"""Focused tests for authentication brute-force protection.

Covers per-account and per-IP attempt limits, temporary lockouts with HTTP 429,
successful-flow preservation and account-enumeration responses for:
  POST /users/login
  POST /users/admin/verify-2fa
  POST /users/reset-password(-phone)
  POST /users/verify-email / /verify-phone

Run with:
    backend/.venv/Scripts/python.exe tests/test_auth_rate_limit.py
"""

import asyncio
import sys
import types
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException  # noqa: E402
from app import auth, models, schemas  # noqa: E402
from app.routers import users  # noqa: E402

GOOD_CODE = "123456"
WRONG_CODE = "000000"
_CODE_HASH = auth.get_password_hash(GOOD_CODE)


class FakeRequest:
    def __init__(self, ip="203.0.113.9", forwarded=None):
        self.headers = {"user-agent": "pytest"}
        if forwarded:
            self.headers["x-forwarded-for"] = forwarded
        self.client = types.SimpleNamespace(host=ip) if ip else None

    async def form(self):
        return {}


class FakeQuery:
    def __init__(self, user):
        self._user = user

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._user


class FakeDb:
    def __init__(self, user=None):
        self._user = user
        self.commits = 0

    def query(self, *args, **kwargs):
        return FakeQuery(self._user)

    def add(self, obj):
        return None

    def commit(self):
        self.commits += 1

    def refresh(self, obj):
        return None


class RaisingDb:
    """Fails if an endpoint touches the database before enforcing the attempt limit."""

    def query(self, *args, **kwargs):
        raise AssertionError("attempt limit must be enforced before any database access")


def make_user(**overrides):
    data = {
        "id": 1,
        "email": "user@example.com",
        "hashed_password": _CODE_HASH,
        "role": models.UserRole.USER,
        "agency_id": None,
        "is_banned": False,
        "banned_until": None,
        "is_email_verified": True,
        "is_phone_verified": True,
        "is_verified": True,
        "auth_provider": "email",
        "last_login_at": None,
        "verification_code_hash": None,
        "verification_expires_at": None,
        "phone_verification_code_hash": None,
        "phone_verification_expires_at": None,
        "password_reset_token_hash": None,
        "password_reset_expires_at": None,
    }
    data.update(overrides)
    return types.SimpleNamespace(**data)


def future(minutes=10):
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def run_login(email, password="wrong-password", request=None, db=None):
    form = types.SimpleNamespace(username=email, password=password)
    return asyncio.run(users.login(request or FakeRequest(), form, db if db is not None else FakeDb()))


class AttemptLimitBase(unittest.TestCase):
    def setUp(self):
        users._attempt_windows.clear()
        users._attempt_lockouts.clear()
        users._attempt_strikes.clear()

    def assert429(self, exc):
        self.assertEqual(exc.status_code, 429, f"expected 429, got {exc.status_code}")
        self.assertIn("Retry-After", exc.headers or {})
        return exc


class AttemptLimitPrimitiveTests(AttemptLimitBase):
    def test_lockout_duration_escalates_and_caps(self):
        request = FakeRequest()
        for _ in range(1):
            users._record_auth_failure(scope="probe", identity="a@example.com", request=request, max_per_account=1)
        with self.assertRaises(HTTPException):
            users._record_auth_failure(scope="probe", identity="a@example.com", request=request, max_per_account=1)
        key = users._attempt_account_key("probe", "a@example.com")
        first = users._attempt_lockouts[key]
        with self.assertRaises(HTTPException):
            users._record_auth_failure(scope="probe", identity="a@example.com", request=request, max_per_account=1)
        second = users._attempt_lockouts[key]
        self.assertGreater(second, first, "repeated lockouts must escalate")
        for _ in range(10):
            try:
                users._record_auth_failure(scope="probe", identity="a@example.com", request=request, max_per_account=1)
            except HTTPException:
                pass
        max_lock = users.AUTH_LOCKOUT_MAX_SECONDS
        remaining = (users._attempt_lockouts[key] - datetime.now(timezone.utc)).total_seconds()
        self.assertLessEqual(remaining, max_lock + 1)

    def test_expired_lockout_is_not_enforced(self):
        key = users._attempt_account_key("probe", "a@example.com")
        users._attempt_lockouts[key] = datetime.now(timezone.utc) - timedelta(seconds=1)
        users._enforce_auth_attempt_limit(scope="probe", identity="a@example.com", request=FakeRequest())

    def test_clear_failures_resets_account_state(self):
        request = FakeRequest()
        users._record_auth_failure(scope="probe", identity="a@example.com", request=request)
        users._clear_auth_failures("probe", "a@example.com")
        key = users._attempt_account_key("probe", "a@example.com")
        self.assertNotIn(key, users._attempt_windows)
        self.assertNotIn(key, users._attempt_lockouts)

    def test_without_client_ip_only_account_is_tracked(self):
        users._record_auth_failure(scope="probe", identity="a@example.com", request=FakeRequest(ip=None))
        keys = list(users._attempt_windows)
        self.assertEqual(len(keys), 1)
        self.assertTrue(keys[0].startswith("probe:account:"))


