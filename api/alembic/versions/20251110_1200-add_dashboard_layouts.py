"""Add dashboard layouts

Revision ID: 20251110_1200
Revises: [previous_revision]
Create Date: 2025-11-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20251110_1200'
down_revision: Union[str, None] = '3ee4be59b21e'  # add_performance_indexes_for_positions
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add dashboard_layouts table"""
    op.create_table(
        'dashboard_layouts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('portfolio_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_shared', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('layout_config', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['portfolio.users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['portfolio_id'], ['portfolio.portfolios.id'], ondelete='CASCADE'),
        schema='portfolio'
    )
    
    # Indexes for performance
    op.create_index(
        'ix_dashboard_layouts_user_id',
        'dashboard_layouts',
        ['user_id'],
        schema='portfolio'
    )
    op.create_index(
        'ix_dashboard_layouts_portfolio_id',
        'dashboard_layouts',
        ['portfolio_id'],
        schema='portfolio'
    )
    op.create_index(
        'ix_dashboard_layouts_user_portfolio',
        'dashboard_layouts',
        ['user_id', 'portfolio_id'],
        schema='portfolio'
    )
    
    # Ensure only one default layout per user-portfolio combination
    # Use partial unique index (PostgreSQL-specific)
    op.execute("""
        CREATE UNIQUE INDEX uq_dashboard_layouts_user_portfolio_default
        ON portfolio.dashboard_layouts (user_id, portfolio_id)
        WHERE is_default = true
    """)


def downgrade() -> None:
    """Remove dashboard_layouts table"""
    # Drop the partial unique index first
    op.execute("DROP INDEX IF EXISTS portfolio.uq_dashboard_layouts_user_portfolio_default")
    
    # Drop the table (will cascade drop other indexes)
    op.drop_table('dashboard_layouts', schema='portfolio')
