"""
Pending Dividends router - endpoints for managing auto-fetched dividends
"""
import logging
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, status, Query, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.auth import get_current_user, verify_portfolio_access
from app.models import User, Portfolio as PortfolioModel, PendingDividendStatus, Asset
from app.schemas import (
    PendingDividendResponse, 
    PendingDividendAccept, 
    PendingDividendBulkAction,
    PendingDividendStats,
    PortfolioPendingDividendStats,
    Transaction as TransactionSchema
)
from app.crud import pending_dividends as crud_pending
from app.services.dividends import get_dividend_service, DividendService
from app.services.notifications import notification_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _enrich_pending_dividend(pending, db: Session) -> dict:
    """Add asset details to pending dividend response"""
    asset = db.query(Asset).filter(Asset.id == pending.asset_id).first()
    return {
        "id": pending.id,
        "portfolio_id": pending.portfolio_id,
        "asset_id": pending.asset_id,
        "user_id": pending.user_id,
        "ex_dividend_date": pending.ex_dividend_date,
        "payment_date": pending.payment_date,
        "dividend_per_share": pending.dividend_per_share,
        "shares_held": pending.shares_held,
        "gross_amount": pending.gross_amount,
        "currency": pending.currency,
        "status": pending.status.value if hasattr(pending.status, 'value') else pending.status,
        "fetched_at": pending.fetched_at,
        "processed_at": pending.processed_at,
        "transaction_id": pending.transaction_id,
        "asset_symbol": asset.symbol if asset else None,
        "asset_name": asset.name if asset else None,
    }