class LoginBruteForceTests(AttemptLimitBase):
    def test_unknown_account_locked_out_after_max_failures(self):
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT):
            with self.assertRaises(HTTPException) as ctx:
                run_login("nobody@example.com", request=FakeRequest(ip="203.0.113.10"))
            self.assertEqual(ctx.exception.status_code, 401)
        with self.assertRaises(HTTPException) as ctx:
            run_login("nobody@example.com", request=FakeRequest(ip="203.0.113.10"))
        self.assert429(ctx.exception)

    def test_per_ip_limit_applies_across_different_accounts(self):
        request = FakeRequest(ip="203.0.113.11")
        for index in range(users.AUTH_MAX_FAILED_PER_IP):
            with self.assertRaises(HTTPException) as ctx:
                run_login(f"nobody{index}@example.com", request=request)
            self.assertEqual(ctx.exception.status_code, 401)
        with self.assertRaises(HTTPException) as ctx:
            run_login("nobody-final@example.com", request=request)
        self.assert429(ctx.exception)

    def test_lockout_is_checked_before_database_access(self):
        request = FakeRequest(ip="203.0.113.12")
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT + 1):
            try:
                run_login("nobody@example.com", request=request)
            except HTTPException:
                pass
        with self.assertRaises(HTTPException) as ctx:
            run_login("nobody@example.com", request=request, db=RaisingDb())
        self.assert429(ctx.exception)

    def test_successful_login_still_issues_token(self):
        user = make_user()
        db = FakeDb(user=user)
        with patch.object(users, "_issue_access_token_for_user", return_value={"access_token": "t", "token_type": "bearer"}):
            result = run_login("user@example.com", password=GOOD_CODE, request=FakeRequest(), db=db)
        self.assertEqual(result, {"access_token": "t", "token_type": "bearer"})
        self.assertEqual(db.commits, 1)

    def test_successful_login_clears_account_failures(self):
        user = make_user()
        request = FakeRequest(ip="203.0.113.13")
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT - 1):
            with self.assertRaises(HTTPException):
                run_login("user@example.com", password="wrong", request=request, db=FakeDb(user=user))
        with patch.object(users, "_issue_access_token_for_user", return_value={"access_token": "t"}):
            run_login("user@example.com", password=GOOD_CODE, request=request, db=FakeDb(user=user))
        self.assertNotIn(users._attempt_account_key("login", "user@example.com"), users._attempt_windows)


