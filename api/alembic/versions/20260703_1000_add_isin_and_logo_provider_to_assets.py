"""add isin and logo provider fields to assets

Revision ID: 20260703_1000
Revises: 20260617_1200
Create Date: 2026-07-03 10:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260703_1000"
down_revision: Union[str, None] = "20260617_1200"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    schema_name = "portfolio"
    table_name = "assets"
    index_name = "ix_portfolio_assets_isin"

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name, schema=schema_name):
        return

    existing_columns = {
        column.get("name")
        for column in inspector.get_columns(table_name, schema=schema_name)
        if column.get("name")
    }

    if "isin" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("isin", sa.String(length=12), nullable=True),
            schema=schema_name,
        )
    if "logo_provider" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("logo_provider", sa.String(length=32), nullable=True),
            schema=schema_name,
        )
    if "logo_url" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("logo_url", sa.String(), nullable=True),
            schema=schema_name,
        )
    if "logo_light_url" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("logo_light_url", sa.String(), nullable=True),
            schema=schema_name,
        )
    if "logo_dark_url" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("logo_dark_url", sa.String(), nullable=True),
            schema=schema_name,
        )

    existing_indexes = {
        index.get("name")
        for index in inspector.get_indexes(table_name, schema=schema_name)
        if index.get("name")
    }
    if index_name not in existing_indexes:
        op.create_index(
            index_name,
            table_name,
            ["isin"],
            unique=False,
            schema=schema_name,
        )


def downgrade() -> None:
    schema_name = "portfolio"
    table_name = "assets"
    index_name = "ix_portfolio_assets_isin"

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name, schema=schema_name):
        return

    existing_indexes = {
        index.get("name")
        for index in inspector.get_indexes(table_name, schema=schema_name)
        if index.get("name")
    }
    if index_name in existing_indexes:
        op.drop_index(index_name, table_name=table_name, schema=schema_name)

    existing_columns = {
        column.get("name")
        for column in inspector.get_columns(table_name, schema=schema_name)
        if column.get("name")
    }

    for column_name in (
        "logo_dark_url",
        "logo_light_url",
        "logo_url",
        "logo_provider",
        "isin",
    ):
        if column_name in existing_columns:
            op.drop_column(table_name, column_name, schema=schema_name)
