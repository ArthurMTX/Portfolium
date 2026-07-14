"""
Cash valuation service

Converts ledger-derived native balances into the portfolio base currency
using the existing CurrencyService (current rates for current valuation,
historical rates for the history series - never one for the other).

FX failures are explicit: a balance whose rate is unavailable keeps its
native value, is excluded from the converted total, and flags the summary
as 'partial'/'unavailable'. The rate is never silently assumed to be 1.

FX PnL is deferred in this release: the breakdown always reports
fx_pnl=None with fx_pnl_status='unavailable'. Movements already store
base_exchange_rate/base_currency_amount at write time so a future release
can compute it without data loss.
"""
import logging
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Dict, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas
from app.crud import cash as crud_cash
from app.models import CashMovement, CashMovementType, Portfolio
from app.services.cash.ledger import q8
from app.services.market_data.currency import CurrencyService

logger = logging.getLogger(__name__)


def build_balances(
    db: Session, portfolio: Portfolio, as_of: Optional[date] = None
) -> tuple[list[schemas.CashBalance], Optional[Decimal], str]:
    """Per-currency balances with base-currency conversion.

    Returns (balances, total_base, fx_status). fx_status is 'ok' when every
    non-zero balance converted, 'partial' when some did, 'unavailable' when
    none did (and there was something to convert).
    """
    base = (portfolio.base_currency or "EUR").upper()
    native = crud_cash.get_balances(db, portfolio.id, as_of=as_of)

    balances: list[schemas.CashBalance] = []
    total = Decimal(0)
    convertible = 0
    unconvertible = 0
    for currency in sorted(native):
        amount = q8(native[currency])
        rate = CurrencyService.get_exchange_rate(currency, base)
        if rate is None:
            unconvertible += 1
            balances.append(
                schemas.CashBalance(
                    currency=currency,
                    balance=amount,
                    balance_base=None,
                    rate=None,
                    rate_stale=False,
                    rate_unavailable=True,
                )
            )
            continue
        convertible += 1
        converted = q8(amount * Decimal(rate))
        total += converted
        balances.append(
            schemas.CashBalance(
                currency=currency,
                balance=amount,
                balance_base=converted,
                rate=q8(Decimal(rate)),
                rate_stale=CurrencyService.is_exchange_rate_stale(currency, base),
                rate_unavailable=False,
            )
        )

    if unconvertible == 0:
        fx_status = "ok"
    elif convertible > 0:
        fx_status = "partial"
    else:
        fx_status = "unavailable"
    total_base = q8(total) if convertible else None
    return balances, total_base, fx_status


def _income_component(
    db: Session,
    portfolio: Portfolio,
    movement_type: CashMovementType,
    standalone_only: bool = True,
) -> Decimal:
    """Best-effort base-currency sum of one movement type.

    Uses the stored base_currency_amount (historical rate at occurred_on);
    movements without one fall back to the current rate, and are skipped
    when no rate exists at all (never assumed 1:1).

    standalone_only excludes transaction-derived movements: fees/taxes on
    asset transactions are already inside cost basis / net proceeds /
    dividend metrics and must not be double-counted.
    """
    base = (portfolio.base_currency or "EUR").upper()
    query = select(
        CashMovement.currency,
        func.sum(CashMovement.amount),
        func.sum(CashMovement.base_currency_amount),
        func.count(CashMovement.base_currency_amount),
        func.count(),
    ).where(
        CashMovement.portfolio_id == portfolio.id,
        CashMovement.type == movement_type,
        CashMovement.occurred_on <= date.today(),
    )
    if standalone_only:
        query = query.where(CashMovement.transaction_id.is_(None))
    query = query.group_by(CashMovement.currency)

    total = Decimal(0)
    for currency, amount_sum, base_sum, base_count, row_count in db.execute(query):
        if base_count == row_count and base_sum is not None:
            total += Decimal(base_sum)
        else:
            # Fall back to the current rate for the whole currency bucket
            converted = CurrencyService.convert(Decimal(amount_sum), currency, base)
            if converted is not None:
                total += converted
            else:
                logger.warning(
                    "Skipping %s %s in cash PnL breakdown: no FX rate to %s",
                    amount_sum, currency, base,
                    extra={"event": "cash_pnl_component_skipped"},
                )
    return q8(total)