class VerificationCodeBruteForceTests(AttemptLimitBase):
    def test_verify_email_unknown_account_is_not_enum_verifiable(self):
        request = FakeRequest(ip="203.0.113.20")
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT + 1):
            try:
                users.verify_email(request, schemas.UserVerifyEmail(email="nobody@example.com", code=WRONG_CODE), FakeDb(user=None))
                self.fail("expected an error response")
            except HTTPException as exc:
                self.assertIn(exc.status_code, (400, 429))
                if exc.status_code == 400:
                    self.assertEqual(exc.detail, "Invalid or expired verification code")
        with self.assertRaises(HTTPException) as ctx:
            users.verify_email(request, schemas.UserVerifyEmail(email="nobody@example.com", code=WRONG_CODE), RaisingDb())
        self.assert429(ctx.exception)

    def test_verify_email_wrong_code_locked_out(self):
        user = make_user(is_email_verified=False, verification_code_hash=_CODE_HASH, verification_expires_at=future())
        request = FakeRequest(ip="203.0.113.21")
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT):
            with self.assertRaises(HTTPException) as ctx:
                users.verify_email(request, schemas.UserVerifyEmail(email=user.email, code=WRONG_CODE), FakeDb(user=user))
            self.assertEqual(ctx.exception.status_code, 400)
        with self.assertRaises(HTTPException) as ctx:
            users.verify_email(request, schemas.UserVerifyEmail(email=user.email, code=WRONG_CODE), FakeDb(user=user))
        self.assert429(ctx.exception)

    def test_verify_email_success_preserved_and_clears_failures(self):
        user = make_user(is_email_verified=False, verification_code_hash=_CODE_HASH, verification_expires_at=future())
        request = FakeRequest(ip="203.0.113.22")
        with self.assertRaises(HTTPException):
            users.verify_email(request, schemas.UserVerifyEmail(email=user.email, code=WRONG_CODE), FakeDb(user=user))
        result = users.verify_email(request, schemas.UserVerifyEmail(email=user.email, code=GOOD_CODE), FakeDb(user=user))
        self.assertTrue(result.is_email_verified)
        self.assertNotIn(users._attempt_account_key("verify-email", user.email), users._attempt_windows)

    def test_verify_phone_wrong_code_locked_out(self):
        user = make_user(is_phone_verified=False, phone_verification_code_hash=_CODE_HASH, phone_verification_expires_at=future())
        request = FakeRequest(ip="203.0.113.23")
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT):
            with self.assertRaises(HTTPException) as ctx:
                users.verify_phone(request, schemas.UserVerifyPhone(email=user.email, code=WRONG_CODE), FakeDb(user=user))
            self.assertEqual(ctx.exception.status_code, 400)
        with self.assertRaises(HTTPException) as ctx:
            users.verify_phone(request, schemas.UserVerifyPhone(email=user.email, code=WRONG_CODE), FakeDb(user=user))
        self.assert429(ctx.exception)

    def test_reset_password_wrong_code_locked_out(self):
        user = make_user(password_reset_token_hash=_CODE_HASH, password_reset_expires_at=future())
        request = FakeRequest(ip="203.0.113.24")
        payload = schemas.ResetPasswordRequest(email=user.email, code=WRONG_CODE, new_password="StrongPass1")
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT):
            with self.assertRaises(HTTPException) as ctx:
                users.reset_password(request, payload, FakeDb(user=user))
            self.assertIn(ctx.exception.status_code, (400, 429))
            self.assertEqual(ctx.exception.detail, "Invalid or expired reset code")
        with self.assertRaises(HTTPException) as ctx:
            users.reset_password(request, payload, FakeDb(user=user))
        self.assert429(ctx.exception)

    def test_reset_password_unknown_account_same_response(self):
        request = FakeRequest(ip="203.0.113.25")
        payload = schemas.ResetPasswordRequest(email="nobody@example.com", code=WRONG_CODE, new_password="StrongPass1")
        with self.assertRaises(HTTPException) as ctx:
            users.reset_password(request, payload, FakeDb(user=None))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "Invalid or expired reset code")

    def test_reset_password_success_preserved(self):
        user = make_user(password_reset_token_hash=_CODE_HASH, password_reset_expires_at=future())
        request = FakeRequest(ip="203.0.113.26")
        payload = schemas.ResetPasswordRequest(email=user.email, code=GOOD_CODE, new_password="StrongPass1")
        for _ in range(2):
            with self.assertRaises(HTTPException):
                users.reset_password(request, schemas.ResetPasswordRequest(email=user.email, code=WRONG_CODE, new_password="StrongPass1"), FakeDb(user=user))
        result = users.reset_password(request, payload, FakeDb(user=user))
        self.assertEqual(result, {"message": "ok"})
        self.assertTrue(auth.verify_password("StrongPass1", user.hashed_password))
        self.assertIsNone(user.password_reset_token_hash)
        self.assertNotIn(users._attempt_account_key("reset", user.email), users._attempt_windows)


class AdminTwoFactorBruteForceTests(AttemptLimitBase):
    def test_admin_2fa_unknown_email_locked_out(self):
        request = FakeRequest(ip="203.0.113.30")
        payload = schemas.AdminVerify2FARequest(email="nobody@example.com", code=WRONG_CODE)
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT):
            with self.assertRaises(HTTPException) as ctx:
                users.admin_verify_2fa(request, payload, FakeDb(user=None))
            self.assertEqual(ctx.exception.status_code, 401)
        with self.assertRaises(HTTPException) as ctx:
            users.admin_verify_2fa(request, payload, FakeDb(user=None))
        self.assert429(ctx.exception)

    def test_admin_2fa_wrong_code_locked_out_and_success_preserved(self):
        admin = make_user(role=models.UserRole.ADMIN, admin_2fa_code_hash=_CODE_HASH, admin_2fa_expires_at=future())
        request = FakeRequest(ip="203.0.113.31")
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT):
            with self.assertRaises(HTTPException) as ctx:
                users.admin_verify_2fa(request, schemas.AdminVerify2FARequest(email=admin.email, code=WRONG_CODE), FakeDb(user=admin))
            self.assertEqual(ctx.exception.status_code, 400)
        with self.assertRaises(HTTPException) as ctx:
            users.admin_verify_2fa(request, schemas.AdminVerify2FARequest(email=admin.email, code=WRONG_CODE), FakeDb(user=admin))
        self.assert429(ctx.exception)

        users._attempt_lockouts.clear()
        with patch.object(users, "_issue_access_token_for_user", return_value={"access_token": "t"}):
            result = users.admin_verify_2fa(request, schemas.AdminVerify2FARequest(email=admin.email, code=GOOD_CODE), FakeDb(user=admin))
        self.assertEqual(result, {"access_token": "t"})
        self.assertNotIn(users._attempt_account_key("admin2fa", admin.email), users._attempt_windows)


