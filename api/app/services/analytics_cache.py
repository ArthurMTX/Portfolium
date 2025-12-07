"""
Smart caching for expensive analytics calculations with Redis backend
Invalidates cache only when underlying data changes
"""
import hashlib
import json
from datetime import datetime, timedelta
from typing import Any, Optional, Dict, Callable
import logging

from app.services.cache import CacheService

logger = logging.getLogger(__name__)

# Cache TTL
_CACHE_TTL = 3600  # 1 hour in seconds


def _calculate_fingerprint(portfolio_id: int, positions: list, last_transaction_date: Optional[str]) -> str:
    """
    Calculate a fingerprint of the data that affects analytics
    Changes when: positions change, new transaction added, prices update
    """
    # Helper to convert Decimal to float for JSON serialization
    def convert_value(val):
        if hasattr(val, '__float__'):  # Decimal, etc.
            return float(val)
        return val
    
    # Create a deterministic representation of the data
    data_snapshot = {
        'portfolio_id': portfolio_id,
        'positions_count': len(positions),
        'positions_snapshot': [
            {
                'asset_id': p.get('asset_id') if isinstance(p, dict) else p.asset_id,
                'quantity': convert_value(p.get('quantity') if isinstance(p, dict) else p.quantity),
                'current_price': convert_value(p.get('current_price') if isinstance(p, dict) else p.current_price),
            }
            for p in positions[:50]  # First 50 positions for fingerprint
        ],
        'last_transaction': last_transaction_date,
        'date': datetime.now().strftime('%Y-%m-%d'),  # Changes daily to catch price updates
    }
    
    # Create SHA256 hash
    json_str = json.dumps(data_snapshot, sort_keys=True)
    return hashlib.sha256(json_str.encode()).hexdigest()[:16]


def get_cached_analytics(
    cache_key: str,
    portfolio_id: int,
    positions: list,
    last_transaction_date: Optional[str],
    calculator: Callable[[], Any]
) -> Any:
    """
    Get cached analytics result or calculate if data changed (using Redis)
    
    Args:
        cache_key: Base key for the cache (e.g., 'risk_metrics', 'benchmark_comparison')
        portfolio_id: Portfolio ID
        positions: Current positions list
        last_transaction_date: Date of last transaction
        calculator: Function to call if cache miss
    
    Returns:
        Cached or freshly calculated result
    """
    # Calculate data fingerprint
    fingerprint = _calculate_fingerprint(portfolio_id, positions, last_transaction_date)
    full_key = f"{CacheService.PREFIX_ANALYTICS}{cache_key}_{portfolio_id}_{fingerprint}"
    
    # Check Redis cache
    cached_value = CacheService.get(full_key)
    if cached_value is not None:
        logger.info(f"Redis cache HIT for {cache_key} (fingerprint: {fingerprint})")
        return cached_value
    
    logger.info(f"Redis cache MISS for {cache_key} (fingerprint: {fingerprint})")
    
    # Calculate fresh result
    logger.info(f"Calculating {cache_key} for portfolio {portfolio_id}")
    result = calculator()
    
    # Store in Redis cache
    CacheService.set(full_key, result, _CACHE_TTL)
    
    return result


def invalidate_portfolio_analytics(portfolio_id: int):
    """
    Manually invalidate all analytics for a portfolio
    Call this when you know data changed (e.g., after transaction)
    """
    deleted_count = CacheService.invalidate_portfolio(portfolio_id)
    logger.info(f"Invalidated {deleted_count} cache entries for portfolio {portfolio_id}")


def clear_all_cache():
    """Clear entire analytics cache"""
    pattern = f"{CacheService.PREFIX_ANALYTICS}*"
    deleted_count = CacheService.delete_pattern(pattern)
    logger.info(f"Cleared {deleted_count} analytics cache entries")


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics from Redis"""
    return CacheService.get_stats()
