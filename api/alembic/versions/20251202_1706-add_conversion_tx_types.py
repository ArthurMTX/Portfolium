"""add conversion transaction types to tx_type enum

Revision ID: 20251202_1706
Revises: 20251202_1000
Create Date: 2025-12-02 17:06:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '20251202_1706'
down_revision: Union[str, Sequence[str], None] = '20251202_1000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add CONVERSION_OUT and CONVERSION_IN to tx_type enum."""
    # Add new enum values to the existing tx_type enum in PostgreSQL
    op.execute("ALTER TYPE portfolio.tx_type ADD VALUE IF NOT EXISTS 'CONVERSION_OUT'")
    op.execute("ALTER TYPE portfolio.tx_type ADD VALUE IF NOT EXISTS 'CONVERSION_IN'")


def downgrade() -> None:
    """Remove CONVERSION_OUT and CONVERSION_IN from tx_type enum.
    
    Note: PostgreSQL doesn't support removing enum values directly.
    This would require recreating the enum type, which is complex.
    For now, we'll leave the enum values in place during downgrade.
    """
    pass
