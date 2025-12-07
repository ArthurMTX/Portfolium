"""
Service layer dependency injection

Provides FastAPI dependencies for service classes to reduce boilerplate
and improve testability.
"""
from typing import Annotated
from fastapi import Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.insights import InsightsService
from app.services.metrics import MetricsService
from app.services.pricing import PricingService
from app.services.notifications import NotificationService
from app.services.currency import CurrencyService


# Service factory functions
def get_insights_service(db: Session = Depends(get_db)) -> InsightsService:
    """Create InsightsService instance with database session"""
    return InsightsService(db)


def get_metrics_service(db: Session = Depends(get_db)) -> MetricsService:
    """Create MetricsService instance with database session"""
    return MetricsService(db)


def get_pricing_service(db: Session = Depends(get_db)) -> PricingService:
    """Create PricingService instance with database session"""
    return PricingService(db)


def get_notification_service(db: Session = Depends(get_db)) -> NotificationService:
    """Create NotificationService instance with database session"""
    return NotificationService(db)


def get_currency_service(db: Session = Depends(get_db)) -> CurrencyService:
    """Create CurrencyService instance with database session"""
    return CurrencyService(db)


# Type aliases for dependency injection
InsightsServiceDep = Annotated[InsightsService, Depends(get_insights_service)]
MetricsServiceDep = Annotated[MetricsService, Depends(get_metrics_service)]
PricingServiceDep = Annotated[PricingService, Depends(get_pricing_service)]
NotificationServiceDep = Annotated[NotificationService, Depends(get_notification_service)]
CurrencyServiceDep = Annotated[CurrencyService, Depends(get_currency_service)]
