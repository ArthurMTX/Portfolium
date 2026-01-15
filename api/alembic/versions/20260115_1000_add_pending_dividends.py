"""add pending dividends table for auto-fetched dividend tracking

Revision ID: 20260115_1000
Revises: 20251209_1400
Create Date: 2026-01-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260115_1000'
down_revision: Union[str, Sequence[str], None] = '20251209_1400'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create pending_dividends table and add PENDING_DIVIDEND notification type."""
    
    # Check if table already exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names(schema='portfolio')
    
    if 'pending_dividends' in tables:
        # Table already exists, skip migration
        return
    
    # Add PENDING_DIVIDEND to notification_type enum
    op.execute("ALTER TYPE portfolio.notification_type ADD VALUE IF NOT EXISTS 'PENDING_DIVIDEND'")
    
    # Create pending_dividend_status enum if it doesn't exist
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE portfolio.pending_dividend_status AS ENUM (
                'PENDING',
                'ACCEPTED',
                'REJECTED',
                'EXPIRED'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create pending_dividends table using raw SQL to avoid enum creation issues
    op.execute("""
        CREATE TABLE portfolio.pending_dividends (
            id SERIAL PRIMARY KEY,
            portfolio_id INTEGER NOT NULL,
            asset_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            ex_dividend_date DATE NOT NULL,
            payment_date DATE,
            dividend_per_share NUMERIC(20, 8) NOT NULL,
            shares_held NUMERIC(20, 8) NOT NULL,
            gross_amount NUMERIC(20, 8) NOT NULL,
            currency VARCHAR,
            status portfolio.pending_dividend_status NOT NULL DEFAULT 'PENDING',
            fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
            processed_at TIMESTAMP,
            transaction_id INTEGER,
            yfinance_raw_data JSONB,
            CONSTRAINT fk_pending_dividends_portfolio 
                FOREIGN KEY (portfolio_id) REFERENCES portfolio.portfolios(id) ON DELETE CASCADE,
            CONSTRAINT fk_pending_dividends_asset 
                FOREIGN KEY (asset_id) REFERENCES portfolio.assets(id) ON DELETE CASCADE,
            CONSTRAINT fk_pending_dividends_user 
                FOREIGN KEY (user_id) REFERENCES portfolio.users(id) ON DELETE CASCADE,
            CONSTRAINT fk_pending_dividends_transaction 
                FOREIGN KEY (transaction_id) REFERENCES portfolio.transactions(id) ON DELETE SET NULL
        );
    """)
    
    # Create indexes for efficient queries
    op.create_index(
        'idx_pending_dividends_user_status',
        'pending_dividends',
        ['user_id', 'status'],
        schema='portfolio'
    )
    op.create_index(
        'idx_pending_dividends_portfolio',
        'pending_dividends',
        ['portfolio_id'],
        schema='portfolio'
    )
    op.create_index(
        'idx_pending_dividends_asset_exdate',
        'pending_dividends',
        ['asset_id', 'ex_dividend_date'],
        schema='portfolio'
    )
    # Unique constraint to prevent duplicate pending dividends
    op.create_index(
        'idx_pending_dividends_unique',
        'pending_dividends',
        ['portfolio_id', 'asset_id', 'ex_dividend_date'],
        unique=True,
        schema='portfolio'
    )


def downgrade() -> None:
    """Drop pending_dividends table and related objects."""
    
    # Drop indexes
    op.drop_index('idx_pending_dividends_unique', table_name='pending_dividends', schema='portfolio')
    op.drop_index('idx_pending_dividends_asset_exdate', table_name='pending_dividends', schema='portfolio')
    op.drop_index('idx_pending_dividends_portfolio', table_name='pending_dividends', schema='portfolio')
    op.drop_index('idx_pending_dividends_user_status', table_name='pending_dividends', schema='portfolio')
    
    # Drop table
    op.drop_table('pending_dividends', schema='portfolio')
    
    # Drop enum type
    op.execute("DROP TYPE IF EXISTS portfolio.pending_dividend_status")
    
    # Note: Cannot remove enum values from notification_type in PostgreSQL without recreating
