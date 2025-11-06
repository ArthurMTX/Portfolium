"""add_performance_indexes_for_positions

Revision ID: 3ee4be59b21e
Revises: 20251105_1623
Create Date: 2025-11-06 14:07:33.450712

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ee4be59b21e'
down_revision: Union[str, Sequence[str], None] = '20251105_1623'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add composite indexes for position calculation performance.
    
    These indexes dramatically speed up:
    1. Loading all transactions for a portfolio+asset combination
    2. Finding the most recent price for an asset
    3. Filtering transactions by portfolio and type
    """
    # Index for fast transaction lookups by portfolio+asset+date
    # Used heavily in position calculations (metrics.py)
    op.create_index(
        'idx_transaction_portfolio_asset_date',
        'transactions',
        ['portfolio_id', 'asset_id', 'tx_date'],
        unique=False,
        schema='portfolio'
    )
    
    # Index for transaction type filtering (BUY, SELL, SPLIT, etc.)
    # Speeds up realized P&L calculations
    op.create_index(
        'idx_transaction_portfolio_type',
        'transactions',
        ['portfolio_id', 'type'],
        unique=False,
        schema='portfolio'
    )
    
    # Index for fast price lookups (most recent price for an asset)
    # Critical for current price fetching
    op.create_index(
        'idx_asset_price_asset_date_desc',
        'prices',
        ['asset_id', sa.text('asof DESC')],
        unique=False,
        schema='portfolio'
    )
    
    # Index for asset lookups by symbol (used in price fetching)
    op.create_index(
        'idx_asset_symbol',
        'assets',
        ['symbol'],
        unique=True,
        schema='portfolio'
    )


def downgrade() -> None:
    """Remove performance indexes."""
    op.drop_index('idx_asset_symbol', table_name='assets', schema='portfolio')
    op.drop_index('idx_asset_price_asset_date_desc', table_name='prices', schema='portfolio')
    op.drop_index('idx_transaction_portfolio_type', table_name='transactions', schema='portfolio')
    op.drop_index('idx_transaction_portfolio_asset_date', table_name='transactions', schema='portfolio')
