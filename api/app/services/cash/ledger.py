"""
Cash ledger service

Derives cash movements from asset transactions, validates cash impact
against the ledger (warning or strict rejection), and records manual cash
operations and Forex conversions.

Accounting rules (full write-up in docs/technical/cash-ledger.md):
- accounting order is (occurred_on ASC, id ASC); all movements sharing an
  occurred_on date form one accounting boundary, so a same-day sell can
  fund a same-day buy and intra-day ordering can never change a balance;
- amounts are signed; the service assigns the sign from the movement type
  (API payloads carry positive amounts);
- strict validation requires the merged balance of every affected currency
  to stay >= 0 at every accounting boundary from the earliest affected
  date onward (historical inserts are validated against the historical
  balance, and against every later boundary they influence);
- all mutators flush but never commit: the caller owns the SQL transaction
  so asset transactions and their derived movements are atomic.

Rate conventions:
- base_exchange_rate: portfolio base-currency units per 1 movement-currency
  unit at occurred_on (historical rate); base_currency_amount is derived
  exclusively from it. Enrichment is best-effort: when no historical rate
  is available both fields stay NULL (never a silent rate of 1).
- conversion_rate: target-currency units per 1 source-currency unit,
  stored on both fx legs of a conversion.
"""
import logging
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Sequence

from sqlalchemy.orm import Session

from app.crud import cash as crud_cash
from app.errors import (
    AdjustmentReasonRequiredError,
    CashError,
    InsufficientCashError,
)
from app.models import (
    CashMode,
    CashMovement,
    CashMovementType,
    Portfolio,
    Transaction,
    TransactionType,
)
from app.services.cash.currencies import normalize_currency

logger = logging.getLogger(__name__)

EIGHT_DP = Decimal("0.00000001")

# Movement types a user may create through the manual movement endpoint.
# opening_balance is reserved for activation/reconstruction workflows.
MANUAL_MOVEMENT_TYPES = frozenset({
    CashMovementType.DEPOSIT,
    CashMovementType.WITHDRAWAL,
    CashMovementType.ADJUSTMENT,
    CashMovementType.INTEREST,
    CashMovementType.FEE,
    CashMovementType.TAX,
})

# Sign assignment for positive API amounts (adjustment uses an explicit direction)
_CREDIT_TYPES = frozenset({
    CashMovementType.OPENING_BALANCE,
    CashMovementType.DEPOSIT,
    CashMovementType.INTEREST,
})
_DEBIT_TYPES = frozenset({
    CashMovementType.WITHDRAWAL,
    CashMovementType.FEE,
    CashMovementType.TAX,
})


def q8(value: Decimal) -> Decimal:
    """Quantize to the ledger precision (8 dp, ROUND_HALF_UP)"""
    return Decimal(value).quantize(EIGHT_DP, rounding=ROUND_HALF_UP)


@dataclass
class MovementSpec:
    """A cash movement about to be written (amount already signed)"""
    currency: str
    type: CashMovementType
    amount: Decimal
    occurred_on: date
    conversion_id: Optional[str] = None
    conversion_rate: Optional[Decimal] = None
    activation_id: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    meta_data: dict = field(default_factory=dict)


@dataclass
class CashWarning:
    """A projected negative balance (tracked_warn mode)"""
    code: str
    currency: str
    occurred_on: date
    projected_balance: Decimal

    def as_dict(self) -> dict:
        return {
            "code": self.code,
            "currency": self.currency,
            "date": self.occurred_on.isoformat(),
            "projected_balance": str(q8(self.projected_balance)),
        }