@router.get("/pending", response_model=List[PendingDividendResponse])
async def get_pending_dividends(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: PENDING, ACCEPTED, REJECTED, EXPIRED"),
    portfolio_id: Optional[int] = Query(None, description="Filter by portfolio ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get pending dividends for the current user.
    
    Returns auto-fetched dividends that need user confirmation.
    These dividends do NOT affect P&L until accepted.
    """
    status_enum = None
    if status_filter:
        try:
            status_enum = PendingDividendStatus(status_filter.upper())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: PENDING, ACCEPTED, REJECTED, EXPIRED"
            )
    
    pending_list = crud_pending.get_pending_dividends_by_user(
        db,
        user_id=current_user.id,
        status=status_enum,
        portfolio_id=portfolio_id,
        skip=skip,
        limit=limit
    )
    
    return [_enrich_pending_dividend(p, db) for p in pending_list]


@router.get("/pending/stats", response_model=PendingDividendStats)
async def get_pending_dividend_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get statistics about pending dividends for the current user"""
    stats = crud_pending.get_pending_dividend_stats(db, current_user.id)
    return stats


@router.post("/{portfolio_id}/fetch", response_model=List[PendingDividendResponse])
async def fetch_dividends_for_portfolio(
    portfolio_id: int,
    lookback_days: int = Query(365, ge=30, le=730, description="Days to look back for dividends"),
    lookahead_days: int = Query(90, ge=0, le=180, description="Days to look ahead for announced dividends"),
    db: Session = Depends(get_db),
    portfolio: PortfolioModel = Depends(verify_portfolio_access),
    dividend_service: DividendService = Depends(get_dividend_service)
):
    """
    Fetch dividends from yfinance for all assets in a portfolio.
    
    Creates pending dividend records for any new dividends found.
    Users must accept pending dividends to add them to their portfolio.
    """
    created = dividend_service.fetch_dividends_for_portfolio(
        portfolio_id,
        lookback_days=lookback_days,
        lookahead_days=lookahead_days
    )
    
    # Create notifications for new pending dividends
    if created:
        notification_service.create_pending_dividend_notification(
            db,
            user_id=portfolio.user_id,
            pending_dividends=created
        )
    
    return [_enrich_pending_dividend(p, db) for p in created]


@router.get("/{portfolio_id}/pending", response_model=List[PendingDividendResponse])
async def get_portfolio_pending_dividends(
    portfolio_id: int,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """
    Get pending dividends for a specific portfolio.
    
    Requires portfolio access.
    """
    status_enum = None
    if status_filter:
        try:
            status_enum = PendingDividendStatus(status_filter.upper())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: PENDING, ACCEPTED, REJECTED, EXPIRED"
            )
    
    pending_list = crud_pending.get_pending_dividends_by_portfolio(
        db,
        portfolio_id=portfolio_id,
        status=status_enum,
        skip=skip,
        limit=limit
    )
    
    return [_enrich_pending_dividend(p, db) for p in pending_list]


@router.get("/{portfolio_id}/pending/stats", response_model=PortfolioPendingDividendStats)
async def get_portfolio_pending_dividend_stats(
    portfolio_id: int,
    db: Session = Depends(get_db),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """
    Get statistics about pending dividends for a specific portfolio.
    
    Returns the total pending amount converted to the portfolio's base currency.
    This avoids N+1 FX rate lookups on the frontend for multi-currency dividends.
    """
    stats = crud_pending.get_pending_dividend_stats_for_portfolio(
        db, 
        portfolio_id=portfolio_id,
        target_currency=portfolio.base_currency
    )
    return stats


@router.post("/pending/{dividend_id}/accept", response_model=TransactionSchema)
async def accept_pending_dividend(
    dividend_id: int,
    accept_data: PendingDividendAccept,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    dividend_service: DividendService = Depends(get_dividend_service)
):
    """
    Accept a pending dividend and create an actual DIVIDEND transaction.
    
    This will:
    1. Create a DIVIDEND transaction in the portfolio
    2. Mark the pending dividend as ACCEPTED
    3. The dividend will now affect P&L calculations
    
    You can optionally:
    - Specify tax_amount for withholding tax
    - Override the gross_amount if the auto-calculated value is incorrect
    - Override shares if the detected share count was wrong
    - Add notes to the transaction
    """
    # Verify user owns this pending dividend
    pending = crud_pending.get_pending_dividend(db, dividend_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Pending dividend not found")
    
    if pending.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this pending dividend")
    
    if pending.status != PendingDividendStatus.PENDING:
        raise HTTPException(
            status_code=400, 
            detail=f"Pending dividend already processed (status: {pending.status.value})"
        )
    
    # Validate tax doesn't exceed gross
    effective_gross = accept_data.override_gross_amount or pending.gross_amount
    if accept_data.tax_amount > effective_gross:
        raise HTTPException(
            status_code=422,
            detail=f"Tax amount ({accept_data.tax_amount}) cannot exceed gross amount ({effective_gross})"
        )
    
    transaction = dividend_service.accept_pending_dividend(
        pending_id=dividend_id,
        tax_amount=accept_data.tax_amount,
        notes=accept_data.notes,
        override_gross=accept_data.override_gross_amount,
        override_shares=accept_data.override_shares
    )
    
    if not transaction:
        raise HTTPException(status_code=500, detail="Failed to create transaction")
    
    # Refresh to get relationships
    db.refresh(transaction)
    
    return transaction


@router.post("/pending/{dividend_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
async def reject_pending_dividend(
    dividend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    dividend_service: DividendService = Depends(get_dividend_service)
):
    """
    Reject a pending dividend.
    
    Use this if:
    - You already recorded this dividend manually
    - The dividend data is incorrect
    - You don't want to track this dividend
    
    Rejected dividends are kept for audit purposes but won't affect anything.
    """
    # Verify user owns this pending dividend
    pending = crud_pending.get_pending_dividend(db, dividend_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Pending dividend not found")
    
    if pending.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this pending dividend")
    
    if pending.status != PendingDividendStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Pending dividend already processed (status: {pending.status.value})"
        )
    
    success = dividend_service.reject_pending_dividend(dividend_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reject pending dividend")


@router.post("/pending/bulk-accept", response_model=List[TransactionSchema])
async def bulk_accept_pending_dividends(
    bulk_data: PendingDividendBulkAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    dividend_service: DividendService = Depends(get_dividend_service)
):
    """
    Accept multiple pending dividends at once.
    
    Optionally apply a uniform tax rate to all dividends.
    """
    transactions = []
    errors = []
    
    for dividend_id in bulk_data.dividend_ids:
        pending = crud_pending.get_pending_dividend(db, dividend_id)
        
        if not pending:
            errors.append(f"Dividend {dividend_id} not found")
            continue
        
        if pending.user_id != current_user.id:
            errors.append(f"Dividend {dividend_id} not authorized")
            continue
        
        if pending.status != PendingDividendStatus.PENDING:
            errors.append(f"Dividend {dividend_id} already processed")
            continue
        
        # Calculate tax if rate provided
        tax_amount = Decimal(0)
        if bulk_data.tax_rate is not None:
            tax_amount = pending.gross_amount * (bulk_data.tax_rate / 100)
        
        transaction = dividend_service.accept_pending_dividend(
            pending_id=dividend_id,
            tax_amount=tax_amount
        )
        
        if transaction:
            db.refresh(transaction)
            transactions.append(transaction)
        else:
            errors.append(f"Failed to accept dividend {dividend_id}")
    
    if errors:
        logger.warning(f"Bulk accept had errors: {errors}")
    
    return transactions


@router.post("/pending/bulk-reject", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_reject_pending_dividends(
    bulk_data: PendingDividendBulkAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    dividend_service: DividendService = Depends(get_dividend_service)
):
    """Reject multiple pending dividends at once."""
    for dividend_id in bulk_data.dividend_ids:
        pending = crud_pending.get_pending_dividend(db, dividend_id)
        
        if not pending:
            continue
        
        if pending.user_id != current_user.id:
            continue
        
        if pending.status != PendingDividendStatus.PENDING:
            continue
        
        dividend_service.reject_pending_dividend(dividend_id)


@router.delete("/pending/{dividend_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pending_dividend(
    dividend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a pending dividend.
    
    Only PENDING dividends can be deleted. Accepted/rejected dividends are kept for audit.
    """
    pending = crud_pending.get_pending_dividend(db, dividend_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Pending dividend not found")
    
    if pending.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if pending.status != PendingDividendStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Can only delete pending dividends. Use reject for processed ones."
        )
    
    success = crud_pending.delete_pending_dividend(db, dividend_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete")
