"""
Cash tracking activation, mode transitions and ledger wipe

Activation strategies:
- opening_balances: cash starts at start_date with user-provided opening
  balances; earlier transactions never affect cash.
- replay: the cash effects of historical transactions since start_date are
  reconstructed; because historical deposits are usually missing, the
  preview computes, per currency, the minimal opening balance that avoids
  an unexplained negative dip (never one fake deposit per purchase). The
  user must explicitly confirm the proposed openings on apply.

Apply is atomic (one SQL transaction, portfolio row locked) and idempotent
(client-supplied activation_id; re-POSTing returns the stored result, and
a partial unique index on (activation_id, currency) for opening balances
backstops races at the database level).

Mode transitions:
- untracked -> tracked_*: via activation; re-enabling over a retained
  ledger goes through change_mode and requires the ledger not to be stale
  (tx_change_seq == cash_ledger_synced_seq detects transactions created,
  edited, deleted or backdated while tracking was off).
- tracked_warn -> tracked_strict: full historical non-negativity sweep.
- tracked_strict -> tracked_warn: always allowed.
- tracked_* -> untracked: always allowed; the ledger is retained but
  excluded from valuation and validation. Destructive deletion is the
  separate, explicit wipe_ledger action.
"""
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app import schemas
from app.crud import cash as crud_cash
from app.errors import (
    CashActivationConflictError,
    CashError,
    CashLedgerNotEmptyError,
    CashLedgerStaleError,
    CashModeTransitionError,
    InsufficientCashError,
    InvalidCurrencyCodeError,
)
from app.models import CashMode, CashMovement, CashMovementType, Portfolio, Transaction
from app.services.cash import ledger
from app.services.cash.currencies import normalize_currency
from app.services.cash.ledger import MovementSpec, q8

logger = logging.getLogger(__name__)

# date -> signed delta, per currency
DeltasByCurrency = Dict[str, Dict[date, Decimal]]


def _lock_portfolio(db: Session, portfolio_id: int) -> Portfolio:
    """Re-read the portfolio row under FOR UPDATE (plain read on SQLite).

    populate_existing forces the fresh row values onto an already-loaded
    instance: the revision counters are updated via bulk UPDATEs
    (synchronize_session=False), so a cached instance could be stale.
    """
    return (
        db.query(Portfolio)
        .filter(Portfolio.id == portfolio_id)
        .populate_existing()
        .with_for_update()
        .one()
    )


def _derive_specs_since(
    db: Session, portfolio: Portfolio, start_date: date
) -> Tuple[List[Tuple[Transaction, List[MovementSpec]]], List[str]]:
    """Movement specs for every transaction on/after start_date.

    Unsupported settlement currencies become blocking issues (reported in
    the preview) instead of silently dropping cash effects.
    """
    transactions = (
        db.query(Transaction)
        .filter(
            Transaction.portfolio_id == portfolio.id,
            Transaction.tx_date >= start_date,
        )
        .order_by(Transaction.tx_date, Transaction.id)
        .all()
    )
    derived: List[Tuple[Transaction, List[MovementSpec]]] = []
    issues: List[str] = []
    for tx in transactions:
        try:
            specs = ledger.derive_movement_specs_for_transaction(tx)
        except InvalidCurrencyCodeError:
            issues.append(
                f"Transaction {tx.id} ({tx.tx_date.isoformat()}) uses unsupported "
                f"settlement currency '{tx.currency}'"
            )
            continue
        if specs:
            derived.append((tx, specs))
    return derived, issues


def _merge_deltas(
    openings: Dict[str, Decimal],
    start_date: date,
    derived: List[Tuple[Transaction, List[MovementSpec]]],
) -> DeltasByCurrency:
    deltas: DeltasByCurrency = {}
    for currency, amount in openings.items():
        if amount != 0:
            deltas.setdefault(currency, {})[start_date] = (
                deltas.get(currency, {}).get(start_date, Decimal(0)) + amount
            )
    for _tx, specs in derived:
        for spec in specs:
            per = deltas.setdefault(spec.currency, {})
            per[spec.occurred_on] = per.get(spec.occurred_on, Decimal(0)) + spec.amount
    return deltas


