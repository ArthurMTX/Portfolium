"""Add ATH (All-Time High) tracking to assets

Revision ID: 20251114_1630
Revises: 20251112_2100
Create Date: 2025-11-14 16:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251114_1630'
down_revision: Union[str, None] = '20251112_2100'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add ATH tracking columns to assets table"""
    
    # Add all-time high price tracking
    op.add_column(
        'assets',
        sa.Column('ath_price', sa.NUMERIC(precision=20, scale=8), nullable=True),
        schema='portfolio'
    )
    
    # Add date when ATH was reached
    op.add_column(
        'assets',
        sa.Column('ath_date', sa.TIMESTAMP(), nullable=True),
        schema='portfolio'
    )
    
    # Add index for quick ATH lookups
    op.create_index(
        'idx_assets_ath_price',
        'assets',
        ['ath_price'],
        schema='portfolio',
        if_not_exists=True
    )


def downgrade() -> None:
    """Remove ATH tracking columns"""
    
    op.drop_index('idx_assets_ath_price', table_name='assets', schema='portfolio')
    op.drop_column('assets', 'ath_price', schema='portfolio')
    op.drop_column('assets', 'ath_date', schema='portfolio')
