import json
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import Mock

from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError

from app.models import AssetThemeClassification
from app.services.asset_themes import (
    ALLOWED_THEME_HIERARCHY,
    AssetThemeService,
    GEMINI_THEME_MODEL,
    MAX_SUMMARY_CHARS,
    MAX_SUMMARY_SENTENCES,
)


def test_refresh_gemini_classification_recovers_from_duplicate_insert(
    monkeypatch,
):
    asset = SimpleNamespace(
        id=41,
        symbol="PLTR",
        name="Palantir Technologies",
        sector="Technology",
        industry="Software",
    )

    existing = AssetThemeClassification(
        asset_id=asset.id,
        themes=[],
        method="gpt",
        model=GEMINI_THEME_MODEL,
        source_hash="stale-hash",
        generated_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db = Mock()
    db.commit.side_effect = [
        IntegrityError("INSERT", {}, Exception("duplicate key")),
        None,
    ]

    service = AssetThemeService(db)
    get_classification = Mock(side_effect=[None, existing])
    monkeypatch.setattr(service, "get_classification", get_classification)
    monkeypatch.setattr(
        service,
        "generate_theme_payload",
        lambda name, sector, industry, summary: (
            [
                {
                    "label": "AI Infrastructure",
                    "confidence": 0.91,
                    "weight": 1.0,
                    "evidence": ["AI infrastructure"],
                    "tier": "primary",
                    "children": [
                        {
                            "label": "GPU Computing",
                            "confidence": 0.88,
                            "evidence": ["GPUs"],
                        },
                    ],
                }
            ],
            None,
        ),
    )

    classification = service.refresh_gemini_classification(
        asset=asset,
        summary="Updated business summary",
        sector=asset.sector,
        industry=asset.industry,
        name=asset.name,
        force=True,
    )

    assert classification.id == existing.id
    assert classification.asset_id == asset.id
    assert classification.themes[0]["label"] == "AI Infrastructure"
    assert classification.source_hash != "stale-hash"
    assert db.commit.call_count == 2
    db.rollback.assert_called_once()
    db.refresh.assert_called_once_with(existing)
    assert get_classification.call_count == 2


def test_refresh_gemini_classification_uses_postgresql_upsert(
    monkeypatch,
):
    asset = SimpleNamespace(
        id=42,
        symbol="NVDA",
        name="NVIDIA Corporation",
        sector="Technology",
        industry="Semiconductors",
    )
    classification = AssetThemeClassification(
        id=7,
        asset_id=asset.id,
        themes=[],
        method="gpt",
        model=GEMINI_THEME_MODEL,
        source_hash="old-hash",
        generated_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db = Mock()
    db.bind.dialect.name = "postgresql"
    db.execute.return_value.scalar_one_or_none.return_value = classification.id
    db.query.return_value.filter.return_value.first.return_value = classification

    service = AssetThemeService(db)
    monkeypatch.setattr(service, "get_classification", Mock(return_value=None))
    monkeypatch.setattr(
        service,
        "generate_theme_payload",
        lambda name, sector, industry, summary: (
            [
                {
                    "label": "AI Infrastructure",
                    "confidence": 0.95,
                    "weight": 1.0,
                    "evidence": ["accelerated computing"],
                    "tier": "primary",
                    "children": [
                        {
                            "label": "Accelerated Computing",
                            "confidence": 0.92,
                            "evidence": ["accelerated computing platforms"],
                        },
                    ],
                }
            ],
            None,
        ),
    )

    result = service.refresh_gemini_classification(
        asset=asset,
        summary="Designs GPUs and accelerated computing platforms",
        sector=asset.sector,
        industry=asset.industry,
        name=asset.name,
        force=False,
    )

    statement = db.execute.call_args.args[0]
    compiled = str(statement.compile(dialect=postgresql.dialect()))

    assert result is classification
    assert "ON CONFLICT" in compiled
    assert "asset_id" in compiled
    assert "DO UPDATE" in compiled
    db.add.assert_not_called()
    db.commit.assert_called_once()


def test_validate_and_flatten_builds_precise_two_level_hierarchy():
    payload = {
        "primaryThemes": [
            {
                "label": "AI Infrastructure",
                "confidence": 0.95,
                "weight": 0.7,
                "evidence": ["accelerated computing", "data center"],
                "subthemes": [
                    {"label": "GPU Computing", "confidence": 0.92, "evidence": ["GPUs"]},
                    {
                        "label": "Accelerated Computing",
                        "confidence": 0.88,
                        "evidence": ["accelerated computing"],
                    },
                    {
                        "label": "Performance Vehicles",
                        "confidence": 0.99,
                        "evidence": ["performance"],
                    },
                    {"label": "AI Servers", "confidence": 0.2, "evidence": ["servers"]},
                ],
            },
            {
                "label": "Technology",
                "confidence": 0.99,
                "weight": 0.9,
                "evidence": ["technology"],
                "subthemes": [],
            },
        ],
        "secondaryThemes": [
            {
                "label": "Space Infrastructure",
                "confidence": 0.87,
                "weight": 0.3,
                "evidence": ["launch services"],
                "subthemes": [
                    {
                        "label": "Launch Services",
                        "confidence": 0.8,
                        "evidence": ["launch"],
                    },
                    {
                        "label": "Satellites",
                        "confidence": 0.78,
                        "evidence": ["satellites"],
                    },
                ],
            },
        ],
    }

    themes = AssetThemeService._validate_and_flatten(payload)

    assert themes == [
        {
            "label": "AI Infrastructure",
            "confidence": 0.95,
            "weight": 0.7,
            "evidence": ["accelerated computing", "data center"],
            "tier": "primary",
            "children": [
                {"label": "GPU Computing", "confidence": 0.92, "evidence": ["GPUs"]},
                {
                    "label": "Accelerated Computing",
                    "confidence": 0.88,
                    "evidence": ["accelerated computing"],
                },
            ],
        },
        {
            "label": "Space Infrastructure",
            "confidence": 0.87,
            "weight": 0.3,
            "evidence": ["launch services"],
            "tier": "secondary",
            "children": [
                {"label": "Launch Services", "confidence": 0.8, "evidence": ["launch"]},
                {"label": "Satellites", "confidence": 0.78, "evidence": ["satellites"]},
            ],
        },
    ]


def test_render_taxonomy_for_prompt_uses_compact_json():
    taxonomy = AssetThemeService._render_taxonomy_for_prompt()
    parsed = json.loads(taxonomy)

    assert parsed["AI Infrastructure"] == list(ALLOWED_THEME_HIERARCHY["AI Infrastructure"])
    assert "\n" not in taxonomy
    assert ": " not in taxonomy


def test_trim_summary_for_prompt_limits_sentences_and_skips_long_brand_lists():
    brand_list = ", ".join(f"Brand {index}" for index in range(12))
    summary = (
        "The company develops water treatment systems for utilities. "
        f"The company sells products under the {brand_list} brands. "
        "It provides pumping systems and smart water networks. "
        + " ".join(f"Additional operating detail {index}." for index in range(20))
    )

    trimmed = AssetThemeService._trim_summary_for_prompt(summary)

    assert len(trimmed) <= MAX_SUMMARY_CHARS
    assert len(AssetThemeService._split_summary_sentences(trimmed)) <= MAX_SUMMARY_SENTENCES
    assert "water treatment systems" in trimmed
    assert "smart water networks" in trimmed
    assert "Brand 11" not in trimmed


def test_build_prompt_metrics_report_prompt_components():
    summary = " ".join(f"Sentence {index}." for index in range(20))

    prompt, metrics = AssetThemeService._build_prompt_with_metrics(
        name="Xylem",
        sector="Industrials",
        industry="Specialty Industrial Machinery",
        summary=summary,
    )

    assert metrics["summary_chars_original"] == len(summary)
    assert metrics["summary_chars_used"] <= MAX_SUMMARY_CHARS
    assert metrics["taxonomy_chars"] == len(AssetThemeService._render_taxonomy_for_prompt())
    assert metrics["prompt_chars"] == len(prompt)
    assert metrics["instruction_chars"] == (
        len(prompt) - metrics["summary_chars_used"] - metrics["taxonomy_chars"]
    )
