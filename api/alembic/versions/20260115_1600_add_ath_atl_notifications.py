"""Add ATH/ATL notifications and tracking

Revision ID: 20260115_1600
Revises: 20260115_1000
Create Date: 2026-01-15 16:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260115_1600'
down_revision: Union[str, None] = '20260115_1000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add ATL tracking to assets and ATH/ATL notification types"""
    
    # Add ATL (All-Time Low) price tracking columns to assets table
    op.add_column(
        'assets',
        sa.Column('atl_price', sa.NUMERIC(precision=20, scale=8), nullable=True),
        schema='portfolio'
    )
    
    op.add_column(
        'assets',
        sa.Column('atl_date', sa.TIMESTAMP(), nullable=True),
        schema='portfolio'
    )
    
    # Add index for quick ATL lookups
    op.create_index(
        'idx_assets_atl_price',
        'assets',
        ['atl_price'],
        schema='portfolio',
        if_not_exists=True
    )
    
    # Add ATH and ATL notification types to the enum
    op.execute("ALTER TYPE portfolio.notification_type ADD VALUE IF NOT EXISTS 'ATH'")
    op.execute("ALTER TYPE portfolio.notification_type ADD VALUE IF NOT EXISTS 'ATL'")
    
    # Add user setting for ATH/ATL notifications
    op.add_column(
        'users',
        sa.Column('ath_atl_notifications_enabled', sa.Boolean(), server_default='true', nullable=True),
        schema='portfolio'
    )


def downgrade() -> None:
    """Remove ATL tracking and notification settings"""
    
    # Remove user setting
    op.drop_column('users', 'ath_atl_notifications_enabled', schema='portfolio')
    
    # Note: Cannot remove enum values in PostgreSQL easily, but we can drop columns
    op.drop_index('idx_assets_atl_price', table_name='assets', schema='portfolio')
    op.drop_column('assets', 'atl_price', schema='portfolio')
    op.drop_column('assets', 'atl_date', schema='portfolio')
