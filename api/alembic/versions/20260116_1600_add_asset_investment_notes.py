"""add asset investment notes

Revision ID: 20260116_1600
Revises: 20260116_1500
Create Date: 2026-01-16 16:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260116_1600"
down_revision: Union[str, None] = "20260116_1500"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    schema_name = "portfolio"
    table_name = "asset_investment_notes"

    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table(table_name, schema=schema_name):
        op.create_table(
            table_name,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("asset_id", sa.Integer(), nullable=False),
            sa.Column("thesis", sa.Text(), nullable=True),
            sa.Column("conviction", sa.String(length=20), nullable=True),
            sa.Column("risks", sa.Text(), nullable=True),
            sa.Column("target_price", sa.Numeric(20, 8), nullable=True),
            sa.Column("target_text", sa.Text(), nullable=True),
            sa.Column("invalidation_thesis", sa.Text(), nullable=True),
            sa.Column("horizon", sa.String(length=20), nullable=True),
            sa.Column("horizon_date", sa.Date(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.CheckConstraint(
                "conviction IS NULL OR conviction IN ('low', 'medium', 'high')",
                name="ck_asset_investment_notes_conviction",
            ),
            sa.CheckConstraint(
                "horizon IS NULL OR horizon IN ('short', 'medium', 'long')",
                name="ck_asset_investment_notes_horizon",
            ),
            sa.ForeignKeyConstraint(["asset_id"], ["portfolio.assets.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["portfolio.users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id",
                "asset_id",
                name="uq_asset_investment_notes_user_asset",
            ),
            schema=schema_name,
        )

    existing_indexes = {
        idx.get("name")
        for idx in inspector.get_indexes(table_name, schema=schema_name)
        if idx.get("name")
    }
    if "idx_asset_investment_notes_user" not in existing_indexes:
        op.create_index(
            "idx_asset_investment_notes_user",
            table_name,
            ["user_id"],
            schema=schema_name,
        )
    if "idx_asset_investment_notes_asset" not in existing_indexes:
        op.create_index(
            "idx_asset_investment_notes_asset",
            table_name,
            ["asset_id"],
            schema=schema_name,
        )
    if "idx_asset_investment_notes_user_asset" not in existing_indexes:
        op.create_index(
            "idx_asset_investment_notes_user_asset",
            table_name,
            ["user_id", "asset_id"],
            schema=schema_name,
        )

    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'update_asset_investment_notes_updated_at'
          ) THEN
            CREATE TRIGGER update_asset_investment_notes_updated_at
              BEFORE UPDATE ON portfolio.asset_investment_notes
              FOR EACH ROW
              EXECUTE FUNCTION portfolio.update_updated_at_column();
          END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    schema_name = "portfolio"
    table_name = "asset_investment_notes"

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name, schema=schema_name):
        return

    op.execute("DROP TRIGGER IF EXISTS update_asset_investment_notes_updated_at ON portfolio.asset_investment_notes")
    op.drop_index("idx_asset_investment_notes_user_asset", table_name=table_name, schema=schema_name)
    op.drop_index("idx_asset_investment_notes_asset", table_name=table_name, schema=schema_name)
    op.drop_index("idx_asset_investment_notes_user", table_name=table_name, schema=schema_name)
    op.drop_table(table_name, schema=schema_name)
