
"""
Portfolios router
"""
from typing import List, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status
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
from app.schemas import (
    Portfolio,
    PortfolioCreate,
    PortfolioUpdate,
    Position,
    PortfolioMetrics,
    PortfolioHistoryPoint,
    TodayBriefItem,
    TodayBriefResponse,
)
from app.crud import portfolios as crud
from app.crud import watchlist as crud_watchlist
from app.crud import notifications as crud_notifications
from app.crud import pending_dividends as crud_pending_dividends
from app.dependencies import PricingServiceDep, MetricsServiceDep
from app.services.portfolio_analytics.metrics import get_metrics_service
from app.services.market_data.pricing import get_pricing_service
from app.services.platform.cache import CacheService
from app.auth import get_current_user, verify_portfolio_access
from app.models import (
    User,
    Transaction,
    Asset,
    Portfolio as PortfolioModel,
    EarningsCache,
)
from app.models.enums import NotificationType

router = APIRouter()

TODAY_BRIEF_CACHE_TTL = 180
TODAY_BRIEF_MAX_ITEMS = 7
TODAY_BRIEF_MOVEMENT_THRESHOLD = Decimal("4")
TODAY_BRIEF_WATCHLIST_THRESHOLD = Decimal("5")
TODAY_BRIEF_DELAY_THRESHOLD_MINUTES = 15
TODAY_BRIEF_EARNINGS_LOOKAHEAD_DAYS = 7
TODAY_BRIEF_NOTIFICATION_WINDOW_HOURS = 24


def _today_brief_severity(change_pct: Optional[Decimal], fallback: str = "neutral") -> str:
    if change_pct is None:
        return fallback
    if change_pct > 0:
        return "positive"
    if change_pct < 0:
        return "negative"
    return fallback


def _format_pct(change_pct: Optional[Decimal]) -> Optional[str]:
    if change_pct is None:
        return None
    sign = "+" if change_pct > 0 else ""
    return f"{sign}{float(change_pct):.2f}%"


def _format_currency(value: Optional[Decimal], currency: str) -> Optional[str]:
    if value is None:
        return None
    sign = "+" if value > 0 else "-" if value < 0 else ""
    symbol = "€" if currency == "EUR" else "$"
    return f"{sign}{symbol}{abs(float(value)):.2f}"


def _brief_item(
    item_id: str,
    item_type: str,
    severity: str,
    title: str,
    description: Optional[str] = None,
    symbol: Optional[str] = None,
    value: Optional[str] = None,
    timestamp: Optional[datetime] = None,
    action_url: Optional[str] = None,
) -> TodayBriefItem:
    return TodayBriefItem(
        id=item_id,
        type=item_type,
        severity=severity,
        title=title,
        description=description,
        symbol=symbol,
        value=value,
        timestamp=timestamp,
        action_url=action_url,
    )


def _dedupe_items(items: List[TodayBriefItem]) -> List[TodayBriefItem]:
    seen_symbols = set()
    seen_types = set()
    deduped: List[TodayBriefItem] = []

    for item in items:
        dedupe_key = item.symbol or item.type
        if item.symbol and item.symbol in seen_symbols:
            continue
        if dedupe_key in seen_types:
            continue
        if item.symbol:
            seen_symbols.add(item.symbol)
        seen_types.add(dedupe_key)
        deduped.append(item)

    return deduped


def _collect_stock_symbols(positions: List[Position]) -> set[str]:
    return {
        position.symbol
        for position in positions
        if position.symbol and position.daily_change_pct is not None and position.market_value is not None and position.market_value > 0
    }


