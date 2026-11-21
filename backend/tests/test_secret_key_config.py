"""Focused tests for JWT SECRET_KEY configuration and production detection.

Verifies that:
  * Production refuses to start when SECRET_KEY is missing, is the development
    default, is an obvious placeholder, or is too weak (never silently falling
    back to a dev secret).
  * Development behaviour is preserved (missing/dev-default -> dev fallback; any
    other value is used unchanged), so existing local setups keep working.
  * No secret is rotated and no JWT claim/token format is touched.

Run with:
    backend/.venv/Scripts/python.exe tests/test_secret_key_config.py
"""

import os
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import auth  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[1]
STRONG_KEY = "8fJ2pQ7wZ1nR4tY6uM0bV3xC5dS9gH2kL7aN4eW8qT1zB6vD0"
AUTO_MADE_WEAK = "abcdef1234567890"  # 16 chars - long enough to look real, but below the floor


def run_import(env_overrides):
    """Import ``app.auth`` in a fresh interpreter and return the CompletedProcess."""
    env = dict(os.environ)
    # Ensure the repo .env cannot leak a competing value (load_dotenv uses override=False,
    # so any key already present here wins).
    env["TOURPIE_ENV"] = ""
    env["ENV"] = ""
    env["ENVIRONMENT"] = "development"
    env["SECRET_KEY"] = ""
    env["MIN_SECRET_KEY_LENGTH"] = "32"
    env["EMAIL_DEBUG_TO_CONSOLE"] = "0"
    env["SMS_DEBUG_TO_CONSOLE"] = "0"
    env["AUTH_DEBUG_DELIVERY"] = "0"
    env["AUTH_DEBUG_OTP"] = "0"
    env.update(env_overrides)
    code = "import app.auth as a; print('SECRET_KEY=' + a.SECRET_KEY)"
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )


class ResolveSecretKeyDevTests(unittest.TestCase):
    """Development path must preserve the existing behaviour exactly."""

    def test_missing_falls_back_to_dev_default(self):
        self.assertEqual(auth.resolve_secret_key(None, is_production=False), auth.DEV_SECRET_KEY)
        self.assertEqual(auth.resolve_secret_key("", is_production=False), auth.DEV_SECRET_KEY)

    def test_dev_default_replaced_by_dev_default(self):
        self.assertEqual(
            auth.resolve_secret_key(auth.DEV_SECRET_KEY, is_production=False), auth.DEV_SECRET_KEY
        )

    def test_custom_dev_value_used_unchanged(self):
        self.assertEqual(auth.resolve_secret_key("my-local-secret", is_production=False), "my-local-secret")

    def test_custom_dev_value_with_whitespace_preserved(self):
        # Regression: a custom development secret must be returned byte-for-byte,
        # including any leading/trailing whitespace (the original code did not strip it).
        raw = "  my-dev-secret-with-spaces  "
        self.assertEqual(auth.resolve_secret_key(raw, is_production=False), raw)

    def test_whitespace_only_falls_back_to_dev_default(self):
        self.assertEqual(auth.resolve_secret_key("   \t\n ", is_production=False), auth.DEV_SECRET_KEY)

    def test_dev_does_not_enforce_strength(self):
        # Even a weak/placeholder value is accepted as-is in development.
        self.assertEqual(auth.resolve_secret_key("changeme", is_production=False), "changeme")
        self.assertEqual(auth.resolve_secret_key("short", is_production=False), "short")


class ResolveSecretKeyProdTests(unittest.TestCase):
    """Production path must fail fast on missing / weak secrets."""

    def test_missing_raises(self):
        with self.assertRaises(RuntimeError) as ctx:
            auth.resolve_secret_key(None, is_production=True)
        self.assertIn("SECRET_KEY", str(ctx.exception))
        with self.assertRaises(RuntimeError):
            auth.resolve_secret_key("   ", is_production=True)

    def test_dev_default_raises(self):
        with self.assertRaises(RuntimeError):
            auth.resolve_secret_key(auth.DEV_SECRET_KEY, is_production=True)

    def test_placeholder_raises(self):
        for placeholder in ("changeme", "secret", "password", "your-secret-key", "tourpie"):
            with self.assertRaises(RuntimeError):
                auth.resolve_secret_key(placeholder, is_production=True)

    def test_too_short_raises(self):
        short_key = "K" * (auth.MIN_PRODUCTION_SECRET_KEY_LENGTH - 1)
        with self.assertRaises(RuntimeError) as ctx:
            auth.resolve_secret_key(short_key, is_production=True)
        self.assertIn("at least", str(ctx.exception))
        self.assertLess(len(AUTO_MADE_WEAK), auth.MIN_PRODUCTION_SECRET_KEY_LENGTH)

    def test_boundary_length(self):
        floor = auth.MIN_PRODUCTION_SECRET_KEY_LENGTH
        self.assertGreaterEqual(floor, 16)
        self.assertEqual(auth.resolve_secret_key("K" * floor, is_production=True), "K" * floor)
        with self.assertRaises(RuntimeError):
            auth.resolve_secret_key("K" * (floor - 1), is_production=True)

    def test_strong_key_accepted(self):
        self.assertEqual(auth.resolve_secret_key(STRONG_KEY, is_production=True), STRONG_KEY)


class ImportTimeStartupTests(unittest.TestCase):
    """The real import (app startup) must honour production detection."""

    def test_production_missing_secret_fails_startup(self):
        result = run_import({"ENVIRONMENT": "production", "SECRET_KEY": ""})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SECRET_KEY", result.stderr)

    def test_production_dev_default_fails_startup(self):
        result = run_import({"ENVIRONMENT": "production", "SECRET_KEY": auth.DEV_SECRET_KEY})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SECRET_KEY", result.stderr)

    def test_production_weak_secret_fails_startup(self):
        result = run_import({"ENVIRONMENT": "production", "SECRET_KEY": AUTO_MADE_WEAK})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SECRET_KEY", result.stderr)

    def test_production_placeholder_fails_startup(self):
        result = run_import({"ENVIRONMENT": "production", "SECRET_KEY": "changeme"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SECRET_KEY", result.stderr)

    def test_production_strong_secret_starts(self):
        result = run_import({"ENVIRONMENT": "production", "SECRET_KEY": STRONG_KEY})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn(f"SECRET_KEY={STRONG_KEY}", result.stdout)

    def test_development_missing_secret_starts_with_dev_default(self):
        result = run_import({"ENVIRONMENT": "development", "SECRET_KEY": ""})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn(f"SECRET_KEY={auth.DEV_SECRET_KEY}", result.stdout)

    def test_development_uses_provided_secret(self):
        result = run_import({"ENVIRONMENT": "development", "SECRET_KEY": "local-dev-secret"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("SECRET_KEY=local-dev-secret", result.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
