"""
Redis connection manager with health monitoring and graceful degradation
"""
import logging
from typing import Optional
import redis
from redis.connection import ConnectionPool
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError
from contextlib import contextmanager

from app.config import settings

logger = logging.getLogger(__name__)


class RedisManager:
    """
    Redis connection manager with connection pooling and health monitoring.
    Gracefully degrades when Redis is unavailable - application continues without caching.
    """
    
    def __init__(self):
        self._pool: Optional[ConnectionPool] = None
        self._client: Optional[redis.Redis] = None
        self._healthy = False
        self._initialize_connection()
    
    def _initialize_connection(self) -> None:
        """Initialize Redis connection pool"""
        try:
            # Build connection URL
            password_part = f":{settings.REDIS_PASSWORD}@" if settings.REDIS_PASSWORD else ""
            redis_url = (
                f"redis://{password_part}{settings.REDIS_HOST}:{settings.REDIS_PORT}/"
                f"{settings.REDIS_DB}"
            )
            
            # Create connection pool
            self._pool = ConnectionPool.from_url(
                redis_url,
                max_connections=settings.REDIS_MAX_CONNECTIONS,
                socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
                socket_connect_timeout=settings.REDIS_SOCKET_CONNECT_TIMEOUT,
                decode_responses=True,  # Automatically decode bytes to strings
                health_check_interval=30,  # Health check every 30 seconds
            )
            
            # Create client
            self._client = redis.Redis(connection_pool=self._pool)
            
            # Test connection
            self._client.ping()
            self._healthy = True
            
            logger.info(
                f"Redis connected successfully to {settings.REDIS_HOST}:{settings.REDIS_PORT}"
            )
            
        except (RedisConnectionError, RedisError) as e:
            self._healthy = False
            logger.warning(
                f"Redis connection failed: {e}. Application will run without caching."
            )
            self._client = None
            self._pool = None
        except Exception as e:
            self._healthy = False
            logger.error(f"❌ Unexpected error initializing Redis: {e}")
            self._client = None
            self._pool = None
    
    @property
    def is_healthy(self) -> bool:
        """Check if Redis connection is healthy"""
        if not self._client:
            return False
        
        try:
            self._client.ping()
            if not self._healthy:
                logger.info("Redis connection restored")
                self._healthy = True
            return True
        except (RedisConnectionError, RedisError):
            if self._healthy:
                logger.warning("Redis connection lost. Continuing without caching.")
                self._healthy = False
            return False
    
    def get_client(self) -> Optional[redis.Redis]:
        """
        Get Redis client if available.
        Returns None if Redis is unavailable (graceful degradation).
        """
        if not self.is_healthy:
            return None
        return self._client
    
    @contextmanager
    def pipeline(self, transaction: bool = True):
        """
        Context manager for Redis pipeline (batch operations).
        Yields None if Redis is unavailable (graceful degradation).
        """
        client = self.get_client()
        if not client:
            # Graceful degradation - yield a dummy object that does nothing
            class NoOpPipeline:
                def execute(self):
                    return []
                def __enter__(self):
                    return self
                def __exit__(self, *args):
                    pass
            yield NoOpPipeline()
            return
        
        pipe = client.pipeline(transaction=transaction)
        try:
            yield pipe
        finally:
            pass
    
    def close(self) -> None:
        """Close Redis connection pool"""
        if self._pool:
            self._pool.disconnect()
            logger.info("Redis connection pool closed")
    
    def get_stats(self) -> dict:
        """Get Redis connection statistics"""
        if not self._client:
            return {
                "status": "disconnected",
                "healthy": False,
                "host": settings.REDIS_HOST,
                "port": settings.REDIS_PORT,
            }
        
        try:
            info = self._client.info()
            return {
                "status": "connected",
                "healthy": self._healthy,
                "host": settings.REDIS_HOST,
                "port": settings.REDIS_PORT,
                "db": settings.REDIS_DB,
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_human": info.get("used_memory_human", "unknown"),
                "uptime_in_seconds": info.get("uptime_in_seconds", 0),
                "total_connections_received": info.get("total_connections_received", 0),
                "total_commands_processed": info.get("total_commands_processed", 0),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
            }
        except (RedisConnectionError, RedisError) as e:
            logger.error(f"Failed to get Redis stats: {e}")
            return {
                "status": "error",
                "healthy": False,
                "error": str(e),
            }


# Global Redis manager instance
_redis_manager: Optional[RedisManager] = None


def get_redis_manager() -> RedisManager:
    """Get or create global Redis manager instance"""
    global _redis_manager
    if _redis_manager is None:
        _redis_manager = RedisManager()
    return _redis_manager


def get_redis() -> Optional[redis.Redis]:
    """
    Dependency function to get Redis client.
    Returns None if Redis is unavailable (graceful degradation).
    """
    manager = get_redis_manager()
    return manager.get_client()


def close_redis_connection():
    """Close Redis connection (called on application shutdown)"""
    global _redis_manager
    if _redis_manager:
        _redis_manager.close()
        _redis_manager = None
