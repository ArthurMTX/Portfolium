"""
Celery application configuration and initialization.
"""
from celery import Celery
from celery.schedules import crontab
from app.config import settings

# Initialize Celery app
celery_app = Celery(
    "portfolium",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.metrics_tasks",
        "app.tasks.insights_tasks",
        "app.tasks.cache_tasks",
        "app.tasks.dashboard_tasks",
    ]
)

# Configure Celery
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # Timezone
    timezone="UTC",
    enable_utc=True,
    
    # Task execution settings
    task_track_started=settings.CELERY_TASK_TRACK_STARTED,
    task_time_limit=settings.CELERY_TASK_TIME_LIMIT,
    task_soft_time_limit=settings.CELERY_TASK_TIME_LIMIT - 30,
    
    # Worker settings
    worker_prefetch_multiplier=settings.CELERY_WORKER_PREFETCH_MULTIPLIER,
    worker_max_tasks_per_child=settings.CELERY_WORKER_MAX_TASKS_PER_CHILD,
    worker_disable_rate_limits=False,  # Enable rate limiting
    
    # Task behavior
    task_acks_late=True,  # Acknowledge tasks after completion (safer for crashes)
    task_reject_on_worker_lost=True,  # Reject tasks if worker crashes
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    task_ignore_result=False,  # We want results for monitoring
    task_store_errors_even_if_ignored=True,  # Store errors even if result ignored
    
    # Result backend optimization
    result_expires=3600,  # Results expire after 1 hour
    result_backend_transport_options={
        'master_name': 'mymaster',
        'visibility_timeout': 3600,
    },
    
    # Compression (reduce Redis memory for large results)
    task_compression='gzip',
    result_compression='gzip',
    
    # Performance tuning
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_connection_max_retries=10,
)

# Configure periodic tasks (Celery Beat schedule)
if settings.ENABLE_BACKGROUND_TASKS:
    celery_app.conf.beat_schedule = {
        # Refresh metrics every N minutes during market hours
        "refresh-portfolio-metrics-market-hours": {
            "task": "app.tasks.metrics_tasks.refresh_all_portfolio_metrics",
            "schedule": crontab(
                minute=f"*/{settings.METRICS_REFRESH_INTERVAL_MINUTES}",
                hour=f"{settings.MARKET_HOURS_START}-{settings.MARKET_HOURS_END}",
            ),
            "options": {
                "queue": "default",
                "expires": 60 * settings.METRICS_REFRESH_INTERVAL_MINUTES,  # Expire if not run
            },
        },
        # Refresh metrics less frequently outside market hours
        "refresh-portfolio-metrics-off-hours": {
            "task": "app.tasks.metrics_tasks.refresh_all_portfolio_metrics",
            "schedule": crontab(
                minute="0,30",  # Every 30 minutes
                hour=f"0-{settings.MARKET_HOURS_START-1},{settings.MARKET_HOURS_END+1}-23",
            ),
            "options": {
                "queue": "default",
                "expires": 30 * 60,  # 30 minutes
            },
        },
        # Refresh insights every N minutes
        "refresh-portfolio-insights": {
            "task": "app.tasks.insights_tasks.refresh_all_portfolio_insights",
            "schedule": crontab(minute=f"*/{settings.INSIGHTS_REFRESH_INTERVAL_MINUTES}"),
            "options": {
                "queue": "default",
                "expires": 60 * settings.INSIGHTS_REFRESH_INTERVAL_MINUTES,
            },
        },
        # Clean up expired cache entries daily at 3 AM
        "cleanup-expired-cache": {
            "task": "app.tasks.cache_tasks.cleanup_expired_cache",
            "schedule": crontab(hour=3, minute=0),
            "options": {
                "queue": "low",
                "expires": 3600,  # 1 hour
            },
        },
        # Warm up price cache during market hours (every 2 minutes)
        "warmup-price-cache-market-hours": {
            "task": "app.tasks.cache_tasks.warmup_price_cache",
            "schedule": crontab(
                minute="*/2",
                hour=f"{settings.MARKET_HOURS_START}-{settings.MARKET_HOURS_END}",
            ),
            "options": {
                "queue": "high",
                "expires": 120,  # 2 minutes
            },
        },
        # Warm up active user dashboards during market hours (every 5 minutes)
        "warmup-active-dashboards-market-hours": {
            "task": "dashboard.warmup_active_dashboards",
            "schedule": crontab(
                minute="*/5",
                hour=f"{settings.MARKET_HOURS_START}-{settings.MARKET_HOURS_END}",
            ),
            "options": {
                "queue": "high",
                "expires": 300,  # 5 minutes
            },
        },
        # Warm up active user dashboards off-hours (every 30 minutes)
        "warmup-active-dashboards-off-hours": {
            "task": "dashboard.warmup_active_dashboards",
            "schedule": crontab(
                minute="0,30",
                hour=f"0-{settings.MARKET_HOURS_START-1},{settings.MARKET_HOURS_END+1}-23",
            ),
            "options": {
                "queue": "default",
                "expires": 1800,  # 30 minutes
            },
        },
    }


