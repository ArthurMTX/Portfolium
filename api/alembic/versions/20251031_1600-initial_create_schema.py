"""initial create schema

Revision ID: initial_create
Revises: 
Create Date: 2025-10-31 16:00:00.000000

This is a proper initial migration that creates the entire schema from scratch.
Use this for fresh database deployments.

This migration is idempotent - it checks if tables exist before creating them,
making it safe to run on databases that were initialized via SQL scripts.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'initial_create'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the entire database schema from scratch.
    
    This migration is idempotent and will skip creating objects that already exist.
    This handles cases where the database was initialized via SQL init scripts.
    """
    
    # Get connection and inspector
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if tables already exist in portfolio schema
    existing_tables = inspector.get_table_names(schema='portfolio')
    
    # If tables already exist, this database was initialized via SQL scripts
    # Just stamp it and return
    if len(existing_tables) > 0:
        print(f"Found {len(existing_tables)} existing tables in portfolio schema.")
        print("Database appears to be already initialized. Skipping table creation.")
        return
    
    # Create schema if it doesn't exist
    op.execute('CREATE SCHEMA IF NOT EXISTS portfolio')
    
    # Create ENUM types
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE portfolio.asset_class AS ENUM ('stock', 'etf', 'crypto', 'cash');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE portfolio.tx_type AS ENUM (
                'BUY', 'SELL', 'DIVIDEND', 'FEE', 'SPLIT', 'TRANSFER_IN', 'TRANSFER_OUT'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE portfolio.notification_type AS ENUM (
                'TRANSACTION_CREATED', 'TRANSACTION_UPDATED', 'TRANSACTION_DELETED',
                'LOGIN', 'PRICE_ALERT', 'DAILY_CHANGE_UP', 'DAILY_CHANGE_DOWN', 'SYSTEM'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('is_verified', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('is_superuser', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('is_admin', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('verification_token', sa.String(), nullable=True),
        sa.Column('verification_token_expires', sa.DateTime(), nullable=True),
        sa.Column('reset_password_token', sa.String(), nullable=True),
        sa.Column('reset_password_token_expires', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('daily_change_notifications_enabled', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('daily_change_threshold_pct', sa.Numeric(precision=5, scale=2), server_default='5.0', nullable=True),
        sa.Column('transaction_notifications_enabled', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('daily_report_enabled', sa.Boolean(), server_default='false', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username'),
        schema='portfolio'
    )
    op.create_index('idx_users_email', 'users', ['email'], unique=False, schema='portfolio')
    op.create_index('idx_users_username', 'users', ['username'], unique=False, schema='portfolio')
    op.create_index('idx_users_verification_token', 'users', ['verification_token'], unique=False, schema='portfolio')
    op.create_index('idx_users_reset_token', 'users', ['reset_password_token'], unique=False, schema='portfolio')
    op.create_index(op.f('ix_portfolio_users_id'), 'users', ['id'], unique=False, schema='portfolio')
    
    # Create assets table
    op.create_table(
        'assets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('currency', sa.String(), server_default='USD', nullable=True),
        sa.Column('class', postgresql.ENUM('stock', 'etf', 'crypto', 'cash', name='asset_class', schema='portfolio', create_type=False), server_default='stock', nullable=True),
        sa.Column('country', sa.String(), nullable=True),
        sa.Column('sector', sa.String(), nullable=True),
        sa.Column('industry', sa.String(), nullable=True),
        sa.Column('asset_type', sa.String(), nullable=True),
        sa.Column('logo_data', sa.LargeBinary(), nullable=True),
        sa.Column('logo_content_type', sa.String(length=100), nullable=True),
        sa.Column('logo_fetched_at', sa.DateTime(), nullable=True),
        sa.Column('first_transaction_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='portfolio'
    )
    op.create_index(op.f('ix_portfolio_assets_id'), 'assets', ['id'], unique=False, schema='portfolio')
    op.create_index(op.f('ix_portfolio_assets_symbol'), 'assets', ['symbol'], unique=True, schema='portfolio')
    
    # Create portfolios table
    op.create_table(
        'portfolios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('base_currency', sa.String(), server_default='EUR', nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['portfolio.users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='uq_user_portfolio_name'),
        schema='portfolio'
    )
    op.create_index('idx_portfolios_user', 'portfolios', ['user_id'], unique=False, schema='portfolio')
    op.create_index('idx_portfolios_name', 'portfolios', ['name'], unique=False, schema='portfolio')
    op.create_index(op.f('ix_portfolio_portfolios_id'), 'portfolios', ['id'], unique=False, schema='portfolio')
    
    # Create transactions table
    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('portfolio_id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('tx_date', sa.Date(), nullable=False),
        sa.Column('type', postgresql.ENUM('BUY', 'SELL', 'DIVIDEND', 'FEE', 'SPLIT', 'TRANSFER_IN', 'TRANSFER_OUT', name='tx_type', schema='portfolio', create_type=False), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=20, scale=8), server_default='0', nullable=False),
        sa.Column('price', sa.Numeric(precision=20, scale=8), server_default='0', nullable=False),
        sa.Column('fees', sa.Numeric(precision=20, scale=8), server_default='0', nullable=False),
        sa.Column('currency', sa.String(), server_default='USD', nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['asset_id'], ['portfolio.assets.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['portfolio_id'], ['portfolio.portfolios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema='portfolio'
    )
    op.create_index('idx_transactions_portfolio', 'transactions', ['portfolio_id'], unique=False, schema='portfolio')
    op.create_index('idx_transactions_asset', 'transactions', ['asset_id'], unique=False, schema='portfolio')
    op.create_index('idx_transactions_date', 'transactions', ['tx_date'], unique=False, schema='portfolio')
    op.create_index('idx_transactions_type', 'transactions', ['type'], unique=False, schema='portfolio')
    op.create_index(op.f('ix_portfolio_transactions_id'), 'transactions', ['id'], unique=False, schema='portfolio')
    
    # Create watchlist table
    op.create_table(
        'watchlist',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('added_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['asset_id'], ['portfolio.assets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['portfolio.users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'asset_id', name='uq_user_asset'),
        schema='portfolio'
    )
    op.create_index('idx_watchlist_user', 'watchlist', ['user_id'], unique=False, schema='portfolio')
    op.create_index('idx_watchlist_asset', 'watchlist', ['asset_id'], unique=False, schema='portfolio')
    op.create_index(op.f('ix_portfolio_watchlist_id'), 'watchlist', ['id'], unique=False, schema='portfolio')
    
    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', postgresql.ENUM('TRANSACTION_CREATED', 'TRANSACTION_UPDATED', 'TRANSACTION_DELETED', 'LOGIN', 'PRICE_ALERT', 'DAILY_CHANGE_UP', 'DAILY_CHANGE_DOWN', 'SYSTEM', name='notification_type', schema='portfolio', create_type=False), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.String(), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('is_read', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['portfolio.users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema='portfolio'
    )
    op.create_index('idx_notifications_user', 'notifications', ['user_id'], unique=False, schema='portfolio')
    op.create_index('idx_notifications_created_at', 'notifications', ['created_at'], unique=False, schema='portfolio')
    op.create_index('idx_notifications_is_read', 'notifications', ['is_read'], unique=False, schema='portfolio')
    op.create_index(op.f('ix_portfolio_notifications_id'), 'notifications', ['id'], unique=False, schema='portfolio')
    
    # Create asset_price_history table
    op.create_table(
        'asset_price_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('price_date', sa.Date(), nullable=False),
        sa.Column('open_price', sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column('high_price', sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column('low_price', sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column('close_price', sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column('adj_close_price', sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column('volume', sa.BigInteger(), nullable=True),
        sa.Column('currency', sa.String(), server_default='USD', nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['asset_id'], ['portfolio.assets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('asset_id', 'price_date', name='uq_asset_price_date'),
        schema='portfolio'
    )
    op.create_index('idx_asset_price_history_asset', 'asset_price_history', ['asset_id'], unique=False, schema='portfolio')
    op.create_index('idx_asset_price_history_date', 'asset_price_history', ['price_date'], unique=False, schema='portfolio')
    op.create_index('idx_asset_price_history_asset_date', 'asset_price_history', ['asset_id', 'price_date'], unique=False, schema='portfolio')
    op.create_index(op.f('ix_portfolio_asset_price_history_id'), 'asset_price_history', ['id'], unique=False, schema='portfolio')
    
    # Create config table (for email configuration)
    op.create_table(
        'config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('smtp_host', sa.String(), nullable=True),
        sa.Column('smtp_port', sa.Integer(), nullable=True),
        sa.Column('smtp_user', sa.String(), nullable=True),
        sa.Column('smtp_password', sa.String(), nullable=True),
        sa.Column('from_email', sa.String(), nullable=True),
        sa.Column('from_name', sa.String(), nullable=True),
        sa.Column('enable_email', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema=None  # config table is in public schema
    )


def downgrade() -> None:
    """Drop the entire schema."""
    # Drop tables in reverse order
    op.drop_table('config')
    op.drop_index(op.f('ix_portfolio_asset_price_history_id'), table_name='asset_price_history', schema='portfolio')
    op.drop_index('idx_asset_price_history_asset_date', table_name='asset_price_history', schema='portfolio')
    op.drop_index('idx_asset_price_history_date', table_name='asset_price_history', schema='portfolio')
    op.drop_index('idx_asset_price_history_asset', table_name='asset_price_history', schema='portfolio')
    op.drop_table('asset_price_history', schema='portfolio')
    
    op.drop_index(op.f('ix_portfolio_notifications_id'), table_name='notifications', schema='portfolio')
    op.drop_index('idx_notifications_is_read', table_name='notifications', schema='portfolio')
    op.drop_index('idx_notifications_created_at', table_name='notifications', schema='portfolio')
    op.drop_index('idx_notifications_user', table_name='notifications', schema='portfolio')
    op.drop_table('notifications', schema='portfolio')
    
    op.drop_index(op.f('ix_portfolio_watchlist_id'), table_name='watchlist', schema='portfolio')
    op.drop_index('idx_watchlist_asset', table_name='watchlist', schema='portfolio')
    op.drop_index('idx_watchlist_user', table_name='watchlist', schema='portfolio')
    op.drop_table('watchlist', schema='portfolio')
    
    op.drop_index(op.f('ix_portfolio_transactions_id'), table_name='transactions', schema='portfolio')
    op.drop_index('idx_transactions_type', table_name='transactions', schema='portfolio')
    op.drop_index('idx_transactions_date', table_name='transactions', schema='portfolio')
    op.drop_index('idx_transactions_asset', table_name='transactions', schema='portfolio')
    op.drop_index('idx_transactions_portfolio', table_name='transactions', schema='portfolio')
    op.drop_table('transactions', schema='portfolio')
    
    op.drop_index(op.f('ix_portfolio_portfolios_id'), table_name='portfolios', schema='portfolio')
    op.drop_index('idx_portfolios_name', table_name='portfolios', schema='portfolio')
    op.drop_index('idx_portfolios_user', table_name='portfolios', schema='portfolio')
    op.drop_table('portfolios', schema='portfolio')
    
    op.drop_index(op.f('ix_portfolio_assets_symbol'), table_name='assets', schema='portfolio')
    op.drop_index(op.f('ix_portfolio_assets_id'), table_name='assets', schema='portfolio')
    op.drop_table('assets', schema='portfolio')
    
    op.drop_index(op.f('ix_portfolio_users_id'), table_name='users', schema='portfolio')
    op.drop_index('idx_users_reset_token', table_name='users', schema='portfolio')
    op.drop_index('idx_users_verification_token', table_name='users', schema='portfolio')
    op.drop_index('idx_users_username', table_name='users', schema='portfolio')
    op.drop_index('idx_users_email', table_name='users', schema='portfolio')
    op.drop_table('users', schema='portfolio')
    
    # Drop ENUM types
    op.execute('DROP TYPE IF EXISTS portfolio.notification_type')
    op.execute('DROP TYPE IF EXISTS portfolio.tx_type')
    op.execute('DROP TYPE IF EXISTS portfolio.asset_class')
    
    # Drop schema
    op.execute('DROP SCHEMA IF EXISTS portfolio CASCADE')
