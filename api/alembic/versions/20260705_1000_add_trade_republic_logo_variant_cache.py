"""add trade republic logo variant cache

Revision ID: 20260705_1000
Revises: 20260703_1100
Create Date: 2026-07-05 10:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260705_1000"
down_revision: Union[str, None] = "20260703_1100"
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

    if "logo_light_data" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("logo_light_data", sa.LargeBinary(), nullable=True),
            schema=schema_name,
        )
    if "logo_dark_data" not in existing_columns:
        op.add_column(
            table_name,
            sa.Column("logo_dark_data", sa.LargeBinary(), nullable=True),
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

    for column_name in ("logo_dark_data", "logo_light_data"):
        if column_name in existing_columns:
            op.drop_column(table_name, column_name, schema=schema_name)
