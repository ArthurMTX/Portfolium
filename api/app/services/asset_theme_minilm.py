"""Local MiniLM theme classifier and scoring helpers."""
from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from app.config import settings
from app.services.asset_theme_minilm_registry import (
    THEME_REGISTRY,
    ThemeRegistry,
    audit_theme_registry_definitions,
    get_subtheme_definition,
    get_theme_definition,
    validate_theme_registry,
)
from app.services.asset_theme_minilm_runtime import (
    EmbeddingBackend,
    OnnxMiniLMEmbeddingBackend,
    download_default_model,
)
from app.services.asset_themes import ALLOWED_THEME_HIERARCHY

logger = logging.getLogger(__name__)

ThemePayload = Dict[str, Any]
Vector = Sequence[float]

MIN_STRONG_SUBTHEME_SIMILARITY = 0.35
MIN_REVIEW_CONFIDENCE = 0.55
MIN_SCORE_GAP = 0.04
VERY_SMALL_SCORE_GAP = 0.025

__all__ = [
    "AssetThemeMiniLMClassifier",
    "ScoredParentTheme",
    "ScoredThemeDocument",
    "THEME_REGISTRY",
    "ThemeDocument",
    "audit_theme_registry_definitions",
    "cosine_similarity",
    "download_default_model",
    "get_subtheme_definition",
    "get_theme_definition",
    "validate_theme_registry",
]


@dataclass(frozen=True)
class ThemeDocument:
    label: str
    parent_label: str
    level: str
    document: str


@dataclass(frozen=True)
class ScoredThemeDocument:
    label: str
    parent_label: str
    level: str
    score: float


@dataclass(frozen=True)
class ScoredParentTheme:
    label: str
    score: float
    confidence: float
    score_gap_to_next: float
    needs_review: bool
    review_reasons: tuple[str, ...]
    max_subtheme_similarity: float
    average_top3_subtheme_similarity: float
    matching_subtheme_count: int
    children: tuple[ScoredThemeDocument, ...]


def cosine_similarity(left: Vector, right: Vector) -> float:
    """Return cosine similarity for two dense vectors."""

    if len(left) != len(right) or not left:
        return 0.0

    dot = 0.0
    left_norm = 0.0
    right_norm = 0.0
    for left_value, right_value in zip(left, right):
        left_float = float(left_value)
        right_float = float(right_value)
        dot += left_float * right_float
        left_norm += left_float * left_float
        right_norm += right_float * right_float

    denominator = math.sqrt(left_norm) * math.sqrt(right_norm)
    if denominator <= 0:
        return 0.0
    return dot / denominator