def derive_movement_specs(
    tx_type: TransactionType,
    quantity: Decimal,
    price: Decimal,
    fees: Decimal,
    currency: str,
    tx_date: date,
) -> List[MovementSpec]:
    """Cash movements implied by one asset transaction.

    Mapping (documented in docs/technical/cash-ledger.md):
      BUY            -> buy  -(qty*price), fee -fees
      SELL           -> sell +(qty*price), fee -fees
      DIVIDEND       -> dividend +(qty*price), tax -fees (fees column holds
                        the withholding tax for dividends)
      FEE            -> fee -(fees, falling back to qty*price)
      CONVERSION_OUT -> fee -fees (the swap itself is cash-neutral)
      SPLIT / TRANSFER_IN / TRANSFER_OUT / CONVERSION_IN -> none
    """
    ccy = normalize_currency(currency)
    quantity = Decimal(quantity or 0)
    price = Decimal(price or 0)
    fees = Decimal(fees or 0)
    gross = q8(quantity * price)
    fees = q8(fees)
    specs: List[MovementSpec] = []

    if tx_type == TransactionType.BUY:
        if gross > 0:
            specs.append(MovementSpec(ccy, CashMovementType.BUY, -gross, tx_date))
        if fees > 0:
            specs.append(MovementSpec(ccy, CashMovementType.FEE, -fees, tx_date))
    elif tx_type == TransactionType.SELL:
        if gross > 0:
            specs.append(MovementSpec(ccy, CashMovementType.SELL, gross, tx_date))
        if fees > 0:
            specs.append(MovementSpec(ccy, CashMovementType.FEE, -fees, tx_date))
    elif tx_type == TransactionType.DIVIDEND:
        if gross > 0:
            specs.append(MovementSpec(ccy, CashMovementType.DIVIDEND, gross, tx_date))
        if fees > 0:
            specs.append(MovementSpec(ccy, CashMovementType.TAX, -fees, tx_date))
    elif tx_type == TransactionType.FEE:
        fee_amount = fees if fees > 0 else gross
        if fee_amount > 0:
            specs.append(MovementSpec(ccy, CashMovementType.FEE, -fee_amount, tx_date))
    elif tx_type == TransactionType.CONVERSION_OUT:
        if fees > 0:
            specs.append(MovementSpec(ccy, CashMovementType.FEE, -fees, tx_date))
    # SPLIT, TRANSFER_IN, TRANSFER_OUT, CONVERSION_IN: cash-neutral
    return specs


def derive_movement_specs_for_transaction(tx: Transaction) -> List[MovementSpec]:
    """derive_movement_specs from a Transaction row"""
    return derive_movement_specs(
        tx_type=tx.type,
        quantity=tx.quantity,
        price=tx.price,
        fees=tx.fees,
        currency=tx.currency,
        tx_date=tx.tx_date,
    )


def validate_cash_impact(
    db: Session,
    portfolio: Portfolio,
    specs: Sequence[MovementSpec],
    exclude_movement_ids: Optional[Sequence[int]] = None,
    exclude_transaction_id: Optional[int] = None,
    affected_currencies: Optional[Sequence[str]] = None,
    force_warn: bool = False,
) -> List[CashWarning]:
    """Validate the cash impact of proposed movements against the ledger.

    Runs the date-boundary sweep for every affected currency. In
    tracked_strict mode the first violation raises InsufficientCashError;
    in tracked_warn mode violations are returned as warnings. Callers must
    lock the affected cash accounts first (see crud.cash.lock_accounts).

    affected_currencies extends the sweep to currencies with no proposed
    movement (needed when a deletion removes their only inflow).

    force_warn turns strict violations into warnings - used by read-only
    previews that report what a strict import/apply would reject.
    """
    if portfolio.cash_mode == CashMode.UNTRACKED:
        return []

    strict = portfolio.cash_mode == CashMode.TRACKED_STRICT and not force_warn
    warnings: List[CashWarning] = []

    by_currency: Dict[str, List[MovementSpec]] = {}
    for spec in specs:
        by_currency.setdefault(spec.currency, []).append(spec)
    for ccy in affected_currencies or []:
        by_currency.setdefault(ccy, [])

    for currency, proposed in sorted(by_currency.items()):
        rows = crud_cash.get_ledger_rows(
            db,
            portfolio.id,
            currency,
            exclude_movement_ids=exclude_movement_ids,
            exclude_transaction_id=exclude_transaction_id,
        )
        # Merge existing and proposed movements into per-date deltas
        existing_by_date: Dict[date, Decimal] = {}
        for occurred_on, amount in rows:
            existing_by_date[occurred_on] = existing_by_date.get(occurred_on, Decimal(0)) + amount
        proposed_by_date: Dict[date, Decimal] = {}
        for spec in proposed:
            proposed_by_date[spec.occurred_on] = (
                proposed_by_date.get(spec.occurred_on, Decimal(0)) + spec.amount
            )

        all_dates = sorted(set(existing_by_date) | set(proposed_by_date))
        merged = Decimal(0)
        baseline = Decimal(0)
        violation: Optional[tuple[date, Decimal, Decimal]] = None
        for boundary in all_dates:
            merged += existing_by_date.get(boundary, Decimal(0))
            merged += proposed_by_date.get(boundary, Decimal(0))
            baseline += existing_by_date.get(boundary, Decimal(0))
            if merged < 0 and violation is None:
                violation = (boundary, merged, baseline)

        if violation is None:
            continue

        violation_date, merged_balance, baseline_balance = violation
        if strict:
            from app.observability.metrics import CASH_STRICT_REJECTIONS

            CASH_STRICT_REJECTIONS.inc()
            logger.info(
                "Strict-mode cash rejection",
                extra={
                    "event": "cash_strict_rejection",
                    "portfolio_id": portfolio.id,
                    "currency": currency,
                },
            )
            net = sum((spec.amount for spec in proposed), Decimal(0))
            required = -net if net < 0 else -merged_balance
            raise InsufficientCashError(
                portfolio_id=portfolio.id,
                currency=currency,
                available=max(baseline_balance, Decimal(0)),
                required=required,
                missing=-merged_balance,
                movement_date=violation_date,
            )
        warnings.append(
            CashWarning(
                code="negative_cash_balance",
                currency=currency,
                occurred_on=violation_date,
                projected_balance=merged_balance,
            )
        )

    return warnings


