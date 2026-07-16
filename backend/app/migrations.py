from __future__ import annotations

import datetime

from sqlalchemy import text

from .database import engine


def _ensure_migrations_table() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR PRIMARY KEY,
                    applied_at TIMESTAMP NOT NULL
                )
                """
            )
        )


def _is_applied(version: str) -> bool:
    with engine.begin() as conn:
        row = conn.execute(text("SELECT version FROM schema_migrations WHERE version = :v"), {"v": version}).first()
        return bool(row)


def _mark_applied(version: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO schema_migrations (version, applied_at) VALUES (:v, :t)"),
            {"v": version, "t": datetime.datetime.now(datetime.timezone.utc)},
        )


def _assert_no_duplicates(table: str, columns: list[str]) -> None:
    cols = ", ".join(columns)
    group = ", ".join(columns)
    with engine.begin() as conn:
        row = conn.execute(
            text(
                f"""
                SELECT {cols}, COUNT(*) AS c
                FROM {table}
                GROUP BY {group}
                HAVING COUNT(*) > 1
                LIMIT 1
                """
            )
        ).first()
        if row:
            raise RuntimeError(f"Duplicate rows exist in {table} for {columns}. Clean data before applying uniqueness.")


def _create_unique_index(index_name: str, table: str, columns: list[str]) -> None:
    cols = ", ".join(columns)
    with engine.begin() as conn:
        conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS {index_name} ON {table} ({cols})"))


def apply_migrations() -> None:
    _ensure_migrations_table()

    version = "0001_unique_indexes"
    if not _is_applied(version):
        _assert_no_duplicates("community_post_likes", ["post_id", "user_id"])
        _assert_no_duplicates("community_post_bookmarks", ["post_id", "user_id"])
        _assert_no_duplicates("favorites", ["user_id", "package_id"])
        _assert_no_duplicates("agency_availability", ["agency_id", "date"])
        _assert_no_duplicates("agency_team_members", ["agency_id", "email"])

        _create_unique_index("uq_community_post_likes_post_user", "community_post_likes", ["post_id", "user_id"])
        _create_unique_index("uq_community_post_bookmarks_post_user", "community_post_bookmarks", ["post_id", "user_id"])
        _create_unique_index("uq_favorites_user_package", "favorites", ["user_id", "package_id"])
        _create_unique_index("uq_agency_availability_agency_date", "agency_availability", ["agency_id", "date"])
        _create_unique_index("uq_agency_team_members_agency_email", "agency_team_members", ["agency_id", "email"])

        _mark_applied(version)


if __name__ == "__main__":
    apply_migrations()