def _sweep(
    deltas: DeltasByCurrency,
) -> Dict[str, Tuple[Decimal, Decimal, Optional[Tuple[date, Decimal]]]]:
    """Per currency: (final_balance, running_minimum, first_negative_dip).

    Date-boundary semantics: all deltas of one date apply together before
    the balance is inspected.
    """
    result = {}
    for currency, per_date in deltas.items():
        balance = Decimal(0)
        minimum = Decimal(0)
        dip: Optional[Tuple[date, Decimal]] = None
        for day in sorted(per_date):
            balance += per_date[day]
            if balance < minimum:
                minimum = balance
            if balance < 0 and dip is None:
                dip = (day, balance)
        result[currency] = (balance, minimum, dip)
    return result


def _normalized_openings(request: schemas.CashActivationRequest) -> Dict[str, Decimal]:
    openings: Dict[str, Decimal] = {}
    for entry in request.opening_balances:
        currency = normalize_currency(entry.currency)
        amount = q8(Decimal(entry.amount))
        if amount < 0:
            raise CashError(
                status_code=422,
                code="invalid_amount",
                message="Opening balances cannot be negative",
            )
        openings[currency] = openings.get(currency, Decimal(0)) + amount
    return {c: a for c, a in openings.items() if a > 0}


def preview_activation(
    db: Session, portfolio: Portfolio, request: schemas.CashActivationRequest
) -> schemas.CashActivationPreview:
    """Dry-run of an activation. Writes nothing."""
    if portfolio.cash_mode != CashMode.UNTRACKED:
        raise CashActivationConflictError(portfolio.id)

    openings = _normalized_openings(request)
    derived, issues = _derive_specs_since(db, portfolio, request.start_date)
    if db.query(CashMovement.id).filter(CashMovement.portfolio_id == portfolio.id).first():
        issues.append(
            "A retained cash ledger exists for this portfolio; wipe it "
            "(DELETE /cash/ledger) or re-enable the previous configuration "
            "(PUT /cash/mode) instead of activating again"
        )

    proposed: Dict[str, Decimal] = {}
    if request.strategy == "replay":
        # Propose, per currency, the opening balance that lifts the running
        # minimum (with the user-provided openings applied) back to zero
        swept = _sweep(_merge_deltas(openings, request.start_date, derived))
        for currency, (_final, minimum, _dip) in swept.items():
            if minimum < 0:
                proposed[currency] = q8(-minimum)

    effective_openings = dict(openings)
    for currency, amount in proposed.items():
        effective_openings[currency] = effective_openings.get(currency, Decimal(0)) + amount

    swept = _sweep(_merge_deltas(effective_openings, request.start_date, derived))
    projected = [
        schemas.CashProjectedBalance(currency=currency, balance=q8(final))
        for currency, (final, _minimum, _dip) in sorted(swept.items())
    ]
    dips = [
        schemas.CashNegativeDip(currency=currency, date=dip[0], projected_balance=q8(dip[1]))
        for currency, (_final, _minimum, dip) in sorted(swept.items())
        if dip is not None
    ]

    return schemas.CashActivationPreview(
        strategy=request.strategy,
        start_date=request.start_date,
        target_mode=request.target_mode,
        derived_movement_count=sum(len(specs) for _tx, specs in derived),
        opening_balances=[
            schemas.CashOpeningBalance(currency=c, amount=a)
            for c, a in sorted(openings.items())
        ],
        proposed_opening_balances=[
            schemas.CashOpeningBalance(currency=c, amount=a)
            for c, a in sorted(proposed.items())
        ],
        projected_balances=projected,
        negative_dips=dips,
        blocking_issues=issues,
    )