class AdminLoginStartBruteForceTests(AttemptLimitBase):
    """H-5: the admin password step must be throttled before any database access."""

    def run_start(self, email, password, request, db):
        payload = schemas.AdminLoginStartRequest(email=email, password=password)
        return users.admin_login_start(request, payload, db)

    def test_unknown_admin_email_locked_out_after_max_failures(self):
        request = FakeRequest(ip="203.0.113.40")
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT):
            with self.assertRaises(HTTPException) as ctx:
                self.run_start("nobody@example.com", WRONG_CODE, request, FakeDb(user=None))
            self.assertEqual(ctx.exception.status_code, 401)
        with self.assertRaises(HTTPException) as ctx:
            self.run_start("nobody@example.com", WRONG_CODE, request, FakeDb(user=None))
        self.assert429(ctx.exception)

    def test_wrong_password_locked_out_for_known_admin(self):
        admin = make_user(role=models.UserRole.ADMIN)
        request = FakeRequest(ip="203.0.113.41")
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT):
            with self.assertRaises(HTTPException) as ctx:
                self.run_start(admin.email, WRONG_CODE, request, FakeDb(user=admin))
            self.assertEqual(ctx.exception.status_code, 401)
        with self.assertRaises(HTTPException) as ctx:
            self.run_start(admin.email, WRONG_CODE, request, FakeDb(user=admin))
        self.assert429(ctx.exception)

    def test_lockout_is_checked_before_database_access(self):
        request = FakeRequest(ip="203.0.113.42")
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT + 1):
            try:
                self.run_start("nobody@example.com", WRONG_CODE, request, FakeDb(user=None))
            except HTTPException:
                pass
        with self.assertRaises(HTTPException) as ctx:
            self.run_start("nobody@example.com", WRONG_CODE, request, RaisingDb())
        self.assert429(ctx.exception)

    def test_valid_password_on_non_admin_account_is_counted(self):
        user = make_user(role=models.UserRole.USER)
        request = FakeRequest(ip="203.0.113.43")
        for _ in range(users.AUTH_MAX_FAILED_PER_ACCOUNT):
            with self.assertRaises(HTTPException) as ctx:
                self.run_start(user.email, GOOD_CODE, request, FakeDb(user=user))
            self.assertEqual(ctx.exception.status_code, 403)
        with self.assertRaises(HTTPException) as ctx:
            self.run_start(user.email, GOOD_CODE, request, FakeDb(user=user))
        self.assert429(ctx.exception)

    def test_successful_start_preserved_and_clears_failures(self):
        admin = make_user(role=models.UserRole.ADMIN)
        request = FakeRequest(ip="203.0.113.44")
        for _ in range(2):
            with self.assertRaises(HTTPException):
                self.run_start(admin.email, WRONG_CODE, request, FakeDb(user=admin))
        with patch.object(users, "_send_email_or_raise") as sender:
            result = self.run_start(admin.email, GOOD_CODE, request, FakeDb(user=admin))
        self.assertTrue(result.two_factor_required)
        sender.assert_called_once()
        self.assertNotIn(users._attempt_account_key("admin-login", admin.email), users._attempt_windows)

    def test_success_still_issues_two_factor_challenge(self):
        admin = make_user(role=models.UserRole.ADMIN)
        request = FakeRequest(ip="203.0.113.45")
        with patch.object(users, "_send_email_or_raise"):
            result = self.run_start(admin.email, GOOD_CODE, request, FakeDb(user=admin))
        self.assertTrue(result.two_factor_required)
        self.assertIsNotNone(admin.admin_2fa_code_hash)
        self.assertIsNotNone(admin.admin_2fa_expires_at)
        # the password scope and the 2FA scope are tracked independently
        self.assertNotIn(users._attempt_account_key("admin2fa", admin.email), users._attempt_windows)


if __name__ == "__main__":
    unittest.main(verbosity=2)
