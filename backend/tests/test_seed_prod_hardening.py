"""Focused tests for H-6: production seeding protection and default-admin password hardening.

Verifies that:
  * ``seed_db()`` never creates accounts with hardcoded default credentials in
    production, while legitimate development seeding is preserved.
  * ``create_default_admin()`` validates ``DEFAULT_ADMIN_PASSWORD`` with the existing
    ``auth.validate_strong_password()`` before hashing it.
  * In production the default admin path fails fast with a clear error when the
    password is missing or weak, but still succeeds with a strong password.
  * Development is not broken by the production guard (missing/weak credentials are
    tolerated and simply skipped).

No live database is required: subprocesses patch out the DB layer, and every check
that touches production runs before any DB query.

Run with:
    backend/.venv/Scripts/python.exe tests/test_seed_prod_hardening.py
"""

import os
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BACKEND_DIR = Path(__file__).resolve().parents[1]
STRONG_KEY = "8fJ2pQ7wZ1nR4tY6uM0bV3xC5dS9gH2kL7aN4eW8qT1zB6vD0"
STRONG_PASSWORD = "TourPie2026!"
WEAK_PASSWORD = "admin123"


def run_py(code, env_overrides=None):
    """Run ``code`` in a fresh interpreter with a deterministic, isolated environment."""
    env = dict(os.environ)
    # Neutralise any competing values from the shell or the repo .env file.
    env["TOURPIE_ENV"] = ""
    env["ENV"] = ""
    env["ENVIRONMENT"] = "development"
    env["SECRET_KEY"] = STRONG_KEY
    # Never let startup schema patching touch a real database during tests.
    env["TOURPIE_AUTO_SCHEMA"] = "0"
    env["EMAIL_DEBUG_TO_CONSOLE"] = "0"
    env["SMS_DEBUG_TO_CONSOLE"] = "0"
    env["AUTH_DEBUG_DELIVERY"] = "0"
    env["AUTH_DEBUG_OTP"] = "0"
    env["DEFAULT_ADMIN_EMAIL"] = ""
    env["DEFAULT_ADMIN_PASSWORD"] = ""
    if env_overrides:
        env.update(env_overrides)
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )


def _value(stdout, key):
    for line in stdout.splitlines():
        if line.startswith(key + "="):
            return line[len(key) + 1:]
    return None


SEED_DETECTION_CODE = "import app.seed as s; print('PROD=' + str(s._is_prod))"

# Seed with a fully faked DB layer so no database is required. Demo content is
# created with id=1 on refresh, and every User object that would be persisted is
# recorded so the test can assert on how many accounts were created.
SEED_RUN_CODE = """
import app.seed as seed
from app import models

created = {}

class FakeQuery:
    def __init__(self, model):
        self.model = model
    def filter(self, *args, **kwargs):
        return self
    def first(self):
        return None

class FakeDb:
    def __init__(self):
        self.users = []
        self.total = 0
        created["db"] = self
    def query(self, model):
        return FakeQuery(model)
    def add(self, obj):
        self.total += 1
        if isinstance(obj, models.User):
            self.users.append(obj)
    def commit(self):
        pass
    def refresh(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = 1

seed.SessionLocal = FakeDb
seed.Base.metadata.create_all = lambda *args, **kwargs: None
seed.seed_db()
db = created["db"]
print("USERS=" + str(len(db.users)))
print("ADDED=" + str(db.total))
"""

VALIDATOR_CODE = (
    "import app.auth as a, app.main as m; "
    "print('SAME=' + str(m.validate_strong_password is a.validate_strong_password))"
)


