"""
Asset models - financial instruments and metadata
"""
from datetime import datetime, date
from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
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
    
    # All-Time High/Low tracking
    ath_price = Column(Numeric(20, 8))  # All-time high price
    ath_date = Column(DateTime)  # When ATH was reached
    atl_price = Column(Numeric(20, 8))  # All-time low price
    atl_date = Column(DateTime)  # When ATL was reached
    
    # Relationships
    transactions = relationship("Transaction", back_populates="asset")
    prices = relationship("Price", back_populates="asset", cascade="all, delete-orphan")
    metadata_overrides = relationship("AssetMetadataOverride", back_populates="asset", cascade="all, delete-orphan")
    investment_notes = relationship("AssetInvestmentNote", back_populates="asset", cascade="all, delete-orphan")
    theme_classification = relationship(
        "AssetThemeClassification",
        back_populates="asset",
        cascade="all, delete-orphan",
        uselist=False,
    )

    @property
    def themes(self):
        if not self.theme_classification:
            return []
        return self.theme_classification.themes or []


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


class AssetInvestmentNote(Base):
    """User-specific investment thesis for an asset."""
    __tablename__ = "asset_investment_notes"
    __table_args__ = (
        UniqueConstraint("user_id", "asset_id", name="uq_asset_investment_notes_user_asset"),
        CheckConstraint(
            "conviction IS NULL OR conviction IN ('low', 'medium', 'high')",
            name="ck_asset_investment_notes_conviction",
        ),
        CheckConstraint(
            "horizon IS NULL OR horizon IN ('short', 'medium', 'long')",
            name="ck_asset_investment_notes_horizon",
        ),
        {"schema": "portfolio"},
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("portfolio.assets.id", ondelete="CASCADE"), nullable=False)
    thesis = Column(Text)
    conviction = Column(String(20))
    risks = Column(Text)
    target_price = Column(Numeric(20, 8))
    target_text = Column(Text)
    invalidation_thesis = Column(Text)
    horizon = Column(String(20))
    horizon_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    asset = relationship("Asset", back_populates="investment_notes")


class AssetThemeClassification(Base):
    """Reusable global theme/exposure classifications for an asset."""
    __tablename__ = "asset_theme_classifications"
    __table_args__ = (
        UniqueConstraint("asset_id", name="uq_asset_theme_classifications_asset"),
        CheckConstraint(
            "method IN ('keyword', 'gpt', 'manual')",
            name="ck_asset_theme_classifications_method",
        ),
        {"schema": "portfolio"},
    )

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("portfolio.assets.id", ondelete="CASCADE"), nullable=False)
    themes = Column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    method = Column(String(20), nullable=False)
    model = Column(String, nullable=True)
    source_hash = Column(String(64), nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    asset = relationship("Asset", back_populates="theme_classification")
