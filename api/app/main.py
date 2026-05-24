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
from app.db import engine, Base
from app.routers import assets, portfolios, transactions, prices, health, admin, settings as settings_router, logs, auth, watchlist, notifications, insights, version, dashboard_layouts, market, batch, tasks, goals, public, pending_dividends, push, calendar
from app.version import __version__, get_version_info


# Logging configuration
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, 'app.log')

formatter = logging.Formatter(
    fmt='%(asctime)s | %(levelname)s | %(name)s | %(module)s | %(funcName)s | %(lineno)d | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Use delay=True to defer file creation and make rotation more resilient
try:
    file_handler = RotatingFileHandler(LOG_FILE, maxBytes=5*1024*1024, backupCount=5, encoding='utf-8', delay=True)
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.DEBUG)
except Exception as e:
    # Fallback to console-only logging if file handler fails
    print(f"Warning: Could not create file handler: {e}")
    file_handler = None

console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
console_handler.setLevel(logging.INFO)

root_logger = logging.getLogger()
root_logger.setLevel(logging.DEBUG)
root_logger.handlers = []  # Remove default handlers
if file_handler:
    root_logger.addHandler(file_handler)
root_logger.addHandler(console_handler)

logger = logging.getLogger("portfolium")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Minimal application lifespan for HTTP runtime resources only."""
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
app.include_router(push.router, tags=["push-notifications"])
app.include_router(insights.router, prefix="/insights", tags=["insights"])
app.include_router(dashboard_layouts.router, tags=["dashboard-layouts"])
app.include_router(market.router, tags=["market"])
app.include_router(batch.router, tags=["batch"])
app.include_router(tasks.router, tags=["tasks"])
app.include_router(logs.router, prefix="/admin", tags=["admin"])
app.include_router(public.router, prefix="/public", tags=["public"])
app.include_router(pending_dividends.router, prefix="/dividends", tags=["dividends"])
app.include_router(calendar.router, prefix="/calendar", tags=["calendar"])


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
