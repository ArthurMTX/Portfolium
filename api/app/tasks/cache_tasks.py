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
        
        # Invalidate public portfolio cache if this portfolio is public
        with get_db_context() as db:
            from app.crud import portfolios as crud_portfolios
            portfolio = crud_portfolios.get_portfolio(db, portfolio_id)
            if portfolio and portfolio.is_public and portfolio.share_token:
                public_cache_key = f"public_portfolio:{portfolio.share_token}"
                if CacheService.delete(public_cache_key):
                    logger.info(f"Invalidated public portfolio cache for {portfolio_id}")
                    deleted_count += 1
        
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


@celery_app.task(bind=True, name="app.tasks.cache_tasks.warmup_public_portfolios")
def warmup_public_portfolios(self) -> dict:
    """
    Warm up cache for all public portfolios.
    Runs periodically to ensure fast loading for visitors.
    
    This is especially important for big portfolios where insights calculation
    can take 10+ seconds. By pre-warming the cache, all visitors get instant load times.
    
    Returns:
        dict with warmup summary
    """
    try:
        logger.info(f"Task {self.request.id}: Starting public portfolio cache warmup")
        
        with get_db_context() as db:
            from app.crud import portfolios as crud_portfolios
            from app.routers.public import get_public_portfolio
            import asyncio
            
            # Get all public portfolios
            public_portfolios = db.query(Portfolio).filter(
                Portfolio.is_public == True,
                Portfolio.share_token.isnot(None)
            ).all()
            
            if not public_portfolios:
                logger.info("No public portfolios to warm up")
                return {"status": "success", "portfolios_warmed": 0}
            
            logger.info(f"Warming up {len(public_portfolios)} public portfolios")
            
            warmed_count = 0
            failed_count = 0
            
            for portfolio in public_portfolios:
                try:
                    # Call the endpoint function directly to warm cache
                    # This will compute and cache the expensive insights
                    result = asyncio.run(get_public_portfolio(portfolio.share_token, db))
                    warmed_count += 1
                    logger.info(f"Warmed public portfolio {portfolio.id} (token {portfolio.share_token[:8]}...)")
                except Exception as e:
                    failed_count += 1
                    logger.error(f"Failed to warm public portfolio {portfolio.id}: {e}")
            
            logger.info(
                f"Task {self.request.id}: Warmed {warmed_count}/{len(public_portfolios)} "
                f"public portfolios, {failed_count} failed"
            )
            
            return {
                "status": "success",
                "portfolios_warmed": warmed_count,
                "portfolios_failed": failed_count,
                "total_public": len(public_portfolios),
                "task_id": self.request.id
            }
        
    except Exception as e:
        logger.error(f"Task {self.request.id}: Error warming public portfolios: {e}", exc_info=True)
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
