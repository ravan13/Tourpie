"""baseline

Empty baseline revision for the existing PostgreSQL schema.

This revision intentionally contains no DDL. It exists solely to record the
starting point of version control for an already-provisioned database, so that
existing deployments can be brought under Alembic management via ``alembic stamp``
without recreating or altering any tables.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-11-29

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op: baseline only. Do not add DDL to this revision."""
    pass


def downgrade() -> None:
    """No-op: baseline only. Do not add DDL to this revision."""
    pass
