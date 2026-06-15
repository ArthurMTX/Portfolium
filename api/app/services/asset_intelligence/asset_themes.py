"""Asset theme classification service."""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass, field
import hashlib
import json
import logging
import re
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Protocol

from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Asset, AssetThemeClassification, AssetThemeTaxonomySuggestion
from app.services.platform.cache import CacheService

logger = logging.getLogger(__name__)

ThemePayload = Dict[str, Any]

GEMINI_THEME_TAXONOMY_VERSION = "hierarchical-weighted-evidence-v8"
GEMINI_THEME_MODEL = settings.GEMINI_MODEL
MINILM_THEME_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
MIN_THEME_CONFIDENCE = 0.55
MIN_THEME_WEIGHT = 0.05
MIN_MISSING_SUBTHEME_SUGGESTION_CONFIDENCE = 0.75
GEMINI_THEME_METHOD = "gpt"
AUTOMATIC_THEME_METHOD = "gpt"
THEME_SOURCE_MINILM = "minilm"
THEME_SOURCE_GEMINI = "gemini"
THEME_SOURCE_MANUAL = "manual"
THEME_ELIGIBLE_ASSET_TYPES = {"EQUITY", "STOCK"}
THEME_ELIGIBLE_ASSET_CLASSES = {"stock"}
MAX_SUMMARY_CHARS = 2500
MAX_SUMMARY_SENTENCES = 10

_SUMMARY_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")


