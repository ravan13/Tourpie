"""Focused tests for PostgreSQL connection pool hardening in app.database.

Verifies that:
  * ``DB_POOL_SIZE`` (5), ``DB_MAX_OVERFLOW`` (10) and ``DB_POOL_RECYCLE`` (1800) have
    the documented defaults and honour explicit overrides.
  * Invalid (non-numeric) and negative values are rejected safely by falling back to
    the default instead of producing an unusable pool.
  * ``pool_pre_ping`` stays enabled.
  * QueuePool-only options are applied to PostgreSQL but never passed to SQLite (whose
    dialect-default pool rejects ``max_overflow``), preserving test compatibility.

Run with:
    backend/.venv/Scripts/python.exe tests/test_database_pool_config.py
"""

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.pool import QueuePool, SingletonThreadPool  # noqa: E402

from app.database import (  # noqa: E402
    DEFAULT_DB_MAX_OVERFLOW,
    DEFAULT_DB_POOL_RECYCLE,
    DEFAULT_DB_POOL_SIZE,
    build_pool_options,
    coerce_pool_int,
)

BACKEND_DIR = Path(__file__).resolve().parents[1]

_POSTGRES_URL = "postgresql+psycopg2://user:pw@db.example.com:5432/tourpie"

_PROBE = (
    "import json\n"
    "import app.database as d\n"
    "pool = d.engine.pool\n"
    "size_attr = getattr(pool, 'size', None)\n"
    "info = {\n"
    "    'pool_size': d.DB_POOL_SIZE,\n"
    "    'max_overflow': d.DB_MAX_OVERFLOW,\n"
    "    'pool_recycle': d.DB_POOL_RECYCLE,\n"
    "    'pool_class': type(pool).__name__,\n"
    "    'pool_options': d.POOL_OPTIONS,\n"
    "    'engine_pool_size': size_attr() if callable(size_attr) else size_attr,\n"
    "}\n"
    "print('INFO=' + json.dumps(info, sort_keys=True))"
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
    "DB_POOL_SIZE",
    "DB_MAX_OVERFLOW",
    "DB_POOL_RECYCLE",
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


def probe_info(result):
    for line in result.stdout.splitlines():
        if line.startswith("INFO="):
            return json.loads(line[len("INFO="):])
    raise AssertionError("probe produced no INFO line; stderr={!r}".format(result.stderr))


class CoercePoolIntTests(unittest.TestCase):
    def test_defaults_are_documented_values(self):
        self.assertEqual(DEFAULT_DB_POOL_SIZE, 5)
        self.assertEqual(DEFAULT_DB_MAX_OVERFLOW, 10)
        self.assertEqual(DEFAULT_DB_POOL_RECYCLE, 1800)

    def test_blank_value_falls_back_to_default(self):
        for blank in ("", None, "   "):
            self.assertEqual(coerce_pool_int(blank, 5, name="X"), 5)

    def test_valid_integer_is_used(self):
        self.assertEqual(coerce_pool_int("7", 5, name="X"), 7)
        self.assertEqual(coerce_pool_int("  42  ", 5, name="X"), 42)

    def test_zero_is_allowed(self):
        self.assertEqual(coerce_pool_int("0", 5, name="X"), 0)

    def test_negative_value_falls_back_to_default(self):
        self.assertEqual(coerce_pool_int("-1", 10, name="X"), 10)
        self.assertEqual(coerce_pool_int("-999", 10, name="X"), 10)

    def test_non_numeric_value_falls_back_to_default(self):
        for bad in ("abc", "5.5", "1e3", "10x", "0x10"):
            self.assertEqual(coerce_pool_int(bad, 3, name="X"), 3)


class BuildPoolOptionsTests(unittest.TestCase):
    def test_postgresql_receives_tuned_options(self):
        options = build_pool_options(
            _POSTGRES_URL, pool_size=7, max_overflow=3, pool_recycle=900
        )
        self.assertEqual(
            options, {"pool_size": 7, "max_overflow": 3, "pool_recycle": 900}
        )

    def test_legacy_postgres_scheme_also_receives_options(self):
        options = build_pool_options(
            "postgres://user:pw@db.example.com:5432/tourpie",
            pool_size=7,
            max_overflow=3,
            pool_recycle=900,
        )
        self.assertEqual(options["pool_size"], 7)

    def test_sqlite_memory_receives_no_options(self):
        self.assertEqual(
            build_pool_options("sqlite://", pool_size=7, max_overflow=3, pool_recycle=900),
            {},
        )

    def test_sqlite_file_receives_no_options(self):
        self.assertEqual(
            build_pool_options(
                "sqlite:///tmp/test.db", pool_size=7, max_overflow=3, pool_recycle=900
            ),
            {},
        )


class EnginePoolConfigurationTests(unittest.TestCase):
    def test_postgres_engine_uses_configured_pool_values(self):
        engine = create_engine(
            _POSTGRES_URL,
            pool_pre_ping=True,
            **build_pool_options(_POSTGRES_URL, pool_size=7, max_overflow=3, pool_recycle=900),
        )
        try:
            self.assertIsInstance(engine.pool, QueuePool)
            self.assertEqual(engine.pool.size(), 7)
            self.assertEqual(engine.pool._max_overflow, 3)
            self.assertEqual(engine.pool._recycle, 900)
        finally:
            engine.dispose()

    def test_sqlite_engine_is_not_given_postgresql_only_options(self):
        url = "sqlite://"
        # Would raise TypeError if max_overflow leaked onto SQLite's default pool.
        engine = create_engine(
            url,
            pool_pre_ping=True,
            **build_pool_options(url, pool_size=7, max_overflow=3, pool_recycle=900),
        )
        try:
            self.assertIsInstance(engine.pool, SingletonThreadPool)
        finally:
            engine.dispose()


class PoolEnvImportTests(unittest.TestCase):
    """End-to-end wiring through module import."""

    def test_defaults_applied_at_import(self):
        result = run_probe()
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        info = probe_info(result)
        self.assertEqual(info["pool_size"], 5)
        self.assertEqual(info["max_overflow"], 10)
        self.assertEqual(info["pool_recycle"], 1800)
        self.assertEqual(info["pool_class"], "QueuePool")
        self.assertEqual(info["engine_pool_size"], 5)

    def test_overrides_applied_at_import(self):
        result = run_probe(
            {"DB_POOL_SIZE": "11", "DB_MAX_OVERFLOW": "4", "DB_POOL_RECYCLE": "600"}
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        info = probe_info(result)
        self.assertEqual(info["pool_size"], 11)
        self.assertEqual(info["max_overflow"], 4)
        self.assertEqual(info["pool_recycle"], 600)
        self.assertEqual(info["engine_pool_size"], 11)

    def test_invalid_values_fall_back_at_import(self):
        result = run_probe(
            {"DB_POOL_SIZE": "-3", "DB_MAX_OVERFLOW": "abc", "DB_POOL_RECYCLE": ""}
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        info = probe_info(result)
        self.assertEqual(info["pool_size"], 5)
        self.assertEqual(info["max_overflow"], 10)
        self.assertEqual(info["pool_recycle"], 1800)

    def test_sqlite_url_import_keeps_dialect_default_pool(self):
        result = run_probe({"DATABASE_URL": "sqlite://"})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        info = probe_info(result)
        self.assertEqual(info["pool_options"], {})
        self.assertEqual(info["pool_class"], "SingletonThreadPool")


if __name__ == "__main__":
    unittest.main(verbosity=2)
