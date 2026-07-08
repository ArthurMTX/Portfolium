"""add uuid to dashboard_layouts

Revision ID: 20260708_1200
Revises: 20260705_1000
Create Date: 2026-07-08 12:00:00.000000
"""
from typing import Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = "20260708_1200"
down_revision: Union[str, None] = "20260705_1000"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def generate_layout_uuid():
    """Generate a unique public identifier for a dashboard layout (board)"""
    return str(uuid.uuid4())


def upgrade() -> None:
    # Add uuid column, nullable first so existing rows can be backfilled
    op.add_column(
        "dashboard_layouts",
        sa.Column("uuid", sa.String(36), nullable=True),
        schema="portfolio",
    )

    # Backfill existing rows with a unique uuid
    connection = op.get_bind()
    layouts = connection.execute(
        sa.text("SELECT id FROM portfolio.dashboard_layouts WHERE uuid IS NULL")
    ).fetchall()

    for layout in layouts:
        connection.execute(
            sa.text("UPDATE portfolio.dashboard_layouts SET uuid = :uuid WHERE id = :id"),
            {"uuid": generate_layout_uuid(), "id": layout[0]},
        )

    # Now make uuid NOT NULL and add a unique index
    op.alter_column(
        "dashboard_layouts",
        "uuid",
        nullable=False,
        schema="portfolio",
    )

    op.create_index(
        "ix_dashboard_layouts_uuid",
        "dashboard_layouts",
        ["uuid"],
        unique=True,
        schema="portfolio",
    )


def downgrade() -> None:
    op.drop_index("ix_dashboard_layouts_uuid", table_name="dashboard_layouts", schema="portfolio")
    op.drop_column("dashboard_layouts", "uuid", schema="portfolio")
