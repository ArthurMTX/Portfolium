"""Asset theme classification service backed by LLM."""
from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Asset, AssetThemeClassification, AssetThemeTaxonomySuggestion
from app.services.gemini import GeminiService
from app.services.cache import CacheService

logger = logging.getLogger(__name__)

ThemePayload = Dict[str, Any]

GEMINI_THEME_TAXONOMY_VERSION = "hierarchical-weighted-evidence-v7"
GEMINI_THEME_MODEL = settings.GEMINI_MODEL
MIN_THEME_CONFIDENCE = 0.55
MIN_THEME_WEIGHT = 0.05
MIN_MISSING_SUBTHEME_SUGGESTION_CONFIDENCE = 0.75
GEMINI_THEME_METHOD = "gpt"
MAX_SUMMARY_CHARS = 2500
MAX_SUMMARY_SENTENCES = 10

_SUMMARY_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")

ALLOWED_THEME_HIERARCHY: Dict[str, tuple[str, ...]] = {
    "AI Infrastructure": ("GPU Computing", "Accelerated Computing", "AI Servers", "AI Networking", "Edge AI"),
    "AI Applications": ("Generative AI", "AI Agents", "AI Software", "Enterprise AI", "Sovereign AI"),
    "Data Center Infrastructure": ("Hyperscale Data Centers", "Data Center Power", "Data Center Cooling"),
    "Networking Infrastructure": ("Ethernet Switching", "Optical Networking", "Routing", "Network Equipment"),
    "Semiconductor Value Chain": ("Chip Design", "Semiconductor Equipment", "Foundry Ecosystem", "Advanced Packaging", "Memory & Storage"),
    "Photonics & Optical Computing": ("Optical Interconnects", "Silicon Photonics", "Optical Transceivers", "Co-Packaged Optics"),
    "Quantum Technology": ("Quantum Computing", "Quantum Networking", "Quantum Security"),
    "Cybersecurity Platforms": ("Identity Security", "Zero Trust", "Threat Intelligence", "Network Security", "Cloud Security", "Security Operations", "Endpoint Security", "Application Security"),
    "Cloud Platforms": ("Cloud Infrastructure", "Hyperscale Cloud", "Developer Platforms", "Observability", "Database Platforms", "CDN", "Edge Network"),
    "Enterprise SaaS": ("CRM Software", "ERP Software", "Workflow Automation", "Digital Transformation", "Customer Experience Software", "Productivity Software"),
    "Data Analytics Platforms": ("Business Intelligence", "Data Warehousing", "Data Engineering", "Real-Time Analytics"),
    "Robotics & Automation": ("Humanoid Robotics", "Industrial Robotics", "Warehouse Automation", "Machine Vision", "Industrial Automation", "Sensors & LiDAR"),
    "Electric Mobility": ("Electric Vehicles", "Charging Infrastructure", "Powertrains", "Fleet Electrification"),
    "Autonomous Mobility": ("Autonomous Vehicles", "Robotaxis", "Driver Assistance", "Mobility Platforms"),
    "Battery Value Chain": ("Battery Technology", "Battery Storage", "Lithium Batteries", "Battery Materials", "Battery Recycling"),
    "Defense Tech": ("Military AI", "ISR & Surveillance", "Drones / UAV", "Electronic Warfare", "Missile Defense", "Secure Communications", "Ammunition & Ordnance"),
    "Space Infrastructure": ("Launch Services", "Satellites", "Space Communications", "Earth Observation", "Space Systems"),
    "Geospatial Technology": ("GNSS Positioning", "Surveying Technology", "Geospatial Software", "Mapping Systems", "Location Intelligence"),
    "Nuclear Energy": ("Nuclear", "SMR", "Uranium", "Nuclear Services"),
    "Grid Modernization": ("Grid Infrastructure", "Power Generation", "Transmission Equipment", "Power Electronics", "Smart Grid"),
    "Renewable Power": ("Solar", "Wind", "Renewable Developers", "Renewable Equipment"),
    "Clean Fuels": ("Hydrogen", "Renewable Natural Gas", "Sustainable Aviation Fuel", "Biofuels"),
    "Carbon Management": ("Carbon Capture", "Carbon Markets", "Emissions Monitoring"),
    "Oil & Gas": ("Crude Oil Production", "Natural Gas Production", "Natural Gas Liquids", "Integrated Energy"),
    "Energy Transport": ("Pipelines", "LNG Infrastructure", "Storage Terminals", "Midstream Infrastructure"),
    "Energy Services": ("Oilfield Services", "Drilling Services", "Completion Services"),
    "Digital Finance": ("Fintech", "Digital Banking", "Payments", "Lending Platforms"),
    "Investment Platforms": ("Asset Management", "Wealth Technology"),
    "Market Infrastructure": ("Exchange Operators", "Trading Infrastructure", "Market Data", "Index Providers", "Credit Ratings"),
    "Insurance": ("P&C Insurance", "Life Insurance", "Reinsurance", "Insurance Brokers"),
    "Crypto Infrastructure": ("Digital Assets", "Crypto Exchanges", "Blockchain Infrastructure", "Bitcoin Mining", "Stablecoin", "Cryptocurrency"),
    "Biotechnology Platforms": ("Drug Discovery", "Biologics", "Gene Therapy", "Cell Therapy", "Clinical Platforms"),
    "Precision Medicine": ("Diagnostics", "Genomics", "Targeted Therapies", "Personalized Oncology"),
    "Medical Technology": ("Medical Devices", "Robotic Surgery", "Imaging Systems", "Monitoring Devices"),
    "Healthcare Delivery": ("Healthcare Services", "Managed Care", "Hospitals", "Pharmacy Services"),
    "Digital Commerce": ("E-commerce", "Marketplaces", "Omnichannel Retail", "Digital Advertising"),
    "Gaming & Interactive Media": ("Gaming", "Game Engines", "Esports", "Interactive Entertainment"),
    "Digital Media": ("Streaming", "Social Media", "Creator Platforms", "Online Advertising"),
    "Luxury Automobiles": ("Performance Vehicles", "Luxury EVs", "Motorsport"),
    "Luxury Goods": ("Luxury", "Premium Apparel", "Jewelry & Watches", "Beauty & Fragrance", "Branded Merchandise", "Lifestyle Licensing"),
    "Travel & Leisure": ("Hotels & Resorts", "Cruise Lines", "Airlines", "Experiences"),
    "Logistics Networks": ("Logistics", "Supply Chain", "Parcel Delivery", "Freight Forwarding", "Cold Chain"),
    "Air Freight & Logistics": ("Express Delivery", "Air Cargo", "Logistics Solutions"),
    "Marine Transportation": ("Tank Barges", "Petrochemical Transport", "Container Shipping", "Dry Bulk Shipping", "Offshore Vessels"),
    "Rail Transportation": ("Freight Rail", "Intermodal Rail", "Rail Equipment"),
    "Aerospace Systems": ("Commercial Aircraft", "Aircraft Engines", "Avionics"),
    "Observability Platforms": ("Infrastructure Monitoring", "Application Monitoring", "Log Analytics", "Telemetry"),
    "National Security Space": ("Defense Satellites", "Space ISR", "Military Communications"),
    "AI Drug Discovery": ("Computational Biology", "AI Drug Discovery", "Drug Simulation"),
    "Electrification": ("Power Distribution", "Electrical Equipment", "Energy Efficiency", "Power Conversion"),
    "Industrial Digitalization": ("Digital Twins", "Industrial Software", "Simulation Software", "Engineering Software"),
    "Construction & Industrial Equipment": ("Construction Equipment", "Industrial Machinery", "Construction Technology", "Rental Equipment"),
    "Precision Agriculture": ("Agricultural Equipment", "Smart Farming", "Crop Inputs"),
    "Construction Materials": ("Roofing Systems", "Flooring Systems", "Concrete Admixtures", "Sealants & Coatings"),
    "Water Infrastructure": ("Water Treatment", "Smart Water Networks", "Water Utilities", "Pumping Systems", "Desalination", "Pool Equipment"),
    "Environmental Services": ("Waste Management", "Hazardous Waste", "Industrial Cleanup", "Recycling", "Environmental Remediation", "Pest Control Services"),
    "Agricultural Chemicals": ("Fertilizer Production", "Ammonia Production", "Nitrogen Products"),
    "Industrial Gases": ("Industrial Oxygen", "Industrial Nitrogen", "Argon & Noble Gases", "Hydrogen Supply", "Medical Gases", "Electronic Specialty Gases"),
    "Specialty Chemicals": ("Industrial Maintenance Chemicals", "Lubricants", "Surface Treatments", "Cleaning Chemicals"),
    "Critical Minerals": ("Rare Earths", "Lithium", "Nickel", "Graphite", "Mineral Processing"),
    "Copper Electrification": ("Copper", "Copper Mining", "Electrical Wiring", "Power Cables"),
    "Precious Metals": ("Gold", "Silver", "Royalty & Streaming", "Mining Services"),
    "Telecom Infrastructure": ("Telecommunications", "5G Infrastructure", "Fiber Networks", "Tower Infrastructure", "Broadband Networks", "Cell Towers", "Wireless Infrastructure"),
    "Data Center Real Estate": ("Data Center REITs", "Colocation", "Hyperscale Leasing"),
    "Real Estate Income": ("Industrial REITs", "Residential REITs", "Healthcare REITs", "Net Lease", "Self Storage"),
    "Real Estate Services": ("Property Management", "Commercial Brokerage", "Facilities Management", "Real Estate Advisory"),
    "AdTech": ("Mobile Advertising", "Programmatic Advertising", "Performance Marketing"),
    "Sports Betting": ("Online Sportsbooks", "iGaming", "Fantasy Sports"),
    "Gaming & Gambling": ("Casinos", "Online Casinos", "Lottery Operators"),
    "EdTech": ("Online Learning", "Professional Training", "Educational Software"),
    "Human Capital": ("Staffing", "HR Software", "Payroll", "Recruiting Platforms"),
    "Testing & Certification": ("Industrial Inspection", "Product Certification", "Laboratory Testing"),
    "Professional Services": ("Consulting", "Outsourcing", "Engineering Services"),
    "Correctional Services": ("Private Prisons", "Electronic Monitoring"),
    "Funeral Services": ("Funeral Homes", "Cemeteries", "Cremation Services"),
    "Forestry": ("Timberlands", "Wood Products", "Pulp & Paper"),
    "Packaging": ("Consumer Packaging", "Industrial Packaging", "Beverage Packaging"),
    "Education Services": ("Universities", "Training Providers", "Student Services"),
    "Music Industry": ("Music Streaming", "Music Rights", "Record Labels"),
    "GovTech": ("Government Software", "Public Sector IT", "Defense Software"),
    "Marine Recreation": ("Boat Retail", "Yacht Retail", "Yacht Services", "Boat Financing"),
    "Restaurant Franchises": ("Quick Service Restaurants", "Restaurant Franchising"),
    "Beverage Brands": ("Soft Drinks", "Alcoholic Beverages"),
    "Pet Care": ("Pet Food", "Veterinary Services", "Veterinary Pharma", "Livestock Health", "Pet Diagnostics"),
    "Food & Beverage": ("Packaged Foods","Plant-Based Foods","Alternative Proteins","Meat Alternatives","Foodservice","Food Delivery"),
    "Household & Personal Care": ("Home Care","Fabric Care","Personal Care","Beauty & Grooming","Baby & Family Care",    "Oral Care","Paper Products"),
    "Consumer Health": ("OTC Health Products","Vitamins & Supplements","Digestive Health","Respiratory Health","Sleep & Relaxation","Sexual Wellness"),
    "Retail & Distribution": ("Luxury Retail","Beauty Retail","Department Stores","Travel Retail","Specialty Retail","Direct-to-Consumer"),
    "Automotive Retail": ("Auto Dealerships","Vehicle Distribution"),
    "Mortgage Finance": ("Secondary Mortgage Market","Mortgage Securitization","Mortgage Guarantees","Single-Family Mortgages","Multifamily Mortgages"),
    "Physical Security": ("Alarm Monitoring","Security Systems","Smart Home Security","Fire & Life Safety","Emergency Response","Access Control")
}

