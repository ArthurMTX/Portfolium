"""
Application settings management
"""
from typing import Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/settings")


class SettingsResponse(BaseModel):
    """Response model for settings"""
    validate_sell_quantity: bool
    price_cache_ttl_seconds: int


class SettingsUpdate(BaseModel):
    """Request model for updating settings"""
    validate_sell_quantity: bool


@router.get("", response_model=SettingsResponse)
async def get_settings():
    """
    Get current application settings
    
    Returns configurable settings that can be modified at runtime.
    """
    return SettingsResponse(
        validate_sell_quantity=settings.VALIDATE_SELL_QUANTITY,
        price_cache_ttl_seconds=settings.PRICE_CACHE_TTL_SECONDS
    )


@router.put("", response_model=SettingsResponse)
async def update_settings(update: SettingsUpdate):
    """
    Update application settings
    
    Changes are applied immediately but are not persisted.
    To make changes permanent, update the .env file.
    """
    # Update runtime settings
    settings.VALIDATE_SELL_QUANTITY = update.validate_sell_quantity
    
    return SettingsResponse(
        validate_sell_quantity=settings.VALIDATE_SELL_QUANTITY,
        price_cache_ttl_seconds=settings.PRICE_CACHE_TTL_SECONDS
    )
