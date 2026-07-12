"""Drop the unused legacy asset_price_history table.

Revision ID: 20260712_1000
Revises: 20260709_1000
Create Date: 2026-07-12

This migration is destructive. Back up portfolio.asset_price_history before
upgrading if a deployment contains data that must be retained. Downgrade
recreates the schema and indexes, but cannot restore deleted rows.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260712_1000"
down_revision = "20260709_1000"
branch_labels = None
depends_on = None

SCHEMA = "portfolio"
TABLE = "asset_price_history"


def _table_exists() -> bool:
    return sa.inspect(op.get_bind()).has_table(TABLE, schema=SCHEMA)


def upgrade() -> None:
    if _table_exists():
        op.drop_table(TABLE, schema=SCHEMA)


def downgrade() -> None:
    if _table_exists():
        return

    op.create_table(
        TABLE,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("asset_id", sa.Integer(), nullable=False),
        sa.Column("price_date", sa.Date(), nullable=False),
        sa.Column("open_price", sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column("high_price", sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column("low_price", sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column("close_price", sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column("adj_close_price", sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column("volume", sa.BigInteger(), nullable=True),
        sa.Column("currency", sa.String(), server_default="USD", nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["asset_id"], ["portfolio.assets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("asset_id", "price_date", name="uq_asset_price_date"),
        schema=SCHEMA,
    )
    op.create_index("idx_asset_price_history_asset", TABLE, ["asset_id"], schema=SCHEMA)
    op.create_index("idx_asset_price_history_date", TABLE, ["price_date"], schema=SCHEMA)
    op.create_index(
        "idx_asset_price_history_asset_date",
        TABLE,
        ["asset_id", "price_date"],
        schema=SCHEMA,
    )
    op.create_index(
        op.f("ix_portfolio_asset_price_history_id"),
        TABLE,
        ["id"],
        schema=SCHEMA,
    )
