"""unique indexes for community / favorites / agency tables

Adds the five unique indexes that the retired ``app/migrations.py`` version
``0001_unique_indexes`` defined but was never applied:

  * uq_community_post_likes_post_user      -> community_post_likes(post_id, user_id)
  * uq_community_post_bookmarks_post_user  -> community_post_bookmarks(post_id, user_id)
  * uq_favorites_user_package              -> favorites(user_id, package_id)
  * uq_agency_availability_agency_date     -> agency_availability(agency_id, date)
  * uq_agency_team_members_agency_email    -> agency_team_members(agency_id, email)

Upgrade:
  * runs a per-index duplicate pre-check that raises a clear exception when a
    duplicate key combination exists, so the migration fails loudly instead of
    aborting opaquely;
  * creates each index with a plain CREATE UNIQUE INDEX (no IF NOT EXISTS), so
    an index that already exists is reported rather than silently accepted.

Downgrade drops exactly these five indexes, nothing else.

Revision ID: 0003_unique_indexes
Revises: 0002_trip_schema_compatibility
Create Date: 2026-11-29

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_unique_indexes"
down_revision: Union[str, None] = "0002_trip_schema_compatibility"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXES = (
    ("uq_community_post_likes_post_user", "community_post_likes", ["post_id", "user_id"]),
    ("uq_community_post_bookmarks_post_user", "community_post_bookmarks", ["post_id", "user_id"]),
    ("uq_favorites_user_package", "favorites", ["user_id", "package_id"]),
    ("uq_agency_availability_agency_date", "agency_availability", ["agency_id", "date"]),
    ("uq_agency_team_members_agency_email", "agency_team_members", ["agency_id", "email"]),
)


def _duplicate_guard(table: str, columns: list, index_name: str) -> str:
    """Static SQL that aborts the migration when duplicate key combinations exist.

    Rendered as a DO block so it also emits under offline (--sql) mode.
    """
    quoted_cols = ", ".join('"%s"' % c for c in columns)
    label = ", ".join(columns)
    return (
        "DO $$\n"
        "DECLARE offenders bigint;\n"
        "BEGIN\n"
        "    SELECT COUNT(*) INTO offenders FROM (\n"
        '        SELECT 1 FROM "%s" GROUP BY %s HAVING COUNT(*) > 1\n'
        "    ) dup;\n"
        "    IF offenders > 0 THEN\n"
        "        RAISE EXCEPTION 'Cannot create unique index %s: %% duplicate group(s) on %s(%s)', offenders;\n"
        "    END IF;\n"
        "END $$;"
        % (table, quoted_cols, index_name, table, label)
    )


def upgrade() -> None:
    for index_name, table, columns in INDEXES:
        # Fail loudly if the data would violate the new uniqueness. The guard
        # only reads data; it never modifies a row.
        op.execute(_duplicate_guard(table, columns, index_name))
        op.create_index(index_name, table, columns, unique=True)


def downgrade() -> None:
    # Drop only the five indexes created by this revision. Plain drop_index
    # fails if an index is absent, so it never removes an unrelated index.
    for index_name, table, _columns in INDEXES:
        op.drop_index(index_name, table_name=table)
