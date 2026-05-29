"""Asset theme classification service backed by Gemini."""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Asset, AssetThemeClassification
from app.services.gemini import GeminiService

logger = logging.getLogger(__name__)

ThemePayload = Dict[str, Any]

GEMINI_THEME_MODEL = "gemini-2.5-flash-lite"

ALLOWED_THEMES: tuple[str, ...] = (
    # AI & Compute
    "AI Infrastructure",
    "Generative AI",
    "AI Agents",
    "AI Software",
    "Sovereign AI",
    "Data Centers",
    "Accelerated Computing",
    "GPU Computing",
    "Edge Computing",

    # Semis
    "Chip Design",
    "Semiconductor Equipment",
    "Foundry Ecosystem",
    "Advanced Packaging",
    "Memory & Storage",
    "Photonics",
    "Optical Interconnects",

    # Quantum
    "Quantum Computing",
    "Quantum Networking",
    "Quantum Security",

    # Cybersecurity
    "Cybersecurity",
    "Identity Security",
    "Zero Trust",
    "Observability",
    "Threat Intelligence",

    # Cloud & Software
    "Cloud Infrastructure",
    "Enterprise SaaS",
    "Developer Platforms",
    "Data Analytics",
    "Digital Transformation",

    # Robotics & Automation
    "Humanoid Robotics",
    "Industrial Robotics",
    "Warehouse Automation",
    "Machine Vision",
    "Industrial Automation",
    "Sensors & LiDAR",

    # Mobility
    "Autonomous Vehicles",
    "Electric Vehicles",
    "Battery Technology",
    "Charging Infrastructure",
    "Mobility Platforms",

    # Defense
    "Defense Tech",
    "Military AI",
    "ISR & Surveillance",
    "Drones / UAV",
    "Electronic Warfare",

    # Space
    "Launch Services",
    "Satellites",
    "Space Infrastructure",
    "Space Communications",

    # Energy
    "Nuclear",
    "SMR",
    "Uranium",
    "Grid Infrastructure",
    "Power Generation",
    "Battery Storage",
    "Solar",
    "Wind",
    "Hydrogen",
    "Carbon Capture",
    "Oil & Gas",
    "LNG",

    # Finance
    "Fintech",
    "Digital Banking",
    "Payments",
    "Asset Management",
    "Capital Markets",
    "Crypto Infrastructure",
    "Digital Assets",

    # Healthcare
    "Drug Discovery",
    "Biologics",
    "Gene Therapy",
    "Precision Medicine",
    "Diagnostics",
    "Medical Devices",
    "Healthcare Services",

    # Consumer
    "Gaming",
    "E-commerce",
    "Digital Advertising",
    "Streaming",
    "Social Media",
    "Consumer Brands",
    "Luxury",
    "Travel & Leisure",

    # Industrial
    "Logistics",
    "Supply Chain",
    "Construction Technology",
    "Infrastructure",
    "Industrial Machinery",

    # Materials
    "Rare Earths",
    "Critical Minerals",
    "Lithium",
    "Copper",
    "Gold",
    "Silver",

    # Telecom
    "Telecommunications",
    "5G Infrastructure",
    "Fiber Networks",

    # Real Estate
    "Data Center REITs",
    "Industrial REITs",
    "Residential REITs",
    "Healthcare REITs",
)

ALLOWED_THEME_SET = set(ALLOWED_THEMES)

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
                },
                "required": ["label", "confidence"],
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
                },
                "required": ["label", "confidence"],
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
                and existing.method == "gpt"
                and existing.model == GEMINI_THEME_MODEL
            ):
                return existing

        themes = []
        if summary and summary.strip():
            themes = self.generate_themes(
                name=name or asset.name or asset.symbol,
                sector=sector or asset.sector,
                industry=industry or asset.industry,
                summary=summary,
            )

        now = datetime.utcnow()
        if existing:
            existing.themes = themes
            existing.method = "gpt"
            existing.model = GEMINI_THEME_MODEL
            existing.source_hash = source_hash
            existing.generated_at = now
            existing.updated_at = now
            classification = existing
        else:
            classification = AssetThemeClassification(
                asset_id=asset.id,
                themes=themes,
                method="gpt",
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
            classification.method = "gpt"
            classification.model = GEMINI_THEME_MODEL
            classification.source_hash = source_hash
            classification.generated_at = now
            classification.updated_at = now
            self.db.commit()

        self.db.refresh(classification)
        return classification

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
        allowed_themes = "\n".join(f"- {theme}" for theme in ALLOWED_THEMES)
        return f"""Input:
company name: {name or ""}
sector: {sector or ""}
industry: {industry or ""}
longBusinessSummary: {summary}

Allowed themes:
{allowed_themes}

Instruction:
Choose ONLY from the allowed themes above.

Return:
* max 3 primary themes
* max 5 secondary themes

Rules:
* do not invent themes
* do not return explanations
* do not return markdown
* only valid JSON
* confidence between 0 and 1
* prefer business core activities, not secondary activities
* themes must represent major revenue drivers or strategic focus

Expected JSON:
{{
  "primaryThemes": [
    {{
      "label": "AI Infrastructure",
      "confidence": 0.95
    }}
  ],
  "secondaryThemes": [
    {{
      "label": "Data Centers",
      "confidence": 0.87
    }}
  ]
}}"""

    @staticmethod
    def _parse_json_response(raw_response: str) -> Dict[str, Any]:
        text = raw_response.strip()
        if text.startswith("```"):
            text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
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

            for item in raw_items[:max_items]:
                if not isinstance(item, dict):
                    continue

                label = item.get("label")
                if label not in ALLOWED_THEME_SET or label in seen_labels:
                    continue

                confidence = cls._to_confidence(item.get("confidence"))
                if confidence is None:
                    continue

                seen_labels.add(label)
                themes.append({
                    "label": label,
                    "confidence": confidence,
                    "evidence": [],
                    "tier": tier,
                })

        return themes

    @staticmethod
    def _to_confidence(value: Any) -> Optional[float]:
        try:
            confidence = float(value)
        except (TypeError, ValueError):
            return None

        if confidence < 0 or confidence > 1:
            return None
        return round(confidence, 2)
