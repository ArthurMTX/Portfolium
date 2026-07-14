"""
Cash management router

All endpoints are scoped to a portfolio the caller owns
(verify_portfolio_access) and, except the activation endpoints, require
cash tracking to be enabled. Business errors use the structured
CashError shape: {"detail": {"code", "message", "context"}}.

Service functions flush but never commit; this router owns the commit and
runs the same cache-invalidation block as transaction writes.
"""
import logging

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from app import schemas
from app.auth import get_current_user, verify_portfolio_access
from app.crud import cash as crud_cash
from app.db import get_db
from app.errors import (
    CashMovementNotFoundError,
    CashTrackingNotEnabledError,
    DerivedMovementImmutableError,
    FxConversionNotFoundError,
)
from app.models import CashMode, CashMovementType, Portfolio as PortfolioModel, User
from app.observability.metrics import CASH_MOVEMENTS_CREATED
from app.services.cash import activation as cash_activation
from app.services.cash import ledger as cash_ledger
from app.services.cash import valuation as cash_valuation

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_tracking(portfolio: PortfolioModel) -> None:
    if portfolio.cash_mode == CashMode.UNTRACKED:
        raise CashTrackingNotEnabledError(portfolio.id)


def _invalidate(portfolio_id: int) -> None:
    """Same invalidation block as transaction mutations"""
    from app.services.platform.analytics_cache import invalidate_portfolio_analytics
    from app.services.platform.cache import CacheService

    invalidate_portfolio_analytics(portfolio_id)
    CacheService.invalidate_portfolio(portfolio_id)


def _require_manual_movement(db: Session, portfolio: PortfolioModel, movement_id: int):
    movement = crud_cash.get_movement(db, portfolio.id, movement_id)
    if movement is None:
        raise CashMovementNotFoundError(portfolio.id, movement_id)
    if movement.transaction_id is not None:
        raise DerivedMovementImmutableError(movement.id, "transaction")
    if movement.conversion_id is not None:
        raise DerivedMovementImmutableError(movement.id, "conversion")
    if movement.type == CashMovementType.OPENING_BALANCE:
        raise DerivedMovementImmutableError(movement.id, "activation")
    return movement


# ---------------------------------------------------------------------------
# Balances / summary
# ---------------------------------------------------------------------------

