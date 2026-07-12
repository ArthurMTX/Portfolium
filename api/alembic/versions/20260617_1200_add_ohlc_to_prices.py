"""add OHLC columns to prices

Revision ID: 20260617_1200
Revises: 20260614_0100
Create Date: 2026-06-17 12:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260617_1200"
down_revision: Union[str, None] = "20260614_0100"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    schema_name = "portfolio"
    table_name = "prices"

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name, schema=schema_name):
        return

    existing_columns = {
        column.get("name")
        for column in inspector.get_columns(table_name, schema=schema_name)
        if column.get("name")
    }

    for column_name in ("open_price", "high_price", "low_price", "close_price"):
        if column_name not in existing_columns:
            op.add_column(
                table_name,
                sa.Column(column_name, sa.Numeric(20, 8), nullable=True),
                schema=schema_name,
            )

    op.execute(
        """
        UPDATE portfolio.prices
        SET close_price = price
        WHERE close_price IS NULL
        """
    )


def downgrade() -> None:
    schema_name = "portfolio"
    table_name = "prices"

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name, schema=schema_name):
        return

    existing_columns = {
        column.get("name")
        for column in inspector.get_columns(table_name, schema=schema_name)
        if column.get("name")
    }

    for column_name in ("close_price", "low_price", "high_price", "open_price"):
        if column_name in existing_columns:
            op.drop_column(table_name, column_name, schema=schema_name)
