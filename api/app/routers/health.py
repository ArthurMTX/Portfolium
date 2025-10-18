"""
Health check router
"""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db
from app.schemas import HealthCheck

router = APIRouter()


@router.get("/health", response_model=HealthCheck)
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint
    
    Verifies:
    - API is running
    - Database connection is healthy
    """
    # Test database connection
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    
    return HealthCheck(
        status="ok" if db_status == "healthy" else "degraded",
        timestamp=datetime.utcnow(),
        database=db_status,
        version="1.0.0"
    )
