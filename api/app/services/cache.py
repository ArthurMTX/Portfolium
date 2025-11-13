"""
High-level caching service with Redis backend and graceful degradation.
Provides type-safe caching for common operations.
"""
import json
import logging
from typing import Optional, Any, Callable, TypeVar, Generic
from datetime import datetime, timedelta
from decimal import Decimal
from redis.exceptions import RedisError
from pydantic import BaseModel

from app.redis_client import get_redis

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CacheService:
    """
    High-level caching service with automatic serialization and graceful degradation.
    
    Features:
    - Automatic JSON serialization with Decimal support
    - TTL (time-to-live) support
    - Graceful degradation when Redis unavailable
    - Type-safe get/set operations
    - Batch operations support
    """
    
    # Cache key prefixes for organization
    PREFIX_PRICE = "price:"
    PREFIX_POSITION = "positions:"
    PREFIX_METRICS = "metrics:"
    PREFIX_ANALYTICS = "analytics:"
    PREFIX_ASSET = "asset:"
    PREFIX_INSIGHTS = "insights:"
    
    # Default TTLs (in seconds)
    TTL_PRICE = 300  # 5 minutes
    TTL_POSITION = 600  # 10 minutes
    TTL_METRICS = 900  # 15 minutes
    TTL_ANALYTICS = 3600  # 1 hour
    TTL_ASSET = 3600  # 1 hour
    TTL_INSIGHTS = 300  # 5 minutes
    
    @staticmethod
    def _serialize(value: Any) -> str:
        """Serialize value to JSON string, handling Decimal, datetime, and Pydantic models"""
        # Handle Pydantic models first
        if isinstance(value, BaseModel):
            value = value.model_dump()
        
        def default_handler(obj):
            if isinstance(obj, Decimal):
                return float(obj)
            if isinstance(obj, datetime):
                return obj.isoformat()
            if isinstance(obj, BaseModel):
                return obj.model_dump()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
        
        return json.dumps(value, default=default_handler)
    
    @staticmethod
    def _deserialize(value: str) -> Any:
        """Deserialize JSON string to Python object"""
        return json.loads(value)
    
    @staticmethod
    def get(key: str, default: Any = None) -> Any:
        """
        Get value from cache.
        Returns default if key not found or Redis unavailable.
        """
        redis_client = get_redis()
        if not redis_client:
            return default
        
        try:
            value = redis_client.get(key)
            if value is None:
                logger.debug(f"Cache MISS: {key}")
                return default
            
            logger.debug(f"Cache HIT: {key}")
            return CacheService._deserialize(value)
        except (RedisError, json.JSONDecodeError) as e:
            logger.warning(f"Cache get error for key {key}: {e}")
            return default
    
    @staticmethod
    def set(key: str, value: Any, ttl: Optional[int] = None, nx: bool = False) -> bool:
        """
        Set value in cache with optional TTL.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds
            nx: Only set if key doesn't exist (for locking)
        
        Returns:
            True if successful, False otherwise.
            With nx=True, returns True only if key was set (didn't exist before).
        """
        redis_client = get_redis()
        if not redis_client:
            return False
        
        try:
            serialized = CacheService._serialize(value)
            
            if nx:
                # SET with NX option (only set if not exists)
                if ttl:
                    result = redis_client.set(key, serialized, ex=ttl, nx=True)
                else:
                    result = redis_client.set(key, serialized, nx=True)
                success = result is not None and result  # Redis returns True/False for nx
                if success:
                    logger.debug(f"Cache SET (NX): {key} (TTL: {ttl}s)" if ttl else f"Cache SET (NX): {key}")
                return success
            else:
                # Normal SET
                if ttl:
                    redis_client.setex(key, ttl, serialized)
                else:
                    redis_client.set(key, serialized)
                
                logger.debug(f"Cache SET: {key} (TTL: {ttl}s)" if ttl else f"Cache SET: {key}")
                return True
        except (RedisError, TypeError) as e:
            logger.warning(f"Cache set error for key {key}: {e}")
            return False
    
    @staticmethod
    def delete(key: str) -> bool:
        """
        Delete key from cache.
        Returns True if successful, False otherwise.
        """
        redis_client = get_redis()
        if not redis_client:
            return False
        
        try:
            redis_client.delete(key)
            logger.debug(f"Cache DELETE: {key}")
            return True
        except RedisError as e:
            logger.warning(f"Cache delete error for key {key}: {e}")
            return False
    
    @staticmethod
    def delete_pattern(pattern: str) -> int:
        """
        Delete all keys matching pattern.
        Returns number of keys deleted, 0 if Redis unavailable.
        """
        redis_client = get_redis()
        if not redis_client:
            return 0
        
        try:
            keys = redis_client.keys(pattern)
            if keys:
                deleted = redis_client.delete(*keys)
                logger.info(f"Cache DELETE PATTERN: {pattern} ({deleted} keys)")
                return deleted
            return 0
        except RedisError as e:
            logger.warning(f"Cache delete pattern error for {pattern}: {e}")
            return 0
    
    @staticmethod
    def exists(key: str) -> bool:
        """Check if key exists in cache"""
        redis_client = get_redis()
        if not redis_client:
            return False
        
        try:
            return redis_client.exists(key) > 0
        except RedisError as e:
            logger.warning(f"Cache exists error for key {key}: {e}")
            return False
    
    @staticmethod
    def get_or_set(
        key: str,
        calculator: Callable[[], T],
        ttl: Optional[int] = None
    ) -> T:
        """
        Get value from cache, or calculate and cache if not found.
        
        Args:
            key: Cache key
            calculator: Function to calculate value if not cached
            ttl: Time to live in seconds
        
        Returns:
            Cached or calculated value
        """
        # Try to get from cache
        cached = CacheService.get(key)
        if cached is not None:
            return cached
        
        # Calculate fresh value
        value = calculator()
        
        # Cache the result
        CacheService.set(key, value, ttl)
        
        return value
    
    @staticmethod
    def mget(keys: list[str]) -> list[Any]:
        """
        Get multiple values at once.
        Returns list of values (None for missing keys).
        """
        redis_client = get_redis()
        if not redis_client:
            return [None] * len(keys)
        
        try:
            values = redis_client.mget(keys)
            result = []
            for value in values:
                if value is None:
                    result.append(None)
                else:
                    try:
                        result.append(CacheService._deserialize(value))
                    except json.JSONDecodeError:
                        result.append(None)
            return result
        except RedisError as e:
            logger.warning(f"Cache mget error: {e}")
            return [None] * len(keys)
    
    @staticmethod
    def mset(mapping: dict[str, Any], ttl: Optional[int] = None) -> bool:
        """
        Set multiple key-value pairs at once.
        Returns True if successful, False otherwise.
        """
        redis_client = get_redis()
        if not redis_client:
            return False
        
        try:
            # Serialize all values
            serialized = {k: CacheService._serialize(v) for k, v in mapping.items()}
            
            # Use pipeline for atomic operation
            pipe = redis_client.pipeline()
            for key, value in serialized.items():
                if ttl:
                    pipe.setex(key, ttl, value)
                else:
                    pipe.set(key, value)
            pipe.execute()
            
            logger.debug(f"Cache MSET: {len(mapping)} keys")
            return True
        except (RedisError, TypeError) as e:
            logger.warning(f"Cache mset error: {e}")
            return False
    
    @staticmethod
    def invalidate_portfolio(portfolio_id: int) -> int:
        """
        Invalidate all cache entries for a portfolio.
        Returns number of keys deleted.
        """
        patterns = [
            f"{CacheService.PREFIX_POSITION}{portfolio_id}:*",
            f"{CacheService.PREFIX_METRICS}{portfolio_id}:*",
            f"{CacheService.PREFIX_ANALYTICS}*_{portfolio_id}_*",
            f"{CacheService.PREFIX_INSIGHTS}{portfolio_id}:*",
        ]
        
        total_deleted = 0
        for pattern in patterns:
            total_deleted += CacheService.delete_pattern(pattern)
        
        logger.info(f"Invalidated {total_deleted} cache entries for portfolio {portfolio_id}")
        return total_deleted
    
    @staticmethod
    def get_stats() -> dict:
        """Get cache statistics"""
        redis_client = get_redis()
        if not redis_client:
            return {"status": "unavailable"}
        
        try:
            info = redis_client.info()
            
            # Count keys by prefix
            key_counts = {}
            for prefix in [
                CacheService.PREFIX_PRICE,
                CacheService.PREFIX_POSITION,
                CacheService.PREFIX_METRICS,
                CacheService.PREFIX_ANALYTICS,
                CacheService.PREFIX_ASSET,
                CacheService.PREFIX_INSIGHTS,
            ]:
                pattern = f"{prefix}*"
                keys = redis_client.keys(pattern)
                key_counts[prefix.rstrip(':')] = len(keys)
            
            return {
                "status": "available",
                "total_keys": info.get("db0", {}).get("keys", 0),
                "keys_by_prefix": key_counts,
                "memory_used": info.get("used_memory_human", "unknown"),
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "hit_rate": (
                    round(
                        info.get("keyspace_hits", 0) /
                        (info.get("keyspace_hits", 0) + info.get("keyspace_misses", 1)) * 100,
                        2
                    )
                ),
            }
        except RedisError as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {"status": "error", "error": str(e)}


