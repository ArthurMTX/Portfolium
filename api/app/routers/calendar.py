"""
Calendar router - Portfolio calendar events including daily P&L and earnings
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case, and_
import logging
from decimal import Decimal

from app.db import get_db
from app.auth import get_current_user
from app.models import User, Portfolio, Transaction, TransactionType, Asset, EarningsCache, Watchlist
from app.crud import portfolios as crud
from app.services.metrics import get_metrics_service
from app.services.market_calendar import MarketCalendarService

router = APIRouter()
logger = logging.getLogger(__name__)


def serialize_value(val: Any) -> Any:
    """Serialize values to JSON-safe types"""
    if val is None:
        return None
    if isinstance(val, (datetime,)):
        return val.isoformat()
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    if hasattr(val, 'item'):  # numpy types
        return val.item()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, dict):
        return {k: serialize_value(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [serialize_value(item) for item in val]
    return val


def get_held_stock_symbols(db: Session, portfolios: List[Portfolio]) -> Dict[str, Dict[str, Any]]:
    """
    Get all currently held stock symbols across portfolios.
    Only returns stocks (EQUITY type), not ETFs, crypto, or other asset types.
    """
    held_symbols: Dict[str, Dict[str, Any]] = {}
    
    for portfolio in portfolios:
        if not portfolio:
            continue
            
        positions = db.query(
            Asset.symbol,
            Asset.name,
            Asset.asset_type,
            func.sum(
                case(
                    (Transaction.type == TransactionType.BUY, Transaction.quantity),
                    (Transaction.type == TransactionType.TRANSFER_IN, Transaction.quantity),
                    (Transaction.type == TransactionType.CONVERSION_IN, Transaction.quantity),
                    (Transaction.type == TransactionType.SELL, -Transaction.quantity),
                    (Transaction.type == TransactionType.TRANSFER_OUT, -Transaction.quantity),
                    (Transaction.type == TransactionType.CONVERSION_OUT, -Transaction.quantity),
                    else_=0
                )
            ).label('quantity')
        ).join(
            Transaction, Transaction.asset_id == Asset.id
        ).filter(
            Transaction.portfolio_id == portfolio.id
        ).group_by(
            Asset.id
        ).having(
            func.sum(
                case(
                    (Transaction.type == TransactionType.BUY, Transaction.quantity),
                    (Transaction.type == TransactionType.TRANSFER_IN, Transaction.quantity),
                    (Transaction.type == TransactionType.CONVERSION_IN, Transaction.quantity),
                    (Transaction.type == TransactionType.SELL, -Transaction.quantity),
                    (Transaction.type == TransactionType.TRANSFER_OUT, -Transaction.quantity),
                    (Transaction.type == TransactionType.CONVERSION_OUT, -Transaction.quantity),
                    else_=0
                )
            ) > 0
        ).all()
        
        for pos in positions:
            # Only include stocks (EQUITY), skip ETFs, crypto, and others
            # ETFs typically don't report earnings the same way individual stocks do
            if pos.asset_type not in ['EQUITY', 'stock', 'Stock', 'STOCK']:
                continue
                
            symbol = pos.symbol
            if symbol not in held_symbols:
                held_symbols[symbol] = {
                    "name": pos.name,
                    "asset_type": pos.asset_type,
                    "portfolios": []
                }
            held_symbols[symbol]["portfolios"].append({
                "id": portfolio.id,
                "name": portfolio.name
            })
    
    return held_symbols


@router.get("/events")
async def get_calendar_events(
    portfolio_id: Optional[int] = Query(None, description="Filter by portfolio ID"),
    days_back: int = Query(30, description="Number of days in the past to include"),
    days_forward: int = Query(60, description="Number of days in the future to include"),
    db: Session = Depends(get_db),
    metrics_service = Depends(get_metrics_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get calendar events including:
    - Daily portfolio performance (positive/negative days) - ONLY for past dates
    - Earnings dates for held stocks (past and upcoming) - from cache
    
    Returns events organized by date for calendar display.
    """
    events: List[Dict[str, Any]] = []
    today = datetime.now().date()
    start_date = today - timedelta(days=days_back)
    end_date = today + timedelta(days=days_forward)
    
    # Get user's portfolios
    if portfolio_id:
        portfolios = [crud.get_portfolio(db, portfolio_id)]
        if not portfolios[0] or portfolios[0].user_id != current_user.id:
            return {"events": [], "start_date": start_date.isoformat(), "end_date": end_date.isoformat()}
    else:
        portfolios = crud.get_portfolios_by_user(db, current_user.id)
    
    # Get held stock symbols (stocks only, no ETFs or crypto)
    held_symbols = get_held_stock_symbols(db, portfolios)
    
    # Fetch earnings from cache (much faster than yfinance API calls)
    if held_symbols:
        symbols_list = list(held_symbols.keys())
        cached_earnings = db.query(EarningsCache).filter(
            EarningsCache.symbol.in_(symbols_list),
            EarningsCache.earnings_date >= start_date,
            EarningsCache.earnings_date <= end_date
        ).all()
        
        for earning in cached_earnings:
            symbol = earning.symbol
            info = held_symbols.get(symbol, {})
            
            events.append({
                "date": earning.earnings_date.isoformat(),
                "type": "earnings",
                "symbol": symbol,
                "name": info.get("name", symbol),
                "portfolios": info.get("portfolios", []),
                "is_future": earning.earnings_date > today,
                "eps_estimate": serialize_value(earning.eps_estimate),
                "revenue_estimate": serialize_value(earning.revenue_estimate),
            })
    
    # Get daily portfolio performance from history (ONLY for past dates, not including today)
    for portfolio in portfolios:
        if not portfolio:
            continue
            
        try:
            # Calculate period based on days_back
            if days_back <= 7:
                period = "1W"
            elif days_back <= 30:
                period = "1M"
            elif days_back <= 90:
                period = "3M"
            elif days_back <= 180:
                period = "6M"
            elif days_back <= 365:
                period = "1Y"
            else:
                period = "ALL"
                
            history = metrics_service.get_portfolio_history(portfolio.id, period)
            
            # Convert history points to daily performance events
            prev_value = None
            for record in history:
                record_date = datetime.fromisoformat(record.date).date() if isinstance(record.date, str) else record.date
                
                # Check if date is in visible range (PAST dates only, not today or future)
                in_visible_range = start_date <= record_date < today
                
                if in_visible_range and prev_value is not None:
                    daily_change = float(record.value) - float(prev_value)
                    daily_change_pct = (daily_change / float(prev_value)) * 100 if prev_value else 0
                    
                    events.append({
                        "date": record_date.isoformat() if hasattr(record_date, 'isoformat') else str(record_date),
                        "type": "daily_performance",
                        "portfolio_id": portfolio.id,
                        "portfolio_name": portfolio.name,
                        "value": float(record.value),
                        "daily_change": daily_change,
                        "daily_change_pct": round(daily_change_pct, 2),
                        "is_positive": daily_change >= 0,
                        "currency": portfolio.base_currency
                    })
                
                # CRITICAL: Always update prev_value for the next iteration
                # This ensures we compare consecutive days, not skip ahead
                prev_value = record.value
        except Exception as e:
            logger.warning(f"Failed to get history for portfolio {portfolio.id}: {e}")
            continue
    
    # Sort events by date
    events.sort(key=lambda x: x["date"])
    
    return {
        "events": events,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "held_symbols": list(held_symbols.keys()),
        "today": today.isoformat()
    }


