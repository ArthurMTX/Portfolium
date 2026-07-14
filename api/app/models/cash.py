"""
Cash ledger models

The cash ledger is the accounting source of truth for portfolio cash:
the balance of a (portfolio, currency) pair is always derived as
SUM(cash_movements.amount). There is no independently mutable balance
column that could silently diverge.

Conventions (full write-up in docs/technical/cash-ledger.md):
- amounts are SIGNED Numeric(20, 8); the backend assigns the sign
- accounting order is (occurred_on ASC, id ASC); all movements sharing an
  occurred_on date form one accounting boundary, so intra-day ordering can
  never change a computed balance
- created_at is technical/audit ordering only
- base_exchange_rate = portfolio base-currency units per 1 movement-currency
  unit at occurred_on; base_currency_amount = amount * base_exchange_rate
- conversion_rate = target-currency units per 1 source-currency unit,
  populated only on fx_debit/fx_credit legs
"""
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import CashMovementType


class CashAccount(Base):
    """One row per (portfolio, currency).

    Exists primarily as the row-level locking anchor for strict-mode
    validation (SELECT ... FOR UPDATE scoped to portfolio + currency).
    """
    __tablename__ = "cash_accounts"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "currency", name="uq_cash_accounts_portfolio_currency"),
        {"schema": "portfolio"},
    )

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(
        Integer,
        ForeignKey("portfolio.portfolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    currency = Column(String(8), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    portfolio = relationship("Portfolio", back_populates="cash_accounts")


class CashMovement(Base):
    """A single signed cash ledger entry."""
    __tablename__ = "cash_movements"
    __table_args__ = (
        # Workhorse index for balance sums and history sweeps
        Index(
            "ix_cash_movements_portfolio_ccy_occurred",
            "portfolio_id",
            "currency",
            "occurred_on",
            "id",
        ),
        # At most one opening balance per currency per activation (idempotency backstop)
        Index(
            "uq_cash_movements_opening_activation",
            "activation_id",
            "currency",
            unique=True,
            postgresql_where=text("type = 'opening_balance'"),
            sqlite_where=text("type = 'opening_balance'"),
        ),
        # A transaction derives at most one movement per movement type,
        # so retries can never duplicate derived movements
        Index(
            "uq_cash_movements_tx_type",
            "transaction_id",
            "type",
            unique=True,
            postgresql_where=text("transaction_id IS NOT NULL"),
            sqlite_where=text("transaction_id IS NOT NULL"),
        ),
        CheckConstraint("amount <> 0", name="ck_cash_movements_amount_nonzero"),
        {"schema": "portfolio"},
    )

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(
        Integer,
        ForeignKey("portfolio.portfolios.id", ondelete="CASCADE"),
        nullable=False,
    )
    currency = Column(String(8), nullable=False)
    type = Column(
        # schema= must match the migration-created PG type so that
        # multi-row inserts render a fully qualified ::portfolio.cash_movement_type
        # cast (ignored on SQLite, where enums render as VARCHAR + CHECK)
        Enum(
            CashMovementType,
            name="cash_movement_type",
            schema="portfolio",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    amount = Column(Numeric(20, 8), nullable=False)
    occurred_on = Column(Date, nullable=False)
    # Non-NULL => derived from an asset transaction => immutable via the cash API
    transaction_id = Column(
        Integer,
        ForeignKey("portfolio.transactions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # Links the fx_debit / fx_credit / fee legs of one Forex conversion
    conversion_id = Column(String(36), nullable=True, index=True)
    # Reserved for opening_balance movements created by an activation
    activation_id = Column(String(36), nullable=True)
    base_exchange_rate = Column(Numeric(20, 8), nullable=True)
    base_currency_amount = Column(Numeric(20, 8), nullable=True)
    conversion_rate = Column(Numeric(20, 8), nullable=True)
    reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    meta_data = Column("metadata", JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    portfolio = relationship("Portfolio", back_populates="cash_movements")
    transaction = relationship("Transaction", back_populates="cash_movements")
