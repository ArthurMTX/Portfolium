"""
Background tasks for cache management and optimization.
"""
import asyncio
import logging
from typing import List, Optional
from celery import group
from datetime import datetime

from app.celery_app import celery_app
from app.db import get_db_context
from app.models import Asset, Portfolio
from app.services.cache import CacheService
from app.services.pricing import PricingService
from app.services.analytics_cache import invalidate_portfolio_analytics
from app.tasks.decorators import singleton_task

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.tasks.cache_tasks.invalidate_portfolio_cache")
def invalidate_portfolio_cache(self, portfolio_id: int) -> dict:
    """
    Invalidate all cache entries for a portfolio.
    Called after transactions are created/updated/deleted.
    
    Args:
        portfolio_id: Portfolio ID to invalidate cache for
        
    Returns:
        dict with invalidation summary
    """
    try:
        logger.info(f"Task {self.request.id}: Invalidating cache for portfolio {portfolio_id}")
        
        # Invalidate portfolio-specific caches
        deleted_count = CacheService.invalidate_portfolio(portfolio_id)
        
        # Also invalidate analytics cache
        invalidate_portfolio_analytics(portfolio_id)
        
        logger.info(
            f"Task {self.request.id}: Invalidated {deleted_count} cache entries "
            f"for portfolio {portfolio_id}"
        )
        
        return {
            "status": "success",
            "portfolio_id": portfolio_id,
            "cache_entries_deleted": deleted_count,
            "task_id": self.request.id
        }
        
    except Exception as e:
        logger.error(
            f"Task {self.request.id}: Error invalidating cache for portfolio {portfolio_id}: {e}",
            exc_info=True
        )
        return {"status": "error", "message": str(e)}


@celery_app.task(bind=True, name="app.tasks.cache_tasks.warmup_price_cache")
@singleton_task(timeout=120)  # Prevent overlapping warmups
def warmup_price_cache(self) -> dict:
    """
    Warm up price cache for all assets that are actively held in portfolios.
    Scheduled to run during market hours to keep prices fresh.
    
    Returns:
        dict with summary of warmed up prices
    """
    try:
        logger.info(f"Task {self.request.id}: Starting price cache warmup")
        
        with get_db_context() as db:
            # Get all unique assets that have active positions
            # (assets with transactions in portfolios)
            active_assets = (
                db.query(Asset.symbol)
                .join(Asset.transactions)
                .distinct()
                .all()
            )
            
            if not active_assets:
                logger.info("No active assets to warm up prices for")
                return {"status": "success", "prices_warmed": 0}
            
            symbols = [asset.symbol for asset in active_assets]
            logger.info(f"Warming up prices for {len(symbols)} active assets")
            
            # Fetch prices (this will automatically cache them)
            pricing_service = PricingService(db)
            results = asyncio.run(pricing_service.get_multiple_prices(symbols))
            
            success_count = sum(1 for r in results.values() if r is not None)
            
            logger.info(
                f"Task {self.request.id}: Warmed up {success_count}/{len(symbols)} prices"
            )
            
            return {
                "status": "success",
                "symbols_processed": len(symbols),
                "prices_warmed": success_count,
                "task_id": self.request.id
            }
            
    except Exception as e:
        logger.error(
            f"Task {self.request.id}: Error warming up price cache: {e}",
            exc_info=True
        )
        # Don't retry - this is a non-critical background task
        return {"status": "error", "message": str(e)}


@celery_app.task(bind=True, name="app.tasks.cache_tasks.cleanup_expired_cache")
def cleanup_expired_cache(self) -> dict:
    """
    Clean up expired cache entries.
    Redis handles TTL automatically, but this can be used for manual cleanup
    or logging/monitoring purposes.
    
    Returns:
        dict with cleanup summary
    """
    try:
        logger.info(f"Task {self.request.id}: Starting expired cache cleanup")
        
        # Get cache stats before cleanup
        stats_before = CacheService.get_stats()
        
        # Redis automatically removes expired keys, but we can get stats
        # This is more for monitoring than actual cleanup
        
        logger.info(
            f"Task {self.request.id}: Cache cleanup completed. "
            f"Current stats: {stats_before.get('total_keys', 0)} keys, "
            f"{stats_before.get('memory_used', 'unknown')} memory"
        )
        
        return {
            "status": "success",
            "cache_stats": stats_before,
            "task_id": self.request.id
        }
        
    except Exception as e:
        logger.error(
            f"Task {self.request.id}: Error during cache cleanup: {e}",
            exc_info=True
        )
        return {"status": "error", "message": str(e)}


@celery_app.task(bind=True, name="app.tasks.cache_tasks.warmup_specific_symbols")
def warmup_specific_symbols(self, symbols: List[str]) -> dict:
    """
    Warm up price cache for specific symbols.
    
    Args:
        symbols: List of symbols to fetch and cache prices for
        
    Returns:
        dict with summary
    """
    try:
        logger.info(f"Task {self.request.id}: Warming up prices for {len(symbols)} specific symbols")
        
        with get_db_context() as db:
            pricing_service = PricingService(db)
            results = asyncio.run(pricing_service.get_multiple_prices(symbols))
            
            success_count = sum(1 for r in results.values() if r is not None)
            
            return {
                "status": "success",
                "symbols_processed": len(symbols),
                "prices_warmed": success_count,
                "task_id": self.request.id
            }
        
    except Exception as e:
        logger.error(
            f"Task {self.request.id}: Error warming up specific symbols: {e}",
            exc_info=True
        )
        return {"status": "error", "message": str(e)}


@celery_app.task(name="app.tasks.cache_tasks.get_cache_statistics")
def get_cache_statistics() -> dict:
    """
    Get comprehensive cache statistics for monitoring.
    
    Returns:
        dict with detailed cache stats
    """
    try:
        stats = CacheService.get_stats()
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "cache_stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting cache statistics: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
