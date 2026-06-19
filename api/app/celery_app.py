"""
Celery application configuration and initialization.
"""
import logging
import time

from celery import Celery
from celery.schedules import crontab
from celery.signals import before_task_publish, task_failure, task_postrun, task_prerun, worker_ready
from prometheus_client import start_http_server
from app.config import settings
from app.observability.context import (
    request_id_var,
    reset_request_id,
    reset_task_name,
    set_request_id,
    set_task_name,
)
from app.observability.logging import configure_logging
from app.observability.metrics import (
    CELERY_TASK_DURATION,
    CELERY_TASK_FAILURES,
    build_metrics_registry,
)


configure_logging(settings)
logger = logging.getLogger(__name__)
_task_observation: dict[str, tuple[float, object, object]] = {}
_metrics_server_started = False

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
        "app.tasks.report_tasks",
        "app.tasks.maintenance_tasks",
        "app.tasks.dividend_tasks",
        "app.tasks.calendar_tasks",
        "app.tasks.ath_tasks",
    ]
)

# Configure Celery
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # Timezone - use Eastern Time for market-based scheduling
    timezone="America/New_York",
    enable_utc=False,
    
    # Task execution settings
    task_track_started=settings.CELERY_TASK_TRACK_STARTED,
    task_time_limit=settings.CELERY_TASK_TIME_LIMIT,
    task_soft_time_limit=settings.CELERY_TASK_TIME_LIMIT - 30,
    
    # Worker settings
    worker_prefetch_multiplier=settings.CELERY_WORKER_PREFETCH_MULTIPLIER,
    worker_max_tasks_per_child=settings.CELERY_WORKER_MAX_TASKS_PER_CHILD,
    worker_disable_rate_limits=False,  # Enable rate limiting
    worker_hijack_root_logger=False,
    worker_send_task_events=True,
    task_send_sent_event=True,
    
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


@before_task_publish.connect
def propagate_request_id(headers=None, **kwargs):
    """Propagate the current HTTP request ID into tasks queued by that request."""
    request_id = request_id_var.get()
    if request_id and headers is not None:
        headers["request_id"] = request_id


@worker_ready.connect
def start_worker_metrics_server(**kwargs):
    """Expose metrics produced by Celery worker child processes."""
    global _metrics_server_started
    if _metrics_server_started or settings.CELERY_METRICS_PORT <= 0:
        return
    start_http_server(
        settings.CELERY_METRICS_PORT,
        addr="0.0.0.0",
        registry=build_metrics_registry(include_business_inventory=False),
    )
    _metrics_server_started = True
    logger.info(
        "Celery metrics endpoint started",
        extra={"event": "celery_metrics_ready"},
    )


@task_prerun.connect
def observe_task_start(sender=None, task_id=None, task=None, **kwargs):
    """Attach task context and start centralized timing."""
    task_name = getattr(sender or task, "name", None) or "unknown"
    request = getattr(task, "request", None)
    headers = getattr(request, "headers", None) or {}
    request_token = set_request_id(headers.get("request_id"))
    task_token = set_task_name(task_name)
    if task_id:
        _task_observation[task_id] = (time.monotonic(), request_token, task_token)
    logger.info("Celery task started", extra={"event": "celery_task_started", "task_name": task_name})


@task_postrun.connect
def record_successful_task(sender=None, task_id=None, state=None, retval=None, **kwargs):
    """Record task duration, outcome, context cleanup, and last-success health."""
    task_name = getattr(sender, "name", None) or "unknown"
    returned_failure = isinstance(retval, dict) and (
        retval.get("status") == "error" or bool(retval.get("error"))
    )
    outcome = "failure" if state != "SUCCESS" or returned_failure else "success"
    observation = _task_observation.pop(task_id, None) if task_id else None
    duration_ms = None
    if observation:
        started, request_token, task_token = observation
        duration_seconds = time.monotonic() - started
        duration_ms = round(duration_seconds * 1000, 2)
        CELERY_TASK_DURATION.labels(task_name=task_name).observe(duration_seconds)
    if returned_failure:
        CELERY_TASK_FAILURES.labels(task_name=task_name).inc()
    logger_method = logger.error if outcome == "failure" else logger.info
    logger_method(
        "Celery task completed",
        extra={
            "event": "celery_task_completed",
            "task_name": task_name,
            "duration_ms": duration_ms,
        },
    )

    if outcome == "success":
        try:
            from app.services.platform.core_observability import record_task_success

            record_task_success(task_name, task_id)
        except Exception:
            pass

    if observation:
        reset_task_name(task_token)
        reset_request_id(request_token)


@task_failure.connect
def observe_task_failure(sender=None, task_id=None, **kwargs):
    """Count failures without using exception text as a label."""
    task_name = getattr(sender, "name", None) or "unknown"
    CELERY_TASK_FAILURES.labels(task_name=task_name).inc()

