"""add optional per-portfolio cash tracking

Revision ID: 20260713_1000
Revises: 20260712_1000
Create Date: 2026-07-13 10:00:00.000000

Adds:
- portfolio.cash_mode enum + cash activation metadata columns on portfolios,
  including the tx_change_seq transaction-revision counter used to detect a
  ledger left stale while a portfolio was untracked;
- portfolio.cash_accounts: one row per (portfolio, currency), the row-level
  locking anchor for strict-mode validation (no cached balance column);
- portfolio.cash_movements: the signed cash ledger (accounting source of
  truth; balances are always SUM(amount) per portfolio + currency).

All existing portfolios default to cash_mode='untracked', which preserves
the historical Portfolium behavior exactly. No cash movements are generated
for existing transactions; that only happens through an explicit,
user-confirmed activation.
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260713_1000"
down_revision: Union[str, None] = "20260712_1000"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


CASH_MODE = postgresql.ENUM(
    "untracked",
    "tracked_warn",
    "tracked_strict",
    name="cash_mode",
    schema="portfolio",
    create_type=False,
)

CASH_MOVEMENT_TYPE = postgresql.ENUM(
    "opening_balance",
    "deposit",
    "withdrawal",
    "buy",
    "sell",
    "dividend",
    "interest",
    "fee",
    "tax",
    "fx_debit",
    "fx_credit",
    "adjustment",
    name="cash_movement_type",
    schema="portfolio",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    CASH_MODE.create(bind, checkfirst=True)
    CASH_MOVEMENT_TYPE.create(bind, checkfirst=True)

    op.add_column(
        "portfolios",
        sa.Column("cash_mode", CASH_MODE, nullable=False, server_default="untracked"),
        schema="portfolio",
    )
    op.add_column(
        "portfolios",
        sa.Column("cash_tracking_started_on", sa.Date(), nullable=True),
        schema="portfolio",
    )
    op.add_column(
        "portfolios",
        sa.Column("cash_activation_id", sa.String(36), nullable=True),
        schema="portfolio",
    )
    op.add_column(
        "portfolios",
        sa.Column("cash_activation_meta", sa.JSON(), nullable=True),
        schema="portfolio",
    )
    op.add_column(
        "portfolios",
        sa.Column("tx_change_seq", sa.Integer(), nullable=False, server_default="0"),
        schema="portfolio",
    )
    op.add_column(
        "portfolios",
        sa.Column("cash_ledger_synced_seq", sa.Integer(), nullable=True),
        schema="portfolio",
    )
    op.create_unique_constraint(
        "uq_portfolios_cash_activation_id",
        "portfolios",
        ["cash_activation_id"],
        schema="portfolio",
    )

    op.create_table(
        "cash_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("portfolio_id", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["portfolio_id"], ["portfolio.portfolios.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint(
            "portfolio_id", "currency", name="uq_cash_accounts_portfolio_currency"
        ),
        schema="portfolio",
    )
    op.create_index(
        "ix_cash_accounts_portfolio_id",
        "cash_accounts",
        ["portfolio_id"],
        schema="portfolio",
    )

    op.create_table(
        "cash_movements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("portfolio_id", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False),
        sa.Column("type", CASH_MOVEMENT_TYPE, nullable=False),
        sa.Column("amount", sa.Numeric(20, 8), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=True),
        sa.Column("conversion_id", sa.String(36), nullable=True),
        sa.Column("activation_id", sa.String(36), nullable=True),
        sa.Column("base_exchange_rate", sa.Numeric(20, 8), nullable=True),
        sa.Column("base_currency_amount", sa.Numeric(20, 8), nullable=True),
        sa.Column("conversion_rate", sa.Numeric(20, 8), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["portfolio_id"], ["portfolio.portfolios.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["portfolio.transactions.id"], ondelete="CASCADE"
        ),
        sa.CheckConstraint("amount <> 0", name="ck_cash_movements_amount_nonzero"),
        schema="portfolio",
    )
    op.create_index(
        "ix_cash_movements_portfolio_ccy_occurred",
        "cash_movements",
        ["portfolio_id", "currency", "occurred_on", "id"],
        schema="portfolio",
    )
    op.create_index(
        "ix_cash_movements_transaction_id",
        "cash_movements",
        ["transaction_id"],
        schema="portfolio",
    )
    op.create_index(
        "ix_cash_movements_conversion_id",
        "cash_movements",
        ["conversion_id"],
        schema="portfolio",
    )
    # At most one opening balance per currency per activation
    op.create_index(
        "uq_cash_movements_opening_activation",
        "cash_movements",
        ["activation_id", "currency"],
        unique=True,
        schema="portfolio",
        postgresql_where=sa.text("type = 'opening_balance'"),
    )
    # A transaction derives at most one movement per movement type
    op.create_index(
        "uq_cash_movements_tx_type",
        "cash_movements",
        ["transaction_id", "type"],
        unique=True,
        schema="portfolio",
        postgresql_where=sa.text("transaction_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_table("cash_movements", schema="portfolio")
    op.drop_table("cash_accounts", schema="portfolio")

    op.drop_constraint(
        "uq_portfolios_cash_activation_id", "portfolios", schema="portfolio"
    )
    op.drop_column("portfolios", "cash_ledger_synced_seq", schema="portfolio")
    op.drop_column("portfolios", "tx_change_seq", schema="portfolio")
    op.drop_column("portfolios", "cash_activation_meta", schema="portfolio")
    op.drop_column("portfolios", "cash_activation_id", schema="portfolio")
    op.drop_column("portfolios", "cash_tracking_started_on", schema="portfolio")
    op.drop_column("portfolios", "cash_mode", schema="portfolio")

    bind = op.get_bind()
    CASH_MOVEMENT_TYPE.drop(bind, checkfirst=True)
    CASH_MODE.drop(bind, checkfirst=True)
