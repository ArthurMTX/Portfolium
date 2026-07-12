"""add market cap metadata to assets

Revision ID: 20260614_0100
Revises: 20260119_1000
Create Date: 2026-06-14 01:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260614_0100"
down_revision: Union[str, None] = "20260119_1000"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    schema_name = "portfolio"
    table_name = "assets"

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name, schema=schema_name):
        return

    existing_columns = {
        column.get("name")
        for column in inspector.get_columns(table_name, schema=schema_name)
        if column.get("name")
    }

    if "market_cap" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("market_cap", sa.Numeric(24, 2), nullable=True),
            schema=schema_name,
        )
    if "market_cap_currency" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("market_cap_currency", sa.String(length=3), nullable=True),
            schema=schema_name,
        )
    if "market_cap_usd" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("market_cap_usd", sa.Numeric(24, 2), nullable=True),
            schema=schema_name,
        )
    if "market_cap_fetched_at" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("market_cap_fetched_at", sa.DateTime(), nullable=True),
            schema=schema_name,
        )


def downgrade() -> None:
    schema_name = "portfolio"
    table_name = "assets"

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name, schema=schema_name):
        return

    existing_columns = {
        column.get("name")
        for column in inspector.get_columns(table_name, schema=schema_name)
        if column.get("name")
    }

    for column_name in (
        "market_cap_fetched_at",
        "market_cap_usd",
        "market_cap_currency",
        "market_cap",
    ):
        if column_name in existing_columns:
            op.drop_column(table_name, column_name, schema=schema_name)