@router.get("/earnings")
async def get_earnings_calendar(
    portfolio_id: Optional[int] = Query(None, description="Filter by portfolio ID"),
    days_back: int = Query(30, description="Number of days in the past to include"),
    days_forward: int = Query(90, description="Number of days in the future to include"),
    include_watchlist: bool = Query(True, description="Include watchlist stocks in earnings calendar"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get earnings calendar for held stocks and watchlist items (not ETFs or crypto).
    Returns past and upcoming earnings dates with estimates from cache.
    """
    events: List[Dict[str, Any]] = []
    today = datetime.now().date()
    start_date = today - timedelta(days=days_back)
    end_date = today + timedelta(days=days_forward)
    
    # Get user's portfolios
    if portfolio_id:
        portfolios = [crud.get_portfolio(db, portfolio_id)]
        if not portfolios[0] or portfolios[0].user_id != current_user.id:
            return {"earnings": [], "start_date": start_date.isoformat(), "end_date": end_date.isoformat()}
    else:
        portfolios = crud.get_portfolios_by_user(db, current_user.id)
    
    # Get held stock symbols (stocks only)
    held_symbols = get_held_stock_symbols(db, portfolios)
    
    # Get watchlist stock symbols (stocks only)
    watchlist_symbols: Dict[str, Dict[str, Any]] = {}
    if include_watchlist:
        watchlist_items = db.query(Watchlist).options(
            joinedload(Watchlist.asset)
        ).filter(
            Watchlist.user_id == current_user.id
        ).all()
        
        for item in watchlist_items:
            if item.asset:
                # Only include stocks (EQUITY), skip ETFs, crypto, and others
                if item.asset.asset_type not in ['EQUITY', 'stock', 'Stock', 'STOCK']:
                    continue
                symbol = item.asset.symbol
                # Skip if already in held symbols (portfolio takes precedence)
                if symbol in held_symbols:
                    continue
                if symbol not in watchlist_symbols:
                    watchlist_symbols[symbol] = {
                        "name": item.asset.name,
                        "asset_type": item.asset.asset_type,
                    }
    
    # Combine all symbols
    all_symbols = {**held_symbols, **watchlist_symbols}
    
    if not all_symbols:
        return {
            "earnings": [],
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "symbols_checked": [],
            "today": today.isoformat()
        }
    
    # Fetch earnings from cache
    symbols_list = list(all_symbols.keys())
    cached_earnings = db.query(EarningsCache).filter(
        EarningsCache.symbol.in_(symbols_list),
        EarningsCache.earnings_date >= start_date,
        EarningsCache.earnings_date <= end_date
    ).order_by(EarningsCache.earnings_date).all()
    
    for earning in cached_earnings:
        symbol = earning.symbol
        is_watchlist = symbol in watchlist_symbols
        info = watchlist_symbols.get(symbol, {}) if is_watchlist else held_symbols.get(symbol, {})
        
        events.append({
            "date": earning.earnings_date.isoformat(),
            "symbol": symbol,
            "name": info.get("name", symbol),
            "portfolios": info.get("portfolios", []),
            "is_future": earning.earnings_date > today,
            "eps_estimate": serialize_value(earning.eps_estimate),
            "eps_actual": serialize_value(earning.eps_actual),
            "revenue_estimate": serialize_value(earning.revenue_estimate),
            "revenue_actual": serialize_value(earning.revenue_actual),
            "surprise_pct": serialize_value(earning.surprise_pct),
            "source": "watchlist" if is_watchlist else "portfolio",
        })
    
    return {
        "earnings": events,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "symbols_checked": symbols_list,
        "today": today.isoformat()
    }


@router.get("/daily-performance")
async def get_daily_performance(
    portfolio_id: Optional[int] = Query(None, description="Filter by portfolio ID"),
    days: int = Query(90, description="Number of days of history"),
    db: Session = Depends(get_db),
    metrics_service = Depends(get_metrics_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get daily performance data for calendar heatmap visualization.
    Returns daily changes for each portfolio.
    Only returns data for PAST dates (not today or future).
    """
    today = datetime.now().date()
    start_date = today - timedelta(days=days)
    
    # Get user's portfolios
    if portfolio_id:
        portfolios = [crud.get_portfolio(db, portfolio_id)]
        if not portfolios[0] or portfolios[0].user_id != current_user.id:
            return {"days": [], "start_date": start_date.isoformat(), "end_date": today.isoformat()}
    else:
        portfolios = crud.get_portfolios_by_user(db, current_user.id)
    
    daily_data: Dict[str, Dict[str, Any]] = {}  # date -> aggregated data
    
    for portfolio in portfolios:
        if not portfolio:
            continue
            
        try:
            # Determine period based on days requested
            if days <= 7:
                period = "1W"
            elif days <= 30:
                period = "1M"
            elif days <= 90:
                period = "3M"
            elif days <= 180:
                period = "6M"
            elif days <= 365:
                period = "1Y"
            else:
                period = "ALL"
                
            history = metrics_service.get_portfolio_history(portfolio.id, period)
            
            prev_value = None
            prev_invested = None
            for record in history:
                record_date = datetime.fromisoformat(record.date).date() if isinstance(record.date, str) else record.date
                date_str = record_date.isoformat() if hasattr(record_date, 'isoformat') else str(record_date)
                
                # Check if date is in visible range (PAST dates only, not today or future)
                in_visible_range = start_date <= record_date < today
                
                if in_visible_range and prev_value is not None:
                    # Get daily cash flow (money added/removed from portfolio)
                    daily_cash_flow = record.daily_cash_flow or 0.0
                    
                    # Calculate performance-adjusted daily change:
                    # True performance = (current_value - prev_value) - cash_flow
                    # This excludes deposits/purchases from the performance calculation
                    raw_change = float(record.value) - float(prev_value)
                    performance_change = raw_change - daily_cash_flow
                    
                    # Calculate percentage based on previous value (before any cash flows)
                    performance_change_pct = (performance_change / float(prev_value)) * 100 if prev_value else 0
                    
                    if date_str not in daily_data:
                        daily_data[date_str] = {
                            "date": date_str,
                            "total_change": 0,
                            "total_change_pct": 0,
                            "total_cash_flow": 0,
                            "portfolios": []
                        }
                    
                    daily_data[date_str]["total_change"] += performance_change
                    daily_data[date_str]["total_cash_flow"] += daily_cash_flow
                    daily_data[date_str]["portfolios"].append({
                        "portfolio_id": portfolio.id,
                        "portfolio_name": portfolio.name,
                        "value": float(record.value),
                        "change": performance_change,
                        "change_pct": round(performance_change_pct, 2),
                        "cash_flow": daily_cash_flow,
                        "currency": portfolio.base_currency
                    })
                
                # CRITICAL: Always update prev_value for the next iteration
                # This ensures we compare consecutive days, not skip ahead
                prev_value = record.value
                prev_invested = record.invested
        except Exception as e:
            logger.warning(f"Failed to get history for portfolio {portfolio.id}: {e}")
            continue
    
    # Calculate total change percentage based on weighted average
    # Using performance-adjusted values (excludes cash flows)
    for date_str, data in daily_data.items():
        total_value = sum(p["value"] for p in data["portfolios"])
        total_cash_flow = data.get("total_cash_flow", 0)
        # Previous value = current value - change - cash_flow
        prev_total_value = total_value - data["total_change"] - total_cash_flow
        if prev_total_value > 0:
            data["total_change_pct"] = round((data["total_change"] / prev_total_value) * 100, 2)
        else:
            data["total_change_pct"] = 0
        data["is_positive"] = data["total_change"] >= 0
    
    # Convert to sorted list
    days_list = sorted(daily_data.values(), key=lambda x: x["date"])
    
    return {
        "days": days_list,
        "start_date": start_date.isoformat(),
        "end_date": today.isoformat(),
        "today": today.isoformat()
    }


@router.post("/refresh-earnings")
async def refresh_earnings_for_user(
    include_watchlist: bool = Query(True, description="Include watchlist stocks in refresh"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger earnings cache refresh for user's held stocks and watchlist items.
    This is useful when a user wants fresh data without waiting for the scheduled job.
    """
    import yfinance as yf
    
    # Get user's portfolios
    portfolios = crud.get_portfolios_by_user(db, current_user.id)
    
    # Get held stock symbols
    held_symbols = get_held_stock_symbols(db, portfolios)
    
    # Get watchlist stock symbols (stocks only)
    watchlist_symbols: Dict[str, Dict[str, Any]] = {}
    if include_watchlist:
        watchlist_items = db.query(Watchlist).options(
            joinedload(Watchlist.asset)
        ).filter(
            Watchlist.user_id == current_user.id
        ).all()
        
        for item in watchlist_items:
            if item.asset:
                # Only include stocks (EQUITY), skip ETFs, crypto, and others
                if item.asset.asset_type not in ['EQUITY', 'stock', 'Stock', 'STOCK']:
                    continue
                symbol = item.asset.symbol
                # Skip if already in held symbols
                if symbol in held_symbols:
                    continue
                if symbol not in watchlist_symbols:
                    watchlist_symbols[symbol] = {
                        "name": item.asset.name,
                        "asset_type": item.asset.asset_type,
                    }
    
    # Combine all symbols
    all_symbols = {**held_symbols, **watchlist_symbols}
    
    if not all_symbols:
        return {"status": "success", "message": "No stocks to refresh", "symbols_updated": 0}
    
    updated_count = 0
    failed_count = 0
    
    for symbol in all_symbols.keys():
        try:
            ticker = yf.Ticker(symbol)
            calendar = ticker.calendar
            
            if calendar is None:
                continue
            
            # Handle different calendar formats
            if hasattr(calendar, 'to_dict'):
                calendar_data = calendar.to_dict()
            elif isinstance(calendar, dict):
                calendar_data = calendar
            else:
                continue
            
            # Parse earnings date
            earnings_date = None
            earnings_dates_raw = calendar_data.get('Earnings Date', [])
            
            if earnings_dates_raw:
                if isinstance(earnings_dates_raw, dict):
                    raw_date = list(earnings_dates_raw.values())[0] if earnings_dates_raw else None
                elif isinstance(earnings_dates_raw, list) and len(earnings_dates_raw) > 0:
                    raw_date = earnings_dates_raw[0]
                else:
                    raw_date = earnings_dates_raw
                    
                if raw_date:
                    # Check if it's already a date object
                    from datetime import date
                    if isinstance(raw_date, date):
                        earnings_date = raw_date
                    elif hasattr(raw_date, 'date'):
                        earnings_date = raw_date.date()
                    elif isinstance(raw_date, str):
                        try:
                            earnings_date = datetime.fromisoformat(raw_date.replace('Z', '+00:00')).date()
                        except:
                            pass
            
            if not earnings_date:
                continue
            
            # Extract estimates
            eps_estimate = calendar_data.get('Earnings Average') or calendar_data.get('EPS Estimate')
            if isinstance(eps_estimate, dict):
                eps_estimate = list(eps_estimate.values())[0] if eps_estimate else None
                
            revenue_estimate = calendar_data.get('Revenue Average') or calendar_data.get('Revenue Estimate')
            if isinstance(revenue_estimate, dict):
                revenue_estimate = list(revenue_estimate.values())[0] if revenue_estimate else None
            
            # Serialize raw_data
            raw_data = {k: serialize_value(v) for k, v in calendar_data.items()}
            
            # Check if we already have this entry
            existing = db.query(EarningsCache).filter(
                EarningsCache.symbol == symbol,
                EarningsCache.earnings_date == earnings_date
            ).first()
            
            if existing:
                existing.eps_estimate = serialize_value(eps_estimate)
                existing.revenue_estimate = serialize_value(revenue_estimate)
                existing.raw_data = raw_data
                existing.fetched_at = datetime.utcnow()
                existing.updated_at = datetime.utcnow()
            else:
                new_cache = EarningsCache(
                    symbol=symbol,
                    earnings_date=earnings_date,
                    eps_estimate=serialize_value(eps_estimate),
                    revenue_estimate=serialize_value(revenue_estimate),
                    raw_data=raw_data,
                    fetched_at=datetime.utcnow(),
                )
                db.add(new_cache)
            
            db.commit()
            updated_count += 1
            
        except Exception as e:
            logger.warning(f"Error refreshing earnings for {symbol}: {e}")
            failed_count += 1
            db.rollback()
            continue
    
    return {
        "status": "success",
        "symbols_checked": len(all_symbols),
        "symbols_updated": updated_count,
        "symbols_failed": failed_count,
        "portfolio_symbols": len(held_symbols),
        "watchlist_symbols": len(watchlist_symbols)
    }


@router.get("/market-holidays")
async def get_market_holidays(
    portfolio_id: Optional[int] = Query(None, description="Portfolio ID to detect relevant exchanges from held assets"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD), defaults to 90 days ago"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD), defaults to 90 days from now"),
    currency: Optional[str] = Query(None, description="Currency to determine exchange (e.g., USD, EUR, GBP). Used if portfolio_id not provided."),
    exchange: Optional[str] = Query(None, description="Exchange code (e.g., XNYS, XETR). Overrides all other options."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get market holidays for a date range.
    
    If portfolio_id is provided, detects which exchanges are relevant based on 
    the currencies of assets held in the portfolio and returns combined holidays.
    
    Uses the exchange-calendars library for accurate holiday data from 50+ exchanges.
    
    Common exchange codes:
    - XNYS: NYSE (New York Stock Exchange)
    - XNAS: NASDAQ
    - XETR: XETRA (Frankfurt/Germany)
    - XLON: London Stock Exchange
    - XPAR: Euronext Paris
    - XTKS: Tokyo Stock Exchange
    """
    from datetime import date
    from app.services.market_calendar import CURRENCY_TO_EXCHANGE
    
    today = date.today()
    
    # Parse dates or use defaults
    if start_date:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
    else:
        start = today - timedelta(days=90)
    
    if end_date:
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    else:
        end = today + timedelta(days=90)
    
    # Determine which exchanges to use
    exchange_codes = []
    
    if exchange:
        # Explicit exchange specified - use only that
        exchange_codes = [exchange]
    elif portfolio_id:
        # Detect exchanges based on assets held in portfolio
        # Get unique currencies from assets in this portfolio
        asset_currencies = (
            db.query(Asset.currency)
            .join(Transaction, Transaction.asset_id == Asset.id)
            .filter(Transaction.portfolio_id == portfolio_id)
            .distinct()
            .all()
        )
        
        # Map currencies to exchanges
        seen_exchanges = set()
        for (curr,) in asset_currencies:
            if curr:
                ex = CURRENCY_TO_EXCHANGE.get(curr.upper(), "XNYS")
                if ex not in seen_exchanges:
                    exchange_codes.append(ex)
                    seen_exchanges.add(ex)
        
        # Always include NYSE as fallback (most stocks are US-listed)
        if "XNYS" not in seen_exchanges:
            exchange_codes.append("XNYS")
    elif currency:
        # Use currency-based exchange
        exchange_codes = [MarketCalendarService.get_exchange_for_currency(currency)]
    else:
        # Default to NYSE
        exchange_codes = ["XNYS"]
    
    # Get combined holidays from all relevant exchanges
    holidays = MarketCalendarService.get_combined_holidays(
        start_date=start,
        end_date=end,
        exchange_codes=exchange_codes
    )
    
    # Get combined closed dates (union of all exchanges)
    closed_dates = MarketCalendarService.get_combined_closed_dates(
        start_date=start,
        end_date=end,
        exchange_codes=exchange_codes
    )
    
    # Get display names for all exchanges
    exchange_display_names = MarketCalendarService.get_exchange_display_names(exchange_codes)
    
    return {
        "holidays": holidays,
        "closed_dates": list(sorted(closed_dates)),
        "exchanges": exchange_codes,
        "exchange_display_names": exchange_display_names,
        "total_exchanges": len(exchange_codes),
        "start_date": start.isoformat(),
        "end_date": end.isoformat()
    }


@router.get("/market-exchanges")
async def list_market_exchanges(
    current_user: User = Depends(get_current_user)
):
    """
    List all available market exchanges.
    
    Returns exchange codes, names, and timezones for all supported exchanges.
    """
    exchanges = MarketCalendarService.list_available_exchanges()
    
    # Also include the currency mappings
    from app.services.market_calendar import CURRENCY_TO_EXCHANGE
    
    return {
        "exchanges": exchanges,
        "currency_mappings": CURRENCY_TO_EXCHANGE
    }
