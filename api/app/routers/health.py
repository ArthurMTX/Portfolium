"""
Health check router
"""
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db
from app.schemas import HealthCheck
from app.version import __version__
from app.config import settings

router = APIRouter()


def get_market_status() -> str:
    """
    Determine current US stock market status based on NY time.
    Returns: 'premarket', 'open', 'afterhours', or 'closed'
    """
    try:
        ny_tz = ZoneInfo("America/New_York")
    except Exception:
        # Fallback if ZoneInfo not available
        from datetime import timezone, timedelta
        ny_tz = timezone(timedelta(hours=-5))  # EST approximation
    
    now = datetime.now(ny_tz)
    weekday = now.weekday()  # 0=Monday, 6=Sunday
    current_time = now.time()
    
    # Weekend (Saturday=5, Sunday=6)
    if weekday >= 5:
        return "closed"
    
    # Market times (all in ET)
    premarket_start = datetime.strptime("04:00", "%H:%M").time()
    market_open = datetime.strptime("09:30", "%H:%M").time()
    market_close = datetime.strptime("16:00", "%H:%M").time()
    afterhours_end = datetime.strptime("20:00", "%H:%M").time()
    
    if current_time < premarket_start:
        return "closed"
    elif current_time < market_open:
        return "premarket"
    elif current_time < market_close:
        return "open"
    elif current_time < afterhours_end:
        return "afterhours"
    else:
        return "closed"


def get_regional_market_status(timezone_str: str, market_open_time: str, market_close_time: str) -> str:
    """
    Determine market status for a given timezone and market hours.
    Returns: 'open' or 'closed'
    """
    try:
        tz = ZoneInfo(timezone_str)
    except Exception:
        return "unknown"
    
    now = datetime.now(tz)
    weekday = now.weekday()  # 0=Monday, 6=Sunday
    current_time = now.time()
    
    # Weekend (Saturday=5, Sunday=6)
    if weekday >= 5:
        return "closed"
    
    market_open = datetime.strptime(market_open_time, "%H:%M").time()
    market_close = datetime.strptime(market_close_time, "%H:%M").time()
    
    if market_open <= current_time < market_close:
        return "open"
    else:
        return "closed"


def get_all_market_statuses() -> dict:
    """
    Get market status for all major regions.
    Returns a dict with region names and their statuses.
    """
    us_status = get_market_status()
    
    # European markets (using London as reference, typically 8:00-16:30 GMT)
    europe_status = get_regional_market_status("Europe/London", "08:00", "16:30")
    
    # Asian markets (using Tokyo as reference, typically 9:00-15:00 JST)
    asia_status = get_regional_market_status("Asia/Tokyo", "09:00", "15:00")
    
    # Oceania markets (using Sydney as reference, typically 10:00-16:00 AEST)
    oceania_status = get_regional_market_status("Australia/Sydney", "10:00", "16:00")
    
    return {
        "us": us_status,
        "europe": europe_status,
        "asia": asia_status,
        "oceania": oceania_status
    }


@router.get("/health", response_model=HealthCheck)
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint
    
    Verifies:
    - API is running
    - Database connection is healthy
    - Returns current market status for all regions
    """
    # Test database connection
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    
    market_status = get_market_status()
    market_statuses = get_all_market_statuses()
    
    return HealthCheck(
        status="ok" if db_status == "healthy" else "degraded",
        timestamp=datetime.utcnow(),
        database=db_status,
        version=__version__,
        market_status=market_status,
        market_statuses=market_statuses,
        email_enabled=settings.ENABLE_EMAIL
    )
