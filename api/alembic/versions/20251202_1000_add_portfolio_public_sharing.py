"""Add portfolio public sharing columns

Revision ID: 20251202_1000
Revises: 20251117_2119
Create Date: 2024-12-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid


# revision identifiers, used by Alembic.
revision: str = '20251202_1000'
down_revision: Union[str, None] = '20251117_2119'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def generate_share_token():
    """Generate a unique share token"""
    return str(uuid.uuid4())


def upgrade() -> None:
    # Add is_public column with default False
    op.add_column(
        'portfolios',
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'),
        schema='portfolio'
    )
    
    # Add share_token column
    op.add_column(
        'portfolios',
        sa.Column('share_token', sa.String(36), nullable=True),
        schema='portfolio'
    )
    
    # Generate unique share tokens for existing portfolios
    connection = op.get_bind()
    portfolios = connection.execute(
        sa.text("SELECT id FROM portfolio.portfolios WHERE share_token IS NULL")
    ).fetchall()
    
    for portfolio in portfolios:
        connection.execute(
            sa.text("UPDATE portfolio.portfolios SET share_token = :token WHERE id = :id"),
            {"token": generate_share_token(), "id": portfolio[0]}
        )
    
    # Now make share_token NOT NULL and add unique constraint
    op.alter_column(
        'portfolios',
        'share_token',
        nullable=False,
        schema='portfolio'
    )
    
    # Create unique index on share_token for fast lookups
    op.create_index(
        'ix_portfolios_share_token',
        'portfolios',
        ['share_token'],
        unique=True,
        schema='portfolio'
    )


def downgrade() -> None:
    op.drop_index('ix_portfolios_share_token', table_name='portfolios', schema='portfolio')
    op.drop_column('portfolios', 'share_token', schema='portfolio')
    op.drop_column('portfolios', 'is_public', schema='portfolio')
