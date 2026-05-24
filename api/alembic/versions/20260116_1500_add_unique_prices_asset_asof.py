"""Add unique constraint for prices asset/asof

Revision ID: 20260116_1500
Revises: 20260116_1400
Create Date: 2026-01-16 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260116_1500"
down_revision: Union[str, None] = "20260116_1400"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


UNIQUE_CONSTRAINT_NAME = "uq_prices_asset_asof"


def upgrade() -> None:
    # Keep the most recently created row for each (asset_id, asof), using id as
    # a deterministic tie-breaker. This preserves the latest fetched/updated
    # price before enforcing database-level idempotence.
    op.execute(
        """
        WITH ranked_prices AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY asset_id, asof
                    ORDER BY created_at DESC NULLS LAST, id DESC
                ) AS rn
            FROM portfolio.prices
        )
        DELETE FROM portfolio.prices p
        USING ranked_prices r
        WHERE p.id = r.id
          AND r.rn > 1
        """
    )

    op.create_unique_constraint(
        UNIQUE_CONSTRAINT_NAME,
        "prices",
        ["asset_id", "asof"],
        schema="portfolio",
    )


def downgrade() -> None:
    op.drop_constraint(
        UNIQUE_CONSTRAINT_NAME,
        table_name="prices",
        schema="portfolio",
        type_="unique",
    )
