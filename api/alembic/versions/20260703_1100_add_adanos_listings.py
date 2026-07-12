"""add adanos_listings reference table

Revision ID: 20260703_1100
Revises: 20260703_1000
Create Date: 2026-07-03 11:00:00.000000
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260703_1100"
down_revision: Union[str, None] = "20260703_1000"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    """Create adanos_listings reference table.

    Populated only by the weekly app.tasks.reference_data_tasks Celery task,
    which downloads and bulk-upserts the Adanos free ticker database CSV.
    Application code never parses the CSV or reaches out to GitHub at request
    time; it only ever queries this table.
    """
    op.create_table(
        "adanos_listings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("listing_key", sa.String(160), nullable=False),
        sa.Column("ticker", sa.String(32), nullable=False),
        sa.Column("exchange", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("asset_type", sa.String(32), nullable=True),
        sa.Column("stock_sector", sa.String(128), nullable=True),
        sa.Column("etf_category", sa.String(128), nullable=True),
        sa.Column("country", sa.String(128), nullable=True),
        sa.Column("country_code", sa.String(8), nullable=True),
        sa.Column("isin", sa.String(12), nullable=True),
        sa.Column("aliases", sa.Text(), nullable=True),
        sa.Column("imported_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("listing_key", name="uq_adanos_listings_listing_key"),
        schema="portfolio",
    )

    op.create_index(
        "ix_adanos_listings_listing_key",
        "adanos_listings",
        ["listing_key"],
        unique=True,
        schema="portfolio",
    )
    op.create_index(
        "ix_adanos_listings_ticker",
        "adanos_listings",
        ["ticker"],
        schema="portfolio",
    )
    op.create_index(
        "ix_adanos_listings_ticker_exchange",
        "adanos_listings",
        ["ticker", "exchange"],
        schema="portfolio",
    )
    op.create_index(
        "ix_adanos_listings_isin",
        "adanos_listings",
        ["isin"],
        schema="portfolio",
    )


def downgrade() -> None:
    op.drop_index("ix_adanos_listings_isin", table_name="adanos_listings", schema="portfolio")
    op.drop_index("ix_adanos_listings_ticker_exchange", table_name="adanos_listings", schema="portfolio")
    op.drop_index("ix_adanos_listings_ticker", table_name="adanos_listings", schema="portfolio")
    op.drop_index("ix_adanos_listings_listing_key", table_name="adanos_listings", schema="portfolio")
    op.drop_table("adanos_listings", schema="portfolio")
