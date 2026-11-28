"""Alembic environment for the TourPie backend.

Design notes:
- The database URL is never stored in ``alembic.ini``. It is resolved at runtime
  from the application's single source of truth, ``app.database.build_postgres_url()``.
- Schema metadata comes from ``app.models.Base.metadata`` so migrations always
  reflect the ORM models.
- Importing ``app.database`` / ``app.models`` builds an engine object lazily but
  does NOT open a database connection, so config-only commands (e.g. ``history``,
  ``heads``, ``upgrade --sql``) remain fully offline.
- Alembic is a deploy-time tool and is intentionally never imported by the running
  application (no migration runs during application startup).
"""

from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Ensure the backend root is importable so ``import app`` works regardless of the
# directory Alembic is invoked from.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base, build_postgres_url  # noqa: E402
from app import models  # noqa: E402,F401  (import registers all tables on Base.metadata)

# Alembic Config object providing access to the values in alembic.ini.
config = context.config

# Configure Python logging from alembic.ini when present.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Inject the runtime database URL. Escape '%' so configparser interpolation does
# not misparse percent-encoded credentials returned by build_postgres_url().
config.set_main_option("sqlalchemy.url", build_postgres_url().replace("%", "%%"))

# Target metadata for autogenerate / comparison.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL without a DB connection)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using a live connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
