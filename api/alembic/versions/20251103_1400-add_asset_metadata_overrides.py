"""add asset metadata overrides

Revision ID: add_asset_overrides
Revises: initial_create
Create Date: 2025-11-03 14:00:00.000000

Create asset_metadata_overrides table for user-specific asset metadata.
This allows users to set custom sector, industry, and country when Yahoo Finance doesn't provide data.
Overrides are user-specific - each user can have their own classification preferences.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_asset_overrides'
down_revision: Union[str, Sequence[str], None] = 'initial_create'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create asset_metadata_overrides table."""
    schema_name = 'portfolio'
    table_name = 'asset_metadata_overrides'

    bind = op.get_bind()
    inspector = sa.inspect(bind)

    table_exists = inspector.has_table(table_name, schema=schema_name)

    # Create the overrides table (idempotent when db/init SQL already created it)
    if not table_exists:
        op.create_table(
            table_name,
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('asset_id', sa.Integer(), nullable=False),
            sa.Column('sector_override', sa.String(), nullable=True),
            sa.Column('industry_override', sa.String(), nullable=True),
            sa.Column('country_override', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['portfolio.users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['asset_id'], ['portfolio.assets.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'asset_id', name='uq_user_asset_override'),
            schema=schema_name
        )

    # If the table already existed (e.g., created by db/init/06_add_asset_metadata_overrides.sql),
    # ensure we at least have a uniqueness constraint on (user_id, asset_id).
    if inspector.has_table(table_name, schema=schema_name):
        existing_uniques = inspector.get_unique_constraints(table_name, schema=schema_name)
        has_user_asset_unique = any(
            set(uc.get('column_names') or []) == {'user_id', 'asset_id'}
            for uc in existing_uniques
        )
        if not has_user_asset_unique:
            op.create_unique_constraint(
                'uq_user_asset_override',
                table_name,
                ['user_id', 'asset_id'],
                schema=schema_name,
            )

        # Add indexes for performance (idempotent)
        existing_indexes = {
            idx.get('name')
            for idx in inspector.get_indexes(table_name, schema=schema_name)
            if idx.get('name')
        }

        if 'idx_asset_overrides_user' not in existing_indexes:
            op.create_index('idx_asset_overrides_user', table_name, ['user_id'], schema=schema_name)
        if 'idx_asset_overrides_asset' not in existing_indexes:
            op.create_index('idx_asset_overrides_asset', table_name, ['asset_id'], schema=schema_name)
        if 'idx_asset_overrides_user_asset' not in existing_indexes:
            op.create_index('idx_asset_overrides_user_asset', table_name, ['user_id', 'asset_id'], schema=schema_name)


def downgrade() -> None:
    """Drop asset_metadata_overrides table."""
    schema_name = 'portfolio'
    table_name = 'asset_metadata_overrides'

    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table(table_name, schema=schema_name):
        return

    existing_indexes = {
        idx.get('name')
        for idx in inspector.get_indexes(table_name, schema=schema_name)
        if idx.get('name')
    }

    # Drop indexes first (guarded)
    if 'idx_asset_overrides_user_asset' in existing_indexes:
        op.drop_index('idx_asset_overrides_user_asset', table_name=table_name, schema=schema_name)
    if 'idx_asset_overrides_asset' in existing_indexes:
        op.drop_index('idx_asset_overrides_asset', table_name=table_name, schema=schema_name)
    if 'idx_asset_overrides_user' in existing_indexes:
        op.drop_index('idx_asset_overrides_user', table_name=table_name, schema=schema_name)

    # Drop table
    op.drop_table(table_name, schema=schema_name)