ALLOWED_THEMES: tuple[str, ...] = tuple(ALLOWED_THEME_HIERARCHY.keys())
ALLOWED_THEME_SET = set(ALLOWED_THEMES)
ALLOWED_SUBTHEME_SETS = {
    theme: set(subthemes)
    for theme, subthemes in ALLOWED_THEME_HIERARCHY.items()
}

GEMINI_RESPONSE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "primaryThemes": {
            "type": "array",
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "confidence": {"type": "number"},
                    "weight": {"type": "number"},
                    "evidence": {
                        "type": "array",
                        "maxItems": 3,
                        "items": {"type": "string"},
                    },
                    "subthemes": {
                        "type": "array",
                        "maxItems": 3,
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "confidence": {"type": "number"},
                                "evidence": {
                                    "type": "array",
                                    "maxItems": 3,
                                    "items": {"type": "string"},
                                },
                            },
                            "required": ["label", "confidence", "evidence"],
                        },
                    },
                },
                "required": ["label", "confidence", "weight", "evidence", "subthemes"],
            },
        },
        "secondaryThemes": {
            "type": "array",
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "confidence": {"type": "number"},
                    "weight": {"type": "number"},
                    "evidence": {
                        "type": "array",
                        "maxItems": 3,
                        "items": {"type": "string"},
                    },
                    "subthemes": {
                        "type": "array",
                        "maxItems": 3,
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "confidence": {"type": "number"},
                                "evidence": {
                                    "type": "array",
                                    "maxItems": 3,
                                    "items": {"type": "string"},
                                },
                            },
                            "required": ["label", "confidence", "evidence"],
                        },
                    },
                },
                "required": ["label", "confidence", "weight", "evidence", "subthemes"],
            },
        },
        "taxonomyGap": {
            "type": "object",
            "properties": {
                "hasGap": {"type": "boolean"},
                "reason": {"type": "string"},
                "suggestedTheme": {"type": "string"},
                "suggestedSubthemes": {
                    "type": "array",
                    "maxItems": 5,
                    "items": {"type": "string"},
                },
                "confidence": {"type": "number"},
            },
            "required": ["hasGap"],
        },
    },
    "required": ["primaryThemes", "secondaryThemes", "taxonomyGap"],
}

