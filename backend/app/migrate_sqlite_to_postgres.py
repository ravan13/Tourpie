from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Any

import os
from sqlalchemy import MetaData, Table, create_engine, inspect, select, text
from sqlalchemy.engine import Engine

from .database import Base, build_postgres_url
from . import models


def _coerce_value(column: Any, value: Any) -> Any:
    if value is None:
        return None
    try:
        python_type = column.type.python_type
    except Exception:
        python_type = None

    if python_type is bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            v = value.strip().lower()
            if v in ("1", "true", "t", "yes", "y", "on"):
                return True
            if v in ("0", "false", "f", "no", "n", "off"):
                return False
        return bool(value)

    if python_type is date:
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            v = value.strip()
            return date.fromisoformat(v[:10])
        return value

    if python_type is datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            v = value.strip().replace("Z", "+00:00")
            return datetime.fromisoformat(v)
        return value

    return value


def _copy_table(source_engine: Engine, target_engine: Engine, table: Table) -> int:
    src_inspector = inspect(source_engine)
    try:
        src_cols = {c["name"] for c in src_inspector.get_columns(table.name)}
    except Exception:
        src_cols = {c.name for c in table.columns}

    dest_cols = [c for c in table.columns if c.name in src_cols]
    if not dest_cols:
        return 0

    stmt = select(*dest_cols)
    with source_engine.connect() as src_conn:
        rows = src_conn.execute(stmt).mappings().all()

    if not rows:
        return 0

    payload: list[dict[str, Any]] = []
    for row in rows:
        item: dict[str, Any] = {}
        for c in dest_cols:
            item[c.name] = _coerce_value(c, row.get(c.name))
        payload.append(item)

    with target_engine.begin() as dst_conn:
        dst_conn.execute(table.insert(), payload)
    return len(payload)


def _set_sequence(target_engine: Engine, table_name: str, pk: str = "id") -> None:
    stmt = text(
        "SELECT setval(pg_get_serial_sequence(:tbl, :pk), "
        "GREATEST((SELECT COALESCE(MAX(%s), 0) FROM %s), 1), true)" % (pk, table_name)
    )
    with target_engine.begin() as conn:
        conn.execute(stmt, {"tbl": table_name, "pk": pk})


def migrate(sqlite_path: Path, postgres_url: str) -> None:
    if not sqlite_path.exists():
        raise RuntimeError(f"SQLite file not found: {sqlite_path}")

    source_engine = create_engine(f"sqlite:///{sqlite_path.as_posix()}")
    target_engine = create_engine(postgres_url, pool_pre_ping=True)

    Base.metadata.create_all(bind=target_engine)

    meta: MetaData = Base.metadata
    tables = list(meta.sorted_tables)

    with target_engine.connect() as conn:
        for t in tables:
            has_any = conn.execute(text(f"SELECT 1 FROM {t.name} LIMIT 1")).first()
            if has_any:
                raise RuntimeError(f"Target database is not empty (table {t.name} already has data)")

    migrated: dict[str, int] = {}
    for t in tables:
        count = _copy_table(source_engine, target_engine, t)
        migrated[t.name] = count

    for t in tables:
        pk_cols = [c for c in t.columns if c.primary_key]
        if len(pk_cols) == 1 and pk_cols[0].name == "id":
            _set_sequence(target_engine, t.name, "id")

    total_rows = sum(migrated.values())
    print(f"Migration complete. Tables: {len(migrated)} Rows: {total_rows}")
    for name, cnt in migrated.items():
        if cnt:
            print(f"{name}: {cnt}")


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    sqlite_path = Path((os.getenv("SQLITE_PATH") or str(repo_root / "tourpie.db")).strip())
    postgres_url = build_postgres_url()
    migrate(sqlite_path, postgres_url)


if __name__ == "__main__":
    main()
