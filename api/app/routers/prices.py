"""
Prices router
"""
from typing import List, Dict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from decimal import Decimal
import yfinance as yf
import asyncio

from app.errors import InvalidPriceRequestError, PortfolioNotFoundError
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
        raise InvalidPriceRequestError("No symbols provided")
    
    if len(symbol_list) > 50:
        raise InvalidPriceRequestError("Maximum 50 symbols per request")
    
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
        raise InvalidPriceRequestError("No symbols provided")
    
    if len(symbol_list) > 50:
        raise InvalidPriceRequestError("Maximum 50 symbols per request")
    
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


@router.get("/quote/{symbol}", response_model=PriceQuote)
async def get_price_quote(
    symbol: str,
    target_currency: str = Query(None, description="Convert price to this currency (e.g., 'USD', 'EUR')"),
    pricing_service = Depends(get_pricing_service)
):
    """
    Get current price for a single symbol
    
    - Fetches from Yahoo Finance
    - Returns price quote with current price, currency, and daily change
    - Optionally converts to target currency
    
    Example: `/prices/quote/BTC-USD` or `/prices/quote/ETH-EUR?target_currency=USD`
    """
    from app.services.currency import CurrencyService
    
    symbol = symbol.strip().upper()
    target_currency = target_currency.upper() if target_currency else None
    prices = await pricing_service.get_multiple_prices([symbol])
    
    if symbol not in prices or prices[symbol] is None:
        # Try to fetch directly from yfinance
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="2d")
            if not hist.empty:
                current_price = float(hist["Close"].iloc[-1])
                prev_close = float(hist["Close"].iloc[-2]) if len(hist) > 1 else current_price
                daily_change = ((current_price - prev_close) / prev_close * 100) if prev_close else 0
                
                # Get actual currency from ticker info
                try:
                    info = ticker.info
                    source_currency = info.get('currency', 'USD')
                except:
                    source_currency = 'USD'
                
                price = Decimal(str(current_price))
                
                # Convert to target currency if specified
                if target_currency and target_currency != source_currency:
                    converted_price = CurrencyService.convert(price, source_currency, target_currency)
                    if converted_price is not None:
                        price = converted_price
                        source_currency = target_currency
                
                return PriceQuote(
                    symbol=symbol,
                    price=price,
                    currency=source_currency,
                    daily_change_pct=Decimal(str(round(daily_change, 2))),
                    asof=datetime.utcnow()
                )
        except Exception:
            pass
        
        raise InvalidPriceRequestError(f"Could not fetch price for symbol: {symbol}")
    
    price_quote = prices[symbol]
    
    # Convert to target currency if specified
    if target_currency and price_quote.currency != target_currency:
        converted_price = CurrencyService.convert(price_quote.price, price_quote.currency, target_currency)
        if converted_price is not None:
            return PriceQuote(
                symbol=price_quote.symbol,
                price=converted_price,
                currency=target_currency,
                daily_change_pct=price_quote.daily_change_pct,
                asof=price_quote.asof
            )
    
    return price_quote


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
        raise PortfolioNotFoundError(portfolio_id)
    
    # Clear cache and refresh
    count = await pricing_service.refresh_all_portfolio_prices(portfolio_id)
    
    return {
        "portfolio_id": portfolio_id,
        "refreshed_count": count,
        "message": f"Refreshed {count} asset prices"
    }
