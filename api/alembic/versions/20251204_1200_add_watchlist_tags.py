"""Add watchlist tags feature

Revision ID: 20251204_1200
Revises: 20251202_1706
Create Date: 2025-12-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251204_1200'
down_revision: Union[str, None] = '20251202_1706'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create watchlist_tags and watchlist_item_tags tables"""
    
    # Create watchlist_tags table
    op.create_table(
        'watchlist_tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('icon', sa.String(50), nullable=False, server_default='tag'),
        sa.Column('color', sa.String(20), nullable=False, server_default='#6366f1'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['portfolio.users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'name', name='uq_watchlist_tags_user_name'),
        schema='portfolio'
    )
    
    # Create indexes for watchlist_tags
    op.create_index(
        'idx_watchlist_tags_user_id',
        'watchlist_tags',
        ['user_id'],
        schema='portfolio'
    )
    
    # Create watchlist_item_tags junction table (many-to-many)
    op.create_table(
        'watchlist_item_tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('watchlist_item_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['watchlist_item_id'], ['portfolio.watchlist.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['portfolio.watchlist_tags.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('watchlist_item_id', 'tag_id', name='uq_watchlist_item_tags'),
        schema='portfolio'
    )
    
    # Create indexes for watchlist_item_tags
    op.create_index(
        'idx_watchlist_item_tags_item',
        'watchlist_item_tags',
        ['watchlist_item_id'],
        schema='portfolio'
    )
    
    op.create_index(
        'idx_watchlist_item_tags_tag',
        'watchlist_item_tags',
        ['tag_id'],
        schema='portfolio'
    )
    
    # Create the update_updated_at_column function if it doesn't exist
    op.execute("""
        CREATE OR REPLACE FUNCTION portfolio.update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create trigger for updated_at on watchlist_tags
    op.execute("""
        CREATE TRIGGER update_watchlist_tags_updated_at
        BEFORE UPDATE ON portfolio.watchlist_tags
        FOR EACH ROW
        EXECUTE FUNCTION portfolio.update_updated_at_column();
    """)


def downgrade() -> None:
    """Drop watchlist tags tables"""
    
    # Drop trigger
    op.execute("DROP TRIGGER IF EXISTS update_watchlist_tags_updated_at ON portfolio.watchlist_tags")
    
    # Drop tables (order matters due to foreign keys)
    op.drop_table('watchlist_item_tags', schema='portfolio')
    op.drop_table('watchlist_tags', schema='portfolio')