class AssetThemeMiniLMClassifier:
    """Rank theme candidates by local MiniLM embedding similarity."""

    def __init__(
        self,
        model_path: Optional[str | Path] = None,
        top_k: Optional[int] = None,
        embedding_backend: Optional[EmbeddingBackend] = None,
        theme_registry: Optional[ThemeRegistry] = None,
    ) -> None:
        self.top_k = top_k or settings.THEME_MINILM_TOP_K
        self.theme_registry = theme_registry or THEME_REGISTRY
        self.embedding_backend = embedding_backend or OnnxMiniLMEmbeddingBackend(model_path)
        self._subtheme_documents = self._build_subtheme_documents(self.theme_registry)
        self._embedded_subtheme_documents: Optional[List[List[float]]] = None
        self.model_load_ms = 0.0

    def classify_summary(self, summary: Optional[str]) -> List[ThemePayload]:
        return self.classify_asset(summary=summary)

    def classify_asset(
        self,
        summary: Optional[str],
        name: Optional[str] = None,
        sector: Optional[str] = None,
        industry: Optional[str] = None,
    ) -> List[ThemePayload]:
        if not summary or not summary.strip():
            return []

        started_at = time.perf_counter()
        asset_document = self._build_asset_document(
            name=name,
            sector=sector,
            industry=industry,
            summary=summary,
        )
        summary_vector = self.embedding_backend.embed([asset_document])[0]
        self._ensure_document_embeddings()

        subtheme_scores = self._score_documents(
            summary_vector,
            self._subtheme_documents,
            self._embedded_subtheme_documents or [],
        )
        themes = self._aggregate_scores(
            subtheme_scores=sorted(subtheme_scores, key=lambda item: item.score, reverse=True)[
                : self.top_k
            ],
            max_parent_count=5,
            max_children_per_parent=3,
        )
        logger.debug(
            "MiniLM theme classification completed elapsed_ms=%.1f themes=%s",
            (time.perf_counter() - started_at) * 1000,
            [theme.get("label") for theme in themes],
        )
        return themes

    def rank_subtheme_candidates(
        self,
        summary: Optional[str],
        top_k: Optional[int] = None,
        name: Optional[str] = None,
        sector: Optional[str] = None,
        industry: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if not summary or not summary.strip():
            return []

        asset_document = self._build_asset_document(
            name=name,
            sector=sector,
            industry=industry,
            summary=summary,
        )
        summary_vector = self.embedding_backend.embed([asset_document])[0]
        self._ensure_document_embeddings()
        scores = self._score_documents(
            summary_vector,
            self._subtheme_documents,
            self._embedded_subtheme_documents or [],
        )
        limit = top_k or self.top_k
        return [
            {
                "label": item.label,
                "parent_label": item.parent_label,
                "level": item.level,
                "score": round(item.score, 4),
            }
            for item in sorted(scores, key=lambda item: item.score, reverse=True)[:limit]
        ]

    def estimated_model_disk_mb(self) -> Optional[float]:
        method = getattr(self.embedding_backend, "estimated_model_disk_mb", None)
        if callable(method):
            return method()
        return None

    def estimated_memory_mb(self) -> Optional[float]:
        backend_estimate = None
        method = getattr(self.embedding_backend, "estimated_memory_mb", None)
        if callable(method):
            backend_estimate = method()

        embedding_mb = self._estimated_embedding_memory_mb()
        if backend_estimate is None and embedding_mb <= 0:
            return None
        return round((backend_estimate or 0.0) + embedding_mb, 2)

    @property
    def embedding_document_count(self) -> int:
        return len(self._subtheme_documents)

    def _model_debug_metadata(self) -> Dict[str, Any]:
        model_paths = getattr(self.embedding_backend, "model_paths", None)
        return {
            "model_path": str(model_paths.model_path) if model_paths else None,
            "tokenizer_path": str(model_paths.tokenizer_path) if model_paths else None,
            "onnx_output_names": list(getattr(self.embedding_backend, "output_names", []) or []),
        }

    def _ensure_document_embeddings(self) -> None:
        if self._embedded_subtheme_documents is not None:
            return

        started_at = time.perf_counter()
        documents = [doc.document for doc in self._subtheme_documents]
        vectors = self.embedding_backend.embed(documents)
        self._embedded_subtheme_documents = vectors
        load_ms = getattr(self.embedding_backend, "load_ms", 0.0) or 0.0
        self.model_load_ms = load_ms or ((time.perf_counter() - started_at) * 1000)

    @staticmethod
    def _build_subtheme_documents(
        registry: ThemeRegistry,
    ) -> List[ThemeDocument]:
        documents: List[ThemeDocument] = []
        for parent, definition in registry.items():
            parent_definition = str(definition.get("definition") or "")
            subtheme_definitions = definition.get("subthemes") or {}
            if not isinstance(subtheme_definitions, dict):
                continue
            for subtheme, subtheme_definition in subtheme_definitions.items():
                documents.append(
                    ThemeDocument(
                        label=subtheme,
                        parent_label=parent,
                        level="subtheme",
                        document=(
                            f"Theme: {parent}\n"
                            f"Theme Definition: {parent_definition}\n\n"
                            f"Subtheme: {subtheme}\n"
                            f"Subtheme Definition: {subtheme_definition}"
                        ),
                    )
                )
        return documents

    @staticmethod
    def _build_asset_document(
        summary: str,
        name: Optional[str] = None,
        sector: Optional[str] = None,
        industry: Optional[str] = None,
    ) -> str:
        normalized_summary = " ".join((summary or "").strip().split())
        return (
            f"Company: {name or ''}\n"
            f"Sector: {sector or ''}\n"
            f"Industry: {industry or ''}\n\n"
            f"Summary:\n{normalized_summary}"
        )

    def _estimated_embedding_memory_mb(self) -> float:
        vectors = self._embedded_subtheme_documents or []
        if not vectors:
            return 0.0
        vector_count = len(vectors)
        dimension = len(vectors[0]) if vectors and vectors[0] else 0
        return (vector_count * dimension * 4) / (1024 * 1024)

    @staticmethod
    def _score_documents(
        summary_vector: Vector,
        documents: Sequence[ThemeDocument],
        document_vectors: Sequence[Vector],
    ) -> List[ScoredThemeDocument]:
        return [
            ScoredThemeDocument(
                label=document.label,
                parent_label=document.parent_label,
                level=document.level,
                score=cosine_similarity(summary_vector, vector),
            )
            for document, vector in zip(documents, document_vectors)
        ]

    @classmethod
    def _aggregate_scores(
        cls,
        subtheme_scores: Sequence[ScoredThemeDocument],
        max_parent_count: int = 5,
        max_children_per_parent: int = 3,
    ) -> List[ThemePayload]:
        parent_scores = cls._score_parent_themes(
            subtheme_scores=subtheme_scores,
            max_parent_count=max_parent_count,
            max_children_per_parent=max_children_per_parent,
        )
        if not parent_scores:
            return []

        total_score = sum(parent.score for parent in parent_scores)
        if total_score <= 0:
            return []

        themes: List[ThemePayload] = []
        for parent in parent_scores:
            child_payload = [
                {
                    "label": child.label,
                    "confidence": cls._confidence_from_similarity(child.score, 0.0),
                    "score": round(max(child.score, 0.0), 4),
                }
                for child in parent.children
            ]
            themes.append(
                {
                    "label": parent.label,
                    "theme": parent.label,
                    "score": round(parent.score, 4),
                    "confidence": parent.confidence,
                    "score_gap_to_next": round(parent.score_gap_to_next, 4),
                    "weight": round(parent.score / total_score, 4),
                    "needs_review": parent.needs_review,
                    "review_reasons": list(parent.review_reasons),
                    "max_subtheme_similarity": round(parent.max_subtheme_similarity, 4),
                    "average_top3_subtheme_similarity": round(
                        parent.average_top3_subtheme_similarity,
                        4,
                    ),
                    "matching_subtheme_count": parent.matching_subtheme_count,
                    "children": child_payload,
                }
            )

        second_total = sum(float(theme["weight"]) for theme in themes)
        if themes and second_total > 0:
            themes[0]["weight"] = round(float(themes[0]["weight"]) + (1.0 - second_total), 4)
        return themes

    @classmethod
    def _score_parent_themes(
        cls,
        subtheme_scores: Sequence[ScoredThemeDocument],
        max_parent_count: int = 5,
        max_children_per_parent: int = 3,
    ) -> List[ScoredParentTheme]:
        grouped_children: Dict[str, List[ScoredThemeDocument]] = {}
        for item in subtheme_scores:
            if item.score <= 0:
                continue
            grouped_children.setdefault(item.parent_label, []).append(item)

        parent_candidates: list[dict[str, Any]] = []
        for parent_label, children in grouped_children.items():
            ranked_children = sorted(children, key=lambda item: (-item.score, item.label))
            top_children = ranked_children[:max_children_per_parent]
            top_scores = [max(child.score, 0.0) for child in top_children]
            max_similarity = max(top_scores) if top_scores else 0.0
            average_top3 = sum(top_scores) / len(top_scores) if top_scores else 0.0
            matching_count = sum(
                1
                for child in ranked_children
                if child.score >= MIN_STRONG_SUBTHEME_SIMILARITY
            )
            count_component = min(matching_count / 3.0, 1.0)
            score = (max_similarity * 0.55) + (average_top3 * 0.30) + (count_component * 0.15)
            parent_candidates.append(
                {
                    "label": parent_label,
                    "score": score,
                    "children": tuple(top_children),
                    "max_subtheme_similarity": max_similarity,
                    "average_top3_subtheme_similarity": average_top3,
                    "matching_subtheme_count": matching_count,
                }
            )

        ranked = sorted(parent_candidates, key=lambda item: (-item["score"], item["label"]))[
            :max_parent_count
        ]
        scored_parents: List[ScoredParentTheme] = []
        for index, item in enumerate(ranked):
            next_score = ranked[index + 1]["score"] if index + 1 < len(ranked) else 0.0
            score_gap = max(float(item["score"]) - float(next_score), 0.0)
            confidence = cls._confidence_from_parent_score(
                score=float(item["score"]),
                score_gap=score_gap,
                matching_subtheme_count=int(item["matching_subtheme_count"]),
                max_subtheme_similarity=float(item["max_subtheme_similarity"]),
            )
            review_reasons = cls._review_reasons(
                confidence=confidence,
                score_gap=score_gap,
                matching_subtheme_count=int(item["matching_subtheme_count"]),
                max_subtheme_similarity=float(item["max_subtheme_similarity"]),
                has_next_theme=index + 1 < len(ranked),
            )
            scored_parents.append(
                ScoredParentTheme(
                    label=str(item["label"]),
                    score=round(float(item["score"]), 6),
                    confidence=confidence,
                    score_gap_to_next=round(score_gap, 6),
                    needs_review=bool(review_reasons),
                    review_reasons=tuple(review_reasons),
                    max_subtheme_similarity=round(float(item["max_subtheme_similarity"]), 6),
                    average_top3_subtheme_similarity=round(
                        float(item["average_top3_subtheme_similarity"]),
                        6,
                    ),
                    matching_subtheme_count=int(item["matching_subtheme_count"]),
                    children=item["children"],
                )
        )
        return scored_parents

    @classmethod
    def _parent_aggregation_diagnostics(
        cls,
        parent_scores: Sequence[ScoredParentTheme],
        subtheme_scores: Sequence[ScoredThemeDocument],
        theme_registry: Optional[ThemeRegistry] = None,
    ) -> List[Dict[str, Any]]:
        grouped_scores: Dict[str, List[ScoredThemeDocument]] = {}
        for item in subtheme_scores:
            grouped_scores.setdefault(item.parent_label, []).append(item)

        diagnostics: List[Dict[str, Any]] = []
        for parent in parent_scores:
            parent_candidates = sorted(
                grouped_scores.get(parent.label, []),
                key=lambda item: (-item.score, item.label),
            )
            total_parent_subthemes = cls._parent_subtheme_count(
                parent.label,
                theme_registry=theme_registry,
            )
            strong_count = parent.matching_subtheme_count
            weak_count = sum(
                1
                for item in parent_candidates
                if 0 < item.score < MIN_STRONG_SUBTHEME_SIMILARITY
            )
            strong_ratio = (
                strong_count / total_parent_subthemes
                if total_parent_subthemes > 0
                else 0.0
            )
            children_used: list[dict[str, Any]] = []
            for child in parent.children:
                child_payload: dict[str, Any] = {
                    "label": child.label,
                    "score": round(child.score, 6),
                }
                children_used.append(child_payload)
            diagnostics.append(
                {
                    "parent_label": parent.label,
                    "final_score": round(parent.score, 6),
                    "max_subtheme_similarity": round(parent.max_subtheme_similarity, 6),
                    "average_top3_subtheme_similarity": round(
                        parent.average_top3_subtheme_similarity,
                        6,
                    ),
                    "matching_subtheme_count": strong_count,
                    "children_used": children_used,
                    "score_gap": round(parent.score_gap_to_next, 6),
                    "confidence": parent.confidence,
                    "needs_review": parent.needs_review,
                    "review_reasons": list(parent.review_reasons),
                    "parent_candidate_count": len(parent_candidates),
                    "parent_subtheme_count": total_parent_subthemes,
                    "weak_match_count": weak_count,
                    "strong_match_ratio": round(strong_ratio, 6),
                    "driven_by_many_weak_children": cls._is_driven_by_many_weak_children(
                        weak_count=weak_count,
                        strong_count=strong_count,
                        average_top3=parent.average_top3_subtheme_similarity,
                        max_similarity=parent.max_subtheme_similarity,
                    ),
                }
            )
        return diagnostics

    @staticmethod
    def _parent_subtheme_count(
        parent_label: str,
        theme_registry: Optional[ThemeRegistry] = None,
    ) -> int:
        if theme_registry:
            definition = theme_registry.get(parent_label)
            subthemes = definition.get("subthemes") if definition else None
            if isinstance(subthemes, dict):
                return len(subthemes)
        return len(ALLOWED_THEME_HIERARCHY.get(parent_label, ()))

    @staticmethod
    def _is_driven_by_many_weak_children(
        *,
        weak_count: int,
        strong_count: int,
        average_top3: float,
        max_similarity: float,
    ) -> bool:
        return (
            weak_count >= 3
            and weak_count > max(strong_count, 1)
            and average_top3 < MIN_STRONG_SUBTHEME_SIMILARITY
            and max_similarity < MIN_STRONG_SUBTHEME_SIMILARITY
        )

    @staticmethod
    def _confidence_from_similarity(similarity: float, separation: float) -> float:
        absolute = max(0.0, min(float(similarity), 1.0))
        separation_component = max(0.0, min(float(separation) / 0.25, 1.0))
        return round(max(0.0, min((absolute * 0.7) + (separation_component * 0.3), 1.0)), 2)

    @staticmethod
    def _confidence_from_parent_score(
        score: float,
        score_gap: float,
        matching_subtheme_count: int,
        max_subtheme_similarity: float,
    ) -> float:
        normalized_score = max(0.0, min(score, 1.0))
        gap_component = max(0.0, min(score_gap / 0.12, 1.0))
        count_component = max(0.0, min(matching_subtheme_count / 3.0, 1.0))
        evidence_component = max(0.0, min(max_subtheme_similarity, 1.0))
        confidence = (
            normalized_score * 0.45
            + gap_component * 0.25
            + count_component * 0.15
            + evidence_component * 0.15
        )
        return round(max(0.0, min(confidence, 1.0)), 2)

    @staticmethod
    def _review_reasons(
        confidence: float,
        score_gap: float,
        matching_subtheme_count: int,
        max_subtheme_similarity: float,
        has_next_theme: bool,
    ) -> List[str]:
        reasons: List[str] = []
        if confidence < MIN_REVIEW_CONFIDENCE:
            reasons.append("low_confidence")
        if has_next_theme and score_gap < MIN_SCORE_GAP:
            reasons.append("small_score_gap")
        if matching_subtheme_count <= 0 or max_subtheme_similarity < MIN_STRONG_SUBTHEME_SIMILARITY:
            reasons.append("no_strong_subtheme_evidence")
        if has_next_theme and score_gap < VERY_SMALL_SCORE_GAP:
            reasons.append("top_themes_too_close")
        return reasons
