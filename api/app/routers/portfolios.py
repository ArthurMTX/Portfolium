
"""
Portfolios router
"""
from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import Portfolio, PortfolioCreate, Position, PortfolioMetrics, PortfolioHistoryPoint
from app.crud import portfolios as crud
from app.services.metrics import get_metrics_service, MetricsService
from app.auth import get_current_user
from app.models import User

router = APIRouter()

# Backfill price history for all held assets in a portfolio
@router.post("/{portfolio_id}/backfill_history")
async def backfill_portfolio_history(
    portfolio_id: int,
    days: int = 365,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Backfill daily price history for all assets in a portfolio for the past N days.
    """
    from app.models import Transaction, Asset
    from app.services.pricing import PricingService
    from datetime import datetime, timedelta

    # Verify the portfolio belongs to the current user
    portfolio = crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )

    # Find all unique asset_ids in this portfolio
    asset_ids = db.query(Transaction.asset_id).filter(Transaction.portfolio_id == portfolio_id).distinct().all()
    asset_ids = [row[0] for row in asset_ids]
    assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()

    pricing_service = PricingService(db)
    start_date = datetime.utcnow() - timedelta(days=days)
    end_date = datetime.utcnow()
    results = {}
    for asset in assets:
        count = pricing_service.ensure_historical_prices(asset, start_date, end_date, interval='1d')
        results[asset.symbol] = count

    return {"portfolio_id": portfolio_id, "assets": len(assets), "history_points_saved": results}



@router.get("", response_model=List[Portfolio])
async def get_portfolios(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of portfolios for the current user"""
    return crud.get_portfolios_by_user(db, current_user.id, skip=skip, limit=limit)


@router.get("/{portfolio_id}", response_model=Portfolio)
async def get_portfolio(
    portfolio_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get portfolio by ID"""
    portfolio = crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    # Verify the portfolio belongs to the current user
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    return portfolio


@router.post("", response_model=Portfolio, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    portfolio: PortfolioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new portfolio"""
    # Check if name already exists for this user
    existing = crud.get_portfolio_by_name_and_user(db, portfolio.name, current_user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Portfolio with name '{portfolio.name}' already exists"
        )
    
    return crud.create_portfolio(db, portfolio, user_id=current_user.id)


@router.put("/{portfolio_id}", response_model=Portfolio)
async def update_portfolio(
    portfolio_id: int,
    portfolio: PortfolioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update existing portfolio"""
    # Verify the portfolio belongs to the current user
    existing = crud.get_portfolio(db, portfolio_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if existing.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this portfolio"
        )
    
    updated = crud.update_portfolio(db, portfolio_id, portfolio)
    return updated


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(
    portfolio_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete portfolio"""
    # Verify the portfolio belongs to the current user
    existing = crud.get_portfolio(db, portfolio_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if existing.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this portfolio"
        )
    
    success = crud.delete_portfolio(db, portfolio_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )


@router.get("/{portfolio_id}/positions", response_model=List[Position])
async def get_portfolio_positions(
    portfolio_id: int,
    metrics_service = Depends(get_metrics_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get current positions for a portfolio
    
    Returns detailed position info including:
    - Current quantity
    - Average cost (PRU)
    - Market value
    - Unrealized P&L
    """
    # Verify portfolio exists
    portfolio = crud.get_portfolio(metrics_service.db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    # Verify the portfolio belongs to the current user
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    return await metrics_service.get_positions(portfolio_id)


@router.get("/{portfolio_id}/sold-positions", response_model=List[Position])
async def get_sold_positions(
    portfolio_id: int,
    metrics_service = Depends(get_metrics_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get sold positions for a portfolio with realized P&L
    
    Returns assets that were fully sold with their:
    - Symbol and name
    - Realized P&L from the sales
    """
    # Verify portfolio exists
    portfolio = crud.get_portfolio(metrics_service.db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    # Verify the portfolio belongs to the current user
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    # Get only sold positions (optimized)
    sold_positions = await metrics_service.get_sold_positions_only(portfolio_id)
    
    return sold_positions


@router.get("/{portfolio_id}/metrics", response_model=PortfolioMetrics)
async def get_portfolio_metrics(
    portfolio_id: int,
    metrics_service = Depends(get_metrics_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get aggregated metrics for a portfolio
    
    Returns:
    - Total value
    - Total cost
    - Unrealized P&L
    - Realized P&L
    - Dividends
    - Fees
    """
    # Verify the portfolio belongs to the current user
    portfolio = crud.get_portfolio(metrics_service.db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    try:
        return await metrics_service.get_metrics(portfolio_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# New endpoint: portfolio value history over time
@router.get("/{portfolio_id}/history", response_model=List[PortfolioHistoryPoint])
async def get_portfolio_history(
    portfolio_id: int,
    interval: str = "daily",  # daily, weekly, 6months, ytd, 1year, all
    metrics_service = Depends(get_metrics_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get portfolio value history for charting (daily, weekly, etc.)
    """
    # Verify the portfolio belongs to the current user
    portfolio = crud.get_portfolio(metrics_service.db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    try:
        return metrics_service.get_portfolio_history(portfolio_id, interval)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{portfolio_id}/generate-report")
async def generate_portfolio_report(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a daily PDF report for a specific portfolio (for testing/preview)
    
    This endpoint allows users to generate a test report on-demand to preview
    what their daily email report will look like.
    """
    from fastapi.responses import Response
    from app.services.pdf_reports import PDFReportService
    from datetime import datetime, timedelta
    
    # Verify the portfolio belongs to the current user
    portfolio = crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    try:
        # Generate report for yesterday (or today if you prefer)
        report_date = (datetime.utcnow() - timedelta(days=1)).date()
        
        pdf_service = PDFReportService(db)
        pdf_bytes = await pdf_service.generate_daily_report(
            user_id=current_user.id,
            portfolio_id=portfolio_id,
            report_date=report_date
        )
        
        # Return PDF as response
        filename = f"portfolio_report_{portfolio.name}_{report_date}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )
