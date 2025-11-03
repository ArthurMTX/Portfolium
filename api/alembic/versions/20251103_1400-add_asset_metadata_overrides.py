"""add asset metadata overrides

Revision ID: add_asset_overrides
Revises: initial_create
Create Date: 2025-11-03 14:00:00.000000

Create asset_metadata_overrides table for user-specific asset metadata.
This allows users to set custom sector, industry, and country when Yahoo Finance doesn't provide data.
Overrides are user-specific - each user can have their own classification preferences.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_asset_overrides'
down_revision: Union[str, Sequence[str], None] = 'initial_create'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create asset_metadata_overrides table."""
    # Create the overrides table
    op.create_table(
        'asset_metadata_overrides',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('sector_override', sa.String(), nullable=True),
        sa.Column('industry_override', sa.String(), nullable=True),
        sa.Column('country_override', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['portfolio.users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['asset_id'], ['portfolio.assets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'asset_id', name='uq_user_asset_override'),
        schema='portfolio'
    )
    
    # Add indexes for performance
    op.create_index('idx_asset_overrides_user', 'asset_metadata_overrides', ['user_id'], schema='portfolio')
    op.create_index('idx_asset_overrides_asset', 'asset_metadata_overrides', ['asset_id'], schema='portfolio')
    op.create_index('idx_asset_overrides_user_asset', 'asset_metadata_overrides', ['user_id', 'asset_id'], schema='portfolio')


def downgrade() -> None:
    """Drop asset_metadata_overrides table."""
    # Drop indexes first
    op.drop_index('idx_asset_overrides_user_asset', table_name='asset_metadata_overrides', schema='portfolio')
    op.drop_index('idx_asset_overrides_asset', table_name='asset_metadata_overrides', schema='portfolio')
    op.drop_index('idx_asset_overrides_user', table_name='asset_metadata_overrides', schema='portfolio')
    
    # Drop table
    op.drop_table('asset_metadata_overrides', schema='portfolio')
