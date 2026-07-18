"""replay opening balances -> progressive inferred deposits

Revision ID: 20260718_1000
Revises: 20260713_1000
Create Date: 2026-07-18 10:00:00.000000

Data migration for ledgers created by the pre-v0.4.0 "deepest point"
replay reconstruction: the single auto-generated opening balance of each
replay activation is replaced by minimum-funding deposits inferred on the
day of each transaction the reconstructed balance could not cover
(metadata.inferred = true). Per-currency final balances are unchanged —
the total inferred equals the removed opening by construction.

User-entered data is never touched: opening_balances-strategy activations,
manual deposits/withdrawals/adjustments and transaction-derived movements
all stay as they are and participate in the recomputation.

Delegates to app.services.cash.activation.migrate_replay_openings_to_inferred
(the same tested code path the service layer exposes); the cash feature is
unreleased, so only development databases carry old-style ledgers and the
models are guaranteed to match this revision.

Downgrade is a no-op: the deepest-point representation is intentionally
not restorable.
"""
from typing import Union

from alembic import op
from sqlalchemy.orm import Session


revision: str = "20260718_1000"
down_revision: Union[str, None] = "20260713_1000"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    from app.services.cash.activation import migrate_replay_openings_to_inferred

    session = Session(bind=op.get_bind())
    migrated = migrate_replay_openings_to_inferred(session)
    session.flush()
    if migrated:
        print(
            "Migrated replay opening balances to inferred deposits for "
            f"portfolios: {migrated}"
        )


def downgrade() -> None:
    # Irreversible data migration: the old single-opening representation is
    # intentionally not restorable (and carries no information the new
    # progressive representation lacks).
    pass