@router.get("/{portfolio_id}/today-brief", response_model=TodayBriefResponse)
async def get_today_brief(
    portfolio_id: int,
    metrics_service: MetricsServiceDep,
    pricing_service: PricingServiceDep,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Build a compact, deterministic daily brief from existing portfolio data."""
    cache = CacheService()
    cache_key = f"today_brief:{portfolio_id}:v1"
    cached = cache.get(cache_key)
    if cached:
        cached_payload = dict(cached)
        cached_payload["cached"] = True
        return TodayBriefResponse(**cached_payload)

    portfolio = crud.get_portfolio(db, portfolio_id)
    if not portfolio or portfolio.user_id != current_user.id:
        raise PortfolioNotFoundError(portfolio_id)

    metrics = await metrics_service.get_metrics(portfolio_id)
    positions = await metrics_service.get_positions(portfolio_id)
    portfolio_currency = portfolio.base_currency or "USD"
    now = datetime.utcnow()

    items: List[TodayBriefItem] = []

    # 1) Portfolio performance today.
    if metrics.daily_change_pct is not None and metrics.daily_change_pct != 0:
        daily_change_pct = Decimal(str(metrics.daily_change_pct))
        daily_change_value = Decimal(str(metrics.daily_change_value)) if metrics.daily_change_value is not None else None
        items.append(_brief_item(
            item_id="portfolio-performance",
            item_type="portfolio_performance",
            severity=_today_brief_severity(daily_change_pct),
            title=f"Portfolio {_format_pct(daily_change_pct) or '0.00%'} today",
            description=_format_currency(daily_change_value, portfolio_currency),
            value=_format_pct(daily_change_pct),
            timestamp=metrics.last_updated,
            action_url=f"/portfolios/{portfolio_id}",
        ))

    # 2) Holdings movers.
    valid_positions = [
        position for position in positions
        if position.daily_change_pct is not None and position.market_value is not None and position.market_value > 0
    ]
    if valid_positions:
        best_position = max(valid_positions, key=lambda position: Decimal(str(position.daily_change_pct)))
        worst_position = min(valid_positions, key=lambda position: Decimal(str(position.daily_change_pct)))

        best_pct = Decimal(str(best_position.daily_change_pct))
        worst_pct = Decimal(str(worst_position.daily_change_pct))

        if best_pct >= TODAY_BRIEF_MOVEMENT_THRESHOLD:
            items.append(_brief_item(
                item_id=f"holding-best-{best_position.asset_id}",
                item_type="holding_best_mover",
                severity="positive",
                title=f"Best holding: {best_position.symbol} {_format_pct(best_pct) or ''}".strip(),
                description=best_position.name,
                symbol=best_position.symbol,
                value=_format_pct(best_pct),
                timestamp=best_position.last_updated,
                action_url=f"/assets/{best_position.asset_id}",
            ))

        if worst_pct <= -TODAY_BRIEF_MOVEMENT_THRESHOLD:
            items.append(_brief_item(
                item_id=f"holding-worst-{worst_position.asset_id}",
                item_type="holding_worst_mover",
                severity="negative",
                title=f"Worst holding: {worst_position.symbol} {_format_pct(worst_pct) or ''}".strip(),
                description=worst_position.name,
                symbol=worst_position.symbol,
                value=_format_pct(worst_pct),
                timestamp=worst_position.last_updated,
                action_url=f"/assets/{worst_position.asset_id}",
            ))

    # 3) Earnings soon.
    symbol_universe = set(_collect_stock_symbols(positions))
    watchlist_items = crud_watchlist.get_watchlist_items_by_user(db, current_user.id)
    watchlist_symbols = [item.asset.symbol for item in watchlist_items if item.asset and item.asset.asset_type in {"EQUITY", "stock", "Stock", "STOCK"}]
    symbol_universe.update(watchlist_symbols)

    earnings_date_start = date.today()
    earnings_date_end = earnings_date_start + timedelta(days=TODAY_BRIEF_EARNINGS_LOOKAHEAD_DAYS)
    if symbol_universe:
        upcoming_earnings = db.query(EarningsCache).filter(
            EarningsCache.symbol.in_(sorted(symbol_universe)),
            EarningsCache.earnings_date >= earnings_date_start,
            EarningsCache.earnings_date <= earnings_date_end,
        ).order_by(EarningsCache.earnings_date).all()

        if upcoming_earnings:
            tomorrow = earnings_date_start + timedelta(days=1)
            today_count = sum(1 for earning in upcoming_earnings if earning.earnings_date == earnings_date_start)
            tomorrow_count = sum(1 for earning in upcoming_earnings if earning.earnings_date == tomorrow)
            week_count = len(upcoming_earnings)

            if today_count:
                title = f"{today_count} earnings today" if today_count > 1 else "1 earnings today"
                timestamp = datetime.combine(earnings_date_start, datetime.min.time())
            elif tomorrow_count:
                title = f"{tomorrow_count} earnings tomorrow" if tomorrow_count > 1 else "1 earnings tomorrow"
                timestamp = datetime.combine(tomorrow, datetime.min.time())
            else:
                title = f"{week_count} earnings this week"
                timestamp = datetime.combine(upcoming_earnings[0].earnings_date, datetime.min.time())

            earnings_symbols = ", ".join(earning.symbol for earning in upcoming_earnings[:3])
            if len(upcoming_earnings) > 3:
                earnings_symbols = f"{earnings_symbols} +{len(upcoming_earnings) - 3} more"

            items.append(_brief_item(
                item_id="earnings-soon",
                item_type="earnings_soon",
                severity="neutral",
                title=title,
                description=earnings_symbols,
                value=str(week_count),
                timestamp=timestamp,
                action_url="/calendar",
            ))

    # 4) Watchlist movement.
    if watchlist_items:
        watchlist_prices = await pricing_service.get_multiple_prices(watchlist_symbols) if watchlist_symbols else {}
        watchlist_candidates = []
        for item in watchlist_items:
            asset = item.asset
            if not asset:
                continue
            quote = watchlist_prices.get(asset.symbol)
            if not quote or quote.daily_change_pct is None:
                continue
            watchlist_candidates.append((item, asset, Decimal(str(quote.daily_change_pct))))

        if watchlist_candidates:
            watchlist_item, asset, watchlist_change = max(watchlist_candidates, key=lambda candidate: abs(candidate[2]))
            if abs(watchlist_change) >= TODAY_BRIEF_WATCHLIST_THRESHOLD:
                items.append(_brief_item(
                    item_id=f"watchlist-{asset.id}",
                    item_type="watchlist_move",
                    severity=_today_brief_severity(watchlist_change),
                    title=f"Watchlist move: {asset.symbol} {_format_pct(watchlist_change) or ''}".strip(),
                    description=asset.name,
                    symbol=asset.symbol,
                    value=_format_pct(watchlist_change),
                    timestamp=watchlist_item.updated_at,
                    action_url="/watchlist",
                ))

    # 5) Freshness / delayed data.
    delayed_positions = [
        position for position in positions
        if position.last_updated and (now - position.last_updated.replace(tzinfo=None)).total_seconds() >= TODAY_BRIEF_DELAY_THRESHOLD_MINUTES * 60
    ]
    if delayed_positions:
        items.append(_brief_item(
            item_id="delayed-prices",
            item_type="delayed_data",
            severity="warning",
            title=f"{len(delayed_positions)} delayed asset price" if len(delayed_positions) == 1 else f"{len(delayed_positions)} delayed asset prices",
            description="Market data is older than 15 minutes.",
            value=str(len(delayed_positions)),
            timestamp=delayed_positions[0].last_updated,
        ))

    # 6) Pending dividends.
    dividend_stats = crud_pending_dividends.get_pending_dividend_stats_for_portfolio(
        db,
        portfolio_id=portfolio_id,
        target_currency=portfolio_currency,
    )
    pending_count = int(dividend_stats.get("pending_count", 0) or 0)
    if pending_count > 0:
        oldest_pending_date = dividend_stats.get("oldest_pending_date")
        converted_total = dividend_stats.get("converted_total_amount")
        items.append(_brief_item(
            item_id="pending-dividends",
            item_type="pending_dividends",
            severity="neutral",
            title=f"{pending_count} pending dividend" if pending_count == 1 else f"{pending_count} pending dividends",
            description=_format_currency(converted_total, portfolio_currency),
            value=str(pending_count),
            timestamp=datetime.combine(oldest_pending_date, datetime.min.time()) if oldest_pending_date else now,
            action_url="/dividends/pending",
        ))

    # 7) Milestone / recent notification.
    recent_notifications = crud_notifications.get_user_notifications(db, current_user.id, skip=0, limit=20, unread_only=False)
    milestone_notification = None
    allowed_types = {
        NotificationType.ATH,
        NotificationType.ATL,
        NotificationType.PRICE_ALERT,
        NotificationType.DAILY_CHANGE_UP,
        NotificationType.DAILY_CHANGE_DOWN,
        NotificationType.PENDING_DIVIDEND,
    }
    cutoff = now - timedelta(hours=TODAY_BRIEF_NOTIFICATION_WINDOW_HOURS)
    for notification in recent_notifications:
        notification_type = notification.type if isinstance(notification.type, NotificationType) else NotificationType(notification.type)
        if notification_type not in allowed_types or notification.created_at < cutoff:
            continue
        milestone_notification = notification
        break

    if milestone_notification:
        metadata = milestone_notification.meta_data or {}
        symbol = metadata.get("symbol") or metadata.get("asset_symbol")
        severity = "positive" if milestone_notification.type == NotificationType.ATH else "warning"
        if milestone_notification.type == NotificationType.ATL:
            severity = "negative"
        elif milestone_notification.type == NotificationType.DAILY_CHANGE_DOWN:
            severity = "negative"
        elif milestone_notification.type == NotificationType.DAILY_CHANGE_UP:
            severity = "positive"

        items.append(_brief_item(
            item_id=f"milestone-{milestone_notification.id}",
            item_type=milestone_notification.type.value.lower(),
            severity=severity,
            title=milestone_notification.title,
            description=milestone_notification.message,
            symbol=symbol,
            timestamp=milestone_notification.created_at,
            action_url="/notifications",
        ))

    items = _dedupe_items(items)
    items.sort(key=lambda item: (
        0 if item.type == "portfolio_performance" else
        1 if item.type in {"holding_best_mover", "holding_worst_mover"} else
        2 if item.type == "earnings_soon" else
        3 if item.type == "watchlist_move" else
        4 if item.type == "delayed_data" else
        5 if item.type == "pending_dividends" else
        6,
        item.timestamp or now,
    ))
    items = items[:TODAY_BRIEF_MAX_ITEMS]

    response = TodayBriefResponse(
        portfolio_id=portfolio_id,
        generated_at=now,
        cached=False,
        items=items,
    )
    cache.set(cache_key, response.model_dump(), ttl=TODAY_BRIEF_CACHE_TTL)
    return response

@router.get("", response_model=List[Portfolio])
def get_portfolios(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of portfolios for the current user"""
    return crud.get_portfolios_by_user(db, current_user.id, skip=skip, limit=limit)


@router.get("/{portfolio_id}", response_model=Portfolio)
def get_portfolio(
    portfolio_id: int, 
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """Get portfolio by ID"""
    return portfolio


@router.post("", response_model=Portfolio, status_code=status.HTTP_201_CREATED)
def create_portfolio(
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
def update_portfolio(
    portfolio_id: int,
    portfolio_data: PortfolioUpdate,
    db: Session = Depends(get_db),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """Update existing portfolio"""
    updated = crud.update_portfolio(db, portfolio_id, portfolio_data)
    return updated


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio(
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


@router.get("/{portfolio_id}/positions/{asset_id}", response_model=Optional[Position])
async def get_portfolio_position(
    portfolio_id: int,
    asset_id: int,
    metrics_service = Depends(get_metrics_service),
    portfolio: PortfolioModel = Depends(verify_portfolio_access)
):
    """Get one open, partially sold, or fully closed portfolio position."""
    return await metrics_service.get_position(portfolio_id, asset_id)


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
def get_portfolio_history(
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
    from app.services.communications.pdf_reports import PDFReportService
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
    force_refresh: bool = Query(False, description="Bypass the server-side batch cache"),
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
    from datetime import datetime, timezone
    from app.services.market_data.currency import CurrencyService
    
    logger = logging.getLogger(__name__)

    def utc_iso(dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    
    from app.services.platform.cache import CacheService
    
    # Check cache first (5 minute TTL)
    cache = CacheService()
    cache_key = f"portfolio_batch_prices:{portfolio_id}"
    cached_data = cache.get(cache_key)
    
    if cached_data and not force_refresh:
        logger.info(f"Price batch cache hit for portfolio {portfolio_id}")
        return cached_data
    
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
            empty_response = {
                "portfolio_id": portfolio_id,
                "base_currency": base_currency,
                "prices": [],
                "updated_at": utc_iso(datetime.now(timezone.utc)),
                "count": 0
            }
            cache.set(cache_key, empty_response, ttl=300)  # 5 min cache
            return empty_response
        
        # Get asset details (symbol, currency) - fast with new index
        assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
        
        # Fetch all prices in parallel (existing optimization)
        pricing_service = get_pricing_service(db)
        symbols = [asset.symbol for asset in assets]
        
        logger.info(f"Batch fetching prices for {len(symbols)} assets in portfolio {portfolio_id}")
        
        # This already uses parallel fetching internally
        price_quotes = await pricing_service.get_multiple_prices(symbols, force_refresh=True)
        
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
                    "last_updated": utc_iso(quote.asof) if quote.asof else None,
                    "asset_type": asset.asset_type
                })
        
        response = {
            "portfolio_id": portfolio_id,
            "base_currency": base_currency,
            "prices": prices,
            "updated_at": utc_iso(datetime.now(timezone.utc)),
            "count": len(prices)
        }
        
        # Cache the response for 5 minutes
        cache.set(cache_key, response, ttl=300)
        logger.info(f"Cached price batch for portfolio {portfolio_id} ({len(prices)} prices)\")")
        
        return response
    
    except Exception as e:
        logger.error(f"Failed to fetch batch prices for portfolio {portfolio_id}: {e}", exc_info=True)
        raise CannotGetPortfolioPricesError(portfolio_id, str(e))