GEMINI_PARENT_THEME_RESPONSE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "primaryThemes": {
            "type": "array",
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "confidence": {"type": "number"},
                    "weight": {"type": "number"},
                    "evidence": {
                        "type": "array",
                        "maxItems": 3,
                        "items": {"type": "string"},
                    },
                },
                "required": ["label", "confidence", "weight", "evidence"],
            },
        },
        "secondaryThemes": {
            "type": "array",
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "confidence": {"type": "number"},
                    "weight": {"type": "number"},
                    "evidence": {
                        "type": "array",
                        "maxItems": 3,
                        "items": {"type": "string"},
                    },
                },
                "required": ["label", "confidence", "weight", "evidence"],
            },
        },
        "taxonomyGap": {
            "type": "object",
            "properties": {
                "hasGap": {"type": "boolean"},
                "reason": {"type": "string"},
                "suggestedTheme": {"type": "string"},
                "suggestedSubthemes": {
                    "type": "array",
                    "maxItems": 5,
                    "items": {"type": "string"},
                },
                "confidence": {"type": "number"},
            },
            "required": ["hasGap"],
        },
    },
    "required": ["primaryThemes", "secondaryThemes", "taxonomyGap"],
}

GEMINI_SUBTHEME_RESPONSE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "themes": {
            "type": "array",
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "subthemes": {
                        "type": "array",
                        "maxItems": 3,
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "confidence": {"type": "number"},
                                "evidence": {
                                    "type": "array",
                                    "maxItems": 3,
                                    "items": {"type": "string"},
                                },
                            },
                            "required": ["label", "confidence", "evidence"],
                        },
                    },
                },
                "required": ["label", "subthemes"],
            },
        },
        "subthemeGaps": {
            "type": "array",
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "reason": {"type": "string"},
                    "suggestedSubthemes": {
                        "type": "array",
                        "maxItems": 5,
                        "items": {"type": "string"},
                    },
                    "confidence": {"type": "number"},
                },
                "required": ["label", "reason", "suggestedSubthemes", "confidence"],
            },
        },
    },
    "required": ["themes", "subthemeGaps"],
}


