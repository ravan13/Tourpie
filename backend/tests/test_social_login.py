"""Focused regression tests for the disabled social-login endpoint.

Security context: ``POST /users/social-login`` previously trusted a client-supplied
email address, auto-verified the account and issued a full session without verifying
any Google/Apple ID token. The endpoint is now disabled (HTTP 501) until real token
verification (signature, issuer, audience, nonce, expiry) is implemented.

Run with:
    backend/.venv/Scripts/python.exe tests/test_social_login.py
"""

import inspect
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException  # noqa: E402
from app import schemas  # noqa: E402
from app.routers import users  # noqa: E402

EXPECTED_STATUS = 501


class _NoDbAccess:
    """Fails loudly if the disabled handler touches the database."""

    def __getattr__(self, name):
        raise AssertionError(f"social_login must not use the database (attempted '{name}')")


def _call(**payload_kwargs) -> HTTPException:
    payload = schemas.SocialLoginRequest(**payload_kwargs)
    with patch.object(
        users,
        "_issue_access_token_for_user",
        side_effect=AssertionError("social_login must not issue a session"),
    ):
        try:
            users.social_login(None, payload, _NoDbAccess())
        except HTTPException as exc:
            return exc
    raise AssertionError("social_login returned instead of raising HTTPException")


class SocialLoginDisabledTests(unittest.TestCase):
    def test_missing_provider_token_is_rejected(self):
        """Request carrying only an email (no provider token at all) is rejected."""
        exc = _call(provider="google", email="attacker@example.com")
        self.assertEqual(exc.status_code, EXPECTED_STATUS)

    def test_forged_email_for_existing_account_is_rejected(self):
        """Claiming an arbitrary victim email must not produce a session."""
        exc = _call(
            provider="google",
            email="victim@example.com",
            full_name="Victim",
            remember_me=True,
        )
        self.assertEqual(exc.status_code, EXPECTED_STATUS)

    def test_forged_id_token_is_rejected(self):
        """A forged/attacker-supplied id_token gains nothing: still rejected."""
        exc = _call(
            provider="apple",
            email="victim@example.com",
            id_token="eyJhbGciOiJub25lIn0.forged.payload",
            credential="forged-credential",
        )
        self.assertEqual(exc.status_code, EXPECTED_STATUS)

    def test_neither_db_lookup_nor_session_created(self):
        """Unknown database access raises; a 501 proves no lookup/add/commit happened."""
        exc = _call(provider="google", email="brand-new@example.com")
        self.assertEqual(exc.status_code, EXPECTED_STATUS)

    def test_message_is_user_safe(self):
        exc = _call(provider="google", email="victim@example.com")
        detail = str(exc.detail).lower()
        for forbidden in ("token", "session", "hash", "secret", "traceback"):
            self.assertNotIn(forbidden, detail)

    def test_handler_never_reads_client_email(self):
        """Source-level guarantee: client email is not read, no session, no DB writes."""
        source = inspect.getsource(users.social_login)
        for forbidden in (
            "payload.email",
            "_issue_access_token_for_user",
            "db.add(",
            "db.commit(",
            "is_email_verified",
            "is_verified",
        ):
            self.assertNotIn(forbidden, source)


class RoutingUnchangedTests(unittest.TestCase):
    """The route must stay registered so clients receive a clean 501, not a 404."""

    def _find_route(self, path: str, method: str):
        for route in users.router.routes:
            if getattr(route, "path", None) == path and method.upper() in getattr(route, "methods", set()):
                return route
        return None

    def test_social_login_route_still_registered_as_post(self):
        route = self._find_route("/social-login", "POST")
        self.assertIsNotNone(route, "POST /social-login route is missing")
        self.assertIs(route.endpoint, users.social_login)

    def test_email_password_login_route_preserved(self):
        self.assertIsNotNone(self._find_route("/login", "POST"), "POST /login route is missing")

    def test_refresh_route_preserved(self):
        self.assertIsNotNone(self._find_route("/refresh", "POST"), "POST /refresh route is missing")


if __name__ == "__main__":
    unittest.main(verbosity=2)
