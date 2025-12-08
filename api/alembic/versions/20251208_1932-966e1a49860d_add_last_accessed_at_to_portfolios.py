"""add_last_accessed_at_to_portfolios

Revision ID: 966e1a49860d
Revises: 20251208_1500
Create Date: 2025-12-08 19:32:31.641837

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '966e1a49860d'
down_revision: Union[str, Sequence[str], None] = '20251208_1500'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add last_accessed_at column to portfolios table for smart cache warmup."""
    # Add last_accessed_at column with default to current timestamp
    op.add_column(
        'portfolios',
        sa.Column('last_accessed_at', sa.DateTime(), nullable=True),
        schema='portfolio'
    )
    
    # Set initial value to created_at for existing portfolios
    op.execute("""
        UPDATE portfolio.portfolios 
        SET last_accessed_at = created_at 
        WHERE last_accessed_at IS NULL
    """)
    
    # Make column non-nullable after setting initial values
    op.alter_column(
        'portfolios',
        'last_accessed_at',
        nullable=False,
        schema='portfolio'
    )
    
    # Add index for efficient filtering by last_accessed_at
    op.create_index(
        'idx_portfolios_last_accessed_at',
        'portfolios',
        ['last_accessed_at'],
        schema='portfolio'
    )


def downgrade() -> None:
    """Remove last_accessed_at column from portfolios table."""
    op.drop_index('idx_portfolios_last_accessed_at', table_name='portfolios', schema='portfolio')
    op.drop_column('portfolios', 'last_accessed_at', schema='portfolio')