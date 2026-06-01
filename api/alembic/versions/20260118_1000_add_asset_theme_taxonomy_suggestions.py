"""add asset theme taxonomy suggestions

Revision ID: 20260118_1000
Revises: 20260117_1000
Create Date: 2026-01-18 10:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260118_1000"
down_revision: Union[str, None] = "20260117_1000"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    schema_name = "portfolio"
    table_name = "asset_theme_taxonomy_suggestions"

    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table(table_name, schema=schema_name):
        op.create_table(
            table_name,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("asset_id", sa.Integer(), nullable=False),
            sa.Column("symbol", sa.String(), nullable=False),
            sa.Column("company_name", sa.String(), nullable=True),
            sa.Column("sector", sa.String(), nullable=True),
            sa.Column("industry", sa.String(), nullable=True),
            sa.Column("summary_hash", sa.String(length=64), nullable=False),
            sa.Column("summary_excerpt", sa.Text(), nullable=True),
            sa.Column("suggested_theme", sa.String(), nullable=False),
            sa.Column(
                "suggested_subthemes",
                postgresql.JSONB(astext_type=sa.Text()),
                server_default=sa.text("'[]'::jsonb"),
                nullable=False,
            ),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("confidence", sa.Numeric(5, 4), nullable=False),
            sa.Column("status", sa.String(length=20), server_default=sa.text("'pending'"), nullable=False),
            sa.Column("reviewer_note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("reviewed_at", sa.DateTime(), nullable=True),
            sa.CheckConstraint(
                "status IN ('pending', 'accepted', 'rejected', 'ignored')",
                name="ck_asset_theme_taxonomy_suggestions_status",
            ),
            sa.ForeignKeyConstraint(["asset_id"], ["portfolio.assets.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "asset_id",
                "summary_hash",
                "suggested_theme",
                name="uq_asset_theme_taxonomy_suggestions_asset_hash_theme",
            ),
            schema=schema_name,
        )

    existing_indexes = {
        idx.get("name")
        for idx in inspector.get_indexes(table_name, schema=schema_name)
        if idx.get("name")
    }
    for index_name, columns in [
        ("idx_asset_theme_taxonomy_suggestions_status", ["status"]),
        ("idx_asset_theme_taxonomy_suggestions_symbol", ["symbol"]),
        ("idx_asset_theme_taxonomy_suggestions_theme", ["suggested_theme"]),
    ]:
        if index_name not in existing_indexes:
            op.create_index(index_name, table_name, columns, schema=schema_name)

    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'update_asset_theme_taxonomy_suggestions_updated_at'
          ) THEN
            CREATE TRIGGER update_asset_theme_taxonomy_suggestions_updated_at
              BEFORE UPDATE ON portfolio.asset_theme_taxonomy_suggestions
              FOR EACH ROW
              EXECUTE FUNCTION portfolio.update_updated_at_column();
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    schema_name = "portfolio"
    table_name = "asset_theme_taxonomy_suggestions"

    op.execute(
        "DROP TRIGGER IF EXISTS update_asset_theme_taxonomy_suggestions_updated_at "
        "ON portfolio.asset_theme_taxonomy_suggestions"
    )
    op.drop_index("idx_asset_theme_taxonomy_suggestions_theme", table_name=table_name, schema=schema_name)
    op.drop_index("idx_asset_theme_taxonomy_suggestions_symbol", table_name=table_name, schema=schema_name)
    op.drop_index("idx_asset_theme_taxonomy_suggestions_status", table_name=table_name, schema=schema_name)
    op.drop_table(table_name, schema=schema_name)
