"""Add portfolio_goals table for tracking financial goals

Revision ID: 20251117_2119
Revises: 20251114_1630
Create Date: 2025-11-17 21:19:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251117_2119'
down_revision: Union[str, None] = '20251114_1630'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create portfolio_goals table"""
    
    # Create portfolio_goals table
    op.create_table(
        'portfolio_goals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('portfolio_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('target_amount', sa.NUMERIC(precision=20, scale=2), nullable=False),
        sa.Column('target_date', sa.Date(), nullable=True),
        sa.Column('monthly_contribution', sa.NUMERIC(precision=20, scale=2), nullable=False, server_default='0'),
        sa.Column('category', sa.String(), nullable=False, server_default='other'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['portfolio_id'], ['portfolio.portfolios.id'], ondelete='CASCADE'),
        sa.CheckConstraint('target_amount > 0', name='check_target_amount_positive'),
        sa.CheckConstraint('monthly_contribution >= 0', name='check_monthly_contribution_non_negative'),
        sa.CheckConstraint(
            "category IN ('retirement', 'house', 'education', 'vacation', 'emergency', 'other')",
            name='check_valid_category'
        ),
        schema='portfolio'
    )
    
    # Create indexes for better query performance
    op.create_index(
        'idx_portfolio_goals_portfolio_id',
        'portfolio_goals',
        ['portfolio_id'],
        schema='portfolio'
    )
    
    op.create_index(
        'idx_portfolio_goals_is_active',
        'portfolio_goals',
        ['is_active'],
        schema='portfolio'
    )
    
    op.create_index(
        'idx_portfolio_goals_created_at',
        'portfolio_goals',
        ['created_at'],
        schema='portfolio'
    )
    
    # Create trigger function for updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION portfolio.update_portfolio_goals_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create trigger
    op.execute("""
        CREATE TRIGGER trigger_update_portfolio_goals_updated_at
        BEFORE UPDATE ON portfolio.portfolio_goals
        FOR EACH ROW
        EXECUTE FUNCTION portfolio.update_portfolio_goals_updated_at();
    """)


def downgrade() -> None:
    """Drop portfolio_goals table"""
    
    # Drop trigger
    op.execute('DROP TRIGGER IF EXISTS trigger_update_portfolio_goals_updated_at ON portfolio.portfolio_goals')
    
    # Drop trigger function
    op.execute('DROP FUNCTION IF EXISTS portfolio.update_portfolio_goals_updated_at()')
    
    # Drop indexes
    op.drop_index('idx_portfolio_goals_created_at', table_name='portfolio_goals', schema='portfolio')
    op.drop_index('idx_portfolio_goals_is_active', table_name='portfolio_goals', schema='portfolio')
    op.drop_index('idx_portfolio_goals_portfolio_id', table_name='portfolio_goals', schema='portfolio')
    
    # Drop table
    op.drop_table('portfolio_goals', schema='portfolio')
