from pathlib import Path
from types import SimpleNamespace

import pytest

from app.cli import benchmark_theme_minilm, sanity_theme_minilm
from app.services.asset_theme_minilm import (
    AssetThemeMiniLMClassifier,
    ScoredThemeDocument,
    THEME_REGISTRY,
    audit_theme_registry_definitions,
    cosine_similarity,
    get_subtheme_definition,
    get_theme_definition,
    validate_theme_registry,
)
from app.services.asset_theme_minilm_runtime import MiniLMModelPaths, resolve_model_paths
from app.services.asset_themes import ALLOWED_THEME_HIERARCHY, settings


class KeywordEmbeddingBackend:
    def embed(self, texts):
        vectors = []
        for text in texts:
            normalized = text.casefold()
            if any(keyword in normalized for keyword in ("gpu", "accelerated", "ai")):
                vectors.append([1.0, 0.0, 0.0])
            elif any(keyword in normalized for keyword in ("airline", "hotel", "travel")):
                vectors.append([0.0, 1.0, 0.0])
            else:
                vectors.append([0.0, 0.0, 1.0])
        return vectors


class PairEmbeddingBackend:
    def embed(self, texts):
        return [[1.0, 0.0] if index % 2 == 0 else [0.8, 0.6] for index, _ in enumerate(texts)]


def small_theme_registry():
    return {
        "AI Infrastructure": {
            "definition": "Companies providing compute infrastructure for artificial intelligence workloads.",
            "subthemes": {
                "GPU Computing": "Accelerators used for artificial intelligence and parallel computing.",
                "Accelerated Computing": "Specialized compute hardware for demanding workloads.",
            },
        },
        "Travel & Leisure": {
            "definition": "Companies providing travel, lodging, leisure, and passenger transportation services.",
            "subthemes": {
                "Airlines": "Passenger air transportation services and related operating networks.",
                "Hotels & Resorts": "Lodging properties, resorts, and related hospitality services.",
            },
        },
    }


def test_cosine_similarity():
    assert cosine_similarity([1, 0], [1, 0]) == pytest.approx(1.0)
    assert cosine_similarity([1, 0], [0, 1]) == pytest.approx(0.0)
    assert cosine_similarity([0, 0], [1, 1]) == 0.0


def test_theme_registry_has_complete_retrieval_definitions():
    validate_theme_registry()
    audit = audit_theme_registry_definitions()

    assert set(THEME_REGISTRY) == set(ALLOWED_THEME_HIERARCHY)
    assert audit["missing_parent_definitions"] == []
    assert audit["missing_subtheme_definitions"] == []
    assert audit["generic_definitions"] == []
    for theme, subthemes in ALLOWED_THEME_HIERARCHY.items():
        assert get_theme_definition(theme)
        for subtheme in subthemes:
            assert get_subtheme_definition(theme, subtheme)


def test_model_path_resolution_accepts_local_onnx_export(tmp_path: Path):
    model_path = tmp_path / "onnx" / "model_quint8_avx2.onnx"
    tokenizer_path = tmp_path / "tokenizer.json"
    model_path.parent.mkdir()
    model_path.write_bytes(b"model")
    tokenizer_path.write_text("{}", encoding="utf-8")

    paths = resolve_model_paths(tmp_path)

    assert paths.model_path == model_path
    assert paths.tokenizer_path == tokenizer_path


def test_model_path_resolution_auto_downloads_when_allowed(tmp_path: Path, monkeypatch):
    model_path = tmp_path / "onnx" / "model_quint8_avx2.onnx"
    tokenizer_path = tmp_path / "tokenizer.json"
    expected = MiniLMModelPaths(model_path=model_path, tokenizer_path=tokenizer_path)
    calls = []

    def fake_download(target_dir=None):
        calls.append(target_dir)
        return expected

    monkeypatch.setattr(settings, "THEME_MINILM_AUTO_DOWNLOAD", True)
    monkeypatch.setattr(
        "app.services.asset_theme_minilm_runtime.download_default_model",
        fake_download,
    )

    paths = resolve_model_paths(tmp_path)

    assert paths == expected
    assert calls == [tmp_path]