def _estimated_token_count(text_or_chars: Any) -> int:
    chars = len(text_or_chars) if isinstance(text_or_chars, str) else int(text_or_chars or 0)
    return max(1, (chars + 3) // 4) if chars else 0


@dataclass
class ClassificationTimingEvent:
    label: str
    duration_seconds: float
    status: str = "success"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GeminiTimingCall:
    pass_label: str
    attempt: int
    model: Optional[str]
    prompt_chars: int
    prompt_tokens_estimate: int
    response_chars: int
    duration_seconds: float
    status: str
    error: Optional[str] = None


class ClassificationTimingReport:
    """Collect high precision timings for one asset theme classification."""

    def __init__(self, *, symbol: Optional[str], source: Optional[str], model: Optional[str]) -> None:
        self.symbol = symbol
        self.source = source
        self.model = model
        self.started_at = time.perf_counter()
        self.events: List[ClassificationTimingEvent] = []
        self.gemini_calls: List[GeminiTimingCall] = []
        self.prompt_metrics: List[Dict[str, Any]] = []

    @contextmanager
    def time_block(
        self,
        label: str,
        *,
        metadata: Optional[Dict[str, Any]] = None,
        status: str = "success",
    ):
        started_at = time.perf_counter()
        event_status = status
        try:
            yield
        except Exception:
            event_status = "failed"
            raise
        finally:
            self.add_event(
                label,
                time.perf_counter() - started_at,
                status=event_status,
                metadata=metadata,
            )

    def add_event(
        self,
        label: str,
        duration_seconds: float,
        *,
        status: str = "success",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.events.append(
            ClassificationTimingEvent(
                label=label,
                duration_seconds=duration_seconds,
                status=status,
                metadata=metadata or {},
            )
        )

    def add_gemini_call(
        self,
        *,
        pass_label: str,
        attempt: int,
        model: Optional[str],
        prompt_chars: int,
        response_chars: int,
        duration_seconds: float,
        status: str,
        error: Optional[str] = None,
    ) -> None:
        self.gemini_calls.append(
            GeminiTimingCall(
                pass_label=pass_label,
                attempt=attempt,
                model=model,
                prompt_chars=prompt_chars,
                prompt_tokens_estimate=_estimated_token_count(prompt_chars),
                response_chars=response_chars,
                duration_seconds=duration_seconds,
                status=status,
                error=error,
            )
        )

    def add_prompt_metrics(self, pass_label: str, metrics: Dict[str, int]) -> None:
        sections = {
            key: value
            for key, value in metrics.items()
            if key.endswith("_chars") and key != "prompt_chars"
        }
        self.prompt_metrics.append({
            "pass_label": pass_label,
            "prompt_chars": metrics.get("prompt_chars", 0),
            "prompt_tokens_estimate": _estimated_token_count(metrics.get("prompt_chars", 0)),
            "sections": sections,
        })

    @property
    def total_seconds(self) -> float:
        return time.perf_counter() - self.started_at

    def print_report(self) -> None:
        total = self.total_seconds
        print("", flush=True)
        print("Classification timing", flush=True)
        if self.symbol:
            print(f"Asset.......................{self.symbol}", flush=True)
        if self.source:
            print(f"Classifier source..........{self.source}", flush=True)
        if self.model:
            print(f"Model.......................{self.model}", flush=True)

        for event in self.events:
            suffix = f" {event.status}" if event.status != "success" else ""
            print(f"{event.label[:27]:.<27}{event.duration_seconds:>7.2f}s{suffix}", flush=True)

        print(f"{'TOTAL':.<27}{total:>7.2f}s", flush=True)
        print("", flush=True)
        print(f"Gemini calls: {len(self.gemini_calls)}", flush=True)
        for call in self.gemini_calls:
            error = f" error={call.error[:120]}" if call.error else ""
            print(
                f"{call.pass_label} attempt {call.attempt}: "
                f"{call.duration_seconds:.2f}s {call.status} "
                f"model={call.model} prompt={call.prompt_chars} chars "
                f"(~{call.prompt_tokens_estimate} tokens) response={call.response_chars} chars"
                f"{error}",
                flush=True,
            )

        if self.prompt_metrics:
            print("", flush=True)
            print("Prompt analysis", flush=True)
            for prompt in self.prompt_metrics:
                print(
                    f"{prompt['pass_label']}: {prompt['prompt_chars']} chars "
                    f"(~{prompt['prompt_tokens_estimate']} tokens)",
                    flush=True,
                )
                largest_sections = sorted(
                    prompt["sections"].items(),
                    key=lambda item: item[1],
                    reverse=True,
                )[:4]
                for name, chars in largest_sections:
                    print(
                        f"  {name}: {chars} chars (~{_estimated_token_count(chars)} tokens)",
                        flush=True,
                    )

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


@dataclass(frozen=True)
class AssetThemeClassifierResult:
    """Normalized classifier result plus provider metadata."""

    themes: List[ThemePayload]
    taxonomy_gap: Optional[Dict[str, Any]] = None
    unavailable_reason: Optional[str] = None


class AssetThemeClassifier(Protocol):
    """Common interface for asset theme classifiers."""

    source: str
    model_name: Optional[str]

    def classify_asset(
        self,
        *,
        name: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        summary: Optional[str],
    ) -> AssetThemeClassifierResult:
        ...


class MiniLMAssetThemeClassifier:
    """Production wrapper for the local MiniLM theme classifier."""

    source = THEME_SOURCE_MINILM
    model_name = MINILM_THEME_MODEL

    def __init__(self, classifier: Optional[Any] = None) -> None:
        self._classifier = classifier

    def classify_asset(
        self,
        *,
        name: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        summary: Optional[str],
    ) -> AssetThemeClassifierResult:
        if not summary or not summary.strip():
            return AssetThemeClassifierResult(themes=[])

        try:
            classifier_started_at = time.perf_counter()
            classifier = self._get_classifier()
            classifier_init_seconds = time.perf_counter() - classifier_started_at
            timing_report = getattr(self, "_asset_theme_timing", None)
            if timing_report is not None and hasattr(timing_report, "add_event"):
                timing_report.add_event(
                    "MiniLM initialization",
                    classifier_init_seconds,
                    metadata={"cached": self._classifier is classifier},
                )
            raw_themes = classifier.classify_asset(
                name=name,
                sector=sector,
                industry=industry,
                summary=summary,
            )
            if timing_report is not None and hasattr(timing_report, "add_event"):
                timing_report.add_event(
                    "MiniLM model load",
                    (getattr(classifier, "model_load_ms", 0.0) or 0.0) / 1000,
                    metadata={
                        "embedding_document_count": getattr(
                            classifier,
                            "embedding_document_count",
                            None,
                        ),
                    },
                )
        except Exception as exc:
            logger.warning(
                "MiniLM theme classification unavailable: %s. Set THEME_MINILM_MODEL_PATH "
                "to a local ONNX export directory or enable THEME_MINILM_AUTO_DOWNLOAD=true.",
                exc,
            )
            return AssetThemeClassifierResult(
                themes=[],
                unavailable_reason="classification unavailable",
            )

        return AssetThemeClassifierResult(
            themes=_normalize_classifier_theme_payload(raw_themes),
        )

    def _get_classifier(self) -> Any:
        if self._classifier is None:
            from app.services.asset_intelligence.asset_theme_minilm import AssetThemeMiniLMClassifier

            self._classifier = AssetThemeMiniLMClassifier()
        return self._classifier


class GeminiAssetThemeClassifier:
    """Production wrapper for Gemini theme classification."""

    source = THEME_SOURCE_GEMINI

    def __init__(
        self,
        generate_theme_payload: Callable[
            [Optional[str], Optional[str], Optional[str], str],
            tuple[List[ThemePayload], Optional[Dict[str, Any]]],
        ],
        gemini_service: Optional[Any] = None,
    ) -> None:
        if gemini_service is None:
            from app.services.asset_intelligence.gemini import GeminiService

            gemini_service = GeminiService()
        self.gemini_service = gemini_service
        self.model_name = getattr(gemini_service, "model", settings.GEMINI_MODEL)
        self._generate_theme_payload = generate_theme_payload

    def classify_asset(
        self,
        *,
        name: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        summary: Optional[str],
    ) -> AssetThemeClassifierResult:
        if not summary or not summary.strip():
            return AssetThemeClassifierResult(themes=[])

        api_key = getattr(self.gemini_service, "api_key", None)
        if api_key is not None and not api_key:
            logger.warning(
                "Asset theme classification unavailable: ASSET_THEME_CLASSIFIER_MODE=gemini "
                "but GEMINI_API_KEY is not configured."
            )
            return AssetThemeClassifierResult(
                themes=[],
                unavailable_reason="classification unavailable",
            )

        themes, taxonomy_gap = self._generate_theme_payload(
            name,
            sector,
            industry,
            summary,
        )
        return AssetThemeClassifierResult(
            themes=_normalize_classifier_theme_payload(themes),
            taxonomy_gap=taxonomy_gap,
        )


def _normalize_classifier_theme_payload(themes: List[ThemePayload]) -> List[ThemePayload]:
    """Return the provider-neutral theme payload persisted by the service."""

    normalized: List[ThemePayload] = []
    for index, raw_theme in enumerate(themes or []):
        if not isinstance(raw_theme, dict):
            continue

        label = raw_theme.get("label") or raw_theme.get("theme")
        if not isinstance(label, str) or not label.strip():
            continue

        confidence = AssetThemeService._to_confidence(raw_theme.get("confidence"))
        if confidence is None:
            confidence = 0.0

        weight = AssetThemeService._to_weight(raw_theme.get("weight"))
        if weight is None:
            weight = 0.0

        tier = raw_theme.get("tier")
        if tier not in {"primary", "secondary"}:
            tier = "primary" if index < 3 else "secondary"

        children = []
        for child in raw_theme.get("children") or raw_theme.get("subthemes") or []:
            if not isinstance(child, dict):
                continue
            child_label = child.get("label")
            if not isinstance(child_label, str) or not child_label.strip():
                continue
            child_confidence = AssetThemeService._to_confidence(child.get("confidence"))
            children.append({
                "label": child_label.strip(),
                "confidence": child_confidence if child_confidence is not None else 0.0,
                "evidence": AssetThemeService._clean_evidence(child.get("evidence")),
            })

        normalized.append({
            "label": label.strip(),
            "confidence": confidence,
            "weight": weight,
            "evidence": AssetThemeService._clean_evidence(raw_theme.get("evidence")),
            "tier": tier,
            "children": children,
            "needs_review": bool(raw_theme.get("needs_review", False)),
            "review_reasons": [
                str(reason)
                for reason in raw_theme.get("review_reasons", [])
                if isinstance(reason, str) and reason.strip()
            ],
        })

    return AssetThemeService._normalize_theme_weights(normalized)


class AssetThemeService:
    """Generate, validate, and persist reusable asset theme classifications."""

    @classmethod
    def is_theme_supported_asset(cls, asset: Asset) -> bool:
        """Theme classification is only supported for equity-like assets."""
        asset_type = str(getattr(asset, "asset_type", "") or "").strip().upper()
        if asset_type:
            return asset_type in THEME_ELIGIBLE_ASSET_TYPES

        asset_class = getattr(asset, "class_", None)
        if asset_class is not None:
            asset_class_value = getattr(asset_class, "value", asset_class)
            return str(asset_class_value).strip().lower() in THEME_ELIGIBLE_ASSET_CLASSES

        # Older tests and lightweight call sites may omit both fields while still
        # representing stocks. Real non-equity assets should carry one of them.
        return True

    @staticmethod
    def empty_classification_for_asset(asset: Asset) -> AssetThemeClassification:
        return AssetThemeClassification(
            asset_id=asset.id,
            themes=[],
            method=AUTOMATIC_THEME_METHOD,
            model=None,
            source=None,
            model_name=None,
            source_hash=None,
            generated_at=None,
            updated_at=None,
        )

    def __init__(
        self,
        db: Session,
        gemini_service: Optional[Any] = None,
        classifier: Optional[AssetThemeClassifier] = None,
    ):
        self.db = db
        self._current_timing_report: Optional[ClassificationTimingReport] = None
        self._pending_timing_events: List[ClassificationTimingEvent] = []
        self.last_taxonomy_gap: Optional[Dict[str, Any]] = None
        self.last_subtheme_taxonomy_gaps: List[Dict[str, Any]] = []
        self.last_taxonomy_gap_persisted: bool = False
        self.last_classification_unavailable_reason: Optional[str] = None
        self._classification_symbol: Optional[str] = None
        self._classifier_injected = classifier is not None
        self._fetch_reclassification_attempted_asset_ids: set[int] = set()
        self.gemini_service: Optional[Any] = None
        self.gemini_model: Optional[str] = None
        classifier_started_at = time.perf_counter()
        self.classifier = classifier or self._build_classifier(gemini_service=gemini_service)
        classifier_duration = time.perf_counter() - classifier_started_at
        if isinstance(self.classifier, GeminiAssetThemeClassifier):
            self.gemini_service = self.classifier.gemini_service
            self.gemini_model = self.classifier.model_name
            self._pending_timing_events.append(
                ClassificationTimingEvent(
                    label="Gemini client",
                    duration_seconds=classifier_duration,
                    metadata={
                        "model": self.gemini_model,
                        "injected": gemini_service is not None or classifier is not None,
                    },
                )
            )
        elif isinstance(self.classifier, MiniLMAssetThemeClassifier):
            self._pending_timing_events.append(
                ClassificationTimingEvent(
                    label="MiniLM wrapper init",
                    duration_seconds=classifier_duration,
                    metadata={"injected": classifier is not None},
                )
            )

    def record_external_timing(
        self,
        label: str,
        duration_seconds: float,
        *,
        status: str = "success",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self._pending_timing_events.append(
            ClassificationTimingEvent(
                label=label,
                duration_seconds=duration_seconds,
                status=status,
                metadata=metadata or {},
            )
        )

    def _start_timing_report(
        self,
        *,
        symbol: Optional[str],
        source: Optional[str],
        model: Optional[str],
    ) -> ClassificationTimingReport:
        report = ClassificationTimingReport(symbol=symbol, source=source, model=model)
        for event in self._pending_timing_events:
            report.add_event(
                event.label,
                event.duration_seconds,
                status=event.status,
                metadata=event.metadata,
            )
        self._pending_timing_events = []
        return report

    @contextmanager
    def _time_block(
        self,
        label: str,
        *,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        if not self._current_timing_report:
            yield
            return
        with self._current_timing_report.time_block(label, metadata=metadata):
            yield

    def _record_timing_event(
        self,
        label: str,
        duration_seconds: float,
        *,
        status: str = "success",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        if self._current_timing_report:
            self._current_timing_report.add_event(
                label,
                duration_seconds,
                status=status,
                metadata=metadata,
            )
        else:
            self.record_external_timing(
                label,
                duration_seconds,
                status=status,
                metadata=metadata,
            )

    def _build_classifier(self, gemini_service: Optional[Any] = None) -> AssetThemeClassifier:
        if gemini_service is not None:
            return GeminiAssetThemeClassifier(
                generate_theme_payload=self.generate_theme_payload,
                gemini_service=gemini_service,
            )

        mode = settings.ASSET_THEME_CLASSIFIER_MODE
        if mode == THEME_SOURCE_GEMINI:
            return GeminiAssetThemeClassifier(generate_theme_payload=self.generate_theme_payload)
        return MiniLMAssetThemeClassifier()

    def _ensure_gemini_service(self) -> None:
        if self.gemini_service is not None:
            self._record_timing_event(
                "Gemini client",
                0.0,
                status="cached",
                metadata={"model": self.gemini_model},
            )
            return
        from app.services.asset_intelligence.gemini import GeminiService

        started_at = time.perf_counter()
        self.gemini_service = GeminiService()
        self.gemini_model = self.gemini_service.model
        self._record_timing_event(
            "Gemini client",
            time.perf_counter() - started_at,
            metadata={"model": self.gemini_model},
        )

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

    def get_classification_for_fetch(
        self,
        asset: Asset,
        *,
        summary: Optional[str] = None,
        sector: Optional[str] = None,
        industry: Optional[str] = None,
        name: Optional[str] = None,
        company_info_loader: Optional[Callable[[], Dict[str, Any]]] = None,
    ) -> Optional[AssetThemeClassification]:
        """Return stored classification, refreshing once when its provider is stale."""
        if not self.is_theme_supported_asset(asset):
            return self.empty_classification_for_asset(asset)

        with self._time_block("DB lookup existing"):
            existing = self.get_classification(asset.id)
        if not existing:
            return None

        current_mode = self.current_classifier_mode()
        provider_stale = self.is_provider_stale(existing, current_mode=current_mode)
        if not provider_stale:
            self._annotate_fetch_metadata(
                existing,
                current_mode=current_mode,
                provider_stale=False,
                reclassified_on_fetch=False,
            )
            return existing

        if asset.id in self._fetch_reclassification_attempted_asset_ids:
            self._annotate_fetch_metadata(
                existing,
                current_mode=current_mode,
                provider_stale=True,
                reclassified_on_fetch=False,
                unavailable_reason="reclassification_already_attempted",
            )
            return existing
        self._fetch_reclassification_attempted_asset_ids.add(asset.id)

        unavailable_reason = self._configured_provider_unavailable_reason(current_mode)
        if unavailable_reason:
            self._annotate_fetch_metadata(
                existing,
                current_mode=current_mode,
                provider_stale=True,
                reclassified_on_fetch=False,
                unavailable_reason=unavailable_reason,
            )
            return existing

        if (not summary or not summary.strip()) and company_info_loader is not None:
            started_at = time.perf_counter()
            status = "success"
            try:
                company_info = company_info_loader() or {}
            except Exception:
                status = "failed"
                raise
            finally:
                self.record_external_timing(
                    "Yahoo metadata",
                    time.perf_counter() - started_at,
                    status=status,
                    metadata={"symbol": getattr(asset, "symbol", None)},
                )
            summary = company_info.get("longBusinessSummary") or company_info.get("description")
            sector = company_info.get("sector") or sector
            industry = company_info.get("industry") or industry
            name = company_info.get("longName") or company_info.get("shortName") or name

        if not summary or not summary.strip():
            self._annotate_fetch_metadata(
                existing,
                current_mode=current_mode,
                provider_stale=True,
                reclassified_on_fetch=False,
                unavailable_reason="missing_summary",
            )
            return existing

        try:
            self._ensure_classifier_matches_mode(current_mode)
            classification = self.refresh_classification(
                asset=asset,
                summary=summary,
                sector=sector or asset.sector,
                industry=industry or asset.industry,
                name=name or asset.name,
                force=True,
            )
        except Exception as exc:
            self.db.rollback()
            logger.warning(
                "Asset theme reclassification on fetch failed asset_id=%s symbol=%s current_mode=%s: %s",
                asset.id,
                asset.symbol,
                current_mode,
                exc,
            )
            preserved = self.get_classification(asset.id) or existing
            self._annotate_fetch_metadata(
                preserved,
                current_mode=current_mode,
                provider_stale=True,
                reclassified_on_fetch=False,
                error=str(exc),
            )
            return preserved

        if (
            self.last_classification_unavailable_reason
            and self.is_provider_stale(classification, current_mode=current_mode)
        ):
            self._annotate_fetch_metadata(
                classification,
                current_mode=current_mode,
                provider_stale=True,
                reclassified_on_fetch=False,
                unavailable_reason=self.last_classification_unavailable_reason,
            )
            return classification

        self._annotate_fetch_metadata(
            classification,
            current_mode=current_mode,
            provider_stale=self.is_provider_stale(classification, current_mode=current_mode),
            reclassified_on_fetch=True,
        )
        return classification

    def refresh_classification(
        self,
        asset: Asset,
        summary: Optional[str],
        sector: Optional[str] = None,
        industry: Optional[str] = None,
        name: Optional[str] = None,
        force: bool = False,
    ) -> AssetThemeClassification:
        provider = self.classifier
        timing_report = self._start_timing_report(
            symbol=getattr(asset, "symbol", None),
            source=getattr(provider, "source", None),
            model=getattr(provider, "model_name", None),
        )
        previous_timing_report = self._current_timing_report
        self._current_timing_report = timing_report

        provider_timing_target = getattr(provider, "__dict__", None)
        previous_provider_timing = None
        if provider_timing_target is not None:
            previous_provider_timing = provider_timing_target.get("_asset_theme_timing")
            provider_timing_target["_asset_theme_timing"] = timing_report

        try:
            return self._refresh_classification_impl(
                asset=asset,
                summary=summary,
                sector=sector,
                industry=industry,
                name=name,
                force=force,
            )
        finally:
            if provider_timing_target is not None:
                if previous_provider_timing is None:
                    provider_timing_target.pop("_asset_theme_timing", None)
                else:
                    provider_timing_target["_asset_theme_timing"] = previous_provider_timing
            timing_report.print_report()
            self._current_timing_report = previous_timing_report

    def _refresh_classification_impl(
        self,
        asset: Asset,
        summary: Optional[str],
        sector: Optional[str] = None,
        industry: Optional[str] = None,
        name: Optional[str] = None,
        force: bool = False,
    ) -> AssetThemeClassification:
        if not self.is_theme_supported_asset(asset):
            self.last_taxonomy_gap = None
            self.last_subtheme_taxonomy_gaps = []
            self.last_taxonomy_gap_persisted = False
            self.last_classification_unavailable_reason = "non_equity_asset"
            logger.info(
                "Asset theme classification skipped asset_id=%s symbol=%s reason=non_equity asset_type=%s class=%s",
                getattr(asset, "id", None),
                getattr(asset, "symbol", None),
                getattr(asset, "asset_type", None),
                getattr(asset, "class_", None),
            )
            return self.empty_classification_for_asset(asset)

        provider = self.classifier
        provider_source = provider.source
        provider_model_name = provider.model_name
        with self._time_block("Load asset metadata"):
            asset_id = asset.id
            asset_symbol = asset.symbol
            asset_sector = asset.sector
            asset_industry = asset.industry
            asset_name = asset.name
            resolved_sector = sector or asset_sector
            resolved_industry = industry or asset_industry
            resolved_name = name or asset_name

        with self._time_block("Source hash"):
            source_hash = self.build_source_hash(
                summary=summary,
                sector=resolved_sector,
                industry=resolved_industry,
                name=resolved_name,
            )

        with self._time_block("DB lookup existing"):
            existing = self.get_classification(asset_id)
        logger.info(
            "Asset theme classification requested asset_id=%s symbol=%s force=%s source=%s model=%s source_hash=%s existing=%s",
            asset_id,
            asset_symbol,
            force,
            provider_source,
            provider_model_name,
            source_hash[:12],
            bool(existing),
        )
        if existing and not force:
            existing_source = self.classification_source(existing)
            if existing_source == THEME_SOURCE_MANUAL:
                logger.info(
                    "Asset theme classification skipped asset_id=%s symbol=%s reason=manual",
                    asset_id,
                    asset_symbol,
                )
                return existing

            if existing.themes and existing_source and existing_source != provider_source:
                logger.info(
                    "Asset theme classification skipped asset_id=%s symbol=%s reason=existing_provider source=%s requested_source=%s",
                    asset_id,
                    asset_symbol,
                    existing_source,
                    provider_source,
                )
                return existing

            if (
                existing.source_hash == source_hash
                and existing_source == provider_source
                and self.classification_model_name(existing) == provider_model_name
            ):
                logger.info(
                    "Asset theme classification skipped asset_id=%s symbol=%s reason=cache_hit generated_at=%s",
                    asset_id,
                    asset_symbol,
                    existing.generated_at,
                )
                return existing

        themes: List[ThemePayload] = []
        taxonomy_gap: Optional[Dict[str, Any]] = None
        self.last_taxonomy_gap = None
        self.last_subtheme_taxonomy_gaps = []
        self.last_taxonomy_gap_persisted = False
        self.last_classification_unavailable_reason = None
        if summary and summary.strip():
            logger.info(
                "Asset theme classification starting asset_id=%s symbol=%s source=%s name=%s sector=%s industry=%s summary_chars=%s",
                asset_id,
                asset_symbol,
                provider_source,
                resolved_name or asset_symbol,
                resolved_sector,
                resolved_industry,
                len(summary),
            )
            previous_symbol = self._classification_symbol
            self._classification_symbol = asset_symbol
            try:
                with self._time_block("Classifier execution"):
                    result = provider.classify_asset(
                        name=resolved_name or asset_symbol,
                        sector=resolved_sector,
                        industry=resolved_industry,
                        summary=summary,
                    )
            finally:
                self._classification_symbol = previous_symbol
            if result.unavailable_reason:
                self.last_classification_unavailable_reason = result.unavailable_reason
                logger.warning(
                    "Asset theme classification unavailable asset_id=%s symbol=%s source=%s reason=%s",
                    asset_id,
                    asset_symbol,
                    provider_source,
                    result.unavailable_reason,
                )
                if existing and existing.themes:
                    logger.info(
                        "Asset theme classification using existing stored result asset_id=%s symbol=%s",
                        asset_id,
                        asset_symbol,
                    )
                    return existing
                return self._empty_classification(
                    asset_id=asset_id,
                    source=provider_source,
                    model_name=provider_model_name,
                )
            themes = result.themes
            taxonomy_gap = result.taxonomy_gap
            self.last_taxonomy_gap = taxonomy_gap
            logger.info(
                "Asset theme classification completed asset_id=%s symbol=%s source=%s theme_count=%s themes=%s",
                asset_id,
                asset_symbol,
                provider_source,
                len(themes),
                [theme.get("label") for theme in themes],
            )
            with self._time_block("Taxonomy gap persistence"):
                self._persist_taxonomy_gap_suggestion(
                    asset=asset,
                    summary_hash=source_hash,
                    taxonomy_gap=taxonomy_gap,
                    summary=summary,
                    sector=resolved_sector,
                    industry=resolved_industry,
                    company_name=resolved_name or asset_symbol,
                    themes=themes,
                )
            for subtheme_gap in self.last_subtheme_taxonomy_gaps:
                with self._time_block("Subtheme gap persistence"):
                    self._persist_taxonomy_gap_suggestion(
                        asset=asset,
                        summary_hash=source_hash,
                        taxonomy_gap=subtheme_gap,
                        summary=summary,
                        sector=resolved_sector,
                        industry=resolved_industry,
                        company_name=resolved_name or asset_symbol,
                        themes=themes,
                    )
        else:
            logger.info(
                "Asset theme classification skipped asset_id=%s symbol=%s source=%s reason=missing_summary",
                asset_id,
                asset_symbol,
                provider_source,
            )

        now = datetime.utcnow()
        if self.db.bind and self.db.bind.dialect.name == "postgresql":
            with self._time_block("DB save"):
                classification = self._upsert_postgresql_classification(
                    asset_id=asset_id,
                    themes=themes,
                    method=AUTOMATIC_THEME_METHOD,
                    model=provider_model_name,
                    source=provider_source,
                    model_name=provider_model_name,
                    source_hash=source_hash,
                    generated_at=now,
                    force=force,
                )
            self._invalidate_theme_dependent_caches_timed()
            return classification

        if existing:
            existing.themes = themes
            existing.method = AUTOMATIC_THEME_METHOD
            existing.model = provider_model_name
            existing.source = provider_source
            existing.model_name = provider_model_name
            existing.source_hash = source_hash
            existing.generated_at = now
            existing.updated_at = now
            classification = existing
        else:
            classification = AssetThemeClassification(
                asset_id=asset_id,
                themes=themes,
                method=AUTOMATIC_THEME_METHOD,
                model=provider_model_name,
                source=provider_source,
                model_name=provider_model_name,
                source_hash=source_hash,
                generated_at=now,
                updated_at=now,
            )
            with self._time_block("DB add classification"):
                self.db.add(classification)

        try:
            with self._time_block("DB commit"):
                self.db.commit()
        except IntegrityError:
            with self._time_block("DB rollback duplicate"):
                self.db.rollback()
            with self._time_block("DB duplicate lookup"):
                classification = self.get_classification(asset_id)
            if not classification:
                raise

            classification.themes = themes
            classification.method = AUTOMATIC_THEME_METHOD
            classification.model = provider_model_name
            classification.source = provider_source
            classification.model_name = provider_model_name
            classification.source_hash = source_hash
            classification.generated_at = now
            classification.updated_at = now
            with self._time_block("DB duplicate update commit"):
                self.db.commit()

        with self._time_block("DB refresh classification"):
            self.db.refresh(classification)
        self._invalidate_theme_dependent_caches_timed()
        logger.info(
            "Asset theme classification persisted asset_id=%s symbol=%s classification_id=%s theme_count=%s",
            asset_id,
            asset_symbol,
            classification.id,
            len(themes),
        )
        return classification

    def refresh_gemini_classification(
        self,
        asset: Asset,
        summary: Optional[str],
        sector: Optional[str] = None,
        industry: Optional[str] = None,
        name: Optional[str] = None,
        force: bool = False,
    ) -> AssetThemeClassification:
        previous_classifier = self.classifier
        previous_gemini_service = self.gemini_service
        previous_gemini_model = self.gemini_model
        classifier_started_at = time.perf_counter()
        self.classifier = GeminiAssetThemeClassifier(
            generate_theme_payload=self.generate_theme_payload,
            gemini_service=previous_gemini_service,
        )
        self.gemini_service = self.classifier.gemini_service
        self.gemini_model = self.classifier.model_name
        self.record_external_timing(
            "Gemini client",
            time.perf_counter() - classifier_started_at,
            metadata={
                "model": self.gemini_model,
                "injected": previous_gemini_service is not None,
            },
        )
        try:
            return self.refresh_classification(
                asset=asset,
                summary=summary,
                sector=sector,
                industry=industry,
                name=name,
                force=force,
            )
        finally:
            self.classifier = previous_classifier
            self.gemini_service = previous_gemini_service
            self.gemini_model = previous_gemini_model

    def _upsert_postgresql_classification(
        self,
        asset_id: int,
        themes: List[ThemePayload],
        method: str,
        model: Optional[str],
        source: str,
        model_name: Optional[str],
        source_hash: str,
        generated_at: datetime,
        force: bool,
    ) -> AssetThemeClassification:
        values = {
            "asset_id": asset_id,
            "themes": themes,
            "method": method,
            "model": model,
            "source": source,
            "model_name": model_name,
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
                "source": statement.excluded.source,
                "model_name": statement.excluded.model_name,
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
            with self._time_block("DB upsert execute"):
                classification_id = self.db.execute(update_statement).scalar_one_or_none()
            with self._time_block("DB upsert commit"):
                self.db.commit()
        except Exception:
            with self._time_block("DB upsert rollback"):
                self.db.rollback()
            raise

        if classification_id is not None:
            with self._time_block("DB fetch saved row"):
                classification = (
                    self.db.query(AssetThemeClassification)
                    .filter(AssetThemeClassification.id == classification_id)
                    .first()
                )
        else:
            with self._time_block("DB fetch existing row"):
                classification = self.get_classification(asset_id)

        if not classification:
            raise RuntimeError(f"Failed to persist theme classification for asset {asset_id}")

        with self._time_block("DB refresh classification"):
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
    def classification_source(classification: AssetThemeClassification) -> Optional[str]:
        source = getattr(classification, "source", None)
        if source in {THEME_SOURCE_MINILM, THEME_SOURCE_GEMINI, THEME_SOURCE_MANUAL}:
            return source

        method = getattr(classification, "method", None)
        if method == "manual":
            return THEME_SOURCE_MANUAL
        if method in {"gpt", "llm"}:
            return THEME_SOURCE_GEMINI
        return None

    @staticmethod
    def classification_model_name(classification: AssetThemeClassification) -> Optional[str]:
        return getattr(classification, "model_name", None) or getattr(classification, "model", None)

    @staticmethod
    def current_classifier_mode() -> str:
        mode = (getattr(settings, "ASSET_THEME_CLASSIFIER_MODE", None) or THEME_SOURCE_MINILM)
        mode = str(mode).strip().lower()
        if mode not in {THEME_SOURCE_MINILM, THEME_SOURCE_GEMINI}:
            return THEME_SOURCE_MINILM
        return mode

    @classmethod
    def is_provider_stale(
        cls,
        classification: AssetThemeClassification,
        *,
        current_mode: Optional[str] = None,
    ) -> bool:
        source = cls.classification_source(classification)
        if source == THEME_SOURCE_MANUAL:
            return False
        if source not in {THEME_SOURCE_MINILM, THEME_SOURCE_GEMINI}:
            return False
        return source != (current_mode or cls.current_classifier_mode())

    def _ensure_classifier_matches_mode(self, current_mode: str) -> None:
        if self._classifier_injected:
            return
        if getattr(self.classifier, "source", None) == current_mode:
            return
        started_at = time.perf_counter()
        self.classifier = self._build_classifier()
        duration_seconds = time.perf_counter() - started_at
        if isinstance(self.classifier, GeminiAssetThemeClassifier):
            self.gemini_service = self.classifier.gemini_service
            self.gemini_model = self.classifier.model_name
            self.record_external_timing(
                "Gemini client",
                duration_seconds,
                metadata={"model": self.gemini_model},
            )
        else:
            self.gemini_service = None
            self.gemini_model = None
            self.record_external_timing("MiniLM wrapper init", duration_seconds)

    @staticmethod
    def _configured_provider_unavailable_reason(current_mode: str) -> Optional[str]:
        gemini_api_key = str(settings.GEMINI_API_KEY or "").strip()
        if current_mode == THEME_SOURCE_GEMINI and not gemini_api_key:
            return "gemini_api_key_missing"
        return None

    @staticmethod
    def _annotate_fetch_metadata(
        classification: AssetThemeClassification,
        *,
        current_mode: str,
        provider_stale: bool,
        reclassified_on_fetch: bool,
        unavailable_reason: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        setattr(classification, "current_classifier_mode", current_mode)
        setattr(classification, "provider_stale", provider_stale)
        setattr(classification, "reclassified_on_fetch", reclassified_on_fetch)
        setattr(classification, "classification_unavailable_reason", unavailable_reason)
        setattr(classification, "reclassification_error", error)

    @staticmethod
    def _empty_classification(
        asset_id: int,
        source: str,
        model_name: Optional[str],
    ) -> AssetThemeClassification:
        return AssetThemeClassification(
            asset_id=asset_id,
            themes=[],
            method=AUTOMATIC_THEME_METHOD,
            model=model_name,
            source=source,
            model_name=model_name,
            source_hash=None,
            generated_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

    @staticmethod
    def _invalidate_theme_dependent_caches() -> None:
        cache = CacheService()
        cache.delete_pattern("assets_held:*")
        cache.delete_pattern("assets_sold:*")
        cache.delete_pattern("positions:*")
        cache.delete_pattern("dashboard_batch:*")

    def _invalidate_theme_dependent_caches_timed(self) -> None:
        cache = CacheService()
        for pattern in (
            "assets_held:*",
            "assets_sold:*",
            "positions:*",
            "dashboard_batch:*",
        ):
            with self._time_block(
                "Cache invalidation",
                metadata={"pattern": pattern},
            ):
                cache.delete_pattern(pattern)

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
        self._ensure_gemini_service()
        if self._classification_strategy() == "two_pass":
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
        with self._time_block("Prompt generation"):
            prompt, prompt_metrics = self._build_prompt_with_metrics(
                name=name,
                sector=sector,
                industry=industry,
                summary=summary,
            )
        if self._current_timing_report:
            self._current_timing_report.add_prompt_metrics("Gemini One Pass", prompt_metrics)
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
        raw_response = self._generate_gemini_json(
            pass_label="Gemini One Pass",
            prompt=prompt,
            response_schema=GEMINI_RESPONSE_SCHEMA,
        )
        elapsed_ms = round((time.perf_counter() - started_at) * 1000)
        logger.info(
            "Gemini theme request received model=%s symbol=%s company=%s elapsed_ms=%s response_chars=%s",
            self.gemini_service.model,
            self._classification_symbol,
            name,
            elapsed_ms,
            len(raw_response),
        )
        with self._time_block("JSON parsing"):
            payload = self._parse_json_response(raw_response)
        with self._time_block("Validation"):
            themes = self._validate_and_flatten(payload)
            taxonomy_gap = self._clean_taxonomy_gap(payload.get("taxonomyGap"))
            themes = self._mark_parent_only_review(themes, taxonomy_gap=taxonomy_gap)
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
        with self._time_block("Prompt generation Pass 1"):
            pass1_prompt, pass1_metrics = self._build_parent_theme_prompt_with_metrics(
                name=name,
                sector=sector,
                industry=industry,
                summary=summary,
            )
        if self._current_timing_report:
            self._current_timing_report.add_prompt_metrics("Gemini Pass 1", pass1_metrics)
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
        pass1_response = self._generate_gemini_json(
            pass_label="Gemini Pass 1",
            prompt=pass1_prompt,
            response_schema=GEMINI_PARENT_THEME_RESPONSE_SCHEMA,
        )
        pass1_duration_ms = round((time.perf_counter() - pass1_started_at) * 1000)
        with self._time_block("JSON parsing Pass 1"):
            pass1_payload = self._parse_json_response(pass1_response)
        with self._time_block("Validation Pass 1"):
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

        with self._time_block("Prompt generation Pass 2"):
            pass2_prompt, pass2_metrics = self._build_subtheme_prompt_with_metrics(
                name=name,
                sector=sector,
                industry=industry,
                summary=summary,
                parent_themes=parent_themes,
            )
        if self._current_timing_report:
            self._current_timing_report.add_prompt_metrics("Gemini Pass 2", pass2_metrics)
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
            pass2_response = self._generate_gemini_json(
                pass_label="Gemini Pass 2",
                prompt=pass2_prompt,
                response_schema=GEMINI_SUBTHEME_RESPONSE_SCHEMA,
            )
            pass2_duration_ms = round((time.perf_counter() - pass2_started_at) * 1000)
            with self._time_block("JSON parsing Pass 2"):
                pass2_payload = self._parse_json_response(pass2_response)
            with self._time_block("Validation Pass 2"):
                subthemes_by_parent = self._validate_subtheme_payload(
                    pass2_payload,
                    selected_parent_themes,
                )
                if settings.ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED:
                    self.last_subtheme_taxonomy_gaps = self._clean_subtheme_gap_suggestions(
                        pass2_payload,
                        selected_parent_themes,
                    )
                else:
                    self.last_subtheme_taxonomy_gaps = []
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

    def _generate_gemini_json(
        self,
        *,
        pass_label: str,
        prompt: str,
        response_schema: Dict[str, Any],
    ) -> str:
        if self.gemini_service is None:
            raise RuntimeError("Gemini service is not initialized")

        previous_timing = getattr(self.gemini_service, "_asset_theme_timing", None)
        previous_call_context = getattr(
            self.gemini_service,
            "_asset_theme_call_context",
            None,
        )
        try:
            setattr(self.gemini_service, "_asset_theme_timing", self._current_timing_report)
            setattr(
                self.gemini_service,
                "_asset_theme_call_context",
                {
                    "pass_label": pass_label,
                    "prompt_chars": len(prompt),
                },
            )
            with self._time_block(pass_label):
                return self.gemini_service.generate_json(prompt, response_schema)
        finally:
            if previous_timing is None:
                try:
                    delattr(self.gemini_service, "_asset_theme_timing")
                except AttributeError:
                    pass
            else:
                setattr(self.gemini_service, "_asset_theme_timing", previous_timing)
            if previous_call_context is None:
                try:
                    delattr(self.gemini_service, "_asset_theme_call_context")
                except AttributeError:
                    pass
            else:
                setattr(
                    self.gemini_service,
                    "_asset_theme_call_context",
                    previous_call_context,
                )

    @staticmethod
    def _classification_strategy() -> str:
        strategy = str(getattr(settings, "ASSET_THEME_GEMINI_STRATEGY", "one_pass") or "one_pass")
        strategy = strategy.strip().lower()
        return "two_pass" if strategy == "two_pass" else "one_pass"

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
        taxonomy_gap_subtheme_rule = cls._one_pass_taxonomy_gap_rule_for_prompt()

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
- {taxonomy_gap_subtheme_rule}
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
        taxonomy_gap_subtheme_rule = cls._taxonomy_gap_subtheme_rule_for_prompt()

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
- {taxonomy_gap_subtheme_rule}
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
        subtheme_gap_rule = cls._subtheme_gap_rule_for_prompt()

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
- {subtheme_gap_rule}
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
    def _one_pass_taxonomy_gap_rule_for_prompt() -> str:
        if settings.ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED:
            return (
                "taxonomyGap.suggestedSubthemes may include up to 5 concise suggestions "
                "when a selected existing parent theme fits but none of its allowed subthemes "
                "fit, or when a genuinely missing new parent theme is needed."
            )
        return "Do not suggest new subthemes; taxonomyGap.suggestedSubthemes must always be an empty array."

    @staticmethod
    def _taxonomy_gap_subtheme_rule_for_prompt() -> str:
        if settings.ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED:
            return "taxonomyGap.suggestedSubthemes may include up to 5 concise suggestions for a genuinely missing new parent theme."
        return "Do not suggest new subthemes; taxonomyGap.suggestedSubthemes must always be an empty array."

    @staticmethod
    def _subtheme_gap_rule_for_prompt() -> str:
        if settings.ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED:
            return "When a selected parent has no allowed subtheme fit but the summary clearly implies a missing specialization, add a subthemeGaps item for that parent with 1-5 concise suggestedSubthemes to add."
        return "Do not propose missing subthemes; subthemeGaps must always be an empty array."

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
        if not settings.ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED:
            return []

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
        if not settings.ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED:
            return []

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

    @staticmethod
    def _mark_parent_only_review(
        themes: List[ThemePayload],
        *,
        taxonomy_gap: Optional[Dict[str, Any]],
    ) -> List[ThemePayload]:
        if not themes or (taxonomy_gap and taxonomy_gap.get("hasGap")):
            return themes

        reviewed: List[ThemePayload] = []
        for theme in themes:
            children = theme.get("children") or []
            if children:
                reviewed.append(theme)
                continue

            next_theme = dict(theme)
            next_theme["needs_review"] = True
            review_reasons = [
                reason
                for reason in next_theme.get("review_reasons", [])
                if isinstance(reason, str) and reason.strip()
            ]
            if "no_valid_subthemes" not in review_reasons:
                review_reasons.append("no_valid_subthemes")
            next_theme["review_reasons"] = review_reasons
            reviewed.append(next_theme)

        return reviewed

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
            "suggested_subthemes": (
                taxonomy_gap.get("suggestedSubthemes") or []
                if settings.ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED
                else []
            ),
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

        if (
            not settings.ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED
            and suggested_theme in ALLOWED_THEME_SET
            and taxonomy_gap.get("suggestedSubthemes")
        ):
            return False

        return True

    @classmethod
    def _clean_taxonomy_gap(cls, value: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(value, dict):
            return None

        confidence = cls._to_confidence(value.get("confidence"))
        subthemes = []
        if settings.ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED:
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
        has_gap = bool(value.get("hasGap")) or bool(subthemes)
        return {
            "hasGap": has_gap,
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
