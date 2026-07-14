"""
CRUD operations for the cash ledger

Balances are always derived from SUM(cash_movements.amount); there is no
mutable balance column. Accounting order is (occurred_on ASC, id ASC) with
all movements of one date forming a single accounting boundary.

None of these functions commit; callers own the transaction so that asset
transactions and their derived cash movements commit (or roll back)
atomically.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.orm import Session

from app.models import CashAccount, CashMovement, CashMovementType


def get_or_create_accounts(
    db: Session, portfolio_id: int, currencies: Sequence[str]
) -> None:
    """Ensure a cash_accounts row exists for each (portfolio, currency).

    Uses ON CONFLICT DO NOTHING on PostgreSQL; other dialects (SQLite in
    tests) use a select-then-insert fallback. Does not commit.
    """
    wanted = sorted(set(currencies))
    if not wanted:
        return
    if db.bind and db.bind.dialect.name == "postgresql":
        statement = postgresql_insert(CashAccount).values(
            [{"portfolio_id": portfolio_id, "currency": c} for c in wanted]
        )
        statement = statement.on_conflict_do_nothing(
            constraint="uq_cash_accounts_portfolio_currency"
        )
        db.execute(statement)
    else:
        existing = {
            row[0]
            for row in db.execute(
                select(CashAccount.currency).where(
                    CashAccount.portfolio_id == portfolio_id,
                    CashAccount.currency.in_(wanted),
                )
            )
        }
        for currency in wanted:
            if currency not in existing:
                db.add(CashAccount(portfolio_id=portfolio_id, currency=currency))
    db.flush()


def lock_accounts(db: Session, portfolio_id: int, currencies: Sequence[str]) -> List[CashAccount]:
    """Row-lock the cash accounts for the given currencies.

    Currencies are locked in sorted order to avoid deadlocks when two
    concurrent operations touch overlapping currency sets. On PostgreSQL
    this emits SELECT ... FOR UPDATE; on SQLite it degrades to a plain
    SELECT (SQLite serializes writers anyway).
    """
    wanted = sorted(set(currencies))
    if not wanted:
        return []
    query = (
        select(CashAccount)
        .where(
            CashAccount.portfolio_id == portfolio_id,
            CashAccount.currency.in_(wanted),
        )
        .order_by(CashAccount.currency)
        .with_for_update()
    )
    return list(db.execute(query).scalars())


def get_movement(db: Session, portfolio_id: int, movement_id: int) -> Optional[CashMovement]:
    """Get one movement scoped to a portfolio"""
    return (
        db.query(CashMovement)
        .filter(CashMovement.id == movement_id, CashMovement.portfolio_id == portfolio_id)
        .first()
    )


def get_movements(
    db: Session,
    portfolio_id: int,
    currency: Optional[str] = None,
    movement_type: Optional[CashMovementType] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: Optional[int] = 100,
) -> tuple[List[CashMovement], int]:
    """List movements (display order: newest first) plus the total count"""
    q = db.query(CashMovement).filter(CashMovement.portfolio_id == portfolio_id)
    if currency:
        q = q.filter(CashMovement.currency == currency)
    if movement_type:
        q = q.filter(CashMovement.type == movement_type)
    if date_from:
        q = q.filter(CashMovement.occurred_on >= date_from)
    if date_to:
        q = q.filter(CashMovement.occurred_on <= date_to)
    total = q.count()
    q = q.order_by(CashMovement.occurred_on.desc(), CashMovement.id.desc()).offset(skip)
    if limit is not None:
        q = q.limit(limit)
    return q.all(), total


def get_conversion_movements(
    db: Session, portfolio_id: int, conversion_id: str
) -> List[CashMovement]:
    """All ledger legs of one Forex conversion, accounting order"""
    return (
        db.query(CashMovement)
        .filter(
            CashMovement.portfolio_id == portfolio_id,
            CashMovement.conversion_id == conversion_id,
        )
        .order_by(CashMovement.occurred_on, CashMovement.id)
        .all()
    )


def get_balances(
    db: Session,
    portfolio_id: int,
    as_of: Optional[date] = None,
) -> dict[str, Decimal]:
    """Per-currency balances derived from the ledger.

    as_of defaults to today, which excludes future-dated movements from the
    current balance.
    """
    effective = as_of or date.today()
    rows = db.execute(
        select(CashMovement.currency, func.sum(CashMovement.amount))
        .where(
            CashMovement.portfolio_id == portfolio_id,
            CashMovement.occurred_on <= effective,
        )
        .group_by(CashMovement.currency)
    ).all()
    return {currency: Decimal(total) for currency, total in rows}


def get_balance(
    db: Session,
    portfolio_id: int,
    currency: str,
    as_of: Optional[date] = None,
) -> Decimal:
    """Ledger-derived balance for one currency (0 when no movements)"""
    effective = as_of or date.today()
    total = db.execute(
        select(func.coalesce(func.sum(CashMovement.amount), 0)).where(
            CashMovement.portfolio_id == portfolio_id,
            CashMovement.currency == currency,
            CashMovement.occurred_on <= effective,
        )
    ).scalar_one()
    return Decimal(total)


def get_ledger_rows(
    db: Session,
    portfolio_id: int,
    currency: str,
    exclude_movement_ids: Optional[Sequence[int]] = None,
    exclude_transaction_id: Optional[int] = None,
) -> List[tuple[date, Decimal]]:
    """(occurred_on, amount) pairs in accounting order for sweep validation.

    Exclusions support replace-on-edit: when a transaction or manual
    movement is being edited, its current movements must not count against
    the proposed replacement.
    """
    q = (
        select(CashMovement.occurred_on, CashMovement.amount)
        .where(
            CashMovement.portfolio_id == portfolio_id,
            CashMovement.currency == currency,
        )
        .order_by(CashMovement.occurred_on, CashMovement.id)
    )
    if exclude_movement_ids:
        q = q.where(CashMovement.id.not_in(list(exclude_movement_ids)))
    if exclude_transaction_id is not None:
        q = q.where(
            (CashMovement.transaction_id.is_(None))
            | (CashMovement.transaction_id != exclude_transaction_id)
        )
    return [(row[0], Decimal(row[1])) for row in db.execute(q)]


def delete_movements_for_transaction(db: Session, transaction_id: int) -> int:
    """Delete all movements derived from one transaction. Does not commit."""
    deleted = (
        db.query(CashMovement)
        .filter(CashMovement.transaction_id == transaction_id)
        .delete(synchronize_session=False)
    )
    db.flush()
    return deleted


def get_movements_for_transaction(db: Session, transaction_id: int) -> List[CashMovement]:
    """Movements derived from one transaction, accounting order"""
    return (
        db.query(CashMovement)
        .filter(CashMovement.transaction_id == transaction_id)
        .order_by(CashMovement.occurred_on, CashMovement.id)
        .all()
    )
