import json
import sys
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import Mock

from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError

from app.models import AssetThemeClassification
from app.services.asset_themes import (
    ALLOWED_THEME_HIERARCHY,
    AssetThemeService,
    AssetThemeClassifierResult,
    GEMINI_PARENT_THEME_RESPONSE_SCHEMA,
    GEMINI_RESPONSE_SCHEMA,
    GEMINI_SUBTHEME_RESPONSE_SCHEMA,
    GeminiAssetThemeClassifier,
    MAX_SUMMARY_CHARS,
    MAX_SUMMARY_SENTENCES,
    MiniLMAssetThemeClassifier,
    settings,
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
        model=settings.GEMINI_MODEL,
        source_hash="stale-hash",
        generated_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db = Mock()
    db.commit.side_effect = [
        IntegrityError("INSERT", {}, Exception("duplicate key")),
        None,
    ]

    service = AssetThemeService(
        db,
        gemini_service=SimpleNamespace(model=settings.GEMINI_MODEL),
    )
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
    assert classification.source == "gemini"
    assert classification.model_name == settings.GEMINI_MODEL
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
        model=settings.GEMINI_MODEL,
        source_hash="old-hash",
        generated_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db = Mock()
    db.bind.dialect.name = "postgresql"
    db.execute.return_value.scalar_one_or_none.return_value = classification.id
    db.query.return_value.filter.return_value.first.return_value = classification

    service = AssetThemeService(
        db,
        gemini_service=SimpleNamespace(model=settings.GEMINI_MODEL),
    )
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
    assert "source" in compiled
    assert "model_name" in compiled
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


class FakeGeminiService:
    model = "gemini-test"

    def __init__(self, responses):
        self.responses = list(responses)
        self.prompts = []
        self.schemas = []

    def generate_json(self, prompt, response_schema):
        self.prompts.append(prompt)
        self.schemas.append(response_schema)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return json.dumps(response)


class FakeClassifier:
    def __init__(
        self,
        source="minilm",
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        themes=None,
        unavailable_reason=None,
    ):
        self.source = source
        self.model_name = model_name
        self.themes = themes or [
            {
                "label": "AI Infrastructure",
                "confidence": 0.9,
                "weight": 1.0,
                "evidence": [],
                "tier": "primary",
                "children": [],
                "needs_review": False,
                "review_reasons": [],
            }
        ]
        self.unavailable_reason = unavailable_reason

    def classify_asset(self, *, name, sector, industry, summary):
        return AssetThemeClassifierResult(
            themes=self.themes,
            unavailable_reason=self.unavailable_reason,
        )


def test_asset_theme_service_defaults_to_minilm_without_importing_gemini(monkeypatch):
    monkeypatch.setattr(settings, "ASSET_THEME_CLASSIFIER_MODE", "minilm")
    sys.modules.pop("app.services.gemini", None)

    service = AssetThemeService(Mock())

    assert isinstance(service.classifier, MiniLMAssetThemeClassifier)
    assert service.gemini_service is None
    assert "app.services.gemini" not in sys.modules


def test_asset_theme_service_uses_gemini_mode(monkeypatch):
    monkeypatch.setattr(settings, "ASSET_THEME_CLASSIFIER_MODE", "gemini")
    monkeypatch.setattr(settings, "GEMINI_MODEL", "gemini-configured")

    service = AssetThemeService(Mock())

    assert isinstance(service.classifier, GeminiAssetThemeClassifier)
    assert service.gemini_service.model == "gemini-configured"
    assert service.gemini_model == "gemini-configured"


def test_minilm_refresh_never_imports_gemini(monkeypatch, test_db, sample_asset):
    monkeypatch.setattr(settings, "ASSET_THEME_CLASSIFIER_MODE", "minilm")
    sys.modules.pop("app.services.gemini", None)
    service = AssetThemeService(test_db, classifier=FakeClassifier(source="minilm"))

    classification = service.refresh_classification(
        asset=sample_asset,
        summary="Builds GPUs for accelerated AI computing.",
        sector=sample_asset.sector,
        industry=sample_asset.industry,
        name=sample_asset.name,
    )

    assert classification.source == "minilm"
    assert classification.model_name == "sentence-transformers/all-MiniLM-L6-v2"
    assert "app.services.gemini" not in sys.modules


def test_gemini_mode_without_api_key_returns_classification_unavailable(
    monkeypatch,
    test_db,
    sample_asset,
):
    monkeypatch.setattr(settings, "ASSET_THEME_CLASSIFIER_MODE", "gemini")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    service = AssetThemeService(test_db)

    classification = service.refresh_classification(
        asset=sample_asset,
        summary="Builds GPUs for accelerated AI computing.",
        sector=sample_asset.sector,
        industry=sample_asset.industry,
        name=sample_asset.name,
    )

    assert classification.id is None
    assert classification.themes == []
    assert classification.source == "gemini"
    assert service.last_classification_unavailable_reason == "classification unavailable"
    assert test_db.query(AssetThemeClassification).count() == 0


def test_minilm_and_gemini_classifiers_return_identical_payload_shape():
    minilm = MiniLMAssetThemeClassifier(
        classifier=SimpleNamespace(
            classify_asset=lambda **_kwargs: [
                {
                    "label": "AI Infrastructure",
                    "confidence": 0.94,
                    "weight": 1.0,
                    "children": [{"label": "GPU Computing", "confidence": 0.9}],
                    "needs_review": False,
                    "review_reasons": [],
                }
            ]
        )
    )
    gemini = GeminiAssetThemeClassifier(
        gemini_service=FakeGeminiService([]),
        generate_theme_payload=lambda name, sector, industry, summary: (
            [
                {
                    "label": "AI Infrastructure",
                    "confidence": 0.94,
                    "weight": 1.0,
                    "evidence": ["GPUs"],
                    "tier": "primary",
                    "children": [
                        {
                            "label": "GPU Computing",
                            "confidence": 0.9,
                            "evidence": ["accelerated computing"],
                        }
                    ],
                }
            ],
            None,
        ),
    )

    minilm_theme = minilm.classify_asset(
        name="NVIDIA",
        sector="Technology",
        industry="Semiconductors",
        summary="GPUs",
    ).themes[0]
    gemini_theme = gemini.classify_asset(
        name="NVIDIA",
        sector="Technology",
        industry="Semiconductors",
        summary="GPUs",
    ).themes[0]

    assert set(minilm_theme) == set(gemini_theme)
    assert set(minilm_theme["children"][0]) == set(gemini_theme["children"][0])


def test_source_and_model_name_are_persisted(test_db, sample_asset):
    service = AssetThemeService(test_db, classifier=FakeClassifier(source="minilm"))

    classification = service.refresh_classification(
        asset=sample_asset,
        summary="Builds GPUs for accelerated AI computing.",
        sector=sample_asset.sector,
        industry=sample_asset.industry,
        name=sample_asset.name,
        force=True,
    )

    assert classification.source == "minilm"
    assert classification.model_name == "sentence-transformers/all-MiniLM-L6-v2"
    assert classification.model == "sentence-transformers/all-MiniLM-L6-v2"


def test_manual_classifications_are_not_overwritten_without_force(test_db, sample_asset):
    manual = AssetThemeClassification(
        asset_id=sample_asset.id,
        themes=[
            {
                "label": "Manual Theme",
                "confidence": 1.0,
                "weight": 1.0,
                "evidence": [],
                "tier": "primary",
                "children": [],
            }
        ],
        method="manual",
        model=None,
        source="manual",
        model_name=None,
        source_hash="manual-hash",
        generated_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    test_db.add(manual)
    test_db.commit()

    service = AssetThemeService(test_db, classifier=FakeClassifier(source="minilm"))
    classification = service.refresh_classification(
        asset=sample_asset,
        summary="Builds GPUs for accelerated AI computing.",
        sector=sample_asset.sector,
        industry=sample_asset.industry,
        name=sample_asset.name,
        force=False,
    )

    assert classification.id == manual.id
    assert classification.source == "manual"
    assert classification.themes[0]["label"] == "Manual Theme"


def test_existing_stored_gemini_classification_is_kept_in_minilm_mode(test_db, sample_asset):
    existing = AssetThemeClassification(
        asset_id=sample_asset.id,
        themes=[
            {
                "label": "AI Infrastructure",
                "confidence": 0.95,
                "weight": 1.0,
                "evidence": ["stored"],
                "tier": "primary",
                "children": [],
            }
        ],
        method="gpt",
        model="gemini-2.5-flash",
        source="gemini",
        model_name="gemini-2.5-flash",
        source_hash="old-hash",
        generated_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    test_db.add(existing)
    test_db.commit()

    service = AssetThemeService(
        test_db,
        classifier=FakeClassifier(
            source="minilm",
            themes=[
                {
                    "label": "Travel & Leisure",
                    "confidence": 0.9,
                    "weight": 1.0,
                    "evidence": [],
                    "tier": "primary",
                    "children": [],
                }
            ],
        ),
    )
    classification = service.refresh_classification(
        asset=sample_asset,
        summary="Builds GPUs for accelerated AI computing.",
        sector=sample_asset.sector,
        industry=sample_asset.industry,
        name=sample_asset.name,
        force=False,
    )

    assert classification.id == existing.id
    assert classification.source == "gemini"
    assert classification.model_name == "gemini-2.5-flash"
    assert classification.themes[0]["label"] == "AI Infrastructure"


def _parent_payload():
    return {
        "primaryThemes": [
            {
                "label": "AI Infrastructure",
                "confidence": 0.91,
                "weight": 0.7,
                "evidence": ["AI infrastructure"],
            }
        ],
        "secondaryThemes": [
            {
                "label": "Space Infrastructure",
                "confidence": 0.82,
                "weight": 0.3,
                "evidence": ["satellite systems"],
            }
        ],
        "taxonomyGap": {"hasGap": False},
    }


def _subtheme_payload():
    return {
        "themes": [
            {
                "label": "AI Infrastructure",
                "subthemes": [
                    {
                        "label": "GPU Computing",
                        "confidence": 0.88,
                        "evidence": ["GPU systems"],
                    }
                ],
            },
            {
                "label": "Space Infrastructure",
                "subthemes": [
                    {
                        "label": "Satellites",
                        "confidence": 0.79,
                        "evidence": ["satellite systems"],
                    }
                ],
            },
            {
                "label": "Mortgage Finance",
                "subthemes": [
                    {
                        "label": "Mortgage Securitization",
                        "confidence": 0.99,
                        "evidence": ["ignored"],
                    }
                ],
            },
        ],
        "subthemeGaps": [],
    }


def test_two_pass_parent_prompt_does_not_include_subthemes():
    prompt, metrics = AssetThemeService._build_parent_theme_prompt_with_metrics(
        name="Example",
        sector="Technology",
        industry="Infrastructure",
        summary="The company builds AI infrastructure and satellite systems.",
    )

    assert "AI Infrastructure" in prompt
    assert "Space Infrastructure" in prompt
    assert "GPU Computing" not in prompt
    assert "Mortgage Securitization" not in prompt
    assert "Allowed parent theme labels JSON" in prompt
    assert metrics["parent_theme_chars"] == len(
        AssetThemeService._render_parent_theme_labels_for_prompt()
    )


def test_two_pass_subtheme_prompt_includes_only_selected_themes_and_subthemes():
    parent_themes = AssetThemeService._validate_parent_themes(_parent_payload(), max_total=5)

    prompt, metrics = AssetThemeService._build_subtheme_prompt_with_metrics(
        name="Example",
        sector="Technology",
        industry="Infrastructure",
        summary="The company builds GPU systems and satellite systems.",
        parent_themes=parent_themes,
    )

    assert "AI Infrastructure" in prompt
    assert "GPU Computing" in prompt
    assert "Space Infrastructure" in prompt
    assert "Satellites" in prompt
    assert "Mortgage Finance" not in prompt
    assert "Mortgage Securitization" not in prompt
    assert metrics["selected_hierarchy_chars"] == len(
        AssetThemeService._render_selected_hierarchy_for_prompt(parent_themes)
    )


def test_two_pass_merge_preserves_parent_fields_and_adds_children():
    parent_themes = AssetThemeService._validate_parent_themes(_parent_payload(), max_total=5)
    subthemes_by_parent = AssetThemeService._validate_subtheme_payload(
        _subtheme_payload(),
        ["AI Infrastructure", "Space Infrastructure"],
    )

    merged = AssetThemeService._merge_parent_themes_with_subthemes(
        parent_themes,
        subthemes_by_parent,
    )

    assert merged[0]["label"] == "AI Infrastructure"
    assert merged[0]["tier"] == "primary"
    assert merged[0]["weight"] == 0.7
    assert merged[0]["confidence"] == 0.91
    assert merged[0]["evidence"] == ["AI infrastructure"]
    assert merged[0]["children"] == [
        {"label": "GPU Computing", "confidence": 0.88, "evidence": ["GPU systems"]}
    ]
    assert merged[1]["label"] == "Space Infrastructure"
    assert merged[1]["children"] == [
        {"label": "Satellites", "confidence": 0.79, "evidence": ["satellite systems"]}
    ]


def test_two_pass_failure_returns_parent_themes_without_children(monkeypatch):
    monkeypatch.setattr(settings, "ASSET_THEME_TWO_PASS_CLASSIFICATION", True)
    gemini = FakeGeminiService([_parent_payload(), RuntimeError("pass2 failed")])
    service = AssetThemeService(Mock(), gemini_service=gemini)

    themes, taxonomy_gap = service.generate_theme_payload(
        name="Example",
        sector="Technology",
        industry="Infrastructure",
        summary="The company builds AI infrastructure and satellite systems.",
    )

    assert taxonomy_gap == {
        "hasGap": False,
        "reason": "",
        "suggestedTheme": "",
        "suggestedSubthemes": [],
        "confidence": None,
    }
    assert [theme["label"] for theme in themes] == ["AI Infrastructure", "Space Infrastructure"]
    assert all(theme["children"] == [] for theme in themes)
    assert gemini.schemas == [GEMINI_PARENT_THEME_RESPONSE_SCHEMA, GEMINI_SUBTHEME_RESPONSE_SCHEMA]


def test_two_pass_taxonomy_gap_comes_from_pass1(monkeypatch):
    monkeypatch.setattr(settings, "ASSET_THEME_TWO_PASS_CLASSIFICATION", True)
    pass1_payload = {
        "primaryThemes": [],
        "secondaryThemes": [],
        "taxonomyGap": {
            "hasGap": True,
            "reason": "No parent label covers orbital debris removal.",
            "suggestedTheme": "Orbital Services",
            "suggestedSubthemes": ["Debris Removal"],
            "confidence": 0.81,
        },
    }
    gemini = FakeGeminiService([pass1_payload])
    service = AssetThemeService(Mock(), gemini_service=gemini)

    themes, taxonomy_gap = service.generate_theme_payload(
        name="Example",
        sector="Industrials",
        industry="Aerospace",
        summary="The company provides orbital debris removal services.",
    )

    assert themes == []
    assert taxonomy_gap == {
        "hasGap": True,
        "reason": "No parent label covers orbital debris removal.",
        "suggestedTheme": "Orbital Services",
        "suggestedSubthemes": [],
        "confidence": 0.81,
    }
    assert len(gemini.prompts) == 1


def test_feature_flag_selects_one_pass_or_two_pass(monkeypatch):
    one_pass_payload = {
        "primaryThemes": [
            {
                "label": "AI Infrastructure",
                "confidence": 0.91,
                "weight": 1.0,
                "evidence": ["AI infrastructure"],
                "subthemes": [
                    {
                        "label": "GPU Computing",
                        "confidence": 0.88,
                        "evidence": ["GPU systems"],
                    }
                ],
            }
        ],
        "secondaryThemes": [],
        "taxonomyGap": {"hasGap": False},
    }

    monkeypatch.setattr(settings, "ASSET_THEME_TWO_PASS_CLASSIFICATION", False)
    one_pass_gemini = FakeGeminiService([one_pass_payload])
    one_pass_service = AssetThemeService(Mock(), gemini_service=one_pass_gemini)
    one_pass_themes, _gap = one_pass_service.generate_theme_payload(
        name="Example",
        sector="Technology",
        industry="Infrastructure",
        summary="The company builds AI infrastructure and GPU systems.",
    )

    assert one_pass_gemini.schemas == [GEMINI_RESPONSE_SCHEMA]
    assert one_pass_themes[0]["children"][0]["label"] == "GPU Computing"

    monkeypatch.setattr(settings, "ASSET_THEME_TWO_PASS_CLASSIFICATION", True)
    two_pass_gemini = FakeGeminiService([_parent_payload(), _subtheme_payload()])
    two_pass_service = AssetThemeService(Mock(), gemini_service=two_pass_gemini)
    two_pass_themes, _gap = two_pass_service.generate_theme_payload(
        name="Example",
        sector="Technology",
        industry="Infrastructure",
        summary="The company builds AI infrastructure, GPU systems, and satellite systems.",
    )

    assert two_pass_gemini.schemas == [
        GEMINI_PARENT_THEME_RESPONSE_SCHEMA,
        GEMINI_SUBTHEME_RESPONSE_SCHEMA,
    ]
    assert [theme["label"] for theme in two_pass_themes] == [
        "AI Infrastructure",
        "Space Infrastructure",
    ]
    assert two_pass_themes[0]["children"][0]["label"] == "GPU Computing"


def test_two_pass_output_shape_remains_frontend_and_allocation_compatible(monkeypatch):
    monkeypatch.setattr(settings, "ASSET_THEME_TWO_PASS_CLASSIFICATION", True)
    gemini = FakeGeminiService([_parent_payload(), _subtheme_payload()])
    service = AssetThemeService(Mock(), gemini_service=gemini)

    themes, _taxonomy_gap = service.generate_theme_payload(
        name="Example",
        sector="Technology",
        industry="Infrastructure",
        summary="The company builds AI infrastructure, GPU systems, and satellite systems.",
    )

    assert themes
    for theme in themes:
        assert set(theme) == {"label", "confidence", "weight", "evidence", "tier", "children"}
        assert isinstance(theme["children"], list)
        for child in theme["children"]:
            assert set(child) == {"label", "confidence", "evidence"}


def test_two_pass_collects_gemini_subtheme_gap_suggestions(monkeypatch):
    monkeypatch.setattr(settings, "ASSET_THEME_TWO_PASS_CLASSIFICATION", True)
    monkeypatch.setattr(settings, "ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED", True)
    pass1_payload = {
        "primaryThemes": [
            {
                "label": "Specialty Chemicals",
                "confidence": 0.9,
                "weight": 1.0,
                "evidence": ["electronic specialty and advanced materials"],
            }
        ],
        "secondaryThemes": [],
        "taxonomyGap": {"hasGap": False},
    }
    pass2_payload = {
        "themes": [{"label": "Specialty Chemicals", "subthemes": []}],
        "subthemeGaps": [
            {
                "label": "Specialty Chemicals",
                "reason": "Current subthemes do not cover electronic materials.",
                "suggestedSubthemes": ["Electronic Specialty Materials", "Industrial Gases"],
                "confidence": 0.88,
            }
        ],
    }
    gemini = FakeGeminiService([pass1_payload, pass2_payload])
    service = AssetThemeService(Mock(), gemini_service=gemini)

    themes, _taxonomy_gap = service.generate_theme_payload(
        name="Air Liquide",
        sector="Basic Materials",
        industry="Specialty Chemicals",
        summary="The company provides electronic specialty and advanced materials.",
    )

    assert themes[0]["children"] == []
    assert service.last_subtheme_taxonomy_gaps == [
        {
            "hasGap": True,
            "reason": "Current subthemes do not cover electronic materials.",
            "suggestedTheme": "Specialty Chemicals",
            "suggestedSubthemes": ["Electronic Specialty Materials", "Industrial Gases"],
            "confidence": 0.88,
        }
    ]


def test_two_pass_ignores_gemini_subtheme_gap_suggestions_when_disabled(monkeypatch):
    monkeypatch.setattr(settings, "ASSET_THEME_TWO_PASS_CLASSIFICATION", True)
    monkeypatch.setattr(settings, "ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED", False)
    pass1_payload = {
        "primaryThemes": [
            {
                "label": "Specialty Chemicals",
                "confidence": 0.9,
                "weight": 1.0,
                "evidence": ["electronic specialty and advanced materials"],
            }
        ],
        "secondaryThemes": [],
        "taxonomyGap": {
            "hasGap": True,
            "reason": "No parent label covers electronic materials.",
            "suggestedTheme": "Electronic Materials",
            "suggestedSubthemes": ["Electronic Specialty Materials"],
            "confidence": 0.88,
        },
    }
    pass2_payload = {
        "themes": [{"label": "Specialty Chemicals", "subthemes": []}],
        "subthemeGaps": [
            {
                "label": "Specialty Chemicals",
                "reason": "Current subthemes do not cover electronic materials.",
                "suggestedSubthemes": ["Electronic Specialty Materials", "Industrial Gases"],
                "confidence": 0.88,
            }
        ],
    }
    gemini = FakeGeminiService([pass1_payload, pass2_payload])
    service = AssetThemeService(Mock(), gemini_service=gemini)

    themes, taxonomy_gap = service.generate_theme_payload(
        name="Air Liquide",
        sector="Basic Materials",
        industry="Specialty Chemicals",
        summary="The company provides electronic specialty and advanced materials.",
    )

    assert themes[0]["children"] == []
    assert taxonomy_gap["suggestedSubthemes"] == []
    assert service.last_subtheme_taxonomy_gaps == []
    assert "subthemeGaps must always be an empty array" in gemini.prompts[1]