# Task routes - distribute tasks across queues by priority
celery_app.conf.task_routes = {
    # High priority - cache warming and invalidation (fast operations)
    "app.tasks.cache_tasks.warmup_price_cache": {
        "queue": "high",
        "priority": 9,
    },
    "app.tasks.cache_tasks.invalidate_portfolio_cache": {
        "queue": "high",
        "priority": 9,
    },
    "app.tasks.cache_tasks.warmup_specific_symbols": {
        "queue": "high",
        "priority": 8,
    },
    "dashboard.warmup_active_dashboards": {
        "queue": "high",
        "priority": 8,
    },
    "dashboard.warmup_user_dashboard": {
        "queue": "high",
        "priority": 7,
    },
    "dashboard.warmup_portfolio_on_transaction": {
        "queue": "high",
        "priority": 9,  # Highest - user just made a transaction
    },
    
    # Default priority - metrics and insights calculation
    "app.tasks.metrics_tasks.calculate_portfolio_metrics": {
        "queue": "default",
        "priority": 5,
    },
    "app.tasks.insights_tasks.calculate_portfolio_insights": {
        "queue": "default",
        "priority": 5,
    },
    "app.tasks.metrics_tasks.refresh_all_portfolio_metrics": {
        "queue": "default",
        "priority": 4,
    },
    "app.tasks.insights_tasks.refresh_all_portfolio_insights": {
        "queue": "default",
        "priority": 4,
    },
    
    # Low priority - cleanup and maintenance
    "app.tasks.cache_tasks.cleanup_expired_cache": {
        "queue": "low",
        "priority": 1,
    },
    "app.tasks.cache_tasks.get_cache_statistics": {
        "queue": "low",
        "priority": 1,
    },
}

# Task annotations - add rate limits to prevent task flooding
celery_app.conf.task_annotations = {
    # Prevent too many concurrent metrics calculations per portfolio
    "app.tasks.metrics_tasks.calculate_portfolio_metrics": {
        "rate_limit": "10/m",  # Max 10 per minute per portfolio
    },
    # Prevent insight calculation spam
    "app.tasks.insights_tasks.calculate_portfolio_insights": {
        "rate_limit": "5/m",  # Max 5 per minute per portfolio
    },
    # Limit cache warmup frequency
    "app.tasks.cache_tasks.warmup_price_cache": {
        "rate_limit": "30/h",  # Max 30 per hour (every 2 min = normal)
    },
    # Limit dashboard warmup to prevent overload
    "dashboard.warmup_user_dashboard": {
        "rate_limit": "60/m",  # Max 60 per minute (reasonable for 50 active users)
    },
    "dashboard.warmup_active_dashboards": {
        "rate_limit": "12/h",  # Max 12 per hour (every 5 min during market hours)
    },
}
