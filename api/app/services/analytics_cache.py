"""
Smart caching for expensive analytics calculations
Invalidates cache only when underlying data changes
"""
import hashlib
import json
from datetime import datetime, timedelta
from typing import Any, Optional, Dict, Callable
import logging

logger = logging.getLogger(__name__)

# In-memory cache (upgrade to Redis in production)
_analytics_cache: Dict[str, tuple[Any, datetime]] = {}
_CACHE_TTL = timedelta(hours=24)  # Max age even if data doesn't change


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
    Get cached analytics result or calculate if data changed
    
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
    full_key = f"{cache_key}_{portfolio_id}_{fingerprint}"
    
    # Check cache
    if full_key in _analytics_cache:
        cached_value, cached_time = _analytics_cache[full_key]
        age = datetime.now() - cached_time
        
        # Return cached if still valid
        if age < _CACHE_TTL:
            logger.info(f"Cache HIT for {cache_key} (age: {age.total_seconds():.1f}s, fingerprint: {fingerprint})")
            return cached_value
        else:
            logger.info(f"Cache EXPIRED for {cache_key} (age: {age.total_seconds():.1f}s)")
    else:
        logger.info(f"Cache MISS for {cache_key} (fingerprint: {fingerprint})")
    
    # Calculate fresh result
    logger.info(f"Calculating {cache_key} for portfolio {portfolio_id}")
    result = calculator()
    
    # Store in cache
    _analytics_cache[full_key] = (result, datetime.now())
    
    # Cleanup old entries (keep last 100)
    if len(_analytics_cache) > 100:
        oldest_keys = sorted(
            _analytics_cache.keys(),
            key=lambda k: _analytics_cache[k][1]
        )[:20]
        for key in oldest_keys:
            del _analytics_cache[key]
        logger.info(f"Cleaned up {len(oldest_keys)} old cache entries")
    
    return result


def invalidate_portfolio_analytics(portfolio_id: int):
    """
    Manually invalidate all analytics for a portfolio
    Call this when you know data changed (e.g., after transaction)
    """
    keys_to_delete = [k for k in _analytics_cache.keys() if f"_{portfolio_id}_" in k]
    for key in keys_to_delete:
        del _analytics_cache[key]
    logger.info(f"Invalidated {len(keys_to_delete)} cache entries for portfolio {portfolio_id}")


def clear_all_cache():
    """Clear entire cache"""
    _analytics_cache.clear()
    logger.info("Cleared entire analytics cache")


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics"""
    return {
        'total_entries': len(_analytics_cache),
        'entries_by_type': {
            'risk_metrics': len([k for k in _analytics_cache if 'risk_metrics' in k]),
            'benchmark_comparison': len([k for k in _analytics_cache if 'benchmark_comparison' in k]),
        },
        'oldest_entry': min(
            [v[1] for v in _analytics_cache.values()],
            default=None
        ),
        'newest_entry': max(
            [v[1] for v in _analytics_cache.values()],
            default=None
        ),
    }