# Convenience functions for common cache operations

def cache_price(symbol: str, price_data: dict, ttl: int = CacheService.TTL_PRICE) -> bool:
    """Cache price data for a symbol"""
    key = f"{CacheService.PREFIX_PRICE}{symbol}"
    return CacheService.set(key, price_data, ttl)


def get_cached_price(symbol: str) -> Optional[dict]:
    """Get cached price data for a symbol"""
    key = f"{CacheService.PREFIX_PRICE}{symbol}"
    return CacheService.get(key)


def cache_positions(portfolio_id: int, positions: list, ttl: int = CacheService.TTL_POSITION) -> bool:
    """Cache portfolio positions"""
    key = f"{CacheService.PREFIX_POSITION}{portfolio_id}"
    return CacheService.set(key, positions, ttl)


def get_cached_positions(portfolio_id: int) -> Optional[list]:
    """Get cached portfolio positions"""
    key = f"{CacheService.PREFIX_POSITION}{portfolio_id}"
    return CacheService.get(key)


def invalidate_positions(portfolio_id: int) -> bool:
    """Invalidate cached positions for a portfolio"""
    key = f"{CacheService.PREFIX_POSITION}{portfolio_id}"
    return CacheService.delete(key)


def cache_asset(asset_id: int, asset_data: dict, ttl: int = CacheService.TTL_ASSET) -> bool:
    """Cache asset data"""
    key = f"{CacheService.PREFIX_ASSET}{asset_id}"
    return CacheService.set(key, asset_data, ttl)


def get_cached_asset(asset_id: int) -> Optional[dict]:
    """Get cached asset data"""
    key = f"{CacheService.PREFIX_ASSET}{asset_id}"
    return CacheService.get(key)