def enrich_base_amounts(
    specs: Sequence[MovementSpec],
    base_currency: str,
    _memo: Optional[dict] = None,
) -> List[tuple[Optional[Decimal], Optional[Decimal]]]:
    """(base_exchange_rate, base_currency_amount) per spec, best-effort.

    Uses the historical rate at occurred_on via the existing
    CurrencyService. Failures yield (None, None) - never a rate of 1.
    """
    from app.services.market_data.currency import CurrencyService

    base = (base_currency or "EUR").upper()
    memo: dict = _memo if _memo is not None else {}
    enriched: List[tuple[Optional[Decimal], Optional[Decimal]]] = []
    for spec in specs:
        if spec.currency == base:
            enriched.append((Decimal(1), q8(spec.amount)))
            continue
        key = (spec.currency, spec.occurred_on)
        if key not in memo:
            try:
                memo[key] = CurrencyService.get_historical_exchange_rate(
                    spec.currency, base, datetime.combine(spec.occurred_on, time.min)
                )
            except Exception:  # pragma: no cover - provider failures are non-fatal
                memo[key] = None
        rate = memo[key]
        if rate is None:
            enriched.append((None, None))
        else:
            rate = q8(Decimal(rate))
            enriched.append((rate, q8(spec.amount * rate)))
    return enriched


def insert_movements(
    db: Session,
    portfolio: Portfolio,
    specs: Sequence[MovementSpec],
    transaction_id: Optional[int] = None,
    enrich: bool = True,
    _fx_memo: Optional[dict] = None,
) -> List[CashMovement]:
    """Insert ledger rows for the given specs. Flushes, never commits."""
    if not specs:
        return []
    rates = (
        enrich_base_amounts(specs, portfolio.base_currency, _memo=_fx_memo)
        if enrich
        else [(None, None)] * len(specs)
    )
    movements = []
    for spec, (base_rate, base_amount) in zip(specs, rates):
        movement = CashMovement(
            portfolio_id=portfolio.id,
            currency=spec.currency,
            type=spec.type,
            amount=q8(spec.amount),
            occurred_on=spec.occurred_on,
            transaction_id=transaction_id,
            conversion_id=spec.conversion_id,
            activation_id=spec.activation_id,
            base_exchange_rate=base_rate,
            base_currency_amount=base_amount,
            conversion_rate=spec.conversion_rate,
            reason=spec.reason,
            notes=spec.notes,
            meta_data=spec.meta_data or {},
        )
        db.add(movement)
        movements.append(movement)
    db.flush()
    return movements


