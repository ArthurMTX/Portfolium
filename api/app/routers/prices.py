"""
Prices router
"""
from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime
from decimal import Decimal
import yfinance as yf
import asyncio

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
    
    prices = await pricing_service.get_multiple_prices(symbol_list)
    
    return prices


@router.get("/indices", response_model=Dict[str, PriceQuote])
async def get_market_indices(
    symbols: str = Query(
        default="^GSPC,^DJI,^IXIC,^GSPTSE,^FTSE,^GDAXI,^FCHI,FTSEMIB.MI,^N225,^HSI,000001.SS,^AXJO",
        description="Comma-separated list of market index symbols"
    )
):
    """
    Get current prices for market indices without requiring them to be in the Asset table.
    
    This endpoint directly fetches from Yahoo Finance and doesn't use the database cache,
    making it suitable for general market data like S&P 500, DAX, Nikkei, etc.
    
    Example: `/prices/indices?symbols=^GSPC,^DJI,^IXIC`
    """
    symbol_list = [s.strip() for s in symbols.split(",")]
    
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
    
    def fetch_index_price(symbol: str) -> tuple[str, PriceQuote | None]:
        """Fetch a single index price from yfinance"""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            # Get current price
            current_price = info.get('regularMarketPrice') or info.get('currentPrice')
            if not current_price:
                return (symbol, None)
            
            # Get previous close for daily change calculation
            prev_close = info.get('previousClose') or info.get('regularMarketPreviousClose')
            daily_change_pct = None
            if prev_close and prev_close > 0:
                daily_change_pct = ((current_price - prev_close) / prev_close) * 100
            
            # Get currency
            currency = info.get('currency', 'USD')
            
            return (symbol, PriceQuote(
                symbol=symbol,
                price=Decimal(str(current_price)),
                asof=datetime.utcnow(),
                currency=currency,
                daily_change_pct=Decimal(str(daily_change_pct)) if daily_change_pct is not None else None
            ))
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")
            return (symbol, None)
    
    # Fetch all prices concurrently using asyncio.to_thread
    tasks = [asyncio.to_thread(fetch_index_price, symbol) for symbol in symbol_list]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Build response dict, excluding failed fetches
    prices = {}
    for result in results:
        if isinstance(result, tuple) and result[1]:
            symbol, price_quote = result
            prices[symbol] = price_quote
    
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
    count = await pricing_service.refresh_all_portfolio_prices(portfolio_id)
    
    return {
        "portfolio_id": portfolio_id,
        "refreshed_count": count,
        "message": f"Refreshed {count} asset prices"
    }