def test_classifier_output_shape_is_stable():
    classifier = AssetThemeMiniLMClassifier(
        embedding_backend=KeywordEmbeddingBackend(),
        theme_registry=small_theme_registry(),
    )

    themes = classifier.classify_summary("Builds GPUs for accelerated AI computing.")

    assert themes
    assert set(themes[0]) == {
        "label",
        "theme",
        "score",
        "confidence",
        "score_gap_to_next",
        "weight",
        "needs_review",
        "review_reasons",
        "max_subtheme_similarity",
        "average_top3_subtheme_similarity",
        "matching_subtheme_count",
        "children",
    }
    assert themes[0]["label"] == "AI Infrastructure"
    assert set(themes[0]["children"][0]) == {"label", "confidence", "score"}


def test_review_safety_marks_close_weak_classifications():
    themes = AssetThemeMiniLMClassifier._aggregate_scores(
        subtheme_scores=[
            ScoredThemeDocument(
                label="GPU Computing",
                parent_label="AI Infrastructure",
                level="subtheme",
                score=0.25,
            ),
            ScoredThemeDocument(
                label="Airlines",
                parent_label="Travel & Leisure",
                level="subtheme",
                score=0.245,
            ),
        ],
        max_parent_count=5,
        max_children_per_parent=3,
    )

    assert themes[0]["needs_review"] is True
    assert "low_confidence" in themes[0]["review_reasons"]
    assert "no_strong_subtheme_evidence" in themes[0]["review_reasons"]
    assert "top_themes_too_close" in themes[0]["review_reasons"]


def test_sanity_theme_minilm_does_not_call_gemini(monkeypatch):
    def fail_asset_theme_service(*args, **kwargs):
        raise AssertionError("Gemini service should not be constructed")

    monkeypatch.setattr("app.cli.AssetThemeService", fail_asset_theme_service)
    classifier = AssetThemeMiniLMClassifier(
        embedding_backend=PairEmbeddingBackend(),
        theme_registry=small_theme_registry(),
    )

    result = sanity_theme_minilm(classifier=classifier)

    assert len(result["pairs"]) == 6
    assert all("cosine_similarity" in row for row in result["pairs"])
    assert result["embedding_dimension"] == 2


def test_benchmark_theme_minilm_smoke_no_gemini_or_persistence(monkeypatch):
    asset = SimpleNamespace(
        symbol="NVDA",
        name="NVIDIA Corporation",
        sector="Technology",
        industry="Semiconductors",
        theme_classification=SimpleNamespace(
            method="gpt",
            themes=[
                {
                    "label": "AI Infrastructure",
                    "confidence": 0.95,
                    "weight": 1.0,
                    "children": [{"label": "GPU Computing", "confidence": 0.9}],
                }
            ],
        ),
    )

    class FakeDB:
        def __init__(self):
            self.adds = 0
            self.commits = 0
            self.rollbacks = 0

        def add(self, *_args, **_kwargs):
            self.adds += 1
            raise AssertionError("benchmark must not persist rows")

        def commit(self):
            self.commits += 1
            raise AssertionError("benchmark must not commit")

        def rollback(self):
            self.rollbacks += 1

    def fail_asset_theme_service(*args, **kwargs):
        raise AssertionError("Gemini service should not be constructed by default")

    monkeypatch.setattr("app.cli._select_benchmark_assets", lambda db, sample, symbols: [asset])
    monkeypatch.setattr("app.cli.AssetThemeService", fail_asset_theme_service)
    monkeypatch.setattr(
        "app.cli.FundamentalsService.fetch_info",
        lambda symbol, action: {
            "longName": "NVIDIA Corporation",
            "longBusinessSummary": "NVIDIA builds GPUs for accelerated AI computing.",
        },
    )
    classifier = AssetThemeMiniLMClassifier(
        embedding_backend=KeywordEmbeddingBackend(),
        theme_registry=small_theme_registry(),
    )
    db = FakeDB()

    result = benchmark_theme_minilm(sample=1, db=db, classifier=classifier)

    assert db.adds == 0
    assert db.commits == 0
    assert db.rollbacks == 0
    assert result["sample_size_used"] == 1
    assert result["top1_parent_match_rate"] == 1.0
    assert result["top3_subtheme_match_rate"] == 1.0
    assert result["embedding_document_count"] == 4
    assert result["asset_results"][0]["parent_top1_match"] is True