# Celery Beat is the single scheduler for the application.
# FastAPI workers do not schedule periodic jobs and do not run heavy warmups at boot.
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
        # Keep cache reasonably fresh off-hours without any web-worker boot work.
        "warmup-price-cache-off-hours": {
            "task": "app.tasks.cache_tasks.warmup_price_cache",
            "schedule": crontab(
                minute="0,30",
                hour=f"0-{settings.MARKET_HOURS_START-1},{settings.MARKET_HOURS_END+1}-23",
            ),
            "options": {
                "queue": "default",
                "expires": 1800,  # 30 minutes
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
        # Warm up public portfolios (every 20 minutes)
        # Ensures visitors always get fast loading times, especially for big portfolios
        "warmup-public-portfolios": {
            "task": "app.tasks.cache_tasks.warmup_public_portfolios",
            "schedule": crontab(minute="*/20"),
            "options": {
                "queue": "default",
                "expires": 1200,  # 20 minutes
            },
        },
        # Check watchlist alerts frequently so users are notified promptly.
        "check-watchlist-price-alerts": {
            "task": "app.tasks.maintenance_tasks.check_price_alerts",
            "schedule": crontab(minute="*/5"),
            "options": {
                "queue": "default",
                "expires": 300,
            },
        },
        # This task self-skips when the market is closed; keeping the Beat rule simple
        # avoids timezone-specific scheduler logic in web code.
        "check-daily-portfolio-changes": {
            "task": "app.tasks.maintenance_tasks.check_daily_changes",
            "schedule": crontab(minute="*/10"),
            "options": {
                "queue": "default",
                "expires": 600,
            },
        },
        # Notification retention maintenance.
        "cleanup-old-notifications": {
            "task": "app.tasks.maintenance_tasks.cleanup_old_notifications",
            "schedule": crontab(hour=3, minute=0),
            "options": {
                "queue": "low",
                "expires": 3600,
            },
        },
        # Historical pricing maintenance.
        "fetch-daily-closing-prices": {
            "task": "app.tasks.maintenance_tasks.fetch_daily_closing_prices",
            "schedule": crontab(hour=17, minute=0, day_of_week="mon-fri"),
            "options": {
                "queue": "default",
                "expires": 7200,
            },
        },
        "backfill-ath-from-yfinance": {
            "task": "tasks.backfill_ath_from_yfinance",
            "schedule": crontab(hour=17, minute=30, day_of_week="mon-fri"),
            "options": {
                "queue": "low",
                "expires": 7200,
            },
        },
        "fetch-pending-dividends": {
            "task": "tasks.fetch_all_dividends",
            "schedule": crontab(hour=6, minute=0),
            "options": {
                "queue": "default",
                "expires": 3600,
            },
        },
        "refresh-earnings-cache": {
            "task": "app.tasks.calendar_tasks.refresh_earnings_cache",
            "schedule": crontab(hour=6, minute=30),
            "options": {
                "queue": "default",
                "expires": 3600,
            },
        },
        "expire-old-pending-dividends": {
            "task": "tasks.expire_old_pending_dividends",
            "schedule": crontab(hour=2, minute=0, day_of_week="sun"),
            "options": {
                "queue": "low",
                "expires": 7200,
            },
        },
        "detect-and-fill-price-gaps": {
            "task": "app.tasks.maintenance_tasks.detect_and_fill_price_gaps",
            "schedule": crontab(hour=3, minute=0, day_of_week="sun"),
            "options": {
                "queue": "low",
                "expires": 7200,
            },
        },
        # Send daily portfolio reports at 4:00 PM EST (after market close)
        # Only on weekdays when markets are open
        "send-daily-reports": {
            "task": "app.tasks.report_tasks.send_daily_reports",
            "schedule": crontab(hour=16, minute=0, day_of_week="mon-fri"),
            "options": {
                "queue": "default",
                "expires": 3600,  # 1 hour
            },
        },
    }
    # Intentionally not migrated from the old web-worker boot flow:
    # - startup recent-price backfill: heavy boot-only catch-up conflicts with stateless web workers
    # - position cache warmup by last_accessed_at: redundant with Beat-driven metrics/dashboard refresh
    #   and tightly coupled to a read-path write we plan to remove in the next stabilization phase


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
    "app.tasks.maintenance_tasks.check_price_alerts": {
        "queue": "default",
        "priority": 4,
    },
    "app.tasks.maintenance_tasks.check_daily_changes": {
        "queue": "default",
        "priority": 4,
    },
    "app.tasks.maintenance_tasks.fetch_daily_closing_prices": {
        "queue": "default",
        "priority": 3,
    },
    "tasks.fetch_all_dividends": {
        "queue": "default",
        "priority": 3,
    },
    "app.tasks.calendar_tasks.refresh_earnings_cache": {
        "queue": "default",
        "priority": 3,
    },
    "app.tasks.report_tasks.send_daily_reports": {
        "queue": "default",
        "priority": 3,
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
    "app.tasks.cache_tasks.warmup_public_portfolios": {
        "queue": "default",
        "priority": 3,
    },
    "app.tasks.maintenance_tasks.cleanup_old_notifications": {
        "queue": "low",
        "priority": 1,
    },
    "app.tasks.maintenance_tasks.detect_and_fill_price_gaps": {
        "queue": "low",
        "priority": 1,
    },
    "tasks.expire_old_pending_dividends": {
        "queue": "low",
        "priority": 1,
    },
    "tasks.backfill_ath_from_yfinance": {
        "queue": "low",
        "priority": 2,
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
    "app.tasks.maintenance_tasks.check_price_alerts": {
        "rate_limit": "12/h",
    },
    "app.tasks.maintenance_tasks.check_daily_changes": {
        "rate_limit": "6/h",
    },
}
