"""
Asset models - financial instruments and metadata
"""
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, Enum, LargeBinary, Date, ForeignKey, Numeric
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import AssetClass


class Asset(Base):
    """Financial asset (stock, ETF, crypto)"""
    __tablename__ = "assets"
    __table_args__ = {"schema": "portfolio"}
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, nullable=False, index=True)
    name = Column(String)
    currency = Column(String, default="USD")
    class_ = Column("class", Enum(AssetClass, values_callable=lambda x: [e.value for e in x]), default=AssetClass.STOCK)
    sector = Column(String)
    industry = Column(String)
    asset_type = Column(String)  # 'EQUITY', 'ETF', 'CRYPTO', etc.
    country = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Logo caching
    logo_data = Column(LargeBinary)  # Binary logo data (WebP or SVG)
    logo_content_type = Column(String)  # MIME type (image/webp, image/svg+xml)
    logo_fetched_at = Column(DateTime)  # When logo was last fetched
    
    # Price history tracking
    first_transaction_date = Column(Date)  # Date of first transaction, used for historical price backfill
    
    # Relationships
    transactions = relationship("Transaction", back_populates="asset")
    prices = relationship("Price", back_populates="asset", cascade="all, delete-orphan")
    metadata_overrides = relationship("AssetMetadataOverride", back_populates="asset", cascade="all, delete-orphan")


class AssetMetadataOverride(Base):
    """User-specific metadata overrides for assets"""
    __tablename__ = "asset_metadata_overrides"
    __table_args__ = (
        {"schema": "portfolio"},
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("portfolio.assets.id", ondelete="CASCADE"), nullable=False)
    sector_override = Column(String)
    industry_override = Column(String)
    country_override = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    asset = relationship("Asset", back_populates="metadata_overrides")
