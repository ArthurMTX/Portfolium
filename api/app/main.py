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
from app.routers import assets, portfolios, transactions, prices, health, admin, settings as settings_router, logs, auth
from app.tasks.scheduler import start_scheduler, stop_scheduler
from app.services.admin import ensure_admin_user


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
    logger.info("Starting Portfolium API...")
    
    # Create tables (in production, use Alembic migrations)
    # Base.metadata.create_all(bind=engine)
    
    # Ensure admin user exists if configured
    try:
        db = SessionLocal()
        ensure_admin_user(db)
    except Exception as e:
        logger.exception("Failed to ensure admin user: %s", e)
    finally:
        try:
            db.close()
        except Exception:
            pass

    # Start background scheduler
    start_scheduler()
    logger.info("Price refresh scheduler started")
    
    yield
    
    # Cleanup
    logger.info("Shutting down...")
    stop_scheduler()


app = FastAPI(
    title="Portfolium API",
    description="Investment portfolio tracking with real-time pricing",
    version="1.0.0",
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
app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(admin.router, tags=["admin"])
app.include_router(settings_router.router, tags=["settings"])
app.include_router(assets.router, prefix="/assets", tags=["assets"])
app.include_router(portfolios.router, prefix="/portfolios", tags=["portfolios"])
app.include_router(transactions.router, prefix="/portfolios", tags=["transactions"])
app.include_router(prices.router, prefix="/prices", tags=["prices"])
app.include_router(logs.router, prefix="/logs", tags=["logs"])


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": "Portfolium API",
        "version": "1.0.0",
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
