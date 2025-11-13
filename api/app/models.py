"""
SQLAlchemy ORM models - Backward compatibility layer

This file maintains backward compatibility by re-exporting all models
from the new organized structure in app/models/ directory.

For new code, prefer importing directly from app.models submodules:
    from app.models.user import User
    from app.models.asset import Asset
    from app.models.enums import AssetClass, TransactionType
"""

# Re-export all models from new structure for backward compatibility
from app.models import (
    # Enums
    AssetClass,
    TransactionType,
    NotificationType,
    # Models
    User,
    Asset,
    AssetMetadataOverride,
    Portfolio,
    Transaction,
    Price,
    Watchlist,
    Notification,
    DashboardLayout,
)

__all__ = [
    # Enums
    "AssetClass",
    "TransactionType",
    "NotificationType",
    # Models
    "User",
    "Asset",
    "AssetMetadataOverride",
    "Portfolio",
    "Transaction",
    "Price",
    "Watchlist",
    "Notification",
    "DashboardLayout",
]
