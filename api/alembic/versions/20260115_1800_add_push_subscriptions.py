"""Add push notification subscriptions table

Revision ID: 20260115_1800
Revises: 20260115_1700
Create Date: 2026-01-15 18:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260115_1800'
down_revision: Union[str, None] = '20260115_1700'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create push_subscriptions table for storing Web Push subscriptions"""
    
    op.create_table(
        'push_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('endpoint', sa.Text(), nullable=False),
        sa.Column('p256dh_key', sa.Text(), nullable=False),  # Public key for encryption
        sa.Column('auth_key', sa.Text(), nullable=False),     # Auth secret
        sa.Column('user_agent', sa.String(500), nullable=True),  # Browser/device info
        sa.Column('device_name', sa.String(100), nullable=True),  # User-friendly device name
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('failed_count', sa.Integer(), server_default='0', nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['portfolio.users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('endpoint', name='uq_push_subscriptions_endpoint'),
        schema='portfolio'
    )
    
    # Create index for faster lookups by user
    op.create_index(
        'idx_push_subscriptions_user_id',
        'push_subscriptions',
        ['user_id'],
        schema='portfolio'
    )
    
    # Create index for active subscriptions
    op.create_index(
        'idx_push_subscriptions_active',
        'push_subscriptions',
        ['is_active'],
        schema='portfolio'
    )
    
    # Add push_notifications_enabled column to users table
    op.add_column(
        'users',
        sa.Column('push_notifications_enabled', sa.Boolean(), server_default='true', nullable=True),
        schema='portfolio'
    )


def downgrade() -> None:
    """Remove push subscriptions table"""
    
    op.drop_column('users', 'push_notifications_enabled', schema='portfolio')
    op.drop_index('idx_push_subscriptions_active', table_name='push_subscriptions', schema='portfolio')
    op.drop_index('idx_push_subscriptions_user_id', table_name='push_subscriptions', schema='portfolio')
    op.drop_table('push_subscriptions', schema='portfolio')
