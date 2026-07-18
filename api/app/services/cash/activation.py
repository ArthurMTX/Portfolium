"""
Cash tracking activation, mode transitions and ledger wipe

Activation strategies:
- opening_balances: cash starts at start_date with user-provided opening
  balances; earlier transactions never affect cash.
- replay: the cash effects of historical transactions since start_date are
  reconstructed with a minimum-funding model; because historical deposits
  are usually missing, a deposit for the exact shortfall is inferred on
  the day of each transaction the reconstructed balance cannot cover
  (inflows such as sale proceeds stay available for later days). Inferred
  deposits are persisted as regular deposit movements marked with
  metadata.inferred = true; the user reviews them in the preview and
  apply recomputes the same deterministic result.

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


def _resolve_start_date(
    db: Session, portfolio: Portfolio, requested: Optional[date]
) -> date:
    """An omitted start_date means "scan everything": the earliest
    transaction date, or today for a portfolio with no transactions."""
    if requested is not None:
        return requested
    earliest = (
        db.query(Transaction.tx_date)
        .filter(Transaction.portfolio_id == portfolio.id)
        .order_by(Transaction.tx_date)
        .limit(1)
        .scalar()
    )
    return earliest or date.today()


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


def infer_funding_deposits(
    deltas: DeltasByCurrency,
) -> Dict[str, List[Tuple[date, Decimal]]]:
    """Minimum-funding reconstruction: the deposits required for the given
    history to never go negative, inferred transaction-by-transaction.

    Per currency, the date boundaries are walked in accounting order with
    a balance starting at zero; whenever a day's net delta would push the
    balance below zero, a deposit for the exact shortfall is created on
    that day (accounting-before the movements it funds — intra-day order
    never changes a balance, see the ledger ordering rules). Inflows
    (sells, dividends, explicit deposits, opening balances) stay available
    for later days, no withdrawal is ever inferred, and nothing is created
    when the running balance already covers the day.
    """
    inferred: Dict[str, List[Tuple[date, Decimal]]] = {}
    for currency, per_date in deltas.items():
        balance = Decimal(0)
        deposits: List[Tuple[date, Decimal]] = []
        for day in sorted(per_date):
            net = per_date[day]
            if balance + net < 0:
                shortfall = q8(-(balance + net))
                deposits.append((day, shortfall))
                balance += shortfall
            balance += net
        if deposits:
            inferred[currency] = deposits
    return inferred


def _apply_inferred_to_deltas(
    deltas: DeltasByCurrency,
    inferred: Dict[str, List[Tuple[date, Decimal]]],
) -> DeltasByCurrency:
    """Merge inferred deposits into a copy of the per-date deltas"""
    merged: DeltasByCurrency = {c: dict(per) for c, per in deltas.items()}
    for currency, deposits in inferred.items():
        per = merged.setdefault(currency, {})
        for day, amount in deposits:
            per[day] = per.get(day, Decimal(0)) + amount
    return merged


def _inferred_deposit_specs(
    inferred: Dict[str, List[Tuple[date, Decimal]]],
    activation_id: Optional[str],
) -> List[MovementSpec]:
    """Movement specs for inferred deposits (marked as reconstructed)"""
    return [
        MovementSpec(
            currency=currency,
            type=CashMovementType.DEPOSIT,
            amount=amount,
            occurred_on=day,
            activation_id=activation_id,
            reason="Inferred deposit (minimum-funding reconstruction)",
            meta_data={"inferred": True, "source": "replay_reconstruction"},
        )
        for currency, deposits in sorted(inferred.items())
        for day, amount in deposits
    ]


def _inferred_totals(
    inferred: Dict[str, List[Tuple[date, Decimal]]],
) -> List[schemas.CashInferredDepositTotal]:
    return [
        schemas.CashInferredDepositTotal(
            currency=currency,
            amount=q8(sum((amount for _day, amount in deposits), Decimal(0))),
            count=len(deposits),
        )
        for currency, deposits in sorted(inferred.items())
    ]


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
    start_date = _resolve_start_date(db, portfolio, request.start_date)
    derived, issues = _derive_specs_since(db, portfolio, start_date)
    if db.query(CashMovement.id).filter(CashMovement.portfolio_id == portfolio.id).first():
        issues.append(
            "A retained cash ledger exists for this portfolio; wipe it "
            "(DELETE /cash/ledger) or re-enable the previous configuration "
            "(PUT /cash/mode) instead of activating again"
        )

    deltas = _merge_deltas(openings, start_date, derived)
    inferred: Dict[str, List[Tuple[date, Decimal]]] = {}
    if request.strategy == "replay":
        # Minimum-funding reconstruction: infer a deposit for the exact
        # shortfall of each day the running balance cannot cover (never
        # one large opening balance at the deepest historical dip)
        inferred = infer_funding_deposits(deltas)

    swept = _sweep(_apply_inferred_to_deltas(deltas, inferred))
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
        start_date=start_date,
        target_mode=request.target_mode,
        derived_movement_count=sum(len(specs) for _tx, specs in derived),
        opening_balances=[
            schemas.CashOpeningBalance(currency=c, amount=a)
            for c, a in sorted(openings.items())
        ],
        proposed_inferred_deposits=[
            schemas.CashInferredDeposit(currency=currency, date=day, amount=amount)
            for currency, deposits in sorted(inferred.items())
            for day, amount in deposits
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

    For the replay strategy, apply recomputes the inferred minimum-funding
    deposits with the same deterministic algorithm the preview used — the
    client confirms the proposal but never sends it back. The request's
    opening_balances only ever carry user-entered balances.
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
        stored_inferred = meta.get("inferred_deposits") or {}
        return schemas.CashActivationResult(
            portfolio_id=portfolio.id,
            cash_mode=portfolio.cash_mode,
            cash_tracking_started_on=portfolio.cash_tracking_started_on,
            activation_id=request.activation_id,
            opening_balances=[
                schemas.CashOpeningBalance(**entry)
                for entry in meta.get("opening_balances", [])
            ],
            inferred_deposit_count=stored_inferred.get("count", 0),
            inferred_deposit_totals=[
                schemas.CashInferredDepositTotal(**entry)
                for entry in stored_inferred.get("totals", [])
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
    start_date = _resolve_start_date(db, portfolio, request.start_date)
    derived, issues = _derive_specs_since(db, portfolio, start_date)
    if issues:
        raise CashError(
            status_code=422,
            code="cash_activation_blocked",
            message="; ".join(issues),
        )

    deltas = _merge_deltas(openings, start_date, derived)
    inferred: Dict[str, List[Tuple[date, Decimal]]] = {}
    if request.strategy == "replay":
        inferred = infer_funding_deposits(deltas)

    if request.target_mode == CashMode.TRACKED_STRICT:
        # A replay reconstruction is dip-free by construction; the sweep
        # still guards the opening_balances strategy (and regressions)
        swept = _sweep(_apply_inferred_to_deltas(deltas, inferred))
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
        set(openings)
        | set(inferred)
        | {spec.currency for _tx, specs in derived for spec in specs}
    )
    if currencies:
        crud_cash.get_or_create_accounts(db, portfolio.id, currencies)
        crud_cash.lock_accounts(db, portfolio.id, currencies)

    opening_specs = [
        MovementSpec(
            currency=currency,
            type=CashMovementType.OPENING_BALANCE,
            amount=amount,
            occurred_on=start_date,
            activation_id=request.activation_id,
            reason=f"Opening balance ({request.strategy} activation)",
        )
        for currency, amount in sorted(openings.items())
    ]
    inferred_specs = _inferred_deposit_specs(inferred, request.activation_id)
    fx_memo: dict = {}
    ledger.insert_movements(db, portfolio, opening_specs, _fx_memo=fx_memo)
    ledger.insert_movements(db, portfolio, inferred_specs, _fx_memo=fx_memo)
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
    inferred_totals = _inferred_totals(inferred)
    inferred_payload = {
        "count": len(inferred_specs),
        "totals": [
            {"currency": t.currency, "amount": str(t.amount), "count": t.count}
            for t in inferred_totals
        ],
    }
    movement_count = derived_count + len(opening_specs) + len(inferred_specs)
    portfolio.cash_mode = request.target_mode
    portfolio.cash_tracking_started_on = start_date
    portfolio.cash_activation_id = request.activation_id
    portfolio.cash_activation_meta = {
        "strategy": request.strategy,
        "applied_at": datetime.utcnow().isoformat(),
        "applied_by_user_id": user_id,
        "target_mode": request.target_mode.value,
        "opening_balances": opening_payload,
        "inferred_deposits": inferred_payload,
        "derived_movement_count": movement_count,
    }
    ledger.mark_ledger_synced(db, portfolio.id)
    db.commit()
    db.refresh(portfolio)

    from app.observability.metrics import CASH_ACTIVATIONS, CASH_MOVEMENTS_CREATED

    CASH_ACTIVATIONS.labels(strategy=request.strategy).inc()
    for spec in opening_specs:
        CASH_MOVEMENTS_CREATED.labels(type=spec.type.value).inc()
    for spec in inferred_specs:
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
        inferred_deposit_count=len(inferred_specs),
        inferred_deposit_totals=inferred_totals,
        derived_movement_count=movement_count,
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


def migrate_replay_openings_to_inferred(db: Session) -> List[int]:
    """One-time migration from the deepest-point model (pre-v0.4.0 dev
    ledgers): replace the auto-generated opening balance of every replay
    activation with progressive minimum-funding deposits recomputed from
    the retained ledger movements.

    Only opening_balance movements whose activation_id matches a portfolio
    whose stored activation strategy is 'replay' are touched — genuine
    user-entered opening balances (opening_balances strategy), manual
    deposits/withdrawals/adjustments and transaction-derived movements are
    never modified, and they all participate in the recomputation. Known
    ambiguity: an API client could have mixed user-supplied openings into
    a replay activation (the UI never does); those cannot be told apart
    from the proposed portion and are conservatively treated as inferred.

    Idempotent: once the openings are gone, later runs are no-ops.
    FX enrichment is intentionally skipped (base amounts stay NULL rather
    than fetched from a network provider inside a migration).
    Returns the migrated portfolio ids. Flushes, never commits.
    """
    migrated: List[int] = []
    portfolios = (
        db.query(Portfolio).filter(Portfolio.cash_activation_id.isnot(None)).all()
    )
    for portfolio in portfolios:
        meta = dict(portfolio.cash_activation_meta or {})
        if meta.get("strategy") != "replay":
            continue
        stale_openings = (
            db.query(CashMovement)
            .filter(
                CashMovement.portfolio_id == portfolio.id,
                CashMovement.type == CashMovementType.OPENING_BALANCE,
                CashMovement.activation_id == portfolio.cash_activation_id,
            )
            .all()
        )
        if not stale_openings:
            continue
        for movement in stale_openings:
            db.delete(movement)
        db.flush()

        # Recompute from every retained movement (derived + manual): the
        # same day-boundary walk the activation itself uses
        deltas: DeltasByCurrency = {}
        rows = (
            db.query(CashMovement.currency, CashMovement.occurred_on, CashMovement.amount)
            .filter(CashMovement.portfolio_id == portfolio.id)
            .all()
        )
        for currency, day, amount in rows:
            per = deltas.setdefault(currency, {})
            per[day] = per.get(day, Decimal(0)) + Decimal(amount)
        inferred = infer_funding_deposits(deltas)
        inferred_specs = _inferred_deposit_specs(inferred, portfolio.cash_activation_id)
        ledger.insert_movements(db, portfolio, inferred_specs, enrich=False)

        inferred_totals = _inferred_totals(inferred)
        meta["opening_balances"] = []
        meta["inferred_deposits"] = {
            "count": len(inferred_specs),
            "totals": [
                {"currency": t.currency, "amount": str(t.amount), "count": t.count}
                for t in inferred_totals
            ],
        }
        meta["migrated_from_deepest_point"] = True
        portfolio.cash_activation_meta = meta
        migrated.append(portfolio.id)
        logger.info(
            "Replay opening balance migrated to inferred deposits",
            extra={
                "event": "cash_replay_openings_migrated",
                "portfolio_id": portfolio.id,
                "inferred_deposit_count": len(inferred_specs),
            },
        )
    db.flush()
    return migrated


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