def apply_transaction_movements(
    db: Session,
    portfolio: Portfolio,
    tx: Transaction,
    specs: Optional[Sequence[MovementSpec]] = None,
    enrich: bool = True,
    _fx_memo: Optional[dict] = None,
) -> List[CashMovement]:
    """Replace-on-edit: delete and regenerate the movements of one transaction.

    Runs inside the caller's SQL transaction so a failed ledger write rolls
    back the transaction row too (and vice versa). Flushes, never commits.
    """
    crud_cash.delete_movements_for_transaction(db, tx.id)
    if specs is None:
        specs = derive_movement_specs_for_transaction(tx)
    return insert_movements(
        db, portfolio, specs, transaction_id=tx.id, enrich=enrich, _fx_memo=_fx_memo
    )


def signed_manual_amount(
    movement_type: CashMovementType,
    amount: Decimal,
    direction: Optional[str] = None,
) -> Decimal:
    """Assign the accounting sign to a positive API amount"""
    amount = q8(Decimal(amount))
    if amount <= 0:
        raise CashError(
            status_code=422,
            code="invalid_amount",
            message="Amount must be positive; the movement type determines the sign",
        )
    if movement_type in _CREDIT_TYPES:
        return amount
    if movement_type in _DEBIT_TYPES:
        return -amount
    if movement_type == CashMovementType.ADJUSTMENT:
        if direction not in ("credit", "debit"):
            raise CashError(
                status_code=422,
                code="adjustment_direction_required",
                message="Cash adjustments require a direction ('credit' or 'debit')",
            )
        return amount if direction == "credit" else -amount
    raise CashError(
        status_code=422,
        code="invalid_movement_type",
        message=f"Movement type '{movement_type.value}' cannot be created manually",
    )


def record_manual_movement(
    db: Session,
    portfolio: Portfolio,
    *,
    movement_type: CashMovementType,
    currency: str,
    amount: Decimal,
    occurred_on: date,
    direction: Optional[str] = None,
    reason: Optional[str] = None,
    notes: Optional[str] = None,
) -> tuple[CashMovement, List[CashWarning]]:
    """Create one manual cash movement (deposit, withdrawal, adjustment,
    interest, fee, tax). Flushes, never commits."""
    if movement_type not in MANUAL_MOVEMENT_TYPES:
        raise CashError(
            status_code=422,
            code="invalid_movement_type",
            message=f"Movement type '{movement_type.value}' cannot be created manually",
        )
    if movement_type == CashMovementType.ADJUSTMENT and not (reason or "").strip():
        raise AdjustmentReasonRequiredError()

    ccy = normalize_currency(currency)
    signed = signed_manual_amount(movement_type, amount, direction)
    spec = MovementSpec(
        currency=ccy,
        type=movement_type,
        amount=signed,
        occurred_on=occurred_on,
        reason=reason,
        notes=notes,
    )

    crud_cash.get_or_create_accounts(db, portfolio.id, [ccy])
    crud_cash.lock_accounts(db, portfolio.id, [ccy])
    warnings = validate_cash_impact(db, portfolio, [spec])
    movement = insert_movements(db, portfolio, [spec])[0]
    return movement, warnings


