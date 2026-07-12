"""add asset theme classifier provenance

Revision ID: 20260119_1000
Revises: 20260118_1000
Create Date: 2026-01-19 10:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260119_1000"
down_revision: Union[str, None] = "20260118_1000"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    schema_name = "portfolio"
    table_name = "asset_theme_classifications"

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name, schema=schema_name):
        return

    existing_columns = {
        column.get("name")
        for column in inspector.get_columns(table_name, schema=schema_name)
        if column.get("name")
    }

    if "source" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("source", sa.String(length=20), nullable=True),
            schema=schema_name,
        )
    if "model_name" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("model_name", sa.String(), nullable=True),
            schema=schema_name,
        )

    op.execute(
        """
        UPDATE portfolio.asset_theme_classifications
        SET
          source = CASE
            WHEN method = 'manual' THEN 'manual'
            WHEN method IN ('gpt', 'llm') THEN 'gemini'
            ELSE 'gemini'
          END,
          model_name = COALESCE(model_name, model)
        WHERE source IS NULL OR model_name IS NULL;
        """
    )

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.alter_column(
            table_name,
            "source",
            nullable=False,
            server_default=sa.text("'gemini'"),
            schema=schema_name,
        )
        op.create_check_constraint(
            "ck_asset_theme_classifications_source",
            table_name,
            "source IN ('minilm', 'gemini', 'manual')",
            schema=schema_name,
        )


def downgrade() -> None:
    schema_name = "portfolio"
    table_name = "asset_theme_classifications"

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name, schema=schema_name):
        return

    if bind.dialect.name == "postgresql":
        op.drop_constraint(
            "ck_asset_theme_classifications_source",
            table_name,
            schema=schema_name,
            type_="check",
        )

    existing_columns = {
        column.get("name")
        for column in inspector.get_columns(table_name, schema=schema_name)
        if column.get("name")
    }
    if "model_name" in existing_columns:
        op.drop_column(table_name, "model_name", schema=schema_name)
    if "source" in existing_columns:
        op.drop_column(table_name, "source", schema=schema_name)
