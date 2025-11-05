"""add user preferred language

Revision ID: 20251105_1623
Revises: add_asset_overrides
Create Date: 2025-11-05 16:23:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251105_1623'
down_revision = 'add_asset_overrides'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add preferred_language column to users table with default 'en'
    op.add_column(
        'users',
        sa.Column('preferred_language', sa.String(length=5), nullable=True, server_default='en'),
        schema='portfolio'
    )
    
    # Update existing users to have 'en' as default
    op.execute("UPDATE portfolio.users SET preferred_language = 'en' WHERE preferred_language IS NULL")
    
    # Now make it non-nullable
    op.alter_column('users', 'preferred_language', nullable=False, schema='portfolio')


def downgrade() -> None:
    # Remove preferred_language column
    op.drop_column('users', 'preferred_language', schema='portfolio')