def update_manual_movement(
    db: Session,
    portfolio: Portfolio,
    movement: CashMovement,
    *,
    currency: Optional[str] = None,
    amount: Optional[Decimal] = None,
    occurred_on: Optional[date] = None,
    direction: Optional[str] = None,
    reason: Optional[str] = None,
    notes: Optional[str] = None,
) -> tuple[CashMovement, List[CashWarning]]:
    """Update a manual movement, re-validating the resulting ledger.

    The proposed new version is validated with the current row excluded,
    covering both the old currency (movement removed) and the new one.
    Flushes, never commits.
    """
    if movement.type == CashMovementType.ADJUSTMENT:
        effective_reason = reason if reason is not None else movement.reason
        if not (effective_reason or "").strip():
            raise AdjustmentReasonRequiredError()

    new_currency = normalize_currency(currency) if currency else movement.currency
    if amount is not None:
        current_direction = "credit" if Decimal(movement.amount) > 0 else "debit"
        signed = signed_manual_amount(movement.type, amount, direction or current_direction)
    elif direction is not None and movement.type == CashMovementType.ADJUSTMENT:
        signed = signed_manual_amount(movement.type, abs(Decimal(movement.amount)), direction)
    else:
        signed = Decimal(movement.amount)
    new_date = occurred_on or movement.occurred_on

    spec = MovementSpec(
        currency=new_currency,
        type=movement.type,
        amount=signed,
        occurred_on=new_date,
    )
    affected = {new_currency, movement.currency}
    crud_cash.get_or_create_accounts(db, portfolio.id, sorted(affected))
    crud_cash.lock_accounts(db, portfolio.id, sorted(affected))
    warnings = validate_cash_impact(
        db,
        portfolio,
        [spec],
        exclude_movement_ids=[movement.id],
        affected_currencies=sorted(affected),
    )

    movement.currency = new_currency
    movement.amount = q8(signed)
    movement.occurred_on = new_date
    if reason is not None:
        movement.reason = reason
    if notes is not None:
        movement.notes = notes
    if (movement.meta_data or {}).get("inferred"):
        # An edited inferred deposit becomes user-confirmed data
        movement.meta_data = {**movement.meta_data, "inferred": False, "user_confirmed": True}
    rate, base_amount = enrich_base_amounts([spec], portfolio.base_currency)[0]
    movement.base_exchange_rate = rate
    movement.base_currency_amount = base_amount
    db.flush()
    return movement, warnings


def delete_manual_movement(
    db: Session,
    portfolio: Portfolio,
    movement: CashMovement,
) -> List[CashWarning]:
    """Delete a manual movement, re-validating the ledger without it.

    Removing a credit (e.g. a deposit) can strand later debits; the sweep
    with the row excluded catches that. Flushes, never commits.
    """
    crud_cash.lock_accounts(db, portfolio.id, [movement.currency])
    warnings = validate_cash_impact(
        db,
        portfolio,
        [],
        exclude_movement_ids=[movement.id],
        affected_currencies=[movement.currency],
    )
    db.delete(movement)
    db.flush()
    return warnings


def build_fx_specs(
    *,
    source_currency: str,
    target_currency: str,
    source_amount: Decimal,
    target_amount: Decimal,
    occurred_on: date,
    conversion_id: str,
    fee_amount: Optional[Decimal] = None,
    fee_currency: Optional[str] = None,
    notes: Optional[str] = None,
) -> List[MovementSpec]:
    """The linked movement legs of one Forex conversion"""
    src = normalize_currency(source_currency)
    dst = normalize_currency(target_currency)
    if src == dst:
        raise CashError(
            status_code=422,
            code="fx_same_currency",
            message="Source and target currencies of a conversion must differ",
        )
    source_amount = q8(Decimal(source_amount))
    target_amount = q8(Decimal(target_amount))
    if source_amount <= 0 or target_amount <= 0:
        raise CashError(
            status_code=422,
            code="invalid_amount",
            message="Conversion amounts must be positive",
        )
    # Convention: target-currency units received per 1 source-currency unit
    rate = q8(target_amount / source_amount)
    leg_meta = {
        "source_currency": src,
        "target_currency": dst,
        "source_amount": str(source_amount),
        "target_amount": str(target_amount),
    }
    specs = [
        MovementSpec(
            currency=src,
            type=CashMovementType.FX_DEBIT,
            amount=-source_amount,
            occurred_on=occurred_on,
            conversion_id=conversion_id,
            conversion_rate=rate,
            notes=notes,
            meta_data=dict(leg_meta),
        ),
        MovementSpec(
            currency=dst,
            type=CashMovementType.FX_CREDIT,
            amount=target_amount,
            occurred_on=occurred_on,
            conversion_id=conversion_id,
            conversion_rate=rate,
            notes=notes,
            meta_data=dict(leg_meta),
        ),
    ]
    if fee_amount is not None and Decimal(fee_amount) > 0:
        fee_ccy = normalize_currency(fee_currency) if fee_currency else src
        specs.append(
            MovementSpec(
                currency=fee_ccy,
                type=CashMovementType.FEE,
                amount=-q8(Decimal(fee_amount)),
                occurred_on=occurred_on,
                conversion_id=conversion_id,
                notes=notes,
                meta_data=dict(leg_meta),
            )
        )
    return specs


