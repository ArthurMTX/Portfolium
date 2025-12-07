"""Add performance indexes for frequently queried columns

Revision ID: 20251112_1600_performance_indexes
Revises: (previous_migration)
Create Date: 2025-11-12 16:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251112_1600'  # performance_indexes (shortened to fit varchar(32))
down_revision: Union[str, None] = '20251110_1200'  # add_dashboard_layouts
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add performance indexes for frequently queried columns"""
    
    # Transaction date index (DESC for recent-first queries)
    # Used in: transaction history, portfolio calculations
    op.create_index(
        'idx_transactions_tx_date',
        'transactions',
        ['tx_date'],
        schema='portfolio',
        postgresql_ops={'tx_date': 'DESC'},
        postgresql_where=None,
        if_not_exists=True
    )
    
    # Composite index for asset prices (asset_id + date)
    # Used in: price lookups, chart data, historical backfill
    op.create_index(
        'idx_prices_asset_date',
        'prices',
        ['asset_id', 'asof'],
        schema='portfolio',
        postgresql_ops={'asof': 'DESC'},
        if_not_exists=True
    )
    
    # Notifications user + created index
    # Used in: notification feed, unread count
    op.create_index(
        'idx_notifications_user_created',
        'notifications',
        ['user_id', 'created_at'],
        schema='portfolio',
        postgresql_ops={'created_at': 'DESC'},
        if_not_exists=True
    )
    
    # Notifications read status index
    # Used in: filtering unread notifications
    op.create_index(
        'idx_notifications_is_read',
        'notifications',
        ['user_id', 'is_read', 'created_at'],
        schema='portfolio',
        postgresql_ops={'created_at': 'DESC'},
        if_not_exists=True
    )
    
    # Watchlist composite index
    # Used in: checking if asset is in watchlist
    op.create_index(
        'idx_watchlist_user_asset',
        'watchlist',
        ['user_id', 'asset_id'],
        schema='portfolio',
        unique=True,  # Prevent duplicate watchlist entries
        if_not_exists=True
    )
    
    # Portfolio user index
    # Used in: listing user's portfolios
    op.create_index(
        'idx_portfolios_user',
        'portfolios',
        ['user_id'],
        schema='portfolio',
        if_not_exists=True
    )
    
    # Transaction portfolio index
    # Used in: loading portfolio transactions
    op.create_index(
        'idx_transactions_portfolio',
        'transactions',
        ['portfolio_id', 'tx_date'],
        schema='portfolio',
        postgresql_ops={'tx_date': 'DESC'},
        if_not_exists=True
    )
    
    # Asset metadata overrides lookup
    # Used in: applying user-specific asset metadata
    op.create_index(
        'idx_asset_metadata_user_asset',
        'asset_metadata_overrides',
        ['user_id', 'asset_id'],
        schema='portfolio',
        unique=True,  # One override per user per asset
        if_not_exists=True
    )
    
    print("Performance indexes created successfully")


def downgrade() -> None:
    """Remove performance indexes"""
    
    op.drop_index('idx_transactions_tx_date', table_name='transactions', schema='portfolio', if_exists=True)
    op.drop_index('idx_prices_asset_date', table_name='prices', schema='portfolio', if_exists=True)
    op.drop_index('idx_notifications_user_created', table_name='notifications', schema='portfolio', if_exists=True)
    op.drop_index('idx_notifications_is_read', table_name='notifications', schema='portfolio', if_exists=True)
    op.drop_index('idx_watchlist_user_asset', table_name='watchlist', schema='portfolio', if_exists=True)
    op.drop_index('idx_portfolios_user', table_name='portfolios', schema='portfolio', if_exists=True)
    op.drop_index('idx_transactions_portfolio', table_name='transactions', schema='portfolio', if_exists=True)
    op.drop_index('idx_asset_metadata_user_asset', table_name='asset_metadata_overrides', schema='portfolio', if_exists=True)
    
    print("Performance indexes removed successfully")