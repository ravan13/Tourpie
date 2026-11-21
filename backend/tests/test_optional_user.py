"""Focused tests for optional authentication (`get_optional_user`).

Verifies that optional authentication performs the same hardening as required
authentication - JWT signature/expiry, session id (`sid`), session revocation and
expiry, and ban status - while still degrading to `None` so public endpoints stay
anonymously usable.

Run with:
    backend/.venv/Scripts/python.exe tests/test_optional_user.py
"""

import inspect
import sys
import types
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException  # noqa: E402
from app import auth, deps, models  # noqa: E402

EMAIL = "user@example.com"
SESSION_ID = "sess-123"


def make_user(**overrides):
    data = {
        "id": 1,
        "email": EMAIL,
        "role": models.UserRole.USER,
        "is_banned": False,
        "banned_until": None,
        "banned_reason": None,
    }
    data.update(overrides)
    return types.SimpleNamespace(**data)


def make_session(**overrides):
    data = {
        "user_id": 1,
        "session_id": SESSION_ID,
        "revoked_at": None,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    data.update(overrides)
    return types.SimpleNamespace(**data)


class FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._result


class FakeDb:
    """Returns the user row for `User` queries and the session row for `UserSession`.

    A revoked session is reported as absent, mirroring the `revoked_at IS NULL`
    filter used against the database.
    """

    def __init__(self, user=None, session=None):
        self._user = user
        self._session = session
        self.commits = 0

    def query(self, *entities, **kwargs):
        target = entities[0] if entities else None
        if target is models.UserSession:
            if self._session is not None and self._session.revoked_at is not None:
                return FakeQuery(None)
            return FakeQuery(self._session)
        return FakeQuery(self._user)

    def commit(self):
        self.commits += 1


class RaisingDb:
    """Fails if optional authentication touches the database for an anonymous request."""

    def query(self, *args, **kwargs):
        raise AssertionError("anonymous requests must not query the database")


def token(**overrides):
    payload = {"sub": EMAIL, "sid": SESSION_ID, "role": "user"}
    payload.update(overrides)
    return auth.create_access_token(payload, timedelta(minutes=30))


class OptionalUserBase(unittest.TestCase):
    def call(self, auth_token, db):
        return deps.get_optional_user(auth_token, db)


class AnonymousAccessTests(OptionalUserBase):
    def test_missing_token_returns_none_without_database_access(self):
        self.assertIsNone(self.call(None, RaisingDb()))

    def test_empty_token_returns_none_without_database_access(self):
        self.assertIsNone(self.call("", RaisingDb()))

    def test_invalid_signature_returns_none_without_database_access(self):
        self.assertIsNone(self.call("not-a-real-token", RaisingDb()))

    def test_token_without_subject_returns_none(self):
        unsigned = auth.create_access_token({"sid": SESSION_ID, "role": "user"}, timedelta(minutes=5))
        self.assertIsNone(self.call(unsigned, RaisingDb()))


class ValidUserTests(OptionalUserBase):
    def test_valid_token_and_session_returns_user(self):
        user = make_user()
        db = FakeDb(user=user, session=make_session())
        self.assertIs(self.call(token(), db), user)

    def test_token_without_sid_still_resolves_user(self):
        user = make_user()
        db = FakeDb(user=user, session=None)
        self.assertIs(self.call(token(sid=None), db), user)


class RevokedSessionTests(OptionalUserBase):
    def test_revoked_session_returns_none(self):
        user = make_user()
        session = make_session(revoked_at=datetime.now(timezone.utc) - timedelta(minutes=1))
        self.assertIsNone(self.call(token(), FakeDb(user=user, session=session)))

    def test_unknown_session_id_returns_none(self):
        user = make_user()
        self.assertIsNone(self.call(token(sid="does-not-exist"), FakeDb(user=user, session=None)))


class ExpiredSessionTests(OptionalUserBase):
    def test_expired_session_returns_none_and_is_revoked(self):
        user = make_user()
        session = make_session(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
        db = FakeDb(user=user, session=session)
        self.assertIsNone(self.call(token(), db))
        self.assertIsNotNone(session.revoked_at, "expired session must be revoked")
        self.assertEqual(db.commits, 1)

    def test_expired_jwt_returns_none(self):
        expired = auth.create_access_token(
            {"sub": EMAIL, "sid": SESSION_ID, "role": "user"}, timedelta(minutes=-5)
        )
        user = make_user()
        self.assertIsNone(self.call(expired, FakeDb(user=user, session=make_session())))


class BannedUserTests(OptionalUserBase):
    def test_permanent_ban_returns_none(self):
        user = make_user(is_banned=True, banned_until=None)
        self.assertIsNone(self.call(token(), FakeDb(user=user, session=make_session())))

    def test_active_temporary_ban_returns_none(self):
        user = make_user(is_banned=True, banned_until=datetime.now(timezone.utc) + timedelta(days=1))
        self.assertIsNone(self.call(token(), FakeDb(user=user, session=make_session())))

    def test_expired_ban_still_resolves_user(self):
        user = make_user(is_banned=True, banned_until=datetime.now(timezone.utc) - timedelta(days=1))
        db = FakeDb(user=user, session=make_session())
        self.assertIs(self.call(token(), db), user)

    def test_unknown_account_returns_none(self):
        self.assertIsNone(self.call(token(), FakeDb(user=None, session=None)))


class SharedHardeningTests(unittest.TestCase):
    def test_optional_auth_reuses_required_auth_logic(self):
        source = inspect.getsource(deps.get_optional_user)
        self.assertIn("_load_user_from_payload", source)

    def test_optional_auth_never_raises_for_bad_credentials(self):
        for bad_token in (None, "garbage", "a.b.c"):
            self.assertIsNone(deps.get_optional_user(bad_token, FakeDb(user=None, session=None)))

    def test_required_auth_still_rejects_revoked_session(self):
        user = make_user()
        session = make_session(revoked_at=datetime.now(timezone.utc) - timedelta(minutes=1))
        with self.assertRaises(HTTPException) as ctx:
            deps.get_current_user(None, token(), FakeDb(user=user, session=session))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_required_auth_still_rejects_banned_user(self):
        user = make_user(is_banned=True, banned_until=None)
        with self.assertRaises(HTTPException) as ctx:
            deps.get_current_user(None, token(), FakeDb(user=user, session=make_session()))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_required_auth_still_accepts_valid_session(self):
        user = make_user()
        db = FakeDb(user=user, session=make_session())
        self.assertIs(deps.get_current_user(None, token(), db), user)


if __name__ == "__main__":
    unittest.main(verbosity=2)
