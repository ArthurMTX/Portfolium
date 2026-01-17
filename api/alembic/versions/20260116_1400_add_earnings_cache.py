"""Add earnings_cache table for storing yfinance earnings data

Revision ID: 20260116_1400
Revises: 20260115_1800
Create Date: 2026-01-16 14:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260116_1400'
down_revision: Union[str, None] = '20260115_1800'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create earnings_cache table for storing yfinance earnings data
    
    This avoids slow API calls on every calendar request by caching earnings data.
    A scheduled job refreshes this data daily.
    """
    
    op.create_table(
        'earnings_cache',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('earnings_date', sa.Date(), nullable=True),
        sa.Column('is_confirmed', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('eps_estimate', sa.Numeric(20, 8), nullable=True),
        sa.Column('eps_actual', sa.Numeric(20, 8), nullable=True),
        sa.Column('revenue_estimate', sa.Numeric(20, 2), nullable=True),
        sa.Column('revenue_actual', sa.Numeric(20, 2), nullable=True),
        sa.Column('surprise_pct', sa.Numeric(10, 4), nullable=True),
        sa.Column('fiscal_quarter', sa.String(10), nullable=True),
        sa.Column('fiscal_year', sa.Integer(), nullable=True),
        sa.Column('raw_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('fetched_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('symbol', 'earnings_date', name='uq_earnings_symbol_date'),
        schema='portfolio'
    )
    
    # Index for fast lookups by symbol
    op.create_index(
        'idx_earnings_cache_symbol',
        'earnings_cache',
        ['symbol'],
        schema='portfolio'
    )
    
    # Index for fast lookups by date range
    op.create_index(
        'idx_earnings_cache_date',
        'earnings_cache',
        ['earnings_date'],
        schema='portfolio'
    )
    
    # Index for finding stale cache entries
    op.create_index(
        'idx_earnings_cache_fetched_at',
        'earnings_cache',
        ['fetched_at'],
        schema='portfolio'
    )


def downgrade() -> None:
    """Drop earnings_cache table and indexes"""
    
    op.drop_index('idx_earnings_cache_fetched_at', table_name='earnings_cache', schema='portfolio')
    op.drop_index('idx_earnings_cache_date', table_name='earnings_cache', schema='portfolio')
    op.drop_index('idx_earnings_cache_symbol', table_name='earnings_cache', schema='portfolio')
    op.drop_table('earnings_cache', schema='portfolio')