def _admin_bootstrap_code(existing_admin, email, password):
    """Build a snippet that fakes the DB layer and runs ``create_default_admin()``.

    ``existing_admin`` controls whether the admin-existence query finds a row, so the
    bootstrap decision can be exercised without a real database. Passing ``None`` for
    ``email``/``password`` simulates unset DEFAULT_ADMIN_* values.
    """
    email_stmt = (
        'os.environ.pop("DEFAULT_ADMIN_EMAIL", None)'
        if email is None
        else "os.environ['DEFAULT_ADMIN_EMAIL'] = {!r}".format(email)
    )
    password_stmt = (
        'os.environ.pop("DEFAULT_ADMIN_PASSWORD", None)'
        if password is None
        else "os.environ['DEFAULT_ADMIN_PASSWORD'] = {!r}".format(password)
    )
    return """
import os
import app.main as m

__EMAIL_STMT__
__PASSWORD_STMT__

class FakeQuery:
    def filter(self, *args, **kwargs):
        return self
    def params(self, **kwargs):
        return self
    def first(self):
        return object() if __EXISTING_ADMIN__ else None

class FakeDb:
    def query(self, *args, **kwargs):
        return FakeQuery()
    def add(self, obj):
        pass
    def commit(self):
        pass
    def refresh(self, obj):
        pass
    def close(self):
        pass

m.SessionLocal = FakeDb
m.create_default_admin()
print("OK")
""".replace("__EMAIL_STMT__", email_stmt).replace(
        "__PASSWORD_STMT__", password_stmt
    ).replace("__EXISTING_ADMIN__", str(bool(existing_admin)))


class SeedEnvironmentDetectionTests(unittest.TestCase):
    def test_seed_detects_production(self):
        result = run_py(SEED_DETECTION_CODE, {"ENVIRONMENT": "production"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(_value(result.stdout, "PROD"), "True")

    def test_seed_detects_development(self):
        result = run_py(SEED_DETECTION_CODE, {"ENVIRONMENT": "development"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(_value(result.stdout, "PROD"), "False")


class ProductionSeedingProtectionTests(unittest.TestCase):
    def test_seed_does_not_create_demo_accounts_in_production(self):
        result = run_py(SEED_RUN_CODE, {"ENVIRONMENT": "production"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(_value(result.stdout, "USERS"), "0")

    def test_seed_still_seeds_content_in_production(self):
        result = run_py(SEED_RUN_CODE, {"ENVIRONMENT": "production"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        # Content (agency/packages/articles) is still created; only demo accounts are withheld.
        self.assertGreater(int(_value(result.stdout, "ADDED")), 0)

    def test_seed_creates_demo_accounts_in_development(self):
        result = run_py(SEED_RUN_CODE, {"ENVIRONMENT": "development"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        # user@example.com, agency@example.com, admin@example.com
        self.assertEqual(_value(result.stdout, "USERS"), "3")


class DefaultAdminBootstrapTests(unittest.TestCase):
    def test_main_uses_shared_password_validator(self):
        result = run_py(VALIDATOR_CODE, {"ENVIRONMENT": "development"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(_value(result.stdout, "SAME"), "True")

    def test_production_existing_admin_starts_without_credentials(self):
        # An admin already exists, so startup must succeed with no DEFAULT_ADMIN_* set.
        code = _admin_bootstrap_code(existing_admin=True, email=None, password=None)
        result = run_py(code, {"ENVIRONMENT": "production"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("OK", result.stdout)

    def test_production_existing_admin_ignores_weak_password(self):
        # With an admin present, bootstrap is skipped and the weak password is never evaluated.
        code = _admin_bootstrap_code(existing_admin=True, email="admin@example.com", password=WEAK_PASSWORD)
        result = run_py(code, {"ENVIRONMENT": "production"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("OK", result.stdout)

    def test_production_no_admin_missing_credentials_fails_fast(self):
        code = _admin_bootstrap_code(existing_admin=False, email=None, password=None)
        result = run_py(code, {"ENVIRONMENT": "production"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DEFAULT_ADMIN", result.stderr)

    def test_production_no_admin_weak_password_fails_fast(self):
        code = _admin_bootstrap_code(existing_admin=False, email="admin@example.com", password=WEAK_PASSWORD)
        result = run_py(code, {"ENVIRONMENT": "production"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DEFAULT_ADMIN_PASSWORD", result.stderr)

    def test_production_no_admin_strong_password_creates_admin(self):
        code = _admin_bootstrap_code(existing_admin=False, email="admin@example.com", password=STRONG_PASSWORD)
        result = run_py(code, {"ENVIRONMENT": "production"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("OK", result.stdout)

    def test_development_missing_credentials_is_tolerated(self):
        code = _admin_bootstrap_code(existing_admin=False, email=None, password=None)
        result = run_py(code, {"ENVIRONMENT": "development"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("OK", result.stdout)

    def test_development_weak_password_is_skipped(self):
        code = _admin_bootstrap_code(existing_admin=False, email="admin@example.com", password=WEAK_PASSWORD)
        result = run_py(code, {"ENVIRONMENT": "development"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("OK", result.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
