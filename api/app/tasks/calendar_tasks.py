"""
Background tasks for earnings calendar data fetching and caching.
"""
import logging
from datetime import date, datetime
from typing import List, Dict, Any, Optional
from decimal import Decimal

from app.celery_app import celery_app
from app.db import get_db_context
from app.models import Asset, EarningsCache, Portfolio, Transaction, TransactionType, Watchlist
from app.tasks.decorators import singleton_task
from app.services.market_data.yahoo_finance import get_market_data_provider, yahoo_timeout_seconds
from sqlalchemy import case, func
logger = logging.getLogger(__name__)


def serialize_value(val: Any) -> Any:
    """Serialize provider values to JSON-safe types"""
    if is_missing_value(val):
        return None
    if isinstance(val, dict):
        return {k: serialize_value(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [serialize_value(item) for item in val]
    if isinstance(val, datetime):
        return val.isoformat()
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    if hasattr(val, 'item'):  # numpy types
        return val.item()
    if isinstance(val, Decimal):
        return float(val)
    return val


def is_missing_value(value: Any) -> bool:
    """Return True for provider nulls, including pandas/numpy missing values."""
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip().lower() in {"", "nan", "nat", "none", "null", "n/a"}
    if repr(value) in {"NaT", "<NA>"}:
        return True
    try:
        return bool(value != value)
    except Exception:
        return False


def extract_calendar_value(calendar_data: Dict[str, Any], *keys: str) -> Any:
    """Return the first provider field value found, unwrapping common table/dict shapes."""
    for key in keys:
        value = calendar_data.get(key)
        if is_missing_value(value):
            continue
        if isinstance(value, dict):
            return next((v for v in value.values() if not is_missing_value(v)), None)
        if isinstance(value, (list, tuple)):
            return next((v for v in value if not is_missing_value(v)), None)
        return value
    return None


def parse_earnings_date(value: Any) -> Optional[date]:
    """Parse provider date-like values into a date."""
    if is_missing_value(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if hasattr(value, 'date'):
        parsed = value.date()
        return parsed if isinstance(parsed, date) else None
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00')).date()
        except ValueError:
            try:
                return datetime.strptime(value[:10], "%Y-%m-%d").date()
            except ValueError:
                return None
    return None


def normalize_provider_table(table: Any) -> List[Dict[str, Any]]:
    """Convert common provider DataFrame/dict/list table shapes into row dicts."""
    if table is None:
        return []

    if hasattr(table, "empty") and table.empty:
        return []

    if hasattr(table, "iterrows"):
        rows: List[Dict[str, Any]] = []
        for row_index, row in table.iterrows():
            row_data = row.to_dict() if hasattr(row, "to_dict") else dict(row)
            row_data.setdefault("Earnings Date", row_index)
            rows.append(row_data)
        return rows

    if isinstance(table, list):
        return [row for row in table if isinstance(row, dict)]

    if not isinstance(table, dict):
        return []

    if all(isinstance(value, dict) for value in table.values()):
        row_keys = []
        seen = set()
        for column_values in table.values():
            for row_key in column_values.keys():
                if row_key not in seen:
                    seen.add(row_key)
                    row_keys.append(row_key)

        rows = []
        for row_key in row_keys:
            row_data = {
                column: values.get(row_key)
                for column, values in table.items()
                if isinstance(values, dict)
            }
            row_data.setdefault("Earnings Date", row_key)
            rows.append(row_data)
        return rows

    return [table]


def build_earnings_event(row_data: Dict[str, Any], date_value: Any = None) -> Optional[Dict[str, Any]]:
    raw_date = date_value
    if is_missing_value(raw_date):
        raw_date = extract_calendar_value(row_data, 'Earnings Date', 'Date', 'earnings_date')
    earnings_date = parse_earnings_date(raw_date)
    if not earnings_date:
        return None

    return {
        "earnings_date": earnings_date,
        "eps_estimate": serialize_value(
            extract_calendar_value(row_data, 'Earnings Average', 'EPS Estimate', 'eps_estimate')
        ),
        "eps_actual": serialize_value(
            extract_calendar_value(row_data, 'Earnings Actual', 'EPS Actual', 'Reported EPS', 'eps_actual')
        ),
        "revenue_estimate": serialize_value(
            extract_calendar_value(row_data, 'Revenue Average', 'Revenue Estimate', 'revenue_estimate')
        ),
        "revenue_actual": serialize_value(
            extract_calendar_value(row_data, 'Revenue Actual', 'Reported Revenue', 'revenue_actual')
        ),
        "surprise_pct": serialize_value(
            extract_calendar_value(row_data, 'Surprise(%)', 'Surprise %', 'EPS Surprise %', 'surprise_pct')
        ),
        "raw_data": {k: serialize_value(v) for k, v in row_data.items()},
    }


def merge_earnings_event(existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    """Merge two rows for the same earnings date, preserving available figures."""
    merged = dict(existing)
    for key in ("eps_estimate", "eps_actual", "revenue_estimate", "revenue_actual", "surprise_pct"):
        if is_missing_value(merged.get(key)) and not is_missing_value(incoming.get(key)):
            merged[key] = incoming[key]

    existing_raw = merged.get("raw_data") if isinstance(merged.get("raw_data"), dict) else {}
    incoming_raw = incoming.get("raw_data") if isinstance(incoming.get("raw_data"), dict) else {}
    merged["raw_data"] = {**existing_raw, **incoming_raw}
    return merged


def _fetch_calendar_earnings_event(symbol: str) -> Optional[Dict[str, Any]]:
    """
    Fetch the headline earnings calendar event from the market data provider.
    """
    try:
        provider = get_market_data_provider()
        calendar = provider.get_calendar(
            symbol,
            action="earnings_cache_calendar",
            timeout_seconds=yahoo_timeout_seconds(),
        )
        
        if calendar is None:
            return None
            
        # Handle different calendar formats
        if hasattr(calendar, 'to_dict'):
            calendar_data = calendar.to_dict()
        elif isinstance(calendar, dict):
            calendar_data = calendar
        else:
            return None

        return build_earnings_event(calendar_data)
        
    except Exception as e:
        logger.warning(f"Failed to fetch earnings for {symbol}: {e}")
        return None


def _fetch_earnings_dates_events(symbol: str) -> List[Dict[str, Any]]:
    """Fetch recent/upcoming earnings rows with reported EPS and surprise values."""
    try:
        provider = get_market_data_provider()
        if not hasattr(provider, "get_earnings_dates"):
            return []

        earnings_dates = provider.get_earnings_dates(
            symbol,
            action="earnings_cache_dates",
            timeout_seconds=yahoo_timeout_seconds(),
            limit=12,
        )

        events = []
        for row_data in normalize_provider_table(earnings_dates):
            event = build_earnings_event(row_data)
            if event:
                events.append(event)
        return events
    except Exception as e:
        logger.warning(f"Failed to fetch earnings dates for {symbol}: {e}")
        return []


def fetch_earnings_events_for_symbol(symbol: str) -> List[Dict[str, Any]]:
    """
    Fetch earnings data for a single symbol.

    The calendar payload is useful for upcoming revenue estimates, while the
    earnings-dates table carries reported EPS and surprise values for past rows.
    """
    events_by_date: Dict[date, Dict[str, Any]] = {}

    calendar_event = _fetch_calendar_earnings_event(symbol)
    if calendar_event:
        events_by_date[calendar_event["earnings_date"]] = calendar_event

    for event in _fetch_earnings_dates_events(symbol):
        earnings_date = event["earnings_date"]
        if earnings_date in events_by_date:
            events_by_date[earnings_date] = merge_earnings_event(events_by_date[earnings_date], event)
        else:
            events_by_date[earnings_date] = event

    return sorted(events_by_date.values(), key=lambda item: item["earnings_date"])


def fetch_earnings_for_symbol(symbol: str) -> Optional[Dict[str, Any]]:
    """
    Fetch the next available earnings event for compatibility with callers that
    expect a single row.
    """
    events = fetch_earnings_events_for_symbol(symbol)
    if not events:
        return None

    today = datetime.utcnow().date()
    future_events = [event for event in events if event["earnings_date"] >= today]
    return future_events[0] if future_events else events[-1]


def upsert_earnings_cache(db, symbol: str, earnings_data: Dict[str, Any]) -> bool:
    earnings_date = earnings_data.get("earnings_date")
    if not earnings_date:
        return False

    existing = db.query(EarningsCache).filter(
        EarningsCache.symbol == symbol,
        EarningsCache.earnings_date == earnings_date
    ).first()

    if existing:
        for field in (
            "eps_estimate",
            "eps_actual",
            "revenue_estimate",
            "revenue_actual",
            "surprise_pct",
        ):
            value = earnings_data.get(field)
            if not is_missing_value(value) or getattr(existing, field) is None:
                setattr(existing, field, value)
        existing.raw_data = earnings_data.get("raw_data")
        existing.fetched_at = datetime.utcnow()
        existing.updated_at = datetime.utcnow()
    else:
        new_cache = EarningsCache(
            symbol=symbol,
            earnings_date=earnings_date,
            eps_estimate=earnings_data.get("eps_estimate"),
            eps_actual=earnings_data.get("eps_actual"),
            revenue_estimate=earnings_data.get("revenue_estimate"),
            revenue_actual=earnings_data.get("revenue_actual"),
            surprise_pct=earnings_data.get("surprise_pct"),
            raw_data=earnings_data.get("raw_data"),
            fetched_at=datetime.utcnow(),
        )
        db.add(new_cache)

    return True


def get_user_earnings_symbols(db, user_id: int, include_watchlist: bool = True) -> Dict[str, str]:
    """Return unique stock symbols relevant to one user's portfolios and watchlist."""
    symbols: Dict[str, str] = {}

    held_rows = (
        db.query(
            Asset.symbol,
            Asset.asset_type,
            func.sum(
                case(
                    (Transaction.type == TransactionType.BUY, Transaction.quantity),
                    (Transaction.type == TransactionType.TRANSFER_IN, Transaction.quantity),
                    (Transaction.type == TransactionType.CONVERSION_IN, Transaction.quantity),
                    (Transaction.type == TransactionType.SELL, -Transaction.quantity),
                    (Transaction.type == TransactionType.TRANSFER_OUT, -Transaction.quantity),
                    (Transaction.type == TransactionType.CONVERSION_OUT, -Transaction.quantity),
                    else_=0,
                )
            ).label("quantity"),
        )
        .join(Transaction, Transaction.asset_id == Asset.id)
        .join(Portfolio, Portfolio.id == Transaction.portfolio_id)
        .filter(Portfolio.user_id == user_id)
        .group_by(Asset.id)
        .having(
            func.sum(
                case(
                    (Transaction.type == TransactionType.BUY, Transaction.quantity),
                    (Transaction.type == TransactionType.TRANSFER_IN, Transaction.quantity),
                    (Transaction.type == TransactionType.CONVERSION_IN, Transaction.quantity),
                    (Transaction.type == TransactionType.SELL, -Transaction.quantity),
                    (Transaction.type == TransactionType.TRANSFER_OUT, -Transaction.quantity),
                    (Transaction.type == TransactionType.CONVERSION_OUT, -Transaction.quantity),
                    else_=0,
                )
            )
            > 0
        )
        .all()
    )

    for symbol, asset_type, _quantity in held_rows:
        if asset_type in ["EQUITY", "stock", "Stock", "STOCK"]:
            symbols[symbol] = "portfolio"

    if include_watchlist:
        watchlist_rows = (
            db.query(Asset.symbol, Asset.asset_type)
            .join(Watchlist, Watchlist.asset_id == Asset.id)
            .filter(Watchlist.user_id == user_id)
            .all()
        )
        for symbol, asset_type in watchlist_rows:
            if symbol not in symbols and asset_type in ["EQUITY", "stock", "Stock", "STOCK"]:
                symbols[symbol] = "watchlist"

    return symbols


def refresh_symbols_earnings_cache(db, symbols: List[str]) -> Dict[str, Any]:
    updated_count = 0
    failed_count = 0
    failures: List[str] = []

    for symbol in symbols:
        try:
            earnings_events = fetch_earnings_events_for_symbol(symbol)
            updated_for_symbol = 0
            for earnings_data in earnings_events:
                if upsert_earnings_cache(db, symbol, earnings_data):
                    updated_for_symbol += 1

            if updated_for_symbol:
                db.commit()
                updated_count += updated_for_symbol
                logger.debug(f"Cached {updated_for_symbol} earnings rows for {symbol}")
        except Exception as e:
            logger.warning(f"Error caching earnings for {symbol}: {e}")
            failed_count += 1
            failures.append(symbol)
            db.rollback()
            continue

    return {
        "symbols_checked": len(symbols),
        "symbols_updated": updated_count,
        "symbols_failed": failed_count,
        "failed_symbols": failures,
    }


@celery_app.task(
    bind=True,
    name="app.tasks.calendar_tasks.refresh_user_earnings_cache",
    time_limit=1800,
    soft_time_limit=1740,
)
def refresh_user_earnings_cache(self, user_id: int, include_watchlist: bool = True) -> dict:
    """
    Refresh earnings cache for one user's portfolio and watchlist symbols.

    This is intentionally asynchronous because yfinance earnings-date calls can
    take seconds per symbol for large portfolios/watchlists.
    """
    try:
        logger.info(f"Task {self.request.id}: Starting user earnings refresh for user {user_id}")

        with get_db_context() as db:
            symbol_sources = get_user_earnings_symbols(db, user_id, include_watchlist)
            symbols = sorted(symbol_sources.keys())

            if not symbols:
                return {
                    "status": "success",
                    "symbols_checked": 0,
                    "symbols_updated": 0,
                    "symbols_failed": 0,
                    "portfolio_symbols": 0,
                    "watchlist_symbols": 0,
                    "task_id": self.request.id,
                }

            updated_count = 0
            failed_count = 0
            failures: List[str] = []
            portfolio_symbols = sum(1 for source in symbol_sources.values() if source == "portfolio")
            watchlist_symbols = sum(1 for source in symbol_sources.values() if source == "watchlist")

            for index, symbol in enumerate(symbols, start=1):
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": index - 1,
                        "total": len(symbols),
                        "symbol": symbol,
                        "symbols_updated": updated_count,
                        "symbols_failed": failed_count,
                    },
                )

                try:
                    earnings_events = fetch_earnings_events_for_symbol(symbol)
                    updated_for_symbol = 0
                    for earnings_data in earnings_events:
                        if upsert_earnings_cache(db, symbol, earnings_data):
                            updated_for_symbol += 1

                    if updated_for_symbol:
                        db.commit()
                        updated_count += updated_for_symbol
                        logger.debug(f"Cached {updated_for_symbol} earnings rows for {symbol}")
                except Exception as e:
                    logger.warning(f"Error caching earnings for {symbol}: {e}")
                    failed_count += 1
                    failures.append(symbol)
                    db.rollback()
                    continue

            result = {
                "status": "success",
                "symbols_checked": len(symbols),
                "symbols_updated": updated_count,
                "symbols_failed": failed_count,
                "failed_symbols": failures,
                "portfolio_symbols": portfolio_symbols,
                "watchlist_symbols": watchlist_symbols,
                "task_id": self.request.id,
            }
            logger.info(
                f"Task {self.request.id}: User earnings refresh complete. "
                f"Rows updated: {updated_count}, Failed symbols: {failed_count}, Total symbols: {len(symbols)}"
            )
            return result
    except Exception as e:
        logger.error(f"Task {self.request.id}: Error in user earnings refresh: {e}", exc_info=True)
        return {"status": "error", "message": str(e), "task_id": self.request.id}


@celery_app.task(bind=True, name="app.tasks.calendar_tasks.refresh_earnings_cache")
@singleton_task(timeout=600)  # 10 minute timeout, prevent overlapping
def refresh_earnings_cache(self) -> dict:
    """
    Refresh earnings cache for all stock assets that are actively held.
    Only fetches for stocks (not ETFs, crypto, or other asset types).
    
    This task should run daily (e.g., at 6 AM) to keep earnings data fresh.
    """
    try:
        logger.info(f"Task {self.request.id}: Starting earnings cache refresh")
        
        with get_db_context() as db:
            # Get all unique STOCK symbols that have transactions
            # Filter to only stocks - exclude ETFs, crypto, etc.
            active_stocks = (
                db.query(Asset.symbol, Asset.id)
                .join(Asset.transactions)
                .filter(
                    Asset.asset_type.in_(['EQUITY', 'stock', 'Stock', 'STOCK']),
                )
                .distinct()
                .all()
            )
            
            if not active_stocks:
                logger.info("No active stocks to fetch earnings for")
                return {"status": "success", "symbols_processed": 0, "cached": 0}
            
            symbols = [(symbol, asset_id) for symbol, asset_id in active_stocks]
            logger.info(f"Fetching earnings for {len(symbols)} active stocks")
            
            cached_count = 0
            failed_count = 0
            
            for symbol, asset_id in symbols:
                try:
                    earnings_events = fetch_earnings_events_for_symbol(symbol)

                    cached_for_symbol = 0
                    for earnings_data in earnings_events:
                        if upsert_earnings_cache(db, symbol, earnings_data):
                            cached_for_symbol += 1

                    if cached_for_symbol:
                        db.commit()
                        cached_count += cached_for_symbol
                        logger.debug(f"Cached {cached_for_symbol} earnings rows for {symbol}")
                        
                except Exception as e:
                    logger.warning(f"Error caching earnings for {symbol}: {e}")
                    failed_count += 1
                    db.rollback()
                    continue
            
            logger.info(
                f"Task {self.request.id}: Earnings cache refresh complete. "
                f"Cached: {cached_count}, Failed: {failed_count}, Total: {len(symbols)}"
            )
            
            return {
                "status": "success",
                "symbols_processed": len(symbols),
                "cached": cached_count,
                "failed": failed_count,
                "task_id": self.request.id
            }
            
    except Exception as e:
        logger.error(f"Task {self.request.id}: Error in earnings cache refresh: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


@celery_app.task(bind=True, name="app.tasks.calendar_tasks.refresh_symbol_earnings")
def refresh_symbol_earnings(self, symbol: str) -> dict:
    """
    Refresh earnings cache for a single symbol.
    Called on-demand when a user adds a new stock position.
    """
    try:
        logger.info(f"Task {self.request.id}: Fetching earnings for {symbol}")
        
        earnings_data = fetch_earnings_for_symbol(symbol)
        
        if not earnings_data or not earnings_data.get("earnings_date"):
            return {"status": "success", "symbol": symbol, "cached": False, "reason": "No earnings data available"}
        
        with get_db_context() as db:
            upsert_earnings_cache(db, symbol, earnings_data)
            db.commit()
            
        return {
            "status": "success",
            "symbol": symbol,
            "cached": True,
            "earnings_date": earnings_data["earnings_date"].isoformat()
        }
        
    except Exception as e:
        logger.error(f"Task {self.request.id}: Error fetching earnings for {symbol}: {e}")
        return {"status": "error", "symbol": symbol, "message": str(e)}
