"""Add additional composite indexes for query optimization

Revision ID: 20251112_2100
Revises: 20251112_1600
Create Date: 2025-11-12 21:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251112_2100'
down_revision: Union[str, None] = '20251112_1600'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add additional composite indexes for frequently used query patterns"""
    
    # Transactions by asset_id + tx_date (used frequently in asset transaction history)
    # Covers queries like: WHERE asset_id = X ORDER BY tx_date
    op.create_index(
        'idx_transactions_asset_date',
        'transactions',
        ['asset_id', 'tx_date', 'created_at'],
        schema='portfolio',
        postgresql_ops={'tx_date': 'ASC', 'created_at': 'ASC'},
        if_not_exists=True
    )
    
    # Transactions by type (used for filtering SPLIT, BUY, SELL transactions)
    # Covers queries like: WHERE type = 'SPLIT' AND asset_id = X
    op.create_index(
        'idx_transactions_type',
        'transactions',
        ['type', 'asset_id', 'tx_date'],
        schema='portfolio',
        postgresql_ops={'tx_date': 'DESC'},
        if_not_exists=True
    )
    
    # Prices by source (useful for identifying data quality and backfill needs)
    # Covers queries that filter by source (yfinance_history, yfinance_current, etc.)
    op.create_index(
        'idx_prices_source',
        'prices',
        ['source', 'asset_id', 'asof'],
        schema='portfolio',
        postgresql_ops={'asof': 'DESC'},
        if_not_exists=True
    )
    
    # Dashboard layouts by user (quick lookup for user's dashboard configs)
    op.create_index(
        'idx_dashboard_layouts_user',
        'dashboard_layouts',
        ['user_id'],
        schema='portfolio',
        if_not_exists=True
    )
    
    print("Additional composite indexes created successfully")


def downgrade() -> None:
    """Remove additional composite indexes"""
    
    op.drop_index('idx_transactions_asset_date', table_name='transactions', schema='portfolio', if_exists=True)
    op.drop_index('idx_transactions_type', table_name='transactions', schema='portfolio', if_exists=True)
    op.drop_index('idx_prices_source', table_name='prices', schema='portfolio', if_exists=True)
    op.drop_index('idx_dashboard_layouts_user', table_name='dashboard_layouts', schema='portfolio', if_exists=True)
    
    print("Additional composite indexes removed successfully")
