"""
Logs API router for Portfolium
"""
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
import os
import re
from typing import List, Optional

# Go up from app/routers/logs.py -> app/routers -> app -> api (project root), then to logs/app.log
LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs', 'app.log')

router = APIRouter()

@router.get("/logs", response_class=JSONResponse)
def get_logs(
    level: Optional[str] = Query(None, description="Log level to filter (DEBUG, INFO, WARNING, ERROR, CRITICAL)"),
    search: Optional[str] = Query(None, description="Search string in log messages"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=500, description="Logs per page")
):
    """Fetch logs from the log file with optional filtering and pagination."""
    if not os.path.exists(LOG_FILE):
        raise HTTPException(status_code=404, detail="Log file not found.")
    
    logs: List[str] = []
    with open(LOG_FILE, encoding="utf-8") as f:
        for line in f:
            if level and f"| {level.upper()} |" not in line:
                continue
            if search and search.lower() not in line.lower():
                continue
            logs.append(line.strip())
    logs.reverse()  # Show newest first
    total = len(logs)
    start = (page - 1) * page_size
    end = start + page_size
    paginated = logs[start:end]
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "logs": paginated
    }
