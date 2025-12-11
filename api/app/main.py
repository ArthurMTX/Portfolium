"""
Portfolium API - Investment tracking system
"""
import logging
from logging.handlers import RotatingFileHandler
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from scalar_fastapi import get_scalar_api_reference

from app.config import settings
from app.db import engine, Base, SessionLocal
from app.routers import assets, portfolios, transactions, prices, health, admin, settings as settings_router, logs, auth, watchlist, notifications, insights, version, dashboard_layouts, market, batch, tasks, goals, public
from app.tasks.scheduler import start_scheduler, stop_scheduler
from app.services.admin import ensure_admin_user, ensure_email_config
from app.version import __version__, get_version_info


# Logging configuration
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, 'app.log')

formatter = logging.Formatter(
    fmt='%(asctime)s | %(levelname)s | %(name)s | %(module)s | %(funcName)s | %(lineno)d | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

file_handler = RotatingFileHandler(LOG_FILE, maxBytes=5*1024*1024, backupCount=5, encoding='utf-8')
file_handler.setFormatter(formatter)
file_handler.setLevel(logging.DEBUG)

console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
console_handler.setLevel(logging.INFO)

root_logger = logging.getLogger()
root_logger.setLevel(logging.DEBUG)
root_logger.handlers = []  # Remove default handlers
root_logger.addHandler(file_handler)
root_logger.addHandler(console_handler)

logger = logging.getLogger("portfolium")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    import asyncio
    import sys
    
    logger.info("Starting Portfolium API...")
    sys.stdout.flush()
    
    # Initialize Redis connection
    from app.redis_client import get_redis_manager
    redis_manager = get_redis_manager()
    if redis_manager.is_healthy:
        logger.info("Redis connection established")
    else:
        logger.warning("Redis unavailable - application will run without caching")
    sys.stdout.flush()
    
    # Skip migrations in test mode
    skip_migrations = os.getenv("SKIP_MIGRATIONS", "false").lower() == "true"
    
    # Run database migrations synchronously
    # Migrations are fast (<1s typically) and running in separate thread causes hanging issues
    if not skip_migrations:
        try:
            from app.services.migrations import run_migrations
            
            logger.info("Running database migrations...")
            sys.stdout.flush()
            
            # Run synchronously - it's fast enough and avoids thread issues
            run_migrations()
            
            logger.info("Migration process completed")
            sys.stdout.flush()
            
        except Exception as e:
            logger.exception("Failed to run database migrations: %s", e)
            sys.stdout.flush()
            raise  # Fail startup if migrations fail
    else:
        logger.info("Skipping database migrations (test mode)")
        sys.stdout.flush()
    
    # Small delay to ensure migration transaction is fully committed
    await asyncio.sleep(0.5)
    
    # Skip email config and admin user setup in test mode
    if not skip_migrations:
        logger.info("Initializing email configuration...")
        sys.stdout.flush()
        
        # Initialize/load email configuration (loads from DB if exists, otherwise uses env vars)
        try:
            db = SessionLocal()
            ensure_email_config(db)
            logger.info("Email configuration initialized")
            sys.stdout.flush()
        except Exception as e:
            logger.warning("Could not initialize email config (will retry later): %s", e)
            logger.exception("Email config error details:")
            sys.stdout.flush()
        finally:
            try:
                db.close()
            except Exception:
                pass
        
        logger.info("Checking admin user...")
        sys.stdout.flush()
        
        # Ensure admin user exists if configured
        try:
            db = SessionLocal()
            ensure_admin_user(db)
            logger.info("Admin user check completed")
            sys.stdout.flush()
        except Exception as e:
            logger.warning("Could not ensure admin user (will retry on first request): %s", e)
            logger.exception("Admin user error details:")
            sys.stdout.flush()
        finally:
            try:
                db.close()
            except Exception:
                pass
    else:
        logger.info("Skipping email config and admin user setup (test mode)")
        sys.stdout.flush()

    # Skip scheduler in test mode (SKIP_MIGRATIONS=true)
    if not skip_migrations:
        logger.info("Starting background scheduler...")
        sys.stdout.flush()
        
        # Start background scheduler
        start_scheduler()
        logger.info("Price refresh scheduler started")
        
        # Trigger cache warmup if enabled
        if settings.ENABLE_BACKGROUND_TASKS and settings.CACHE_WARMUP_ON_STARTUP:
            try:
                from app.tasks.metrics_tasks import warmup_metrics_cache
                from app.tasks.insights_tasks import warmup_insights_cache
                from app.tasks.dashboard_tasks import warmup_active_dashboards
                
                logger.info("Triggering startup cache warmup...")
                warmup_metrics_cache.delay()
                warmup_insights_cache.delay(periods=["1mo"])
                warmup_active_dashboards.delay()
                logger.info("Cache warmup tasks queued (metrics, insights, dashboards)")
            except Exception as e:
                logger.warning(f"Failed to queue cache warmup tasks: {e}")
    else:
        logger.info("Skipping scheduler startup (test mode)")
    
    logger.info("=" * 50)
    logger.info("Portfolium API startup complete - ready to serve requests")
    logger.info("=" * 50)
    sys.stdout.flush()
    sys.stderr.flush()
    
    # Force logger flush for all handlers
    for handler in logger.handlers:
        handler.flush()
    for handler in root_logger.handlers:
        handler.flush()
    
    yield
    
    # Cleanup
    logger.info("Shutting down...")
    sys.stdout.flush()
    sys.stderr.flush()
    if not skip_migrations:
        stop_scheduler()
    
    # Close Redis connection
    from app.redis_client import close_redis_connection
    close_redis_connection()
    logger.info("Redis connection closed")
    sys.stdout.flush()


app = FastAPI(
    title="Portfolium API",
    description="Investment portfolio tracking with real-time pricing",
    version=__version__,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(version.router, tags=["version"])
app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(admin.router, tags=["admin"])
app.include_router(settings_router.router, tags=["settings"])
app.include_router(assets.router, prefix="/assets", tags=["assets"])
app.include_router(portfolios.router, prefix="/portfolios", tags=["portfolios"])
app.include_router(goals.router, tags=["goals"])
app.include_router(transactions.router, prefix="/portfolios", tags=["transactions"])
app.include_router(prices.router, prefix="/prices", tags=["prices"])
app.include_router(watchlist.router, prefix="/watchlist", tags=["watchlist"])
app.include_router(notifications.router, tags=["notifications"])
app.include_router(insights.router, prefix="/insights", tags=["insights"])
app.include_router(dashboard_layouts.router, tags=["dashboard-layouts"])
app.include_router(market.router, tags=["market"])
app.include_router(batch.router, tags=["batch"])
app.include_router(tasks.router, tags=["tasks"])
app.include_router(logs.router, prefix="/admin", tags=["admin"])
app.include_router(public.router, prefix="/public", tags=["public"])


@app.get("/")
async def root():
    """API root endpoint"""
    version_info = get_version_info()
    return {
        "name": "Portfolium API",
        "version": version_info["version"],
        "build_date": version_info["build_date"],
        "git_commit": version_info["git_commit"],
        "docs": "/docs",
        "scalar": "/scalar",
        "status": "running"
    }


@app.get("/scalar", include_in_schema=False)
async def scalar_html():
    """Scalar API documentation"""
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        title=app.title,
    )
