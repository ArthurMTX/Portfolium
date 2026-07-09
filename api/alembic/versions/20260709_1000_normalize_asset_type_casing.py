"""normalize asset_type casing/synonyms

Revision ID: 20260709_1000
Revises: 20260708_1200
Create Date: 2026-07-09 10:00:00.000000

Backfills app.crud.assets.normalize_asset_type onto existing rows so that
provider-cased values (e.g. "stock", "etf") collapse onto the canonical
uppercase forms ("EQUITY", "ETF") already used elsewhere, instead of
coexisting as separate distinct values (visible as duplicate options in the
assets list type filter).
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260709_1000"
down_revision: Union[str, None] = "20260708_1200"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None

_SYNONYMS = {
    "STOCK": "EQUITY",
    "MUTUAL FUND": "MUTUAL_FUND",
}


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.text("SELECT DISTINCT asset_type FROM portfolio.assets WHERE asset_type IS NOT NULL")
    ).fetchall()

    for (raw_value,) in rows:
        normalized = raw_value.strip().upper()
        normalized = _SYNONYMS.get(normalized, normalized)
        if normalized == raw_value:
            continue
        connection.execute(
            sa.text(
                "UPDATE portfolio.assets SET asset_type = :normalized WHERE asset_type = :raw_value"
            ),
            {"normalized": normalized, "raw_value": raw_value},
        )


def downgrade() -> None:
    # Casing/synonym normalization is not reversible (original values are lost).
    pass
