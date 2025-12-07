"""
Task decorators for enhanced Celery functionality.
"""
import functools
import hashlib
import logging
from typing import Callable, Any
from app.services.cache import CacheService

logger = logging.getLogger(__name__)


def singleton_task(timeout: int = 300):
    """
    Decorator to ensure only one instance of a task runs at a time.
    Uses Redis lock to prevent duplicate executions.
    
    Args:
        timeout: Lock timeout in seconds (default 5 minutes)
        
    Usage:
        @celery_app.task
        @singleton_task(timeout=60)
        def my_task(arg1, arg2):
            # Task code here
            pass
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            # Create a unique lock key based on task name and arguments
            task_name = func.__name__
            args_hash = hashlib.md5(str((args, kwargs)).encode()).hexdigest()[:8]
            lock_key = f"task_lock:{task_name}:{args_hash}"
            
            # Try to acquire lock
            lock_acquired = CacheService.set(
                lock_key,
                "locked",
                ttl=timeout,
                nx=True  # Only set if doesn't exist
            )
            
            if not lock_acquired:
                logger.info(
                    f"Task {task_name} with args {args[:2] if args else '()'}... "
                    f"is already running, skipping"
                )
                return {
                    "status": "skipped",
                    "reason": "Task already running",
                    "lock_key": lock_key
                }
            
            try:
                # Execute the task
                result = func(*args, **kwargs)
                return result
            finally:
                # Release lock
                CacheService.delete(lock_key)
        
        return wrapper
    return decorator


def deduplicate_task(ttl: int = 60):
    """
    Decorator to deduplicate task calls within a time window.
    If the same task with same args was called recently, return cached result.
    
    Args:
        ttl: Time-to-live for deduplication cache in seconds
        
    Usage:
        @celery_app.task
        @deduplicate_task(ttl=30)
        def my_task(arg1, arg2):
            # Task code here
            pass
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            # Create cache key based on task name and arguments
            task_name = func.__name__
            args_hash = hashlib.md5(str((args, kwargs)).encode()).hexdigest()
            cache_key = f"task_dedup:{task_name}:{args_hash}"
            
            # Check if we have a recent result
            cached_result = CacheService.get(cache_key)
            if cached_result is not None:
                logger.info(
                    f"Task {task_name} with args {args[:2] if args else '()'}... "
                    f"was recently executed, returning cached result"
                )
                return cached_result
            
            # Execute the task
            result = func(*args, **kwargs)
            
            # Cache the result
            CacheService.set(cache_key, result, ttl=ttl)
            
            return result
        
        return wrapper
    return decorator
