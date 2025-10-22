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


@router.get("/health", response_model=HealthCheck)
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint
    
    Verifies:
    - API is running
    - Database connection is healthy
    - Returns current market status
    """
    # Test database connection
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    
    market_status = get_market_status()
    
    return HealthCheck(
        status="ok" if db_status == "healthy" else "degraded",
        timestamp=datetime.utcnow(),
        database=db_status,
        version="1.0.0",
        market_status=market_status
    )