def apply_activation(
    db: Session,
    portfolio: Portfolio,
    request: schemas.CashActivationRequest,
    user_id: int,
) -> schemas.CashActivationResult:
    """Enable cash tracking atomically and idempotently.

    Unlike the replay preview, apply never invents opening balances: the
    request's opening_balances are what gets recorded (the UI passes the
    confirmed proposals through).
    """
    if not request.activation_id:
        raise CashError(
            status_code=422,
            code="activation_id_required",
            message="activation_id (a client-generated UUID) is required to apply an activation",
        )

    portfolio = _lock_portfolio(db, portfolio.id)

    if portfolio.cash_activation_id == request.activation_id:
        # Idempotent retry: return the stored result
        meta = portfolio.cash_activation_meta or {}
        return schemas.CashActivationResult(
            portfolio_id=portfolio.id,
            cash_mode=portfolio.cash_mode,
            cash_tracking_started_on=portfolio.cash_tracking_started_on,
            activation_id=request.activation_id,
            opening_balances=[
                schemas.CashOpeningBalance(**entry)
                for entry in meta.get("opening_balances", [])
            ],
            derived_movement_count=meta.get("derived_movement_count", 0),
            already_applied=True,
        )

    if portfolio.cash_mode != CashMode.UNTRACKED:
        raise CashActivationConflictError(portfolio.id)
    if db.query(CashMovement.id).filter(CashMovement.portfolio_id == portfolio.id).first():
        raise CashLedgerNotEmptyError(
            portfolio.id,
            "A retained cash ledger exists; wipe it (DELETE /cash/ledger) or "
            "re-enable the previous configuration (PUT /cash/mode)",
        )

    openings = _normalized_openings(request)
    derived, issues = _derive_specs_since(db, portfolio, request.start_date)
    if issues:
        raise CashError(
            status_code=422,
            code="cash_activation_blocked",
            message="; ".join(issues),
        )

    if request.target_mode == CashMode.TRACKED_STRICT:
        swept = _sweep(_merge_deltas(openings, request.start_date, derived))
        for currency, (_final, _minimum, dip) in sorted(swept.items()):
            if dip is not None:
                raise InsufficientCashError(
                    portfolio_id=portfolio.id,
                    currency=currency,
                    available=Decimal(0),
                    required=-dip[1],
                    missing=-dip[1],
                    movement_date=dip[0],
                )

    currencies = sorted(
        set(openings) | {spec.currency for _tx, specs in derived for spec in specs}
    )
    if currencies:
        crud_cash.get_or_create_accounts(db, portfolio.id, currencies)
        crud_cash.lock_accounts(db, portfolio.id, currencies)

    opening_specs = [
        MovementSpec(
            currency=currency,
            type=CashMovementType.OPENING_BALANCE,
            amount=amount,
            occurred_on=request.start_date,
            activation_id=request.activation_id,
            reason=f"Opening balance ({request.strategy} activation)",
        )
        for currency, amount in sorted(openings.items())
    ]
    fx_memo: dict = {}
    ledger.insert_movements(db, portfolio, opening_specs, _fx_memo=fx_memo)
    derived_count = 0
    for tx, specs in derived:
        ledger.insert_movements(
            db, portfolio, specs, transaction_id=tx.id, _fx_memo=fx_memo
        )
        derived_count += len(specs)

    opening_payload = [
        {"currency": currency, "amount": str(amount)}
        for currency, amount in sorted(openings.items())
    ]
    portfolio.cash_mode = request.target_mode
    portfolio.cash_tracking_started_on = request.start_date
    portfolio.cash_activation_id = request.activation_id
    portfolio.cash_activation_meta = {
        "strategy": request.strategy,
        "applied_at": datetime.utcnow().isoformat(),
        "applied_by_user_id": user_id,
        "target_mode": request.target_mode.value,
        "opening_balances": opening_payload,
        "derived_movement_count": derived_count + len(opening_specs),
    }
    ledger.mark_ledger_synced(db, portfolio.id)
    db.commit()
    db.refresh(portfolio)

    from app.observability.metrics import CASH_ACTIVATIONS, CASH_MOVEMENTS_CREATED

    CASH_ACTIVATIONS.labels(strategy=request.strategy).inc()
    for spec in opening_specs:
        CASH_MOVEMENTS_CREATED.labels(type=spec.type.value).inc()
    logger.info(
        "Cash tracking activated",
        extra={
            "event": "cash_activation_applied",
            "portfolio_id": portfolio.id,
            "strategy": request.strategy,
            "target_mode": request.target_mode.value,
        },
    )
    return schemas.CashActivationResult(
        portfolio_id=portfolio.id,
        cash_mode=portfolio.cash_mode,
        cash_tracking_started_on=portfolio.cash_tracking_started_on,
        activation_id=request.activation_id,
        opening_balances=[
            schemas.CashOpeningBalance(currency=e["currency"], amount=Decimal(e["amount"]))
            for e in opening_payload
        ],
        derived_movement_count=derived_count + len(opening_specs),
        already_applied=False,
    )


