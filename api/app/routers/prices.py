"""
Prices router
"""
from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import PriceQuote
from app.services.pricing import get_pricing_service, PricingService
from app.crud import portfolios as portfolio_crud

router = APIRouter()


@router.get("", response_model=Dict[str, PriceQuote])
async def get_prices(
    symbols: str = Query(..., description="Comma-separated list of symbols (e.g., 'AAPL,MSFT,BTC-USD')"),
    pricing_service = Depends(get_pricing_service)
):
    """
    Get current prices for multiple symbols
    
    - Checks cache first (TTL from config)
    - Fetches from Yahoo Finance if stale/missing
    - Updates cache
    - Falls back to last known price if fetch fails
    
    Example: `/prices?symbols=AAPL,MSFT,NVDA`
    """
    symbol_list = [s.strip().upper() for s in symbols.split(",")]
    
    if not symbol_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No symbols provided"
        )
    
    if len(symbol_list) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 50 symbols per request"
        )
    
    prices = pricing_service.get_multiple_prices(symbol_list)
    
    return prices


@router.post("/refresh")
async def refresh_prices(
    portfolio_id: int = Query(..., description="Portfolio ID to refresh prices for"),
    pricing_service = Depends(get_pricing_service)
):
    """
    Force refresh prices for all assets in a portfolio
    
    This will fetch fresh prices from Yahoo Finance regardless of cache TTL.
    Useful for manual refresh or when you need the most up-to-date data.
    """
    # Verify portfolio exists
    portfolio = portfolio_crud.get_portfolio(pricing_service.db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    
    # Clear cache and refresh
    count = pricing_service.refresh_all_portfolio_prices(portfolio_id)
    
    return {
        "portfolio_id": portfolio_id,
        "refreshed_count": count,
        "message": f"Refreshed {count} asset prices"
    }
