
"""
Portfolios router
"""
from typing import List, Annotated, Dict
from decimal import Decimal
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.errors import (
    CannotGetPortfolioReportError,
    CannotGetPortfolioHistoryError, 
    CannotGetPortfolioMetricsError,
    CannotGetPortfolioPricesError, 
    PortfolioAlreadyExistsError, 
    PortfolioNotFoundError
)
from app.db import get_db
from app.schemas import Portfolio, PortfolioCreate, PortfolioUpdate, Position, PortfolioMetrics, PortfolioHistoryPoint
from app.crud import portfolios as crud
from app.services.metrics import MetricsService, get_metrics_service
from app.services.pricing import get_pricing_service
from app.auth import get_current_user, verify_portfolio_access
from app.models import User, Transaction, Asset, TransactionType, Portfolio as PortfolioModel

router = APIRouter()

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
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """Get portfolio by ID"""
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
        raise PortfolioAlreadyExistsError(portfolio.name)
    
    return crud.create_portfolio(db, portfolio, user_id=current_user.id)


@router.put("/{portfolio_id}", response_model=Portfolio)
async def update_portfolio(
    portfolio_id: int,
    portfolio_data: PortfolioUpdate,
    db: Session = Depends(get_db),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """Update existing portfolio"""
    updated = crud.update_portfolio(db, portfolio_id, portfolio_data)
    return updated


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(
    portfolio_id: int, 
    db: Session = Depends(get_db),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """Delete portfolio"""
    success = crud.delete_portfolio(db, portfolio_id)
    if not success:
        raise PortfolioNotFoundError(portfolio_id)


@router.get("/{portfolio_id}/positions", response_model=List[Position])
async def get_portfolio_positions(
    portfolio_id: int,
    metrics_service = Depends(get_metrics_service),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """
    Get current positions for a portfolio
    
    Returns detailed position info including:
    - Current quantity
    - Average cost (PRU)
    - Market value
    - Unrealized P&L
    """
    return await metrics_service.get_positions(portfolio_id)


@router.get("/{portfolio_id}/positions/{asset_id}/detailed-metrics")
async def get_position_detailed_metrics(
    portfolio_id: int,
    asset_id: int,
    metrics_service = Depends(get_metrics_service),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """
    Get detailed metrics for a single position (lazy-loaded on-demand)
    
    This includes expensive calculations like:
    - Relative performance vs sector (30d, 90d, YTD, 1y)
    
    These metrics are NOT included in the main positions list to keep
    dashboard loading fast. They are only calculated when user opens
    the position detail modal.
    """
    result = await metrics_service.get_position_detailed_metrics(portfolio_id, asset_id)
    if not result:
        return {
            'relative_perf_30d': None,
            'relative_perf_90d': None,
            'relative_perf_ytd': None,
            'relative_perf_1y': None,
            'sector_etf': None
        }
    return result


@router.get("/{portfolio_id}/sold-positions", response_model=List[Position])
async def get_sold_positions(
    portfolio_id: int,
    metrics_service = Depends(get_metrics_service),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """
    Get sold positions for a portfolio with realized P&L
    
    Returns assets that were fully sold with their:
    - Symbol and name
    - Realized P&L from the sales
    """
    # Get only sold positions (optimized)
    sold_positions = await metrics_service.get_sold_positions_only(portfolio_id)
    
    return sold_positions


@router.get("/{portfolio_id}/metrics", response_model=PortfolioMetrics)
async def get_portfolio_metrics(
    portfolio_id: int,
    metrics_service = Depends(get_metrics_service),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
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
    try:
        return await metrics_service.get_metrics(portfolio_id)
    except ValueError as e:
        raise CannotGetPortfolioMetricsError(portfolio_id, str(e))


# New endpoint: portfolio value history over time
@router.get("/{portfolio_id}/history", response_model=List[PortfolioHistoryPoint])
async def get_portfolio_history(
    portfolio_id: int,
    period: str = "1M",  # 1W, 1M, 3M, 6M, YTD, 1Y, ALL
    metrics_service = Depends(get_metrics_service),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """
    Get portfolio value history for charting
    
    Uses saved closing prices from asset_price table to calculate
    historical portfolio values. Much more efficient and accurate
    than the old backfill approach.
    
    Supported periods:
    - 1W: Last 7 days
    - 1M: Last 30 days (default)
    - 3M: Last 3 months
    - 6M: Last 6 months
    - YTD: Year to date
    - 1Y: Last year
    - ALL: All available data
    """
    try:
        return metrics_service.get_portfolio_history(portfolio_id, period)
    except ValueError as e:
        raise CannotGetPortfolioHistoryError(portfolio_id, str(e))


@router.post("/{portfolio_id}/generate-report")
async def generate_portfolio_report(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """
    Generate a daily PDF report for a specific portfolio (for testing/preview)
    
    This endpoint allows users to generate a test report on-demand to preview
    what their daily email report will look like.
    """
    from fastapi.responses import Response
    from app.services.pdf_reports import PDFReportService
    from datetime import datetime, timedelta
    
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
        raise CannotGetPortfolioReportError(portfolio_id, str(e))


@router.get("/{portfolio_id}/prices/batch")
async def get_batch_prices(
    portfolio_id: int,
    db: Session = Depends(get_db),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """
    **Ultra-fast endpoint for price-only updates** 🚀
    
    Returns ONLY current prices and daily changes for all assets in a portfolio.
    Skips heavy position calculations and P&L, but DOES convert prices to portfolio base currency.
    
    Perfect for auto-refresh scenarios where you already have position quantities
    and just need updated prices.
    
    **Performance:**
    - No transaction processing
    - No P&L calculations
    - Parallel price fetching
    - Currency conversion to portfolio base currency
    - ~10x faster than full positions endpoint
    
    **Returns:**
    ```json
    {
      "portfolio_id": 1,
      "base_currency": "EUR",
      "prices": [
        {
          "symbol": "AAPL",
          "asset_id": 5,
          "current_price": 168.75,
          "original_price": 182.50,
          "original_currency": "USD",
          "daily_change_pct": 1.25,
          "last_updated": "2025-11-06T14:30:00"
        },
        ...
      ],
      "updated_at": "2025-11-06T14:30:15"
    }
    ```
    
    **Usage:**
    Frontend should call this during auto-refresh instead of full positions endpoint,
    then merge the price data with cached position structures client-side.
    """
    import logging
    from datetime import datetime
    from app.services.currency import CurrencyService
    
    logger = logging.getLogger(__name__)
    
    try:
        # Get portfolio base currency for conversion
        base_currency = portfolio.base_currency if portfolio.base_currency else "USD"
        
        # Get all unique assets in this portfolio (fast query with new index)
        # Only look at assets with current positions (quantity > 0)
        asset_ids_query = (
            db.query(Transaction.asset_id)
            .filter(Transaction.portfolio_id == portfolio_id)
            .distinct()
        )
        
        asset_ids = [row[0] for row in asset_ids_query.all()]
        
        if not asset_ids:
            return {
                "portfolio_id": portfolio_id,
                "base_currency": base_currency,
                "prices": [],
                "updated_at": datetime.utcnow().isoformat(),
                "count": 0
            }
        
        # Get asset details (symbol, currency) - fast with new index
        assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
        asset_map = {asset.id: asset for asset in assets}
        
        # Fetch all prices in parallel (existing optimization)
        pricing_service = get_pricing_service(db)
        symbols = [asset.symbol for asset in assets]
        
        logger.info(f"Batch fetching prices for {len(symbols)} assets in portfolio {portfolio_id}")
        
        # This already uses parallel fetching internally
        price_quotes = await pricing_service.get_multiple_prices(symbols)
        
        # Build response with currency conversion
        prices = []
        for asset in assets:
            quote = price_quotes.get(asset.symbol)
            if quote and quote.price:
                original_price = float(quote.price)
                current_price = original_price
                
                # Convert to portfolio base currency if needed
                if asset.currency != base_currency:
                    from decimal import Decimal
                    converted = CurrencyService.convert(
                        Decimal(str(original_price)),
                        from_currency=asset.currency,
                        to_currency=base_currency
                    )
                    if converted:
                        current_price = float(converted)
                        logger.debug(
                            f"Converted {asset.symbol} price: "
                            f"{original_price} {asset.currency} -> {current_price} {base_currency}"
                        )
                    else:
                        logger.warning(
                            f"Failed to convert {asset.symbol} from {asset.currency} to {base_currency}, "
                            f"using original price"
                        )
                
                prices.append({
                    "symbol": asset.symbol,
                    "asset_id": asset.id,
                    "name": asset.name,
                    "current_price": current_price,
                    "original_price": original_price,
                    "original_currency": asset.currency,
                    "daily_change_pct": float(quote.daily_change_pct) if quote.daily_change_pct else None,
                    "last_updated": quote.asof.isoformat() if quote.asof else None,
                    "asset_type": asset.asset_type
                })
        
        return {
            "portfolio_id": portfolio_id,
            "base_currency": base_currency,
            "prices": prices,
            "updated_at": datetime.utcnow().isoformat(),
            "count": len(prices)
        }
    
    except Exception as e:
        logger.error(f"Failed to fetch batch prices for portfolio {portfolio_id}: {e}", exc_info=True)
        raise CannotGetPortfolioPricesError(portfolio_id, str(e))

