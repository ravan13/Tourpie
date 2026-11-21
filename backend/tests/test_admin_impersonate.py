"""Focused tests for admin impersonation hardening.

Covers:
  - admin-only authorization
  - exact target selection (never silently substituting another account)
  - a real, revocable, session-management-visible UserSession per impersonation token
  - a short configurable TTL
  - audit logging of who impersonated whom

Run with:
    backend/.venv/Scripts/python.exe tests/test_admin_impersonate.py
"""

import sys
import types
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app import auth, deps, models, schemas  # noqa: E402
from app.database import Base  # noqa: E402
from app.routers import users  # noqa: E402

PASSWORD = "StrongPass1"


class FakeRequest:
    def __init__(self, ip="198.51.100.7", user_agent="pytest-agent"):
        self.headers = {"user-agent": user_agent, "x-forwarded-for": ip}
        self.client = types.SimpleNamespace(host=ip)


class ImpersonationBase(unittest.TestCase):
    def setUp(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(engine)
        self.db = Session(bind=engine)
        self.addCleanup(self.db.close)
        self.admin = self.seed_user("admin@example.com", models.UserRole.ADMIN)

    def seed_user(self, email, role=models.UserRole.USER, agency_id=None, created_at=None):
        user = models.User(
            email=email,
            hashed_password=auth.get_password_hash(PASSWORD),
            full_name=email.split("@")[0],
            role=role,
            agency_id=agency_id,
            is_verified=True,
            is_email_verified=True,
        )
        if created_at is not None:
            user.created_at = created_at
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def impersonate(self, actor, body, request=None):
        return users.admin_impersonate(request or FakeRequest(), body, current_user=actor, db=self.db)

    def sessions(self, user_id):
        return (
            self.db.query(models.UserSession)
            .filter(models.UserSession.user_id == user_id)
            .all()
        )

    def audit_rows(self):
        return self.db.query(models.ModerationLog).all()

    def decode(self, response):
        payload = auth.decode_access_token(response["access_token"])
        self.assertIsNotNone(payload, "issued impersonation token must be decodable")
        return payload


class AuthorizationTests(ImpersonationBase):
    def test_non_admin_cannot_impersonate(self):
        member = self.seed_user("member@example.com")
        with self.assertRaises(HTTPException) as ctx:
            self.impersonate(member, schemas.AdminImpersonateRequest(role="user"))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_non_admin_creates_no_session_and_no_audit_row(self):
        member = self.seed_user("member@example.com")
        with self.assertRaises(HTTPException):
            self.impersonate(member, schemas.AdminImpersonateRequest(role="user"))
        self.assertEqual(self.sessions(member.id), [])
        self.assertEqual(self.audit_rows(), [])

    def test_admin_can_impersonate(self):
        target = self.seed_user("customer@example.com")
        result = self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))
        self.assertEqual(result["token_type"], "bearer")
        self.assertEqual(self.decode(result)["sub"], target.email)

    def test_invalid_target_role_rejected(self):
        self.seed_user("customer@example.com")
        with self.assertRaises(HTTPException) as ctx:
            self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="admin"))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(self.audit_rows(), [])


class TargetSelectionTests(ImpersonationBase):
    def test_explicit_user_id_is_respected(self):
        stale = self.seed_user("stale@example.com", created_at=datetime(2024, 1, 1, tzinfo=timezone.utc))
        self.seed_user("newest@example.com", created_at=datetime(2025, 1, 1, tzinfo=timezone.utc))

        result = self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=stale.id))
        payload = self.decode(result)
        self.assertEqual(payload["sub"], stale.email)
        self.assertEqual([s.user_id for s in self.sessions(stale.id)], [stale.id])

    def test_explicit_email_is_respected(self):
        wanted = self.seed_user("wanted@example.com", created_at=datetime(2024, 1, 1, tzinfo=timezone.utc))
        self.seed_user("other@example.com", created_at=datetime(2025, 1, 1, tzinfo=timezone.utc))

        result = self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", email="WANTED@example.com"))
        self.assertEqual(self.decode(result)["sub"], wanted.email)

    def test_unknown_target_is_rejected_not_substituted(self):
        self.seed_user("customer@example.com")
        with self.assertRaises(HTTPException) as ctx:
            self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=999999))
        self.assertEqual(ctx.exception.status_code, 404)
        self.assertEqual(ctx.exception.detail, "Account not found")
        self.assertEqual(self.audit_rows(), [])

    def test_unknown_email_is_rejected(self):
        self.seed_user("customer@example.com")
        with self.assertRaises(HTTPException) as ctx:
            self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", email="nobody@example.com"))
        self.assertEqual(ctx.exception.status_code, 404)

    def test_role_mismatch_is_rejected(self):
        agency_user = self.seed_user("agency@example.com", role=models.UserRole.AGENCY, agency_id=7)
        with self.assertRaises(HTTPException) as ctx:
            self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=agency_user.id))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "Account does not match the requested role")
        self.assertEqual(self.sessions(agency_user.id), [])

    def test_preview_fallback_selects_latest_account_of_requested_role(self):
        self.seed_user("old@example.com", created_at=datetime(2024, 1, 1, tzinfo=timezone.utc))
        newest = self.seed_user("new@example.com", created_at=datetime(2025, 1, 1, tzinfo=timezone.utc))

        result = self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user"))
        self.assertEqual(self.decode(result)["sub"], newest.email)

    def test_preview_fallback_never_picks_a_different_role(self):
        self.seed_user("agency@example.com", role=models.UserRole.AGENCY, agency_id=7, created_at=datetime(2025, 1, 1, tzinfo=timezone.utc))
        member = self.seed_user("member@example.com", created_at=datetime(2024, 1, 1, tzinfo=timezone.utc))

        result = self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user"))
        self.assertEqual(self.decode(result)["sub"], member.email)

    def test_no_eligible_account_returns_404(self):
        with self.assertRaises(HTTPException) as ctx:
            self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="agency"))
        self.assertEqual(ctx.exception.status_code, 404)


