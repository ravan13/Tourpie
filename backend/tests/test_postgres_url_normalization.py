"""Focused tests for PostgreSQL URL scheme normalization in app.database.

Managed providers (Railway, Heroku, Render) commonly inject ``postgres://`` or
``postgresql://`` URLs without a driver. SQLAlchemy 2.0 rejects the legacy
``postgres://`` scheme, so ``build_postgres_url()`` must rewrite both plain
schemes to ``postgresql+psycopg2://`` while preserving credentials, host, port,
database and query parameters, and leaving driver-qualified URLs untouched.

Run with:
    backend/.venv/Scripts/python.exe tests/test_postgres_url_normalization.py
"""

import contextlib
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import build_postgres_url  # noqa: E402

_DB_KEYS = (
    "DATABASE_URL",
    "DATABASE_HOST",
    "DATABASE_PORT",
    "DATABASE_NAME",
    "DATABASE_USER",
    "DATABASE_PASSWORD",
)


@contextlib.contextmanager
def db_env(**overrides):
    """Run a block with the DATABASE_* environment reset to only ``overrides``."""
    saved = {key: os.environ.get(key) for key in _DB_KEYS}
    for key in _DB_KEYS:
        os.environ.pop(key, None)
    os.environ.update({key: value for key, value in overrides.items()})
    try:
        yield
    finally:
        for key, value in saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


class NormalizePostgresSchemeTests(unittest.TestCase):
    def test_legacy_postgres_scheme_is_normalized(self):
        with db_env(DATABASE_URL="postgres://user:secret@db.example.com:5432/tourpie"):
            self.assertEqual(
                build_postgres_url(),
                "postgresql+psycopg2://user:secret@db.example.com:5432/tourpie",
            )

    def test_plain_postgresql_scheme_is_normalized(self):
        with db_env(DATABASE_URL="postgresql://user:secret@db.example.com:6543/tourpie"):
            self.assertEqual(
                build_postgres_url(),
                "postgresql+psycopg2://user:secret@db.example.com:6543/tourpie",
            )

    def test_existing_psycopg2_url_is_unchanged(self):
        url = "postgresql+psycopg2://user:secret@db.example.com:5432/tourpie"
        with db_env(DATABASE_URL=url):
            self.assertEqual(build_postgres_url(), url)

    def test_other_driver_qualified_url_is_unchanged(self):
        url = "postgresql+psycopg://user:secret@db.example.com:5432/tourpie"
        with db_env(DATABASE_URL=url):
            self.assertEqual(build_postgres_url(), url)

    def test_credentials_host_port_db_and_query_are_preserved(self):
        url = (
            "postgres://u%40corp:p%3As%2Fw@db.example.com:5432/tourpie"
            "?sslmode=require&options=-c%20search_path%3Dpublic"
        )
        with db_env(DATABASE_URL=url):
            self.assertEqual(
                build_postgres_url(),
                "postgresql+psycopg2://u%40corp:p%3As%2Fw@db.example.com:5432/tourpie"
                "?sslmode=require&options=-c%20search_path%3Dpublic",
            )

    def test_query_parameters_are_preserved_for_plain_scheme(self):
        url = "postgresql://user:pw@db.example.com:5432/tourpie?sslmode=require&connect_timeout=10"
        with db_env(DATABASE_URL=url):
            self.assertEqual(
                build_postgres_url(),
                "postgresql+psycopg2://user:pw@db.example.com:5432/tourpie?sslmode=require&connect_timeout=10",
            )

    def test_scheme_detection_is_case_insensitive(self):
        with db_env(DATABASE_URL="POSTGRES://user:secret@db.example.com:5432/tourpie"):
            self.assertEqual(
                build_postgres_url(),
                "postgresql+psycopg2://user:secret@db.example.com:5432/tourpie",
            )

    def test_url_takes_precedence_over_database_parts(self):
        with db_env(
            DATABASE_URL="postgres://a:b@real.example.com:5432/real",
            DATABASE_HOST="ignored",
            DATABASE_NAME="ignored",
            DATABASE_USER="ignored",
            DATABASE_PASSWORD="ignored",
        ):
            self.assertEqual(
                build_postgres_url(),
                "postgresql+psycopg2://a:b@real.example.com:5432/real",
            )

    def test_blank_url_falls_back_to_database_parts(self):
        with db_env(
            DATABASE_URL="   ",
            DATABASE_HOST="parts.example.com",
            DATABASE_PORT="6000",
            DATABASE_NAME="partsdb",
            DATABASE_USER="partsuser",
            DATABASE_PASSWORD="partspass",
        ):
            self.assertEqual(
                build_postgres_url(),
                "postgresql+psycopg2://partsuser:partspass@parts.example.com:6000/partsdb",
            )

    def test_fallback_is_unchanged_when_password_is_missing(self):
        with db_env(
            DATABASE_HOST="parts.example.com",
            DATABASE_PORT="6000",
            DATABASE_NAME="partsdb",
            DATABASE_USER="partsuser",
        ):
            self.assertEqual(
                build_postgres_url(),
                "postgresql+psycopg2://partsuser@parts.example.com:6000/partsdb",
            )

    def test_fallback_percent_encodes_special_characters(self):
        with db_env(
            DATABASE_HOST="parts.example.com",
            DATABASE_PORT="5432",
            DATABASE_NAME="partsdb",
            DATABASE_USER="partsuser",
            DATABASE_PASSWORD="p@ss:w/rd",
        ):
            self.assertEqual(
                build_postgres_url(),
                "postgresql+psycopg2://partsuser:p%40ss%3Aw%2Frd@parts.example.com:5432/partsdb",
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