def _assert_ledger_non_negative(db: Session, portfolio: Portfolio) -> None:
    """Full historical sweep: every currency must stay >= 0 at every date
    boundary. Used when tightening to strict mode."""
    currencies = sorted(
        row[0]
        for row in db.query(CashMovement.currency)
        .filter(CashMovement.portfolio_id == portfolio.id)
        .distinct()
    )
    for currency in currencies:
        balance = Decimal(0)
        current_day: Optional[date] = None
        for day, amount in crud_cash.get_ledger_rows(db, portfolio.id, currency):
            if current_day is not None and day != current_day and balance < 0:
                _raise_dip(portfolio.id, currency, current_day, balance)
            balance += amount
            current_day = day
        if balance < 0 and current_day is not None:
            _raise_dip(portfolio.id, currency, current_day, balance)


def _raise_dip(portfolio_id: int, currency: str, day: date, balance: Decimal) -> None:
    raise InsufficientCashError(
        portfolio_id=portfolio_id,
        currency=currency,
        available=balance,
        required=-balance,
        missing=-balance,
        movement_date=day,
    )


def change_mode(db: Session, portfolio: Portfolio, target: CashMode) -> Portfolio:
    """Transition the cash mode (see module docstring for the matrix)"""
    portfolio = _lock_portfolio(db, portfolio.id)
    current = portfolio.cash_mode
    if current == target:
        return portfolio

    if current == CashMode.UNTRACKED:
        # Re-enabling a previously configured ledger
        if portfolio.cash_activation_id is None:
            raise CashModeTransitionError(
                portfolio.id, current.value, target.value,
                "cash tracking has never been activated; use the activation workflow",
            )
        if portfolio.tx_change_seq != (portfolio.cash_ledger_synced_seq or 0):
            raise CashLedgerStaleError(portfolio.id)
        if target == CashMode.TRACKED_STRICT:
            _assert_ledger_non_negative(db, portfolio)
    elif target == CashMode.TRACKED_STRICT:
        # warn -> strict: the whole history must be dip-free
        _assert_ledger_non_negative(db, portfolio)
    # strict -> warn and tracked -> untracked need no validation;
    # the ledger is always retained.

    portfolio.cash_mode = target
    db.commit()
    db.refresh(portfolio)

    from app.observability.metrics import CASH_MODE_TRANSITIONS

    CASH_MODE_TRANSITIONS.labels(from_mode=current.value, to_mode=target.value).inc()
    logger.info(
        "Cash mode changed",
        extra={
            "event": "cash_mode_changed",
            "portfolio_id": portfolio.id,
            "from_mode": current.value,
            "to_mode": target.value,
        },
    )
    return portfolio


def wipe_ledger(db: Session, portfolio: Portfolio) -> None:
    """Destructive, explicit deletion of all cash ledger data.

    Only allowed while untracked, so disabling tracking (which retains the
    ledger) and destroying data stay two separate user actions.
    """
    portfolio = _lock_portfolio(db, portfolio.id)
    if portfolio.cash_mode != CashMode.UNTRACKED:
        raise CashLedgerNotEmptyError(
            portfolio.id,
            "Disable cash tracking before wiping the cash ledger",
        )

    deleted = (
        db.query(CashMovement)
        .filter(CashMovement.portfolio_id == portfolio.id)
        .delete(synchronize_session=False)
    )
    from app.models import CashAccount

    db.query(CashAccount).filter(CashAccount.portfolio_id == portfolio.id).delete(
        synchronize_session=False
    )
    portfolio.cash_activation_id = None
    portfolio.cash_activation_meta = None
    portfolio.cash_tracking_started_on = None
    portfolio.cash_ledger_synced_seq = None
    db.commit()

    logger.info(
        "Cash ledger wiped",
        extra={
            "event": "cash_ledger_wiped",
            "portfolio_id": portfolio.id,
            "movements_deleted": deleted,
        },
    )
