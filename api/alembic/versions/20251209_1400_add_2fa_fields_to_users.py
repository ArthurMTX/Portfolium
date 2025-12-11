"""add 2FA fields to users

Revision ID: 20251209_1400
Revises: 966e1a49860d
Create Date: 2025-12-09 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251209_1400'
down_revision = '966e1a49860d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add TOTP 2FA columns to users table"""
    op.add_column('users', sa.Column('totp_secret', sa.String(), nullable=True), schema='portfolio')
    op.add_column('users', sa.Column('totp_enabled', sa.Boolean(), nullable=False, server_default='false'), schema='portfolio')
    op.add_column('users', sa.Column('totp_backup_codes', sa.Text(), nullable=True), schema='portfolio')
    
    # Add indexes for performance
    op.create_index('idx_users_totp_enabled', 'users', ['totp_enabled'], schema='portfolio')


def downgrade() -> None:
    """Remove TOTP 2FA columns from users table"""
    op.drop_index('idx_users_totp_enabled', table_name='users', schema='portfolio')
    op.drop_column('users', 'totp_backup_codes', schema='portfolio')
    op.drop_column('users', 'totp_enabled', schema='portfolio')
    op.drop_column('users', 'totp_secret', schema='portfolio')