def build_pnl_breakdown(db: Session, portfolio: Portfolio) -> schemas.CashPnlBreakdown:
    """Cash-related PnL components in the base currency.

    Only standalone (non-transaction-derived) fee/tax movements appear here;
    fx conversion fee legs count as standalone. fx_pnl is deferred.
    """
    return schemas.CashPnlBreakdown(
        interest_income=_income_component(db, portfolio, CashMovementType.INTEREST),
        standalone_fees=_income_component(db, portfolio, CashMovementType.FEE),
        standalone_taxes=_income_component(db, portfolio, CashMovementType.TAX),
        fx_pnl=None,
        fx_pnl_status="unavailable",
    )


def get_cash_summary(
    db: Session, portfolio: Portfolio, include_pnl: bool = False
) -> schemas.CashSummary:
    """Cash valuation of a tracked portfolio (current rates)"""
    balances, total_base, fx_status = build_balances(db, portfolio)
    return schemas.CashSummary(
        base_currency=(portfolio.base_currency or "EUR").upper(),
        balances=balances,
        total_base=total_base,
        fx_status=fx_status,
        pnl=build_pnl_breakdown(db, portfolio) if include_pnl else None,
        as_of=datetime.utcnow(),
    )


def get_cash_balance_series(
    db: Session,
    portfolio: Portfolio,
    start_date: date,
    end_date: date,
) -> Dict[date, Optional[Decimal]]:
    """Base-currency cash value per day for the history chart.

    Only movements from cash_tracking_started_on onward exist in the
    ledger, so the series naturally starts there. Non-base balances are
    converted with the historical rate of each day (memoized); days where
    some balance has no rate carry the last convertible value for that
    currency - logged, never silently rate=1.
    """
    if end_date < start_date:
        return {}

    rows = db.execute(
        select(CashMovement.currency, CashMovement.occurred_on, func.sum(CashMovement.amount))
        .where(
            CashMovement.portfolio_id == portfolio.id,
            CashMovement.occurred_on <= end_date,
        )
        .group_by(CashMovement.currency, CashMovement.occurred_on)
        .order_by(CashMovement.occurred_on)
    ).all()
    if not rows:
        return {}

    base = (portfolio.base_currency or "EUR").upper()
    # Per-currency date -> delta
    deltas: Dict[str, Dict[date, Decimal]] = {}
    for currency, occurred_on, amount in rows:
        deltas.setdefault(currency, {})[occurred_on] = Decimal(amount)

    rate_memo: Dict[tuple[str, date], Optional[Decimal]] = {}

    def rate_for(currency: str, day: date) -> Optional[Decimal]:
        if currency == base:
            return Decimal(1)
        key = (currency, day)
        if key not in rate_memo:
            try:
                rate_memo[key] = CurrencyService.get_historical_exchange_rate(
                    currency, base, datetime.combine(day, time.min)
                )
            except Exception:  # pragma: no cover - provider failures are non-fatal
                rate_memo[key] = None
        return rate_memo[key]

    series: Dict[date, Optional[Decimal]] = {}
    running: Dict[str, Decimal] = {currency: Decimal(0) for currency in deltas}
    last_converted: Dict[str, Decimal] = {}
    day = min(start_date, min(d for per in deltas.values() for d in per))
    # Warm the running balances up to start_date
    while day < start_date:
        for currency, per_date in deltas.items():
            if day in per_date:
                running[currency] += per_date[day]
        day += timedelta(days=1)

    while day <= end_date:
        for currency, per_date in deltas.items():
            if day in per_date:
                running[currency] += per_date[day]
        total = Decimal(0)
        for currency, balance in running.items():
            if balance == 0 and currency not in last_converted:
                continue
            rate = rate_for(currency, day)
            if rate is not None:
                converted = q8(balance * Decimal(rate))
                last_converted[currency] = converted
                total += converted
            elif currency in last_converted:
                total += last_converted[currency]
            else:
                logger.debug(
                    "No historical FX rate for %s->%s on %s; cash excluded that day",
                    currency, base, day,
                )
        series[day] = q8(total)
        day += timedelta(days=1)
    return series