def record_fx_conversion(
    db: Session,
    portfolio: Portfolio,
    *,
    source_currency: str,
    target_currency: str,
    source_amount: Decimal,
    target_amount: Decimal,
    occurred_on: date,
    fee_amount: Optional[Decimal] = None,
    fee_currency: Optional[str] = None,
    notes: Optional[str] = None,
    conversion_id: Optional[str] = None,
) -> tuple[str, List[CashMovement], List[CashWarning]]:
    """Create the linked legs of one Forex conversion atomically.

    Strict mode requires the source currency balance to cover the debit
    (plus a source-currency fee); no cross-currency netting ever happens.
    Flushes, never commits.
    """
    conversion_id = conversion_id or str(uuid.uuid4())
    specs = build_fx_specs(
        source_currency=source_currency,
        target_currency=target_currency,
        source_amount=source_amount,
        target_amount=target_amount,
        occurred_on=occurred_on,
        conversion_id=conversion_id,
        fee_amount=fee_amount,
        fee_currency=fee_currency,
        notes=notes,
    )
    currencies = sorted({spec.currency for spec in specs})
    crud_cash.get_or_create_accounts(db, portfolio.id, currencies)
    crud_cash.lock_accounts(db, portfolio.id, currencies)
    warnings = validate_cash_impact(db, portfolio, specs)
    movements = insert_movements(db, portfolio, specs)
    return conversion_id, movements, warnings


def update_fx_conversion(
    db: Session,
    portfolio: Portfolio,
    conversion_id: str,
    *,
    source_currency: str,
    target_currency: str,
    source_amount: Decimal,
    target_amount: Decimal,
    occurred_on: date,
    fee_amount: Optional[Decimal] = None,
    fee_currency: Optional[str] = None,
    notes: Optional[str] = None,
) -> tuple[List[CashMovement], List[CashWarning]]:
    """Replace all legs of a conversion consistently. Flushes, never commits."""
    existing = crud_cash.get_conversion_movements(db, portfolio.id, conversion_id)
    specs = build_fx_specs(
        source_currency=source_currency,
        target_currency=target_currency,
        source_amount=source_amount,
        target_amount=target_amount,
        occurred_on=occurred_on,
        conversion_id=conversion_id,
        fee_amount=fee_amount,
        fee_currency=fee_currency,
        notes=notes,
    )
    affected = sorted(
        {spec.currency for spec in specs} | {m.currency for m in existing}
    )
    crud_cash.get_or_create_accounts(db, portfolio.id, affected)
    crud_cash.lock_accounts(db, portfolio.id, affected)
    warnings = validate_cash_impact(
        db,
        portfolio,
        specs,
        exclude_movement_ids=[m.id for m in existing],
        affected_currencies=affected,
    )
    for movement in existing:
        db.delete(movement)
    db.flush()
    movements = insert_movements(db, portfolio, specs)
    return movements, warnings


def delete_fx_conversion(
    db: Session,
    portfolio: Portfolio,
    conversion_id: str,
    movements: Sequence[CashMovement],
) -> List[CashWarning]:
    """Delete all legs of a conversion atomically. Flushes, never commits."""
    affected = sorted({m.currency for m in movements})
    crud_cash.lock_accounts(db, portfolio.id, affected)
    warnings = validate_cash_impact(
        db,
        portfolio,
        [],
        exclude_movement_ids=[m.id for m in movements],
        affected_currencies=affected,
    )
    for movement in movements:
        db.delete(movement)
    db.flush()
    return warnings


# ---------------------------------------------------------------------------
# Asset transaction orchestration (tracked portfolios)
#
# These wrappers replace the plain crud calls in the transactions router
# when cash tracking is enabled: they lock the affected cash accounts,
# validate the cash impact (raising in strict mode), persist the
# transaction and its derived movements in one SQL transaction, keep the
# ledger sync sequence up to date, then commit and invalidate caches -
# mirroring what crud.create/update/delete_transaction(commit=True) does
# for untracked portfolios.
# ---------------------------------------------------------------------------

