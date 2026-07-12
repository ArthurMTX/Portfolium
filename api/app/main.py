"""
Portfolium API - Investment tracking system
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from scalar_fastapi import get_scalar_api_reference

from app.config import settings
from app.observability.logging import configure_logging
from app.observability.metrics import metrics_payload
from app.observability.middleware import ObservabilityMiddleware
from app.security_headers import SecurityHeadersMiddleware
from app.routers import assets, portfolios, transactions, prices, health, admin, settings as settings_router, logs, auth, watchlist, notifications, insights, version, dashboard_layouts, market, batch, tasks, goals, public, pending_dividends, push, calendar
from app.version import __version__, get_version_info


configure_logging(settings)

logger = logging.getLogger("portfolium")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Minimal application lifespan for HTTP runtime resources only."""
    logger.info("Starting Portfolium API", extra={"event": "application_starting"})
    
    if settings.REDIS_ENABLED:
        # Initialize Redis connection
        from app.redis_client import get_redis_manager

        redis_manager = get_redis_manager()
        if redis_manager.is_healthy:
            logger.info("Redis connection established")
        else:
            logger.warning("Redis unavailable - application will run without caching")
    else:
        logger.info("Redis disabled by configuration")

    logger.info(
        "Portfolium API startup complete",
        extra={"event": "application_ready"},
    )
    
    yield
    
    # Cleanup
    logger.info("Shutting down", extra={"event": "application_stopping"})
    
    # Close Redis connection
    from app.redis_client import close_redis_connection
    close_redis_connection()
    logger.info("Redis connection closed")


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
app.add_middleware(ObservabilityMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


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


@app.get("/metrics", include_in_schema=False)
async def prometheus_metrics():
    """Prometheus exposition endpoint."""
    return Response(content=metrics_payload(), media_type="text/plain; version=0.0.4")


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