class AssetThemeService:
    """Generate, validate, and persist reusable asset theme classifications."""

    def __init__(self, db: Session, gemini_service: Optional[GeminiService] = None):
        self.db = db
        self.gemini_service = gemini_service or GeminiService()
        self.gemini_model = self.gemini_service.model
        self.last_taxonomy_gap: Optional[Dict[str, Any]] = None
        self.last_subtheme_taxonomy_gaps: List[Dict[str, Any]] = []
        self.last_taxonomy_gap_persisted: bool = False
        self._classification_symbol: Optional[str] = None

    def get_classification(self, asset_id: int) -> Optional[AssetThemeClassification]:
        return (
            self.db.query(AssetThemeClassification)
            .filter(AssetThemeClassification.asset_id == asset_id)
            .first()
        )

    def get_themes(self, asset_id: int) -> List[ThemePayload]:
        classification = self.get_classification(asset_id)
        if not classification:
            return []
        return classification.themes or []

    def refresh_gemini_classification(
        self,
        asset: Asset,
        summary: Optional[str],
        sector: Optional[str] = None,
        industry: Optional[str] = None,
        name: Optional[str] = None,
        force: bool = False,
    ) -> AssetThemeClassification:
        source_hash = self.build_source_hash(
            summary=summary,
            sector=sector or asset.sector,
            industry=industry or asset.industry,
            name=name or asset.name,
        )

        existing = self.get_classification(asset.id)
        logger.info(
            "Asset theme classification requested asset_id=%s symbol=%s force=%s model=%s source_hash=%s existing=%s",
            asset.id,
            asset.symbol,
            force,
            self.gemini_model,
            source_hash[:12],
            bool(existing),
        )
        if existing and not force:
            if existing.method == "manual":
                logger.info(
                    "Asset theme classification skipped asset_id=%s symbol=%s reason=manual",
                    asset.id,
                    asset.symbol,
                )
                return existing
            if (
                existing.source_hash == source_hash
                and existing.method in {"gpt", "llm"}
                and existing.model == self.gemini_model
            ):
                logger.info(
                    "Asset theme classification skipped asset_id=%s symbol=%s reason=cache_hit generated_at=%s",
                    asset.id,
                    asset.symbol,
                    existing.generated_at,
                )
                return existing

        themes: List[ThemePayload] = []
        taxonomy_gap: Optional[Dict[str, Any]] = None
        self.last_taxonomy_gap = None
        self.last_subtheme_taxonomy_gaps = []
        self.last_taxonomy_gap_persisted = False
        if summary and summary.strip():
            strategy = self._classification_strategy()
            logger.info(
                "Asset theme Gemini classification starting asset_id=%s symbol=%s name=%s sector=%s industry=%s summary_chars=%s classification_strategy=%s",
                asset.id,
                asset.symbol,
                name or asset.name or asset.symbol,
                sector or asset.sector,
                industry or asset.industry,
                len(summary),
                strategy,
            )
            previous_symbol = self._classification_symbol
            self._classification_symbol = asset.symbol
            try:
                themes, taxonomy_gap = self.generate_theme_payload(
                    name=name or asset.name or asset.symbol,
                    sector=sector or asset.sector,
                    industry=industry or asset.industry,
                    summary=summary,
                )
            finally:
                self._classification_symbol = previous_symbol
            self.last_taxonomy_gap = taxonomy_gap
            logger.info(
                "Asset theme Gemini classification completed asset_id=%s symbol=%s theme_count=%s themes=%s",
                asset.id,
                asset.symbol,
                len(themes),
                [theme.get("label") for theme in themes],
            )
            self._persist_taxonomy_gap_suggestion(
                asset=asset,
                summary_hash=source_hash,
                taxonomy_gap=taxonomy_gap,
                summary=summary,
                sector=sector or asset.sector,
                industry=industry or asset.industry,
                company_name=name or asset.name or asset.symbol,
                themes=themes,
            )
            for subtheme_gap in self.last_subtheme_taxonomy_gaps:
                self._persist_taxonomy_gap_suggestion(
                    asset=asset,
                    summary_hash=source_hash,
                    taxonomy_gap=subtheme_gap,
                    summary=summary,
                    sector=sector or asset.sector,
                    industry=industry or asset.industry,
                    company_name=name or asset.name or asset.symbol,
                    themes=themes,
                )
        else:
            logger.info(
                "Asset theme classification skipped Gemini asset_id=%s symbol=%s reason=missing_summary",
                asset.id,
                asset.symbol,
            )

        now = datetime.utcnow()
        if self.db.bind and self.db.bind.dialect.name == "postgresql":
            classification = self._upsert_postgresql_classification(
                asset_id=asset.id,
                themes=themes,
                source_hash=source_hash,
                generated_at=now,
                force=force,
            )
            self._invalidate_theme_dependent_caches()
            return classification

        if existing:
            existing.themes = themes
            existing.method = GEMINI_THEME_METHOD
            existing.model = self.gemini_model
            existing.source_hash = source_hash
            existing.generated_at = now
            existing.updated_at = now
            classification = existing
        else:
            classification = AssetThemeClassification(
                asset_id=asset.id,
                themes=themes,
                method=GEMINI_THEME_METHOD,
                model=self.gemini_model,
                source_hash=source_hash,
                generated_at=now,
                updated_at=now,
            )
            self.db.add(classification)

        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            classification = self.get_classification(asset.id)
            if not classification:
                raise

            classification.themes = themes
            classification.method = GEMINI_THEME_METHOD
            classification.model = self.gemini_model
            classification.source_hash = source_hash
            classification.generated_at = now
            classification.updated_at = now
            self.db.commit()

        self.db.refresh(classification)
        self._invalidate_theme_dependent_caches()
        logger.info(
            "Asset theme classification persisted asset_id=%s symbol=%s classification_id=%s theme_count=%s",
            asset.id,
            asset.symbol,
            classification.id,
            len(themes),
        )
        return classification

    def _upsert_postgresql_classification(
        self,
        asset_id: int,
        themes: List[ThemePayload],
        source_hash: str,
        generated_at: datetime,
        force: bool,
    ) -> AssetThemeClassification:
        values = {
            "asset_id": asset_id,
            "themes": themes,
            "method": GEMINI_THEME_METHOD,
            "model": self.gemini_model,
            "source_hash": source_hash,
            "generated_at": generated_at,
            "updated_at": generated_at,
        }
        statement = postgresql_insert(AssetThemeClassification).values(**values)

        conflict_update = {
            "index_elements": ["asset_id"],
            "set_": {
                "themes": statement.excluded.themes,
                "method": statement.excluded.method,
                "model": statement.excluded.model,
                "source_hash": statement.excluded.source_hash,
                "generated_at": statement.excluded.generated_at,
                "updated_at": statement.excluded.updated_at,
            },
        }
        if not force:
            conflict_update["where"] = AssetThemeClassification.method != "manual"

        update_statement = statement.on_conflict_do_update(**conflict_update).returning(
            AssetThemeClassification.id
        )

        try:
            classification_id = self.db.execute(update_statement).scalar_one_or_none()
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        if classification_id is not None:
            classification = (
                self.db.query(AssetThemeClassification)
                .filter(AssetThemeClassification.id == classification_id)
                .first()
            )
        else:
            classification = self.get_classification(asset_id)

        if not classification:
            raise RuntimeError(f"Failed to persist theme classification for asset {asset_id}")

        self.db.refresh(classification)
        logger.info(
            "Asset theme classification upserted asset_id=%s classification_id=%s theme_count=%s force=%s",
            asset_id,
            classification.id,
            len(themes),
            force,
        )
        return classification

    @staticmethod
    def _invalidate_theme_dependent_caches() -> None:
        cache = CacheService()
        cache.delete_pattern("assets_held:*")
        cache.delete_pattern("assets_sold:*")
        cache.delete_pattern("positions:*")
        cache.delete_pattern("dashboard_batch:*")

    def generate_themes(
        self,
        name: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        summary: str,
    ) -> List[ThemePayload]:
        themes, taxonomy_gap = self.generate_theme_payload(
            name=name,
            sector=sector,
            industry=industry,
            summary=summary,
        )
        self.last_taxonomy_gap = taxonomy_gap
        return themes

    def generate_theme_payload(
        self,
        name: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        summary: str,
    ) -> tuple[List[ThemePayload], Optional[Dict[str, Any]]]:
        if settings.ASSET_THEME_TWO_PASS_CLASSIFICATION:
            return self.generate_theme_payload_two_pass(
                name=name,
                sector=sector,
                industry=industry,
                summary=summary,
            )

        return self.generate_theme_payload_one_pass(
            name=name,
            sector=sector,
            industry=industry,
            summary=summary,
        )

    def generate_theme_payload_one_pass(
        self,
        name: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        summary: str,
    ) -> tuple[List[ThemePayload], Optional[Dict[str, Any]]]:
        prompt, prompt_metrics = self._build_prompt_with_metrics(
            name=name,
            sector=sector,
            industry=industry,
            summary=summary,
        )
        started_at = time.perf_counter()
        logger.info(
            "Gemini theme request sending model=%s symbol=%s company=%s sector=%s industry=%s "
            "summary_chars_original=%s summary_chars_used=%s taxonomy_chars=%s "
            "instruction_chars=%s prompt_chars=%s classification_strategy=%s",
            self.gemini_service.model,
            self._classification_symbol,
            name,
            sector,
            industry,
            prompt_metrics["summary_chars_original"],
            prompt_metrics["summary_chars_used"],
            prompt_metrics["taxonomy_chars"],
            prompt_metrics["instruction_chars"],
            prompt_metrics["prompt_chars"],
            "one_pass",
        )
        raw_response = self.gemini_service.generate_json(prompt, GEMINI_RESPONSE_SCHEMA)
        elapsed_ms = round((time.perf_counter() - started_at) * 1000)
        logger.info(
            "Gemini theme request received model=%s symbol=%s company=%s elapsed_ms=%s response_chars=%s",
            self.gemini_service.model,
            self._classification_symbol,
            name,
            elapsed_ms,
            len(raw_response),
        )
        payload = self._parse_json_response(raw_response)
        themes = self._validate_and_flatten(payload)
        taxonomy_gap = self._clean_taxonomy_gap(payload.get("taxonomyGap"))
        logger.info(
            "Gemini theme response validated symbol=%s company=%s theme_count=%s labels=%s taxonomy_gap=%s",
            self._classification_symbol,
            name,
            len(themes),
            [theme.get("label") for theme in themes],
            bool(taxonomy_gap and taxonomy_gap.get("hasGap")),
        )
        return themes, taxonomy_gap

    def generate_theme_payload_two_pass(
        self,
        name: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        summary: str,
    ) -> tuple[List[ThemePayload], Optional[Dict[str, Any]]]:
        pass1_prompt, pass1_metrics = self._build_parent_theme_prompt_with_metrics(
            name=name,
            sector=sector,
            industry=industry,
            summary=summary,
        )
        pass1_started_at = time.perf_counter()
        logger.info(
            "Gemini theme pass1 sending model=%s symbol=%s company=%s sector=%s industry=%s "
            "summary_chars_original=%s summary_chars_used=%s parent_theme_chars=%s "
            "instruction_chars=%s pass1_prompt_chars=%s classification_strategy=%s",
            self.gemini_service.model,
            self._classification_symbol,
            name,
            sector,
            industry,
            pass1_metrics["summary_chars_original"],
            pass1_metrics["summary_chars_used"],
            pass1_metrics["parent_theme_chars"],
            pass1_metrics["instruction_chars"],
            pass1_metrics["prompt_chars"],
            "two_pass",
        )
        pass1_response = self.gemini_service.generate_json(
            pass1_prompt,
            GEMINI_PARENT_THEME_RESPONSE_SCHEMA,
        )
        pass1_duration_ms = round((time.perf_counter() - pass1_started_at) * 1000)
        pass1_payload = self._parse_json_response(pass1_response)
        parent_themes = self._validate_parent_themes(pass1_payload, max_total=5)
        taxonomy_gap = self._clean_taxonomy_gap(pass1_payload.get("taxonomyGap"))
        selected_parent_themes = [theme["label"] for theme in parent_themes]

        logger.info(
            "Gemini theme pass1 received model=%s symbol=%s company=%s pass1_duration_ms=%s "
            "response_chars=%s selected_parent_themes=%s taxonomy_gap=%s",
            self.gemini_service.model,
            self._classification_symbol,
            name,
            pass1_duration_ms,
            len(pass1_response),
            selected_parent_themes,
            bool(taxonomy_gap and taxonomy_gap.get("hasGap")),
        )

        if not parent_themes:
            logger.info(
                "Gemini theme two-pass completed model=%s symbol=%s company=%s "
                "classification_strategy=%s pass1_prompt_chars=%s pass2_prompt_chars=%s "
                "total_prompt_chars=%s pass1_duration_ms=%s pass2_duration_ms=%s "
                "selected_parent_themes=%s",
                self.gemini_service.model,
                self._classification_symbol,
                name,
                "two_pass",
                pass1_metrics["prompt_chars"],
                0,
                pass1_metrics["prompt_chars"],
                pass1_duration_ms,
                0,
                selected_parent_themes,
            )
            return parent_themes, taxonomy_gap

        pass2_prompt, pass2_metrics = self._build_subtheme_prompt_with_metrics(
            name=name,
            sector=sector,
            industry=industry,
            summary=summary,
            parent_themes=parent_themes,
        )
        pass2_duration_ms = 0
        try:
            pass2_started_at = time.perf_counter()
            logger.info(
                "Gemini theme pass2 sending model=%s symbol=%s company=%s selected_parent_themes=%s "
                "selected_hierarchy_chars=%s instruction_chars=%s pass2_prompt_chars=%s "
                "classification_strategy=%s",
                self.gemini_service.model,
                self._classification_symbol,
                name,
                selected_parent_themes,
                pass2_metrics["selected_hierarchy_chars"],
                pass2_metrics["instruction_chars"],
                pass2_metrics["prompt_chars"],
                "two_pass",
            )
            pass2_response = self.gemini_service.generate_json(
                pass2_prompt,
                GEMINI_SUBTHEME_RESPONSE_SCHEMA,
            )
            pass2_duration_ms = round((time.perf_counter() - pass2_started_at) * 1000)
            pass2_payload = self._parse_json_response(pass2_response)
            subthemes_by_parent = self._validate_subtheme_payload(
                pass2_payload,
                selected_parent_themes,
            )
            self.last_subtheme_taxonomy_gaps = self._clean_subtheme_gap_suggestions(
                pass2_payload,
                selected_parent_themes,
            )
            themes = self._merge_parent_themes_with_subthemes(
                parent_themes,
                subthemes_by_parent,
            )
            logger.info(
                "Gemini theme pass2 received model=%s symbol=%s company=%s pass2_duration_ms=%s "
                "response_chars=%s selected_parent_themes=%s",
                self.gemini_service.model,
                self._classification_symbol,
                name,
                pass2_duration_ms,
                len(pass2_response),
                selected_parent_themes,
            )
        except Exception as exc:
            logger.warning(
                "Gemini theme pass2 failed; persisting parent themes without children "
                "model=%s symbol=%s company=%s selected_parent_themes=%s error=%s",
                self.gemini_service.model,
                self._classification_symbol,
                name,
                selected_parent_themes,
                exc,
            )
            themes = parent_themes

        logger.info(
            "Gemini theme two-pass completed model=%s symbol=%s company=%s "
            "classification_strategy=%s pass1_prompt_chars=%s pass2_prompt_chars=%s "
            "total_prompt_chars=%s pass1_duration_ms=%s pass2_duration_ms=%s "
            "selected_parent_themes=%s",
            self.gemini_service.model,
            self._classification_symbol,
            name,
            "two_pass",
            pass1_metrics["prompt_chars"],
            pass2_metrics["prompt_chars"],
            pass1_metrics["prompt_chars"] + pass2_metrics["prompt_chars"],
            pass1_duration_ms,
            pass2_duration_ms,
            selected_parent_themes,
        )
        return themes, taxonomy_gap

    @staticmethod
    def _classification_strategy() -> str:
        return "two_pass" if settings.ASSET_THEME_TWO_PASS_CLASSIFICATION else "one_pass"

    @staticmethod
    def build_source_hash(
        summary: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        name: Optional[str],
    ) -> str:
        source = "\n".join([
            GEMINI_THEME_TAXONOMY_VERSION,
            summary or "",
            sector or "",
            industry or "",
            name or "",
        ])
        return hashlib.sha256(source.encode("utf-8")).hexdigest()

    @classmethod
    def _build_prompt_with_metrics(
        cls,
        name: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        summary: str,
    ) -> tuple[str, Dict[str, int]]:
        summary_original = summary or ""
        summary_used = cls._trim_summary_for_prompt(summary_original)
        taxonomy = cls._render_taxonomy_for_prompt()

        prompt = f"""You classify listed companies into investment themes.

Input:
company name: {name or ""}
sector: {sector or ""}
industry: {industry or ""}
longBusinessSummary: {summary_used}

Allowed hierarchy JSON:
{taxonomy}

Rules:
- Use only labels from the allowed hierarchy for primaryThemes, secondaryThemes, and subthemes.
- Select real economic exposures: core activities, operating segments, revenue drivers, or strategic focus.
- Ignore minor, supporting, customer, partnership, financing, leasing, insurance, payment, marketing, and internal software activities unless they are major segments.
- Prefer precise investable exposures over broad sectors; never use generic labels like Technology, Software, Industrials, Energy, Consumer Brands, or Infrastructure.
- Return fewer themes, or none, when fit is weak or uncertain.
- If a clear business exposure is missing from the allowed hierarchy, set taxonomyGap for admin review; it is not a final classification and must not duplicate an existing theme or subtheme.
- If an existing theme fits well, taxonomyGap.hasGap must be false.
- Max 3 primary themes, max 5 secondary themes, max 3 subthemes per theme.
- Theme weights estimate economic exposure, must sum to 1.00, and omit any theme below {MIN_THEME_WEIGHT}.
- Primary themes are core business exposures; secondary themes are meaningful but not main business exposures.
- Confidence and weight must be between 0 and 1; omit themes or subthemes below confidence {MIN_THEME_CONFIDENCE}.
- Evidence must be short exact phrases from longBusinessSummary; do not paraphrase or invent evidence.
- Do not add a third hierarchy level, explanations, markdown, or non-JSON text.
- taxonomyGap.reason must be concise and business-oriented; taxonomyGap.confidence must be between 0 and 1.

Examples:
- Deere: Precision Agriculture and Construction & Industrial Equipment can be valid; Digital Finance is usually invalid when financing only supports equipment sales.
- MarineMax: Marine Recreation can be valid; Luxury Automobiles is invalid for yachts.
- Xylem: Water Infrastructure can be valid; Data Analytics Platforms is invalid when analytics only supports water operations.
- If no existing theme fits a clear exposure, return no weak theme and provide taxonomyGap. If a good theme exists, taxonomyGap.hasGap=false.

Return only JSON shaped as:
{{"primaryThemes":[{{"label":"","confidence":0,"weight":0,"evidence":[],"subthemes":[{{"label":"","confidence":0,"evidence":[]}}]}}],"secondaryThemes":[{{"label":"","confidence":0,"weight":0,"evidence":[],"subthemes":[{{"label":"","confidence":0,"evidence":[]}}]}}],"taxonomyGap":{{"hasGap":false,"reason":"","suggestedTheme":"","suggestedSubthemes":[],"confidence":0}}}}"""

        metrics = {
            "summary_chars_original": len(summary_original),
            "summary_chars_used": len(summary_used),
            "taxonomy_chars": len(taxonomy),
            "instruction_chars": len(prompt) - len(summary_used) - len(taxonomy),
            "prompt_chars": len(prompt),
        }
        return prompt, metrics

    @classmethod
    def _build_prompt(
        cls,
        name: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        summary: str,
    ) -> str:
        prompt, _metrics = cls._build_prompt_with_metrics(
            name=name,
            sector=sector,
            industry=industry,
            summary=summary,
        )
        return prompt

    @staticmethod
    def _render_taxonomy_for_prompt() -> str:
        return json.dumps(
            {theme: list(subthemes) for theme, subthemes in ALLOWED_THEME_HIERARCHY.items()},
            separators=(",", ":"),
        )

    @staticmethod
    def _render_parent_theme_labels_for_prompt() -> str:
        return json.dumps(list(ALLOWED_THEME_HIERARCHY.keys()), separators=(",", ":"))

    @classmethod
    def _build_parent_theme_prompt_with_metrics(
        cls,
        name: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        summary: str,
    ) -> tuple[str, Dict[str, int]]:
        summary_original = summary or ""
        summary_used = cls._trim_summary_for_prompt(summary_original)
        parent_themes = cls._render_parent_theme_labels_for_prompt()

        prompt = f"""You classify listed companies into investment theme parent labels.

Input:
company name: {name or ""}
sector: {sector or ""}
industry: {industry or ""}
longBusinessSummary: {summary_used}

Allowed parent theme labels JSON:
{parent_themes}

Rules:
- Use only labels from the allowed parent theme labels.
- Do not select subthemes in this pass.
- Select real economic exposures: core activities, operating segments, revenue drivers, or strategic focus.
- Ignore minor, supporting, customer, partnership, financing, leasing, insurance, payment, marketing, and internal software activities unless they are major segments.
- Prefer precise investable exposures over broad sectors; never use generic labels like Technology, Software, Industrials, Energy, Consumer Brands, or Infrastructure.
- Return up to 5 total parent themes across primaryThemes and secondaryThemes.
- Return fewer themes, or none, when fit is weak or uncertain.
- If a clear business exposure is missing from the allowed parent labels, set taxonomyGap for admin review; it is not a final classification and must not duplicate an existing theme.
- If an existing parent label fits well, taxonomyGap.hasGap must be false.
- Max 3 primary themes. Primary themes are core business exposures; secondary themes are meaningful but not main business exposures.
- Theme weights estimate economic exposure, must sum to 1.00, and omit any theme below {MIN_THEME_WEIGHT}.
- Confidence and weight must be between 0 and 1; omit themes below confidence {MIN_THEME_CONFIDENCE}.
- Evidence must be short exact phrases from longBusinessSummary; do not paraphrase or invent evidence.
- Do not add explanations, markdown, or non-JSON text.

Return only JSON shaped as:
{{"primaryThemes":[{{"label":"","confidence":0,"weight":0,"evidence":[]}}],"secondaryThemes":[{{"label":"","confidence":0,"weight":0,"evidence":[]}}],"taxonomyGap":{{"hasGap":false,"reason":"","suggestedTheme":"","suggestedSubthemes":[],"confidence":0}}}}"""

        metrics = {
            "summary_chars_original": len(summary_original),
            "summary_chars_used": len(summary_used),
            "parent_theme_chars": len(parent_themes),
            "instruction_chars": len(prompt) - len(summary_used) - len(parent_themes),
            "prompt_chars": len(prompt),
        }
        return prompt, metrics

    @classmethod
    def _build_subtheme_prompt_with_metrics(
        cls,
        name: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        summary: str,
        parent_themes: List[ThemePayload],
    ) -> tuple[str, Dict[str, int]]:
        summary_original = summary or ""
        summary_used = cls._trim_summary_for_prompt(summary_original)
        selected_hierarchy = cls._render_selected_hierarchy_for_prompt(parent_themes)
        selected_parent_labels = [theme["label"] for theme in parent_themes]

        prompt = f"""You select subthemes for already-selected investment theme parent labels.

Input:
company name: {name or ""}
sector: {sector or ""}
industry: {industry or ""}
longBusinessSummary: {summary_used}

Selected parent themes JSON:
{json.dumps(selected_parent_labels, separators=(",", ":"))}

Allowed selected hierarchy JSON:
{selected_hierarchy}

Rules:
- Use only the selected parent theme labels and their allowed subthemes.
- Do not add, remove, rename, reorder, or replace parent themes.
- Do not invent parent themes or subthemes.
- Return each selected parent theme at most once.
- Select up to 3 subthemes for each selected parent theme.
- Return an empty subthemes array when no allowed subtheme fits with confidence.
- When a selected parent has no allowed subtheme fit but the summary clearly implies a missing specialization, add a subthemeGaps item for that parent with 1-5 concise suggestedSubthemes to add.
- Do not suggest subthemes that already exist in the allowed selected hierarchy.
- Confidence must be between 0 and 1; omit subthemes below confidence {MIN_THEME_CONFIDENCE}.
- Evidence must be short exact phrases from longBusinessSummary; do not paraphrase or invent evidence.
- subthemeGaps.reason must be concise and business-oriented.
- Do not add explanations, markdown, or non-JSON text.

Return only JSON shaped as:
{{"themes":[{{"label":"","subthemes":[{{"label":"","confidence":0,"evidence":[]}}]}}],"subthemeGaps":[{{"label":"","reason":"","suggestedSubthemes":[],"confidence":0}}]}}"""

        metrics = {
            "summary_chars_original": len(summary_original),
            "summary_chars_used": len(summary_used),
            "selected_hierarchy_chars": len(selected_hierarchy),
            "instruction_chars": len(prompt) - len(summary_used) - len(selected_hierarchy),
            "prompt_chars": len(prompt),
        }
        return prompt, metrics

    @staticmethod
    def _render_selected_hierarchy_for_prompt(parent_themes: List[ThemePayload]) -> str:
        selected = {
            theme["label"]: list(ALLOWED_THEME_HIERARCHY[theme["label"]])
            for theme in parent_themes
            if theme.get("label") in ALLOWED_THEME_HIERARCHY
        }
        return json.dumps(selected, separators=(",", ":"))

    @classmethod
    def _trim_summary_for_prompt(cls, summary: Optional[str]) -> str:
        if not summary:
            return ""

        normalized = " ".join(summary.strip().split())
        if not normalized:
            return ""

        sentences = cls._split_summary_sentences(normalized)
        if len(normalized) <= MAX_SUMMARY_CHARS and len(sentences) <= MAX_SUMMARY_SENTENCES:
            return normalized

        should_skip_low_signal_lists = (
            len(normalized) > MAX_SUMMARY_CHARS
            or len(sentences) > MAX_SUMMARY_SENTENCES
        )

        kept: List[str] = []
        for sentence in sentences:
            if len(kept) >= MAX_SUMMARY_SENTENCES:
                break
            if (
                should_skip_low_signal_lists
                and kept
                and cls._looks_like_excessive_brand_list(sentence)
            ):
                continue

            candidate = " ".join([*kept, sentence])
            if len(candidate) > MAX_SUMMARY_CHARS:
                if not kept:
                    return cls._truncate_at_word_boundary(sentence, MAX_SUMMARY_CHARS)
                break
            kept.append(sentence)

        if kept:
            return " ".join(kept)

        return cls._truncate_at_word_boundary(normalized, MAX_SUMMARY_CHARS)

    @staticmethod
    def _split_summary_sentences(summary: str) -> List[str]:
        sentences = [
            sentence.strip()
            for sentence in _SUMMARY_SENTENCE_RE.split(summary)
            if sentence.strip()
        ]
        return sentences or [summary]

    @staticmethod
    def _looks_like_excessive_brand_list(sentence: str) -> bool:
        lower = sentence.casefold()
        if "brand" not in lower and "trademark" not in lower:
            return False

        comma_count = sentence.count(",")
        semicolon_count = sentence.count(";")
        return comma_count >= 8 or semicolon_count >= 4

    @staticmethod
    def _truncate_at_word_boundary(text: str, max_chars: int) -> str:
        if len(text) <= max_chars:
            return text

        truncated = text[:max_chars].rstrip()
        boundary = truncated.rfind(" ")
        if boundary >= max_chars * 0.8:
            truncated = truncated[:boundary].rstrip()
        return truncated.rstrip(" ,;:")

    @staticmethod
    def _parse_json_response(raw_response: str) -> Dict[str, Any]:
        text = raw_response.strip()
        if text.startswith("```"):
            text = (
                text
                .removeprefix("```json")
                .removeprefix("```")
                .removesuffix("```")
                .strip()
            )
        return json.loads(text)

    @classmethod
    def _validate_and_flatten(cls, payload: Dict[str, Any]) -> List[ThemePayload]:
        themes: List[ThemePayload] = []
        seen_labels: set[str] = set()

        for tier, max_items in [("primary", 3), ("secondary", 5)]:
            key = "primaryThemes" if tier == "primary" else "secondaryThemes"
            raw_items = payload.get(key) or []

            if not isinstance(raw_items, list):
                continue

            tier_count = 0
            for item in raw_items:
                if tier_count >= max_items:
                    break
                if not isinstance(item, dict):
                    continue

                label = item.get("label")
                if label not in ALLOWED_THEME_SET or label in seen_labels:
                    continue

                confidence = cls._to_confidence(item.get("confidence"))
                if confidence is None or confidence < MIN_THEME_CONFIDENCE:
                    continue

                weight = cls._to_weight(item.get("weight"))
                if weight is None or weight < MIN_THEME_WEIGHT:
                    continue

                evidence = cls._clean_evidence(item.get("evidence"))
                children = cls._clean_subthemes(
                    theme_label=label,
                    value=item.get("subthemes") or item.get("children"),
                )

                seen_labels.add(label)
                tier_count += 1
                themes.append({
                    "label": label,
                    "confidence": confidence,
                    "weight": weight,
                    "evidence": evidence,
                    "tier": tier,
                    "children": children,
                })

        themes = cls._normalize_theme_weights(themes)

        themes.sort(
            key=lambda item: (
                0 if item.get("tier") == "primary" else 1,
                -float(item.get("weight", 0)),
                -float(item.get("confidence", 0)),
                item.get("label", ""),
            )
        )
        return themes

    @classmethod
    def _validate_parent_themes(
        cls,
        payload: Dict[str, Any],
        max_total: int,
    ) -> List[ThemePayload]:
        themes = cls._validate_and_flatten(payload)
        parent_themes: List[ThemePayload] = []
        for theme in themes:
            if len(parent_themes) >= max_total:
                break
            parent = dict(theme)
            parent["children"] = []
            parent_themes.append(parent)
        return cls._normalize_theme_weights(parent_themes)

    @classmethod
    def _validate_subtheme_payload(
        cls,
        payload: Dict[str, Any],
        selected_parent_themes: List[str],
    ) -> Dict[str, List[ThemePayload]]:
        selected = set(selected_parent_themes)
        subthemes_by_parent: Dict[str, List[ThemePayload]] = {}
        raw_themes = payload.get("themes") or []
        if not isinstance(raw_themes, list):
            return subthemes_by_parent

        for item in raw_themes:
            if not isinstance(item, dict):
                continue
            label = item.get("label")
            if label not in selected or label in subthemes_by_parent:
                continue
            subthemes_by_parent[label] = cls._clean_subthemes(
                theme_label=label,
                value=item.get("subthemes") or item.get("children"),
            )

        return subthemes_by_parent

    @classmethod
    def _clean_subtheme_gap_suggestions(
        cls,
        payload: Dict[str, Any],
        selected_parent_themes: List[str],
    ) -> List[Dict[str, Any]]:
        selected = set(selected_parent_themes)
        gaps: List[Dict[str, Any]] = []
        seen_labels: set[str] = set()
        raw_gaps = payload.get("subthemeGaps") or []
        if not isinstance(raw_gaps, list):
            return gaps

        for item in raw_gaps:
            if len(gaps) >= 5:
                break
            if not isinstance(item, dict):
                continue

            label = item.get("label")
            if label not in selected or label in seen_labels:
                continue

            confidence = cls._to_confidence(item.get("confidence"))
            if (
                confidence is None
                or confidence < MIN_MISSING_SUBTHEME_SUGGESTION_CONFIDENCE
            ):
                continue

            suggested_subthemes = cls._clean_suggested_subthemes(
                parent_label=label,
                value=item.get("suggestedSubthemes"),
            )
            if not suggested_subthemes:
                continue

            reason = item.get("reason")
            cleaned_reason = (
                " ".join(reason.strip().split())[:500]
                if isinstance(reason, str)
                else ""
            )
            if not cleaned_reason:
                cleaned_reason = "Selected parent theme has no accepted subtheme."

            seen_labels.add(label)
            gaps.append({
                "hasGap": True,
                "reason": cleaned_reason,
                "suggestedTheme": label,
                "suggestedSubthemes": suggested_subthemes,
                "confidence": confidence,
            })

        return gaps

    @staticmethod
    def _clean_suggested_subthemes(parent_label: str, value: Any) -> List[str]:
        if not isinstance(value, list):
            return []

        allowed = {
            subtheme.casefold()
            for subtheme in ALLOWED_THEME_HIERARCHY.get(parent_label, ())
        }
        subthemes: List[str] = []
        seen: set[str] = set()
        for item in value:
            if len(subthemes) >= 5:
                break
            if not isinstance(item, str):
                continue

            cleaned = " ".join(item.strip().split())[:120]
            normalized = cleaned.casefold()
            if not cleaned or normalized in seen or normalized in allowed:
                continue
            seen.add(normalized)
            subthemes.append(cleaned)

        return subthemes

    @staticmethod
    def _merge_parent_themes_with_subthemes(
        parent_themes: List[ThemePayload],
        subthemes_by_parent: Dict[str, List[ThemePayload]],
    ) -> List[ThemePayload]:
        merged: List[ThemePayload] = []
        for parent in parent_themes:
            next_parent = dict(parent)
            next_parent["children"] = list(subthemes_by_parent.get(parent["label"], []))
            merged.append(next_parent)
        return merged

    def _persist_taxonomy_gap_suggestion(
        self,
        asset: Asset,
        summary_hash: str,
        taxonomy_gap: Optional[Dict[str, Any]],
        summary: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        company_name: Optional[str],
        themes: List[ThemePayload],
    ) -> Optional[AssetThemeTaxonomySuggestion]:
        self.last_taxonomy_gap_persisted = False
        if not self._is_valid_taxonomy_gap_suggestion(taxonomy_gap, themes):
            return None

        assert taxonomy_gap is not None
        suggested_theme = taxonomy_gap["suggestedTheme"]
        values = {
            "asset_id": asset.id,
            "symbol": asset.symbol,
            "company_name": company_name or asset.name or asset.symbol,
            "sector": sector or asset.sector,
            "industry": industry or asset.industry,
            "summary_hash": summary_hash,
            "summary_excerpt": self._summary_excerpt(summary),
            "suggested_theme": suggested_theme,
            "suggested_subthemes": taxonomy_gap.get("suggestedSubthemes") or [],
            "reason": taxonomy_gap["reason"],
            "confidence": taxonomy_gap["confidence"],
            "status": "pending",
        }

        if self.db.bind and self.db.bind.dialect.name == "postgresql":
            statement = (
                postgresql_insert(AssetThemeTaxonomySuggestion)
                .values(**values)
                .on_conflict_do_nothing(
                    index_elements=["asset_id", "summary_hash", "suggested_theme"]
                )
                .returning(AssetThemeTaxonomySuggestion.id)
            )
            try:
                suggestion_id = self.db.execute(statement).scalar_one_or_none()
                self.db.commit()
            except Exception:
                self.db.rollback()
                raise

            if suggestion_id is None:
                return None

            suggestion = (
                self.db.query(AssetThemeTaxonomySuggestion)
                .filter(AssetThemeTaxonomySuggestion.id == suggestion_id)
                .first()
            )
            self.last_taxonomy_gap_persisted = suggestion is not None
            return suggestion

        suggestion = AssetThemeTaxonomySuggestion(**values)
        self.db.add(suggestion)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            return None

        self.db.refresh(suggestion)
        self.last_taxonomy_gap_persisted = True
        return suggestion

    @staticmethod
    def _is_valid_taxonomy_gap_suggestion(
        taxonomy_gap: Optional[Dict[str, Any]],
        _themes: List[ThemePayload],
    ) -> bool:
        if not taxonomy_gap or not taxonomy_gap.get("hasGap"):
            return False

        suggested_theme = taxonomy_gap.get("suggestedTheme")
        reason = taxonomy_gap.get("reason")
        confidence = taxonomy_gap.get("confidence")
        if not suggested_theme or not reason or confidence is None:
            return False

        return True

    @classmethod
    def _clean_taxonomy_gap(cls, value: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(value, dict):
            return None

        confidence = cls._to_confidence(value.get("confidence"))
        subthemes = []
        seen_subthemes: set[str] = set()
        for item in value.get("suggestedSubthemes") or []:
            if len(subthemes) >= 5:
                break
            if not isinstance(item, str):
                continue
            cleaned = " ".join(item.strip().split())[:120]
            normalized = cleaned.casefold()
            if cleaned and normalized not in seen_subthemes:
                seen_subthemes.add(normalized)
                subthemes.append(cleaned)

        suggested_theme = value.get("suggestedTheme")
        reason = value.get("reason")
        return {
            "hasGap": bool(value.get("hasGap")),
            "reason": " ".join(reason.strip().split())[:500] if isinstance(reason, str) else "",
            "suggestedTheme": " ".join(suggested_theme.strip().split())[:160]
            if isinstance(suggested_theme, str)
            else "",
            "suggestedSubthemes": subthemes,
            "confidence": confidence,
        }

    @staticmethod
    def _summary_excerpt(summary: Optional[str]) -> Optional[str]:
        if not summary:
            return None
        return " ".join(summary.strip().split())[:700]

    @classmethod
    def _clean_subthemes(cls, theme_label: str, value: Any) -> List[ThemePayload]:
        if not isinstance(value, list):
            return []

        allowed_subthemes = ALLOWED_SUBTHEME_SETS.get(theme_label, set())
        subthemes: List[ThemePayload] = []
        seen_labels: set[str] = set()

        for item in value:
            if len(subthemes) >= 3:
                break
            if not isinstance(item, dict):
                continue

            label = item.get("label")
            if label not in allowed_subthemes or label in seen_labels:
                continue

            confidence = cls._to_confidence(item.get("confidence"))
            if confidence is None or confidence < MIN_THEME_CONFIDENCE:
                continue

            seen_labels.add(label)
            subthemes.append({
                "label": label,
                "confidence": confidence,
                "evidence": cls._clean_evidence(item.get("evidence")),
            })

        subthemes.sort(key=lambda item: (-float(item.get("confidence", 0)), item.get("label", "")))
        return subthemes

    @staticmethod
    def _normalize_theme_weights(themes: List[ThemePayload]) -> List[ThemePayload]:
        if not themes:
            return []

        total = sum(float(theme.get("weight") or 0) for theme in themes)

        if total <= 0:
            equal_weight = round(1.0 / len(themes), 4)
            for theme in themes:
                theme["weight"] = equal_weight
            return themes

        normalized: List[ThemePayload] = []
        for theme in themes:
            weight = float(theme.get("weight") or 0) / total
            if weight < MIN_THEME_WEIGHT:
                continue
            next_theme = dict(theme)
            next_theme["weight"] = round(weight, 4)
            normalized.append(next_theme)

        second_total = sum(float(theme.get("weight") or 0) for theme in normalized)
        if normalized and second_total > 0:
            delta = round(1.0 - second_total, 4)
            normalized[0]["weight"] = round(float(normalized[0]["weight"]) + delta, 4)

        return normalized

    @staticmethod
    def _to_confidence(value: Any) -> Optional[float]:
        try:
            confidence = float(value)
        except (TypeError, ValueError):
            return None

        if confidence < 0 or confidence > 1:
            return None

        return round(confidence, 2)

    @staticmethod
    def _to_weight(value: Any) -> Optional[float]:
        try:
            weight = float(value)
        except (TypeError, ValueError):
            return None

        if weight < 0 or weight > 1:
            return None

        return round(weight, 4)

    @staticmethod
    def _clean_evidence(value: Any) -> List[str]:
        if not isinstance(value, list):
            return []

        evidence: List[str] = []
        seen: set[str] = set()
        for item in value:
            if len(evidence) >= 3:
                break
            if not isinstance(item, str):
                continue

            cleaned = " ".join(item.strip().split())
            if not cleaned:
                continue

            normalized = cleaned.casefold()
            if normalized in seen:
                continue

            seen.add(normalized)
            evidence.append(cleaned[:160])

        return evidence
