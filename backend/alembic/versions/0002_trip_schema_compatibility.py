"""trip schema compatibility

Aligns the trip_requests / trip_offers PostgreSQL schema with the current
SQLAlchemy models.

Upgrade:
  * create the nullable columns trip_requests.{budget, currency, meal_preference}
    and trip_offers.{price, notes, expiration_date}. Creation uses explicit
    Alembic add_column and deliberately fails if a column of the same name
    already exists, so an unexpected pre-existing column is never silently
    adopted.
  * backfill each new column from its legacy source, only where the target is
    still NULL, so any value already present is preserved.
  * relax NOT NULL on trip_requests.{destination, ideal_budget, expires_at} and
    trip_offers.{total_price, expires_at}.

The upgrade is additive: no row is deleted and no pre-existing column is
dropped. This revision owns exactly the six columns it creates; the downgrade
removes only those columns and restores the NOT NULL constraints, guarding
against unsafe re-tightening.

Revision ID: 0002_trip_schema_compatibility
Revises: 0001_baseline
Create Date: 2026-11-29

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_trip_schema_compatibility"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Refuse to re-tighten NOT NULL when existing rows would violate it. Emitted as
# static SQL so it renders under offline mode; a violation aborts the downgrade
# loudly instead of failing opaquely or removing data.
_GUARD_NOT_NULL = """
DO $$
DECLARE offenders bigint;
BEGIN
    SELECT COUNT(*) INTO offenders FROM trip_requests
        WHERE destination IS NULL OR ideal_budget IS NULL OR expires_at IS NULL;
    IF offenders > 0 THEN
        RAISE EXCEPTION 'Cannot downgrade - % trip_requests rows have NULL in destination/ideal_budget/expires_at', offenders;
    END IF;
    SELECT COUNT(*) INTO offenders FROM trip_offers
        WHERE total_price IS NULL OR expires_at IS NULL;
    IF offenders > 0 THEN
        RAISE EXCEPTION 'Cannot downgrade - % trip_offers rows have NULL in total_price/expires_at', offenders;
    END IF;
END $$;
"""


def upgrade() -> None:
    # Columns created and owned by this revision. Plain add_column fails if a
    # column with this name already exists, surfacing unexpected schema instead
    # of silently reusing a pre-existing column.
    op.add_column("trip_requests", sa.Column("budget", sa.Float(), nullable=True))
    op.add_column("trip_requests", sa.Column("currency", sa.String(), nullable=True))
    op.add_column("trip_requests", sa.Column("meal_preference", sa.String(), nullable=True))
    op.add_column("trip_offers", sa.Column("price", sa.Float(), nullable=True))
    op.add_column("trip_offers", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column("trip_offers", sa.Column("expiration_date", sa.Date(), nullable=True))

    # Backfill from legacy sources. The "target IS NULL" predicate preserves any
    # value already present in the target column.
    op.execute(
        "UPDATE trip_requests SET budget = ideal_budget "
        "WHERE budget IS NULL AND ideal_budget IS NOT NULL"
    )
    op.execute(
        "UPDATE trip_requests SET currency = budget_currency "
        "WHERE currency IS NULL AND budget_currency IS NOT NULL"
    )
    op.execute(
        "UPDATE trip_requests SET meal_preference = meal_type "
        "WHERE meal_preference IS NULL AND meal_type IS NOT NULL"
    )
    op.execute(
        "UPDATE trip_offers SET price = total_price "
        "WHERE price IS NULL AND total_price IS NOT NULL"
    )
    op.execute(
        "UPDATE trip_offers SET expiration_date = expires_at::date "
        "WHERE expiration_date IS NULL AND expires_at IS NOT NULL"
    )

    # Relax NOT NULL to match the models.
    op.alter_column("trip_requests", "destination", existing_type=sa.String(), nullable=True)
    op.alter_column("trip_requests", "ideal_budget", existing_type=sa.Float(), nullable=True)
    op.alter_column("trip_requests", "expires_at", existing_type=sa.DateTime(), nullable=True)
    op.alter_column("trip_offers", "total_price", existing_type=sa.Float(), nullable=True)
    op.alter_column("trip_offers", "expires_at", existing_type=sa.DateTime(), nullable=True)


def downgrade() -> None:
    # Restore NOT NULL first, but only when it is safe to do so: the guard aborts
    # the whole downgrade if NULL rows would block it, so nothing is lost.
    op.execute(_GUARD_NOT_NULL)

    op.alter_column("trip_requests", "destination", existing_type=sa.String(), nullable=False)
    op.alter_column("trip_requests", "ideal_budget", existing_type=sa.Float(), nullable=False)
    op.alter_column("trip_requests", "expires_at", existing_type=sa.DateTime(), nullable=False)
    op.alter_column("trip_offers", "total_price", existing_type=sa.Float(), nullable=False)
    op.alter_column("trip_offers", "expires_at", existing_type=sa.DateTime(), nullable=False)

    # Remove only the six columns created by this revision. Plain drop_column
    # fails if a column is absent, so it can never remove a column this revision
    # did not create. No pre-existing column or row is touched.
    op.drop_column("trip_requests", "budget")
    op.drop_column("trip_requests", "currency")
    op.drop_column("trip_requests", "meal_preference")
    op.drop_column("trip_offers", "price")
    op.drop_column("trip_offers", "notes")
    op.drop_column("trip_offers", "expiration_date")
