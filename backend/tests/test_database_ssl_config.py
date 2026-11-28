"""Focused tests for PostgreSQL SSL configuration in app.database.

Verifies that:
  * ``DATABASE_SSLMODE`` defaults to ``prefer`` in development and ``require`` in
    production, and that an explicit value overrides the environment default.
  * Only known libpq sslmode tokens are accepted; anything else fails fast.
  * ``DATABASE_SSLROOTCERT`` is forwarded for certificate verification.
  * An ``sslmode`` already present in ``DATABASE_URL`` is preserved (SQLAlchemy lets
    ``connect_args`` win over URL query parameters, so it must not be overridden).
  * A configuration failure never leaks credentials or the full connection URL.

Run with:
    backend/.venv/Scripts/python.exe tests/test_database_ssl_config.py
"""

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import (  # noqa: E402
    ALLOWED_DATABASE_SSLMODES,
    build_connect_args,
    default_database_sslmode,
    resolve_database_sslmode,
)

BACKEND_DIR = Path(__file__).resolve().parents[1]

_PROBE = (
    "import json\n"
    "import app.database as d\n"
    "print('ARGS=' + json.dumps(d.DATABASE_CONNECT_ARGS, sort_keys=True))"
)

# Pinned so a developer's .env or shell cannot influence the probe: dotenv loads with
# ``override=False``, so any key already present here wins.
_PINNED_KEYS = (
    "TOURPIE_ENV",
    "ENVIRONMENT",
    "ENV",
    "DATABASE_URL",
    "DATABASE_SSLMODE",
    "DATABASE_SSLROOTCERT",
)


def run_probe(env_overrides=None):
    """Import app.database in a fresh interpreter with a deterministic environment."""
    env = dict(os.environ)
    for key in _PINNED_KEYS:
        env[key] = ""
    env["ENV"] = "development"
    if env_overrides:
        env.update(env_overrides)
    return subprocess.run(
        [sys.executable, "-c", _PROBE],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )


def probe_args(result):
    for line in result.stdout.splitlines():
        if line.startswith("ARGS="):
            return json.loads(line[len("ARGS="):])
    raise AssertionError("probe produced no ARGS line; stderr={!r}".format(result.stderr))


class DefaultSslmodeTests(unittest.TestCase):
    def test_development_default_is_prefer(self):
        self.assertEqual(default_database_sslmode(False), "prefer")
        self.assertEqual(resolve_database_sslmode(None, is_production=False), "prefer")
        self.assertEqual(resolve_database_sslmode("", is_production=False), "prefer")
        self.assertEqual(resolve_database_sslmode("   ", is_production=False), "prefer")

    def test_production_default_is_require(self):
        self.assertEqual(default_database_sslmode(True), "require")
        self.assertEqual(resolve_database_sslmode(None, is_production=True), "require")
        self.assertEqual(resolve_database_sslmode("", is_production=True), "require")


class ExplicitSslmodeTests(unittest.TestCase):
    def test_explicit_value_overrides_development_default(self):
        self.assertEqual(
            resolve_database_sslmode("verify-full", is_production=False), "verify-full"
        )

    def test_explicit_value_overrides_production_default(self):
        self.assertEqual(resolve_database_sslmode("disable", is_production=True), "disable")

    def test_value_is_normalized(self):
        self.assertEqual(resolve_database_sslmode("  REQUIRE  ", is_production=False), "require")

    def test_all_allowed_modes_are_accepted(self):
        for mode in ALLOWED_DATABASE_SSLMODES:
            self.assertEqual(resolve_database_sslmode(mode, is_production=True), mode)


class InvalidSslmodeTests(unittest.TestCase):
    def test_unknown_value_raises(self):
        with self.assertRaises(ValueError):
            resolve_database_sslmode("bogus", is_production=True)

    def test_error_message_names_the_allowed_modes(self):
        with self.assertRaises(ValueError) as ctx:
            resolve_database_sslmode("bogus", is_production=False)
        message = str(ctx.exception)
        self.assertIn("bogus", message)
        for mode in ALLOWED_DATABASE_SSLMODES:
            self.assertIn(mode, message)


class BuildConnectArgsTests(unittest.TestCase):
    def test_sslmode_included_when_set(self):
        self.assertEqual(build_connect_args(sslmode="require"), {"sslmode": "require"})

    def test_sslmode_omitted_when_unset(self):
        self.assertEqual(build_connect_args(), {})

    def test_sslrootcert_included_when_set(self):
        self.assertEqual(
            build_connect_args(sslmode="verify-full", sslrootcert="/etc/ssl/root.crt"),
            {"sslmode": "verify-full", "sslrootcert": "/etc/ssl/root.crt"},
        )

    def test_sslrootcert_omitted_when_blank(self):
        self.assertEqual(
            build_connect_args(sslmode="require", sslrootcert="   "), {"sslmode": "require"}
        )

    def test_sslrootcert_is_stripped(self):
        self.assertEqual(
            build_connect_args(sslrootcert="  /certs/root.crt  "),
            {"sslrootcert": "/certs/root.crt"},
        )


class DatabaseSslImportTests(unittest.TestCase):
    """End-to-end wiring through module import (mirrors the resolver's precedence)."""

    def test_development_import_defaults_to_prefer(self):
        result = run_probe()
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(probe_args(result), {"sslmode": "prefer"})

    def test_production_import_defaults_to_require(self):
        result = run_probe({"TOURPIE_ENV": "production"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(probe_args(result), {"sslmode": "require"})

    def test_explicit_sslmode_overrides_environment_default(self):
        result = run_probe({"DATABASE_SSLMODE": "verify-full"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(probe_args(result)["sslmode"], "verify-full")

    def test_sslrootcert_is_passed_through(self):
        result = run_probe({"DATABASE_SSLROOTCERT": "/etc/ssl/root.crt"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(probe_args(result)["sslrootcert"], "/etc/ssl/root.crt")

    def test_url_sslmode_is_not_overridden(self):
        result = run_probe(
            {"DATABASE_URL": "postgres://u:p@db.example.com:5432/tourpie?sslmode=verify-full"}
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertNotIn("sslmode", probe_args(result))

    def test_explicit_sslmode_wins_over_url_sslmode(self):
        result = run_probe(
            {
                "DATABASE_URL": "postgres://u:p@db.example.com:5432/tourpie?sslmode=disable",
                "DATABASE_SSLMODE": "verify-full",
            }
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(probe_args(result)["sslmode"], "verify-full")

    def test_invalid_sslmode_fails_import(self):
        result = run_probe({"DATABASE_SSLMODE": "bogus"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DATABASE_SSLMODE", result.stderr)

    def test_configuration_failure_never_leaks_credentials_or_url(self):
        secret = "sup3r-s3cret-password"
        url = "postgres://user:{}@db.example.com:5432/tourpie".format(secret)
        result = run_probe({"DATABASE_URL": url, "DATABASE_SSLMODE": "bogus"})
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(secret, result.stderr)
        self.assertNotIn(url, result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