@router.get("/{portfolio_id}/cash/balances", response_model=schemas.CashBalancesResponse)
def get_cash_balances(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Per-currency cash balances with base-currency conversion and rate freshness"""
    _require_tracking(portfolio)
    summary = cash_valuation.get_cash_summary(db, portfolio)
    return schemas.CashBalancesResponse(
        portfolio_id=portfolio.id,
        base_currency=summary.base_currency,
        balances=summary.balances,
        total_base=summary.total_base,
        fx_status=summary.fx_status,
        as_of=summary.as_of,
    )


@router.get("/{portfolio_id}/cash/summary", response_model=schemas.CashSummary)
def get_cash_summary(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Cash valuation plus the cash PnL breakdown (fx_pnl deferred)"""
    _require_tracking(portfolio)
    return cash_valuation.get_cash_summary(db, portfolio, include_pnl=True)


# ---------------------------------------------------------------------------
# Movements
# ---------------------------------------------------------------------------

@router.get("/{portfolio_id}/cash/movements", response_model=schemas.CashMovementListResponse)
def list_cash_movements(
    portfolio_id: int,
    currency: Optional[str] = Query(default=None, max_length=8),
    type: Optional[CashMovementType] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Movement history, newest first"""
    _require_tracking(portfolio)
    movements, total = crud_cash.get_movements(
        db,
        portfolio.id,
        currency=currency.upper() if currency else None,
        movement_type=type,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )
    items = []
    for movement in movements:
        item = schemas.CashMovementOut.model_validate(movement)
        if movement.transaction is not None and movement.transaction.asset is not None:
            item.asset_symbol = movement.transaction.asset.symbol
        items.append(item)
    return schemas.CashMovementListResponse(items=items, total=total)


@router.post(
    "/{portfolio_id}/cash/movements",
    response_model=schemas.CashMovementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_cash_movement(
    portfolio_id: int,
    payload: schemas.CashMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Create a manual cash movement (deposit, withdrawal, adjustment,
    interest, fee, tax). Amounts are positive; the backend assigns the
    accounting sign. opening_balance is reserved for activation."""
    _require_tracking(portfolio)
    movement, warnings = cash_ledger.record_manual_movement(
        db,
        portfolio,
        movement_type=payload.type,
        currency=payload.currency,
        amount=payload.amount,
        occurred_on=payload.occurred_on,
        direction=payload.direction,
        reason=payload.reason,
        notes=payload.notes,
    )
    db.commit()
    db.refresh(movement)
    _invalidate(portfolio.id)
    CASH_MOVEMENTS_CREATED.labels(type=movement.type.value).inc()
    return schemas.CashMovementResponse(
        movement=movement, warnings=[w.as_dict() for w in warnings]
    )


@router.put(
    "/{portfolio_id}/cash/movements/{movement_id}",
    response_model=schemas.CashMovementResponse,
)
def update_cash_movement(
    portfolio_id: int,
    movement_id: int,
    payload: schemas.CashMovementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Update a manual movement. Transaction/conversion-derived and
    opening-balance movements are immutable through this endpoint."""
    _require_tracking(portfolio)
    movement = _require_manual_movement(db, portfolio, movement_id)
    movement, warnings = cash_ledger.update_manual_movement(
        db,
        portfolio,
        movement,
        currency=payload.currency,
        amount=payload.amount,
        occurred_on=payload.occurred_on,
        direction=payload.direction,
        reason=payload.reason,
        notes=payload.notes,
    )
    db.commit()
    db.refresh(movement)
    _invalidate(portfolio.id)
    return schemas.CashMovementResponse(
        movement=movement, warnings=[w.as_dict() for w in warnings]
    )


@router.delete("/{portfolio_id}/cash/movements/{movement_id}")
def delete_cash_movement(
    portfolio_id: int,
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Delete a manual movement. Strict mode re-validates the remaining
    ledger (removing a deposit can strand later spending)."""
    _require_tracking(portfolio)
    movement = _require_manual_movement(db, portfolio, movement_id)
    warnings = cash_ledger.delete_manual_movement(db, portfolio, movement)
    db.commit()
    _invalidate(portfolio.id)
    return {"deleted": movement_id, "warnings": [w.as_dict() for w in warnings]}


# ---------------------------------------------------------------------------
# Forex conversions
# ---------------------------------------------------------------------------

@router.post(
    "/{portfolio_id}/cash/fx-conversions",
    response_model=schemas.FxConversionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_fx_conversion(
    portfolio_id: int,
    payload: schemas.FxConversionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Create an explicit Forex conversion (linked fx_debit/fx_credit legs
    plus an optional fee leg). Strict mode requires the source currency to
    cover the debit; there is never any automatic conversion."""
    _require_tracking(portfolio)
    conversion_id, movements, warnings = cash_ledger.record_fx_conversion(
        db,
        portfolio,
        source_currency=payload.source_currency,
        target_currency=payload.target_currency,
        source_amount=payload.source_amount,
        target_amount=payload.target_amount,
        occurred_on=payload.occurred_on,
        fee_amount=payload.fee_amount,
        fee_currency=payload.fee_currency,
        notes=payload.notes,
    )
    db.commit()
    for movement in movements:
        db.refresh(movement)
        CASH_MOVEMENTS_CREATED.labels(type=movement.type.value).inc()
    _invalidate(portfolio.id)
    return schemas.FxConversionResponse(
        conversion_id=conversion_id,
        conversion_rate=movements[0].conversion_rate,
        movements=movements,
        warnings=[w.as_dict() for w in warnings],
    )


@router.put(
    "/{portfolio_id}/cash/fx-conversions/{conversion_id}",
    response_model=schemas.FxConversionResponse,
)
def update_fx_conversion(
    portfolio_id: int,
    conversion_id: str,
    payload: schemas.FxConversionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Replace all legs of a conversion consistently"""
    _require_tracking(portfolio)
    existing = crud_cash.get_conversion_movements(db, portfolio.id, conversion_id)
    if not existing:
        raise FxConversionNotFoundError(portfolio.id, conversion_id)
    movements, warnings = cash_ledger.update_fx_conversion(
        db,
        portfolio,
        conversion_id,
        source_currency=payload.source_currency,
        target_currency=payload.target_currency,
        source_amount=payload.source_amount,
        target_amount=payload.target_amount,
        occurred_on=payload.occurred_on,
        fee_amount=payload.fee_amount,
        fee_currency=payload.fee_currency,
        notes=payload.notes,
    )
    db.commit()
    for movement in movements:
        db.refresh(movement)
    _invalidate(portfolio.id)
    return schemas.FxConversionResponse(
        conversion_id=conversion_id,
        conversion_rate=movements[0].conversion_rate,
        movements=movements,
        warnings=[w.as_dict() for w in warnings],
    )


@router.delete("/{portfolio_id}/cash/fx-conversions/{conversion_id}")
def delete_fx_conversion(
    portfolio_id: int,
    conversion_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Delete all legs of a conversion atomically"""
    _require_tracking(portfolio)
    movements = crud_cash.get_conversion_movements(db, portfolio.id, conversion_id)
    if not movements:
        raise FxConversionNotFoundError(portfolio.id, conversion_id)
    warnings = cash_ledger.delete_fx_conversion(db, portfolio, conversion_id, movements)
    db.commit()
    _invalidate(portfolio.id)
    return {"deleted": conversion_id, "warnings": [w.as_dict() for w in warnings]}


# ---------------------------------------------------------------------------
# Activation / mode / wipe
# ---------------------------------------------------------------------------

@router.post(
    "/{portfolio_id}/cash/activation/preview",
    response_model=schemas.CashActivationPreview,
)
def preview_cash_activation(
    portfolio_id: int,
    payload: schemas.CashActivationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Dry-run of enabling cash tracking: projected balances per currency,
    earliest negative dips, and (for the replay strategy) the proposed
    opening balances that avoid unexplained negative cash. Writes nothing."""
    return cash_activation.preview_activation(db, portfolio, payload)


@router.post(
    "/{portfolio_id}/cash/activation",
    response_model=schemas.CashActivationResult,
    status_code=status.HTTP_201_CREATED,
)
def apply_cash_activation(
    portfolio_id: int,
    payload: schemas.CashActivationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Enable cash tracking atomically and idempotently (re-POSTing the
    same activation_id returns the stored result instead of duplicating)."""
    result = cash_activation.apply_activation(db, portfolio, payload, current_user.id)
    if not result.already_applied:
        _invalidate(portfolio.id)
    return result


@router.put("/{portfolio_id}/cash/mode", response_model=schemas.Portfolio)
def change_cash_mode(
    portfolio_id: int,
    payload: schemas.CashModeChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Change the cash mode. warn->strict validates historical
    non-negativity; tracked->untracked keeps the ledger (excluded from
    valuation); untracked->tracked requires the activation workflow."""
    portfolio = cash_activation.change_mode(db, portfolio, payload.mode)
    _invalidate(portfolio.id)
    return portfolio


@router.delete("/{portfolio_id}/cash/ledger", status_code=status.HTTP_204_NO_CONTENT)
def wipe_cash_ledger(
    portfolio_id: int,
    payload: schemas.CashLedgerWipeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
):
    """Destructive, explicit wipe of all cash ledger data. Only allowed
    while the portfolio is untracked (disable tracking first)."""
    cash_activation.wipe_ledger(db, portfolio)
    _invalidate(portfolio.id)
    return None
