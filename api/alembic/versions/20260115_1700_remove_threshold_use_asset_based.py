"""Remove daily_change_threshold_pct from users - use asset-based thresholds

Revision ID: 20260115_1700
Revises: 20260115_1600
Create Date: 2026-01-15 17:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260115_1700'
down_revision: Union[str, None] = '20260115_1600'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove daily_change_threshold_pct column from users table"""
    
    # Remove the user-specific threshold column
    # The system will now use asset-based thresholds determined by market cap and asset class
    op.drop_column('users', 'daily_change_threshold_pct', schema='portfolio')


def downgrade() -> None:
    """Re-add daily_change_threshold_pct column"""
    
    op.add_column(
        'users',
        sa.Column(
            'daily_change_threshold_pct',
            sa.NUMERIC(precision=5, scale=2),
            server_default='5.0',
            nullable=True
        ),
        schema='portfolio'
    )
