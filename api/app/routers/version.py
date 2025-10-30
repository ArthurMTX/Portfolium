"""
Version information router
"""
from fastapi import APIRouter
from app.version import get_version_info

router = APIRouter()


@router.get("/version")
async def get_version():
    """
    Get API version information
    
    Returns version, build date, and git commit hash
    """
    return get_version_info()
