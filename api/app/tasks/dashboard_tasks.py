"""
Background tasks for dashboard data pre-warming
Ensures users are greeted with instant data when they visit their dashboard
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Set, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func

from app.celery_app import celery_app
from app.db import get_db_context
from app.models import User, Portfolio, DashboardLayout
from app.routers.batch import (
    _extract_required_data,
    _fetch_metrics,
    _fetch_positions,
    _fetch_watchlist,
    _fetch_notifications,
    _fetch_market_tnx,
    _fetch_market_dxy,
    _fetch_market_vix,
    _fetch_market_indices,
    _fetch_sentiment_stock,
    _fetch_sentiment_crypto,
    _fetch_asset_allocation,
    _fetch_sector_allocation,
    _fetch_country_allocation,
    _fetch_performance_history,
    _fetch_transactions,
    _make_json_serializable,
)
from app.services.metrics import MetricsService
from app.services.insights import InsightsService
from app.services.cache import CacheService
from app.tasks.decorators import singleton_task, deduplicate_task

logger = logging.getLogger(__name__)

# Cache TTL for warmed dashboard data (5 minutes)
_DASHBOARD_WARMUP_CACHE_TTL = 300


@celery_app.task(bind=True, name="dashboard.warmup_user_dashboard")
@deduplicate_task(ttl=30)
def warmup_user_dashboard(self, user_id: int, portfolio_id: int, widget_ids: Optional[List[str]] = None):
    """
    Pre-warm dashboard cache for a specific user's portfolio
    
    This task fetches and caches all data needed for the user's dashboard widgets.
    When the user visits their dashboard, data will be served instantly from cache.
    
    Args:
        user_id: User ID
        portfolio_id: Portfolio ID
        widget_ids: List of widget IDs to warm (if None, uses default common widgets)
    """
    with get_db_context() as db:
        # Verify portfolio belongs to user
        portfolio = db.query(Portfolio).filter(
            and_(Portfolio.id == portfolio_id, Portfolio.user_id == user_id)
        ).first()
        
        if not portfolio:
            logger.warning(f"Portfolio {portfolio_id} not found for user {user_id}")
            return {"success": False, "error": "Portfolio not found"}
        
        # Get user's dashboard layout if exists, otherwise use default widgets
        if widget_ids is None:
            layout = db.query(DashboardLayout).filter(
                and_(
                    DashboardLayout.user_id == user_id,
                    DashboardLayout.portfolio_id == portfolio_id,
                    DashboardLayout.is_default == True
                )
            ).first()
            
            if layout and layout.layout_config:
                # Extract widget IDs from layout config
                widget_ids = _extract_widget_ids_from_layout(layout.layout_config)
            else:
                # Default common widgets (fast widgets only)
                widget_ids = [
                    'total-value', 'daily-gain', 'unrealized-pnl', 'realized-pnl',
                    'positions-table', 'watchlist', 'market-indices',
                    'asset-allocation', 'recent-transactions'
                ]
        
        logger.info(f"Warming dashboard for user {user_id}, portfolio {portfolio_id} with {len(widget_ids)} widgets")
        
        # Determine required data sets
        required_data = _extract_required_data(widget_ids)
        
        # Initialize services with db session
        metrics_service = MetricsService(db)
        insights_service = InsightsService(db)
        
        # Fetch user object once (needed by multiple data fetchers)
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning(f"User {user_id} not found")
            return {"success": False, "error": "User not found"}
        
        # Fetch all required data
        async def fetch_all_data():
            tasks = {}
            task_names = []
            
            if 'metrics' in required_data:
                tasks['metrics'] = _fetch_metrics(portfolio_id, metrics_service, db)
                task_names.append('metrics')
            
            if 'positions' in required_data:
                tasks['positions'] = _fetch_positions(portfolio_id, metrics_service, db)
                task_names.append('positions')
            
            if 'watchlist' in required_data:
                tasks['watchlist'] = _fetch_watchlist(user, db)
                task_names.append('watchlist')
            
            if 'notifications' in required_data:
                tasks['notifications'] = _fetch_notifications(user, db)
                task_names.append('notifications')
            
            if 'market_tnx' in required_data:
                tasks['market_tnx'] = _fetch_market_tnx()
                task_names.append('market_tnx')
            
            if 'market_dxy' in required_data:
                tasks['market_dxy'] = _fetch_market_dxy()
                task_names.append('market_dxy')
            
            if 'market_vix' in required_data:
                tasks['market_vix'] = _fetch_market_vix()
                task_names.append('market_vix')
            
            if 'market_indices' in required_data:
                tasks['market_indices'] = _fetch_market_indices()
                task_names.append('market_indices')
            
            if 'sentiment_stock' in required_data:
                tasks['sentiment_stock'] = _fetch_sentiment_stock()
                task_names.append('sentiment_stock')
            
            if 'sentiment_crypto' in required_data:
                tasks['sentiment_crypto'] = _fetch_sentiment_crypto()
                task_names.append('sentiment_crypto')
            
            if 'asset_allocation' in required_data:
                tasks['asset_allocation'] = _fetch_asset_allocation(portfolio_id, db, metrics_service, user)
                task_names.append('asset_allocation')
            
            if 'sector_allocation' in required_data:
                tasks['sector_allocation'] = _fetch_sector_allocation(portfolio_id, db, metrics_service, user)
                task_names.append('sector_allocation')
            
            if 'country_allocation' in required_data:
                tasks['country_allocation'] = _fetch_country_allocation(portfolio_id, db, metrics_service, user)
                task_names.append('country_allocation')
            
            if 'performance_history' in required_data:
                tasks['performance_history'] = _fetch_performance_history(portfolio_id, db)
                task_names.append('performance_history')
            
            if 'transactions' in required_data:
                tasks['transactions'] = _fetch_transactions(portfolio_id, db)
                task_names.append('transactions')
            
            # Execute all in parallel
            results = await asyncio.gather(*tasks.values(), return_exceptions=True)
            
            # Build data dict from results
            data = {}
            errors = {}
            for i, (name, result) in enumerate(zip(task_names, results)):
                if isinstance(result, Exception):
                    errors[name] = str(result)
                    logger.error(f"Error fetching {name} during warmup: {result}")
                else:
                    data[name] = result
            
            return data, errors
        
        # Run the async fetch
        data, errors = asyncio.run(fetch_all_data())
        
        # Build response matching batch endpoint format
        now = datetime.utcnow()
        response = {
            "data": data,
            "errors": errors,
            "cached": False,
            "timestamp": now.isoformat(),
            "widgets_requested": len(widget_ids),
            "data_fetched": len(data),
        }
        
        # Make response JSON serializable
        response = _make_json_serializable(response)
        
        # Cache the response in Redis using the same key format as batch endpoint
        cache = CacheService()
        widget_key = ','.join(sorted(widget_ids))
        cache_key = f"dashboard_batch:{portfolio_id}:{hash(widget_key)}"
        cache.set(cache_key, response, ttl=_DASHBOARD_WARMUP_CACHE_TTL)
        
        # ALSO warm up the price batch cache (used by auto-refresh)
        price_batch_warmed = False
        try:
            from app.routers.portfolios import get_batch_prices
            from fastapi import Request
            
            # Import the batch prices functionality
            from app.services.pricing import PricingService
            from app.services.currency import CurrencyService
            from app.models import Asset, Transaction
            from decimal import Decimal
            
            # Get base currency
            base_currency = portfolio.base_currency if portfolio.base_currency else "USD"
            
            # Get all unique assets
            asset_ids = (
                db.query(Transaction.asset_id)
                .filter(Transaction.portfolio_id == portfolio_id)
                .distinct()
                .all()
            )
            asset_ids = [row[0] for row in asset_ids]
            
            if asset_ids:
                assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
                symbols = [asset.symbol for asset in assets]
                asset_map = {asset.id: asset for asset in assets}
                
                pricing_service = PricingService(db)
                price_quotes = asyncio.run(pricing_service.get_multiple_prices(symbols))
                
                prices = []
                for asset in assets:
                    quote = price_quotes.get(asset.symbol)
                    if quote and quote.price:
                        original_price = float(quote.price)
                        current_price = original_price
                        
                        if asset.currency != base_currency:
                            converted = CurrencyService.convert(
                                Decimal(str(original_price)),
                                from_currency=asset.currency,
                                to_currency=base_currency
                            )
                            current_price = float(converted) if converted else original_price
                        
                        price_data = {
                            "symbol": asset.symbol,
                            "asset_id": asset.id,
                            "name": asset.name,
                            "current_price": current_price,
                            "original_price": original_price,
                            "original_currency": asset.currency,
                            "daily_change_pct": float(quote.daily_change_pct) if quote.daily_change_pct else None,
                            "last_updated": quote.asof.isoformat() if quote.asof else None,
                            "asset_type": asset.asset_type
                        }
                        prices.append(price_data)
                
                price_batch_response = {
                    "portfolio_id": portfolio_id,
                    "base_currency": base_currency,
                    "prices": prices,
                    "updated_at": now.isoformat(),
                    "count": len(prices)
                }
                
                price_cache_key = f"portfolio_batch_prices:{portfolio_id}"
                cache.set(price_cache_key, price_batch_response, ttl=_DASHBOARD_WARMUP_CACHE_TTL)
                price_batch_warmed = True
                logger.info(f"Warmed price batch cache for portfolio {portfolio_id} ({len(prices)} prices)")
        except Exception as e:
            logger.error(f"Failed to warm price batch cache for portfolio {portfolio_id}: {e}")
        
        logger.info(
            f"Dashboard warmup complete for portfolio {portfolio_id}: "
            f"{len(widget_ids)} widgets, {len(data)} data sets cached, {len(errors)} errors, "
            f"price_batch_warmed={price_batch_warmed}"
        )
        
        return {
            "success": True,
            "portfolio_id": portfolio_id,
            "widgets_warmed": len(widget_ids),
            "data_sets_cached": len(data),
            "errors": len(errors),
            "cache_key": cache_key,
            "cache_ttl": _DASHBOARD_WARMUP_CACHE_TTL,
            "price_batch_warmed": price_batch_warmed,
            "timestamp": now.isoformat()
        }


@celery_app.task(bind=True, name="dashboard.warmup_active_dashboards")
def warmup_active_dashboards(self):
    """
    Pre-warm dashboards for recently active users
    
    This scheduled task identifies users who have been active recently and
    pre-warms their dashboard caches so they get instant data on next visit.
    
    Runs every 5 minutes during market hours, every 30 minutes off-hours.
    """
    with get_db_context() as db:
        # Find users active in the last hour
        cutoff_time = datetime.utcnow() - timedelta(hours=1)
        
        # Get distinct users with portfolios who were recently active
        active_users = db.query(
            User.id,
            Portfolio.id.label('portfolio_id')
        ).join(
            Portfolio, User.id == Portfolio.user_id
        ).filter(
            User.is_active == True
        ).limit(50).all()  # Limit to 50 most recent to avoid overload
        
        if not active_users:
            logger.info("No active users found for dashboard warmup")
            return {"success": True, "users_warmed": 0}
        
        logger.info(f"Warming dashboards for {len(active_users)} active users")
        
        # Queue warmup tasks for each user's portfolio
        warmed_count = 0
        for user in active_users:
            try:
                warmup_user_dashboard.delay(user.id, user.portfolio_id)
                warmed_count += 1
            except Exception as e:
                logger.error(f"Failed to queue warmup for user {user.id}: {e}")
        
        return {
            "success": True,
            "users_warmed": warmed_count,
            "timestamp": datetime.now().isoformat()
        }


@celery_app.task(bind=True, name="dashboard.warmup_portfolio_on_transaction")
def warmup_portfolio_on_transaction(self, portfolio_id: int, user_id: int):
    """
    Triggered after a transaction is created/updated
    Immediately warms the dashboard cache so user sees updated data
    
    Args:
        portfolio_id: Portfolio that had a transaction
        user_id: User who owns the portfolio
    """
    logger.info(f"Transaction detected for portfolio {portfolio_id}, warming dashboard")
    return warmup_user_dashboard(user_id, portfolio_id)


def _extract_widget_ids_from_layout(layout_config: dict) -> List[str]:
    """
    Extract widget IDs from dashboard layout configuration
    
    Args:
        layout_config: JSON layout configuration from DashboardLayout.layout_config
        
    Returns:
        List of widget IDs
    """
    widget_ids = []
    
    # Handle different layout config structures
    if isinstance(layout_config, dict):
        # Check for common layout structures
        if 'widgets' in layout_config:
            widgets = layout_config['widgets']
            if isinstance(widgets, list):
                for widget in widgets:
                    if isinstance(widget, dict) and 'id' in widget:
                        widget_ids.append(widget['id'])
                    elif isinstance(widget, str):
                        widget_ids.append(widget)
        
        # Check for grid-based layouts
        elif 'grid' in layout_config or 'layout' in layout_config:
            grid = layout_config.get('grid') or layout_config.get('layout')
            if isinstance(grid, list):
                for item in grid:
                    if isinstance(item, dict):
                        # Common grid formats: {i: 'widget-id', ...} or {id: 'widget-id', ...}
                        widget_id = item.get('i') or item.get('id') or item.get('widget_id')
                        if widget_id:
                            widget_ids.append(widget_id)
    
    return widget_ids
