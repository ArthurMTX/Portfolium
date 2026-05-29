"""add asset theme classifications

Revision ID: 20260117_1000
Revises: 20260116_1600
Create Date: 2026-01-17 10:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260117_1000"
down_revision: Union[str, None] = "20260116_1600"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    schema_name = "portfolio"
    table_name = "asset_theme_classifications"

    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table(table_name, schema=schema_name):
        op.create_table(
            table_name,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("asset_id", sa.Integer(), nullable=False),
            sa.Column(
                "themes",
                postgresql.JSONB(astext_type=sa.Text()),
                server_default=sa.text("'[]'::jsonb"),
                nullable=False,
            ),
            sa.Column("method", sa.String(length=20), nullable=False),
            sa.Column("model", sa.String(), nullable=True),
            sa.Column("source_hash", sa.String(length=64), nullable=True),
            sa.Column("generated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.CheckConstraint(
                "method IN ('keyword', 'gpt', 'manual')",
                name="ck_asset_theme_classifications_method",
            ),
            sa.ForeignKeyConstraint(["asset_id"], ["portfolio.assets.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("asset_id", name="uq_asset_theme_classifications_asset"),
            schema=schema_name,
        )

    existing_indexes = {
        idx.get("name")
        for idx in inspector.get_indexes(table_name, schema=schema_name)
        if idx.get("name")
    }
    if "idx_asset_theme_classifications_asset" not in existing_indexes:
        op.create_index(
            "idx_asset_theme_classifications_asset",
            table_name,
            ["asset_id"],
            schema=schema_name,
        )
    if "idx_asset_theme_classifications_source_hash" not in existing_indexes:
        op.create_index(
            "idx_asset_theme_classifications_source_hash",
            table_name,
            ["source_hash"],
            schema=schema_name,
        )

    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'update_asset_theme_classifications_updated_at'
          ) THEN
            CREATE TRIGGER update_asset_theme_classifications_updated_at
              BEFORE UPDATE ON portfolio.asset_theme_classifications
              FOR EACH ROW
              EXECUTE FUNCTION portfolio.update_updated_at_column();
          END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    schema_name = "portfolio"
    table_name = "asset_theme_classifications"

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name, schema=schema_name):
        return

    op.execute("DROP TRIGGER IF EXISTS update_asset_theme_classifications_updated_at ON portfolio.asset_theme_classifications")
    op.drop_index("idx_asset_theme_classifications_source_hash", table_name=table_name, schema=schema_name)
    op.drop_index("idx_asset_theme_classifications_asset", table_name=table_name, schema=schema_name)
    op.drop_table(table_name, schema=schema_name)
