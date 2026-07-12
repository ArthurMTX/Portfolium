"""
Reference-data models - vendor-provided listing databases used only for
lightweight, local, indexed metadata enrichment (never authoritative).
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Index

from app.db import Base


class AdanosListing(Base):
    """One row per exchange::ticker listing from the Adanos free ticker
    database CSV. Refreshed weekly by app.tasks.reference_data_tasks.

    Secondary/non-authoritative: currently used only to backfill an asset's
    ISIN when Yahoo Finance does not provide one. Never overwrites a valid
    existing ISIN.
    """
    __tablename__ = "adanos_listings"
    __table_args__ = (
        Index("ix_adanos_listings_ticker_exchange", "ticker", "exchange"),
        {"schema": "portfolio"},
    )

    id = Column(Integer, primary_key=True, index=True)
    listing_key = Column(String(160), nullable=False, unique=True, index=True)  # "{exchange}::{ticker}"
    ticker = Column(String(32), nullable=False, index=True)
    exchange = Column(String(64), nullable=False)
    name = Column(String(255))
    asset_type = Column(String(32))
    stock_sector = Column(String(128))
    etf_category = Column(String(128))
    country = Column(String(128))
    country_code = Column(String(8))
    isin = Column(String(12), index=True)  # normalized/validated at import time; NULL if source row had none/invalid
    aliases = Column(Text)  # raw as-is from CSV; not parsed or used in matching
    imported_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
