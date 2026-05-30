"""Asset theme classification service backed by LLM."""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Asset, AssetThemeClassification
from app.services.gemini import GeminiService
from app.services.cache import CacheService

logger = logging.getLogger(__name__)

ThemePayload = Dict[str, Any]

GEMINI_THEME_MODEL = "gemini-2.5-flash-lite"
GEMINI_THEME_TAXONOMY_VERSION = "hierarchical-weighted-evidence-v4"
MIN_THEME_CONFIDENCE = 0.55
MIN_THEME_WEIGHT = 0.05
GEMINI_THEME_METHOD = "gpt"

ALLOWED_THEME_HIERARCHY: Dict[str, tuple[str, ...]] = {
    "AI Infrastructure": ("GPU Computing", "Accelerated Computing", "AI Servers", "AI Networking", "Edge AI"),
    "AI Applications": ("Generative AI", "AI Agents", "AI Software", "Enterprise AI", "Sovereign AI"),
    "Data Center Infrastructure": ("Colocation", "Hyperscale Data Centers", "Data Center Power", "Data Center Cooling"),
    "Networking Infrastructure": ("Ethernet Switching", "Optical Networking", "Routing", "Network Equipment"),
    "Semiconductor Value Chain": ("Chip Design", "Semiconductor Equipment", "Foundry Ecosystem", "Advanced Packaging", "Memory & Storage"),
    "Photonics & Optical Computing": ("Optical Interconnects", "Silicon Photonics", "Optical Transceivers", "Co-Packaged Optics"),
    "Quantum Technology": ("Quantum Computing", "Quantum Networking", "Quantum Security"),
    "Cybersecurity Platforms": ("Identity Security", "Zero Trust", "Threat Intelligence", "Network Security", "Cloud Security", "Security Operations"),
    "Cloud Platforms": ("Cloud Infrastructure", "Hyperscale Cloud", "Developer Platforms", "Observability", "Database Platforms"),
    "Enterprise SaaS": ("CRM Software", "ERP Software", "Workflow Automation", "Digital Transformation", "Customer Experience Software", "Productivity Software"),
    "Data Analytics Platforms": ("Business Intelligence", "Data Warehousing", "Data Engineering", "Real-Time Analytics"),
    "Robotics & Automation": ("Humanoid Robotics", "Industrial Robotics", "Warehouse Automation", "Machine Vision", "Industrial Automation", "Sensors & LiDAR"),
    "Electric Mobility": ("Electric Vehicles", "Charging Infrastructure", "Powertrains", "Fleet Electrification"),
    "Autonomous Mobility": ("Autonomous Vehicles", "Robotaxis", "Driver Assistance", "Mobility Platforms"),
    "Battery Value Chain": ("Battery Technology", "Battery Storage", "Lithium Batteries", "Battery Materials", "Battery Recycling"),
    "Defense Tech": ("Military AI", "ISR & Surveillance", "Drones / UAV", "Electronic Warfare", "Missile Defense", "Secure Communications"),
    "Space Infrastructure": ("Launch Services", "Satellites", "Space Communications", "Earth Observation", "Space Systems"),
    "Nuclear Energy": ("Nuclear", "SMR", "Uranium", "Nuclear Services"),
    "Grid Modernization": ("Grid Infrastructure", "Power Generation", "Transmission Equipment", "Power Electronics", "Smart Grid"),
    "Renewable Power": ("Solar", "Wind", "Renewable Developers", "Renewable Equipment"),
    "Clean Fuels": ("Hydrogen", "Renewable Natural Gas", "Sustainable Aviation Fuel", "Biofuels"),
    "Carbon Management": ("Carbon Capture", "Carbon Markets", "Emissions Monitoring"),
    "Energy Transport": ("Oil & Gas", "LNG", "Pipelines", "Refining", "Energy Services"),
    "Digital Finance": ("Fintech", "Digital Banking", "Payments", "Lending Platforms"),
    "Asset & Wealth Platforms": ("Asset Management", "Capital Markets", "Wealth Technology", "Exchange Operators"),
    "Crypto Infrastructure": ("Digital Assets", "Crypto Exchanges", "Blockchain Infrastructure", "Bitcoin Mining"),
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
    "Water Infrastructure": ("Water Treatment", "Smart Water Networks", "Water Utilities", "Pumping Systems", "Desalination"),
    "Environmental Services": ("Waste Management", "Hazardous Waste", "Industrial Cleanup", "Recycling", "Environmental Remediation"),
    "Critical Minerals": ("Rare Earths", "Lithium", "Nickel", "Graphite", "Mineral Processing"),
    "Copper Electrification": ("Copper", "Copper Mining", "Electrical Wiring", "Power Cables"),
    "Precious Metals": ("Gold", "Silver", "Royalty & Streaming", "Mining Services"),
    "Telecom Infrastructure": ("Telecommunications", "5G Infrastructure", "Fiber Networks", "Tower Infrastructure", "Broadband Networks"),
    "Data Center Real Estate": ("Data Center REITs", "Colocation", "Hyperscale Leasing"),
    "Real Estate Income": ("Industrial REITs", "Residential REITs", "Healthcare REITs", "Net Lease", "Self Storage"),
    "AdTech": ("Mobile Advertising", "Programmatic Advertising", "Performance Marketing"),
    "Sports Betting": ("Online Sportsbooks", "iGaming", "Fantasy Sports"),
    "EdTech": ("Online Learning", "Professional Training", "Educational Software"),
    "GovTech": ("Government Software", "Public Sector IT", "Defense Software"),
    "Marine Recreation": ("Boat Retail", "Yacht Retail", "Yacht Services", "Boat Financing"),
    "Restaurant Franchises": ("Quick Service Restaurants", "Restaurant Franchising"),
    "Beverage Brands": ("Soft Drinks", "Alcoholic Beverages"),
    "Pet Care": ("Pet Food", "Veterinary Services"),
    "Food & Beverage": ("Packaged Foods","Plant-Based Foods","Alternative Proteins","Meat Alternatives","Foodservice","Food Delivery"),
    "Household & Personal Care": ("Home Care","Fabric Care","Personal Care","Beauty & Grooming","Baby & Family Care",    "Oral Care","Paper Products"),
    "Consumer Health": ("OTC Health Products","Vitamins & Supplements","Digestive Health","Respiratory Health","Sleep & Relaxation","Sexual Wellness"),
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
    },
    "required": ["primaryThemes", "secondaryThemes"],
}