class SessionLifecycleTests(ImpersonationBase):
    def test_every_impersonation_creates_a_session(self):
        target = self.seed_user("customer@example.com")
        first = self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))
        second = self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))

        sessions = self.sessions(target.id)
        self.assertEqual(len(sessions), 2)
        self.assertEqual(
            {s.session_id for s in sessions},
            {self.decode(first)["sid"], self.decode(second)["sid"]},
        )

    def test_session_belongs_to_target_and_is_revocable(self):
        target = self.seed_user("customer@example.com")
        session_id = self.decode(
            self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))
        )["sid"]

        session = self.db.query(models.UserSession).filter(models.UserSession.session_id == session_id).first()
        self.assertIsNotNone(session)
        self.assertEqual(session.user_id, target.id)
        self.assertIsNone(session.revoked_at)
        self.assertEqual(session.auth_provider, "impersonation")

    def test_ttl_is_short_and_configurable(self):
        target = self.seed_user("customer@example.com")
        now = datetime.now(timezone.utc)

        default_response = self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))
        default_exp = datetime.fromtimestamp(self.decode(default_response)["exp"], timezone.utc)
        self.assertLessEqual(default_exp, now + timedelta(minutes=users.IMPERSONATION_TOKEN_EXPIRE_MINUTES + 1))
        self.assertLessEqual(users.IMPERSONATION_TOKEN_EXPIRE_MINUTES, 60)

        with patch.object(users, "IMPERSONATION_TOKEN_EXPIRE_MINUTES", 3):
            short_response = self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))
        short_exp = datetime.fromtimestamp(self.decode(short_response)["exp"], timezone.utc)
        self.assertLessEqual(short_exp, datetime.now(timezone.utc) + timedelta(minutes=3))

    def test_session_expiry_tracks_the_token_ttl(self):
        target = self.seed_user("customer@example.com")
        session_id = self.decode(
            self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))
        )["sid"]
        session = self.db.query(models.UserSession).filter(models.UserSession.session_id == session_id).first()
        expires_at = session.expires_at if session.expires_at.tzinfo else session.expires_at.replace(tzinfo=timezone.utc)
        delta = (expires_at - datetime.now(timezone.utc)).total_seconds()
        self.assertGreater(delta, 0)
        self.assertLessEqual(delta, users.IMPERSONATION_TOKEN_EXPIRE_MINUTES * 60)


class RevocationTests(ImpersonationBase):
    def test_impersonation_token_works_then_stops_after_revocation(self):
        target = self.seed_user("customer@example.com")
        response = self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))
        token = response["access_token"]
        payload = self.decode(response)

        self.assertEqual(deps.get_current_user(None, token, self.db).id, target.id)

        session_id = payload["sid"]
        revoked = users.revoke_my_session(
            session_id,
            current_user=target,
            payload=payload,
            db=self.db,
        )
        self.assertTrue(revoked["revoked_current"])

        with self.assertRaises(HTTPException) as ctx:
            deps.get_current_user(None, token, self.db)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_impersonation_session_is_visible_in_session_management(self):
        target = self.seed_user("customer@example.com")
        response = self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))
        payload = self.decode(response)

        listed = users.list_my_sessions(current_user=target, payload=payload, db=self.db)
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["session_id"], payload["sid"])
        self.assertEqual(listed[0]["auth_provider"], "impersonation")
        self.assertTrue(listed[0]["is_current"])

    def test_impersonation_session_is_not_attached_to_the_admin(self):
        target = self.seed_user("customer@example.com")
        self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))
        self.assertEqual(self.sessions(self.admin.id), [])


class AuditLogTests(ImpersonationBase):
    def test_records_who_impersonated_whom(self):
        target = self.seed_user("customer@example.com")
        payload = self.decode(
            self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))
        )

        rows = self.audit_rows()
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row.reason, "admin_impersonate")
        self.assertEqual(row.action, "impersonated")
        self.assertEqual(row.entity_type, "user")
        self.assertEqual(row.entity_id, target.id)
        self.assertEqual(row.user_id, target.id)
        self.assertEqual(row.reviewed_by_user_id, self.admin.id)
        self.assertEqual(row.reporter_user_id, self.admin.id)
        self.assertIn(self.admin.email, row.note)
        self.assertIn(target.email, row.note)
        self.assertIn(payload["sid"], row.note)

    def test_records_one_row_per_impersonation(self):
        target = self.seed_user("customer@example.com")
        self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))
        self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=target.id))
        self.assertEqual(len(self.audit_rows()), 2)

    def test_denied_impersonation_is_not_audited_as_success(self):
        with self.assertRaises(HTTPException):
            self.impersonate(self.admin, schemas.AdminImpersonateRequest(role="user", user_id=424242))
        self.assertEqual(self.audit_rows(), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