def mark_ledger_synced(db: Session, portfolio_id: int) -> None:
    """Record that the ledger reflects the current transaction revision.

    Executed inside the same SQL transaction as the transaction mutation,
    so tx_change_seq == cash_ledger_synced_seq holds invariantly while a
    portfolio is tracked. Does not commit.
    """
    db.query(Portfolio).filter(Portfolio.id == portfolio_id).update(
        {Portfolio.cash_ledger_synced_seq: Portfolio.tx_change_seq},
        synchronize_session=False,
    )


def _specs_from_payload(payload, tx_date: Optional[date] = None) -> List[MovementSpec]:
    return derive_movement_specs(
        tx_type=payload.type,
        quantity=Decimal(payload.quantity or 0),
        price=Decimal(payload.price or 0),
        fees=Decimal(payload.fees or 0),
        currency=payload.currency or "USD",
        tx_date=tx_date or payload.tx_date,
    )


def create_transaction_with_cash(
    db: Session,
    portfolio: Portfolio,
    payload,
) -> tuple[Transaction, List[CashWarning]]:
    """Create a transaction and its derived cash movements atomically"""
    from app.crud import transactions as crud_transactions
    from app.services.platform.cache import invalidate_positions

    specs = _specs_from_payload(payload)
    currencies = sorted({spec.currency for spec in specs})
    if currencies:
        crud_cash.get_or_create_accounts(db, portfolio.id, currencies)
        crud_cash.lock_accounts(db, portfolio.id, currencies)
    warnings = validate_cash_impact(db, portfolio, specs)

    tx = crud_transactions.create_transaction(db, portfolio.id, payload, commit=False)
    insert_movements(db, portfolio, specs, transaction_id=tx.id)
    mark_ledger_synced(db, portfolio.id)
    db.commit()
    db.refresh(tx)
    invalidate_positions(portfolio.id)
    return tx, warnings


def update_transaction_with_cash(
    db: Session,
    portfolio: Portfolio,
    transaction_id: int,
    payload,
) -> tuple[Optional[Transaction], List[CashWarning]]:
    """Update a transaction, replacing its derived movements atomically"""
    from app.crud import transactions as crud_transactions
    from app.services.platform.cache import invalidate_positions

    old_movements = crud_cash.get_movements_for_transaction(db, transaction_id)
    specs = _specs_from_payload(payload)
    affected = sorted({spec.currency for spec in specs} | {m.currency for m in old_movements})
    if affected:
        crud_cash.get_or_create_accounts(db, portfolio.id, affected)
        crud_cash.lock_accounts(db, portfolio.id, affected)
    warnings = validate_cash_impact(
        db,
        portfolio,
        specs,
        exclude_transaction_id=transaction_id,
        affected_currencies=affected,
    )

    tx = crud_transactions.update_transaction(db, transaction_id, payload, commit=False)
    if tx is None:
        return None, warnings
    apply_transaction_movements(db, portfolio, tx, specs)
    mark_ledger_synced(db, portfolio.id)
    db.commit()
    db.refresh(tx)
    invalidate_positions(portfolio.id)
    return tx, warnings


def delete_transactions_with_cash(
    db: Session,
    portfolio: Portfolio,
    transactions: Sequence[Transaction],
) -> List[CashWarning]:
    """Delete transactions (and their movements) atomically.

    Accepts several transactions so linked conversion legs are removed in
    one SQL transaction. Strict mode re-validates the ledger without the
    removed movements (removing a sell can strand later purchases).
    """
    from app.crud import transactions as crud_transactions
    from app.services.platform.cache import invalidate_positions

    movement_ids: List[int] = []
    affected: set[str] = set()
    for tx in transactions:
        for movement in crud_cash.get_movements_for_transaction(db, tx.id):
            movement_ids.append(movement.id)
            affected.add(movement.currency)
    if affected:
        crud_cash.lock_accounts(db, portfolio.id, sorted(affected))
    warnings = validate_cash_impact(
        db,
        portfolio,
        [],
        exclude_movement_ids=movement_ids,
        affected_currencies=sorted(affected),
    )

    for tx in transactions:
        crud_transactions.delete_transaction(db, tx.id, commit=False)
    mark_ledger_synced(db, portfolio.id)
    db.commit()
    invalidate_positions(portfolio.id)
    return warnings