class AssetThemeService:
    """Generate, validate, and persist reusable asset theme classifications."""

    def __init__(self, db: Session, gemini_service: Optional[GeminiService] = None):
        self.db = db
        self.gemini_service = gemini_service or GeminiService(model=GEMINI_THEME_MODEL)

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
        if existing and not force:
            if existing.method == "manual":
                return existing
            if (
                existing.source_hash == source_hash
                and existing.method in {"gpt", "llm"}
                and existing.model == GEMINI_THEME_MODEL
            ):
                return existing

        themes: List[ThemePayload] = []
        if summary and summary.strip():
            themes = self.generate_themes(
                name=name or asset.name or asset.symbol,
                sector=sector or asset.sector,
                industry=industry or asset.industry,
                summary=summary,
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
            existing.model = GEMINI_THEME_MODEL
            existing.source_hash = source_hash
            existing.generated_at = now
            existing.updated_at = now
            classification = existing
        else:
            classification = AssetThemeClassification(
                asset_id=asset.id,
                themes=themes,
                method=GEMINI_THEME_METHOD,
                model=GEMINI_THEME_MODEL,
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
            classification.model = GEMINI_THEME_MODEL
            classification.source_hash = source_hash
            classification.generated_at = now
            classification.updated_at = now
            self.db.commit()

        self.db.refresh(classification)
        self._invalidate_theme_dependent_caches()
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
            "model": GEMINI_THEME_MODEL,
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
        prompt = self._build_prompt(
            name=name,
            sector=sector,
            industry=industry,
            summary=summary,
        )
        raw_response = self.gemini_service.generate_json(prompt, GEMINI_RESPONSE_SCHEMA)
        payload = self._parse_json_response(raw_response)
        return self._validate_and_flatten(payload)

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

    @staticmethod
    def _build_prompt(
        name: Optional[str],
        sector: Optional[str],
        industry: Optional[str],
        summary: str,
    ) -> str:
        allowed_themes = "\n".join(
            f"- {theme}: {', '.join(subthemes)}"
            for theme, subthemes in ALLOWED_THEME_HIERARCHY.items()
        )

        return f"""You classify listed companies into investment themes.

Input:
company name: {name or ""}
sector: {sector or ""}
industry: {industry or ""}
longBusinessSummary: {summary}

Allowed hierarchy:
{allowed_themes}

Instruction:
Choose ONLY from the allowed hierarchy above.

Return:
* max 3 primary themes
* max 5 secondary themes
* max 3 subthemes per theme

Definitions:
* Theme = high-level investable exposure for portfolio allocation and dashboard aggregation.
* Subtheme = precise business specialization for asset research and detailed exposure analysis.
* Primary themes = core business activities, main revenue drivers, or main strategic focus.
* Secondary themes = meaningful top-level exposure, but not the main business.
* Theme weight = estimated share of the company's real economic exposure.
* All selected theme weights combined must sum to exactly 1.00.
* Primary themes usually receive 0.40 to 0.90 weight.
* Secondary themes usually receive 0.05 to 0.40 weight.
* If a theme would receive less than {MIN_THEME_WEIGHT}, omit it.

Business Relevance Rules:
* Identify the company's real economic exposures, not every activity mentioned.
* Select themes based on core business activities, operating segments, revenue drivers, or strategic focus.
* Ignore financing, leasing, insurance, payment processing, support services, minor software tools, ancillary cloud services, distribution agreements, partnerships, customer examples, marketing initiatives, temporary projects, and small business units unless they are a major business segment.
* Do NOT select a theme simply because a related keyword appears.
* Prefer precise investable exposures over broad sectors.
* Pick subthemes only from the selected theme's allowed subtheme list.
* If uncertain, return fewer themes.

Examples:
* Deere: Precision Agriculture and Construction & Industrial Equipment are valid. Digital Finance is usually invalid because financing supports equipment sales.
* MarineMax: Marine Recreation is valid. Luxury Automobiles is invalid because yachts are not automobiles.
* Xylem: Water Infrastructure is valid. Data Analytics Platforms is usually invalid because analytics supports water operations.
* Rocket Lab: Space Infrastructure is valid. Cloud Platforms is invalid unless cloud services are a real sold product.

Rules:
* do not invent themes or subthemes
* do not use generic sector labels such as Technology, Software, Industrials, Energy, Consumer Brands, or Infrastructure
* do not return explanations
* do not return markdown
* only valid JSON
* confidence between 0 and 1
* weight between 0 and 1
* all theme weights must sum to 1.00
* evidence must be short exact phrases from longBusinessSummary that justify the selected theme or subtheme
* evidence must come from the input description; do not paraphrase or invent evidence
* do not include themes or subthemes with confidence below {MIN_THEME_CONFIDENCE}
* do not add a third hierarchy level

Expected JSON:
{{
  "primaryThemes": [
    {{
      "label": "AI Infrastructure",
      "confidence": 0.95,
      "weight": 0.65,
      "evidence": ["accelerated computing", "data center"],
      "subthemes": [
        {{
          "label": "GPU Computing",
          "confidence": 0.92,
          "evidence": ["graphics processing units"]
        }},
        {{
          "label": "Accelerated Computing",
          "confidence": 0.88,
          "evidence": ["accelerated computing"]
        }}
      ]
    }}
  ],
  "secondaryThemes": [
    {{
      "label": "Data Center Infrastructure",
      "confidence": 0.87,
      "weight": 0.35,
      "evidence": ["data center"],
      "subthemes": [
        {{
          "label": "Hyperscale Data Centers",
          "confidence": 0.84,
          "evidence": ["hyperscale data centers"]
        }}
      ]
    }}
  ]
}}"""

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
