"""Read-only theme classification benchmark and taxonomy gap reports."""
from __future__ import annotations

import math
import time
from datetime import datetime
from statistics import mean
from typing import Any, Dict, Optional, Sequence

from sqlalchemy.orm import Session, joinedload

from app.models import Asset, AssetThemeTaxonomySuggestion
from app.services.asset_theme_minilm import (
    AssetThemeMiniLMClassifier,
    THEME_REGISTRY,
    get_subtheme_definition,
    get_theme_definition,
)
from app.services.asset_themes import ALLOWED_THEME_HIERARCHY, AssetThemeService
from app.services.fundamentals import FundamentalsService


def build_classification_benchmark_report(
    db: Session,
    *,
    limit: int = 50,
    offset: int = 0,
    symbols: Optional[Sequence[str]] = None,
    retrieved_candidate_limit: int = 10,
    classifier: Optional[AssetThemeMiniLMClassifier] = None,
) -> Dict[str, Any]:
    """Compare stored Gemini classifications against local MiniLM candidates."""

    classifier = classifier or AssetThemeMiniLMClassifier()
    query = db.query(Asset).options(joinedload(Asset.theme_classification))
    if symbols:
        normalized_symbols = [symbol.upper() for symbol in symbols]
        query = query.filter(Asset.symbol.in_(normalized_symbols))

    assets = query.order_by(Asset.symbol).offset(offset).limit(limit).all()
    rows: list[dict[str, Any]] = []
    skipped = {
        "missing_stored_gemini_classification": 0,
        "missing_summary": 0,
    }
    failed = 0
    runtime_ms_values: list[float] = []
    parent_match_counts = {1: 0, 3: 0, 5: 0}
    subtheme_match_counts = {1: 0, 3: 0}
    subtheme_comparisons = 0
    theme_confidences: list[float] = []
    candidate_scores: list[float] = []

    for asset in assets:
        stored_themes = _stored_gemini_theme_payload(asset)
        if not stored_themes:
            skipped["missing_stored_gemini_classification"] += 1
            continue

        try:
            info = FundamentalsService.fetch_info(
                asset.symbol,
                action="asset_theme_minilm_admin_benchmark",
            ) or {}
            summary = _extract_asset_summary(info)
            if not summary:
                skipped["missing_summary"] += 1
                continue

            company_name = info.get("longName") or info.get("shortName") or asset.name
            sector = info.get("sector") or asset.sector
            industry = info.get("industry") or asset.industry

            started_at = time.perf_counter()
            minilm_themes = classifier.classify_asset(
                name=company_name,
                sector=sector,
                industry=industry,
                summary=summary,
            )
            retrieved_candidates = classifier.rank_subtheme_candidates(
                name=company_name,
                sector=sector,
                industry=industry,
                summary=summary,
                top_k=retrieved_candidate_limit,
            )
            runtime_ms = (time.perf_counter() - started_at) * 1000
            runtime_ms_values.append(runtime_ms)

            stored_parent_labels = _extract_parent_labels(stored_themes)
            minilm_parent_labels = _extract_parent_labels(minilm_themes)
            parent_matches = {
                limit_value: _has_top_k_match(stored_parent_labels, minilm_parent_labels, limit_value)
                for limit_value in parent_match_counts
            }
            for limit_value, matched in parent_matches.items():
                if matched:
                    parent_match_counts[limit_value] += 1

            stored_subthemes = _extract_subtheme_labels(stored_themes)
            minilm_subthemes = _extract_subtheme_labels(minilm_themes)
            subtheme_matches: dict[int, Optional[bool]] = {1: None, 3: None}
            if stored_subthemes and minilm_subthemes:
                subtheme_comparisons += 1
                for limit_value in subtheme_match_counts:
                    subtheme_matches[limit_value] = _has_top_k_match(
                        stored_subthemes,
                        minilm_subthemes,
                        limit_value,
                    )
                    if subtheme_matches[limit_value]:
                        subtheme_match_counts[limit_value] += 1

            gemini_top_confidence = _top_confidence(stored_themes)
            minilm_top_confidence = _top_confidence(minilm_themes)
            confidence_delta = (
                round(minilm_top_confidence - gemini_top_confidence, 4)
                if gemini_top_confidence is not None and minilm_top_confidence is not None
                else None
            )
            theme_confidences.extend(
                float(theme.get("confidence") or 0.0)
                for theme in minilm_themes
                if isinstance(theme, dict)
            )
            candidate_scores.extend(
                float(candidate.get("score") or 0.0)
                for candidate in retrieved_candidates
                if isinstance(candidate, dict)
            )

            rows.append(
                {
                    "asset_id": asset.id,
                    "symbol": asset.symbol,
                    "company_name": company_name,
                    "sector": sector,
                    "industry": industry,
                    "summary_excerpt": _summary_excerpt(summary),
                    "gemini_themes": stored_themes,
                    "minilm_themes": minilm_themes,
                    "retrieved_candidates": retrieved_candidates,
                    "parent_top1_match": parent_matches[1],
                    "parent_top3_match": parent_matches[3],
                    "parent_top5_match": parent_matches[5],
                    "subtheme_top1_match": subtheme_matches[1],
                    "subtheme_top3_match": subtheme_matches[3],
                    "parent_agreement_rank": _agreement_rank(parent_matches),
                    "subtheme_agreement_rank": _agreement_rank(subtheme_matches),
                    "gemini_top_confidence": gemini_top_confidence,
                    "minilm_top_confidence": minilm_top_confidence,
                    "confidence_delta": confidence_delta,
                    "runtime_ms": round(runtime_ms, 2),
                    "definitions_used": _definitions_used(
                        stored_themes,
                        minilm_themes,
                        retrieved_candidates,
                    ),
                }
            )
        except Exception:
            db.rollback()
            failed += 1

    used = len(rows)
    metrics = {
        "sample_size_requested": len(symbols) if symbols else limit,
        "sample_size_used": used,
        "skipped": skipped,
        "failed": failed,
        "top1_parent_agreement": round(parent_match_counts[1] / used, 4) if used else 0.0,
        "top3_parent_agreement": round(parent_match_counts[3] / used, 4) if used else 0.0,
        "top5_parent_agreement": round(parent_match_counts[5] / used, 4) if used else 0.0,
        "top1_subtheme_agreement": (
            round(subtheme_match_counts[1] / subtheme_comparisons, 4)
            if subtheme_comparisons
            else None
        ),
        "top3_subtheme_agreement": (
            round(subtheme_match_counts[3] / subtheme_comparisons, 4)
            if subtheme_comparisons
            else None
        ),
        "theme_confidence_distribution": _bucket_distribution(theme_confidences),
        "candidate_score_distribution": _bucket_distribution(candidate_scores),
        "average_runtime_ms": round(mean(runtime_ms_values), 2) if runtime_ms_values else 0.0,
        "p95_runtime_ms": round(_percentile(runtime_ms_values, 95), 2) if runtime_ms_values else 0.0,
        "embedding_document_count": classifier.embedding_document_count,
        "model_load_ms": round(float(classifier.model_load_ms or 0.0), 2),
        "estimated_model_disk_mb": classifier.estimated_model_disk_mb(),
        "estimated_memory_mb": classifier.estimated_memory_mb(),
    }
    return {
        "generated_at": datetime.utcnow().isoformat(),
        "metrics": metrics,
        "rows": rows,
    }


def build_taxonomy_gap_report(db: Session) -> Dict[str, Any]:
    """Summarize assignment coverage and frequent taxonomy gap suggestions."""

    theme_counts = {theme: 0 for theme in ALLOWED_THEME_HIERARCHY}
    subtheme_counts = {
        (theme, subtheme): 0
        for theme, subthemes in ALLOWED_THEME_HIERARCHY.items()
        for subtheme in subthemes
    }

    assets = db.query(Asset).options(joinedload(Asset.theme_classification)).all()
    for asset in assets:
        seen_themes: set[str] = set()
        seen_subthemes: set[tuple[str, str]] = set()
        for theme_payload in getattr(asset, "themes", []) or []:
            if not isinstance(theme_payload, dict):
                continue
            parent = theme_payload.get("label")
            if isinstance(parent, str) and parent in theme_counts:
                seen_themes.add(parent)
                for child in theme_payload.get("children") or theme_payload.get("subthemes") or []:
                    if not isinstance(child, dict):
                        continue
                    child_label = child.get("label")
                    key = (parent, child_label)
                    if isinstance(child_label, str) and key in subtheme_counts:
                        seen_subthemes.add(key)
        for theme in seen_themes:
            theme_counts[theme] += 1
        for key in seen_subthemes:
            subtheme_counts[key] += 1

    suggestions = db.query(AssetThemeTaxonomySuggestion).all()
    suggested_theme_counts: dict[str, int] = {}
    suggested_subtheme_counts: dict[str, int] = {}
    for suggestion in suggestions:
        suggested_theme_counts[suggestion.suggested_theme] = (
            suggested_theme_counts.get(suggestion.suggested_theme, 0) + 1
        )
        for subtheme in suggestion.suggested_subthemes or []:
            if isinstance(subtheme, str):
                suggested_subtheme_counts[subtheme] = suggested_subtheme_counts.get(subtheme, 0) + 1

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "classified_asset_count": sum(1 for asset in assets if getattr(asset, "themes", None)),
        "themes_never_assigned": [
            {"theme": theme, "asset_count": count}
            for theme, count in sorted(theme_counts.items())
            if count == 0
        ],
        "subthemes_never_assigned": [
            {"theme": theme, "subtheme": subtheme, "asset_count": count}
            for (theme, subtheme), count in sorted(subtheme_counts.items())
            if count == 0
        ],
        "themes_under_3_assets": [
            {"theme": theme, "asset_count": count}
            for theme, count in sorted(theme_counts.items(), key=lambda item: (item[1], item[0]))
            if count < 3
        ],
        "themes_over_50_assets": [
            {"theme": theme, "asset_count": count}
            for theme, count in sorted(theme_counts.items(), key=lambda item: (-item[1], item[0]))
            if count > 50
        ],
        "most_frequent_taxonomy_suggestions": _rank_counts(suggested_theme_counts, "theme"),
        "most_frequent_subtheme_suggestions": _rank_counts(suggested_subtheme_counts, "subtheme"),
    }


def serialize_theme_registry() -> Dict[str, Any]:
    return {
        theme: {
            "definition": payload.get("definition"),
            "subthemes": payload.get("subthemes") or {},
        }
        for theme, payload in THEME_REGISTRY.items()
    }


def _stored_gemini_theme_payload(asset: Asset) -> list[dict]:
    classification = getattr(asset, "theme_classification", None)
    if not classification:
        return []
    source = AssetThemeService.classification_source(classification)
    if source and source != "gemini":
        return []
    if not source and classification.method not in {"gpt", "llm"}:
        return []
    return list(classification.themes or [])


def _extract_asset_summary(info: dict) -> str:
    summary = info.get("longBusinessSummary") or info.get("description") or info.get("summary")
    if not isinstance(summary, str):
        return ""
    return " ".join(summary.strip().split())


def _extract_parent_labels(themes: list[dict]) -> list[str]:
    labels: list[str] = []
    seen: set[str] = set()
    for theme in themes or []:
        if not isinstance(theme, dict):
            continue
        label = theme.get("label")
        if not isinstance(label, str) or not label.strip():
            continue
        normalized = label.casefold()
        if normalized in seen:
            continue
        seen.add(normalized)
        labels.append(label)
    return labels


def _extract_subtheme_labels(themes: list[dict]) -> list[str]:
    labels: list[str] = []
    seen: set[str] = set()
    for theme in themes or []:
        if not isinstance(theme, dict):
            continue
        children = theme.get("children") or theme.get("subthemes") or []
        for child in children or []:
            if not isinstance(child, dict):
                continue
            label = child.get("label")
            if not isinstance(label, str) or not label.strip():
                continue
            normalized = label.casefold()
            if normalized in seen:
                continue
            seen.add(normalized)
            labels.append(label)
    return labels


def _has_top_k_match(stored_labels: list[str], candidate_labels: list[str], top_k: int) -> bool:
    stored = {label.casefold() for label in stored_labels}
    candidates = {label.casefold() for label in candidate_labels[:top_k]}
    return bool(stored.intersection(candidates))


def _agreement_rank(matches: dict[int, Optional[bool]]) -> Optional[int]:
    for limit in sorted(matches):
        if matches[limit]:
            return limit
    return None


def _top_confidence(themes: list[dict]) -> Optional[float]:
    for theme in themes or []:
        if not isinstance(theme, dict):
            continue
        value = theme.get("confidence")
        if value is None:
            continue
        try:
            return round(float(value), 4)
        except (TypeError, ValueError):
            continue
    return None


def _definitions_used(
    stored_themes: list[dict],
    minilm_themes: list[dict],
    retrieved_candidates: list[dict],
) -> list[dict[str, Any]]:
    theme_to_subthemes: dict[str, set[str]] = {}
    for payload in [*stored_themes, *minilm_themes]:
        if not isinstance(payload, dict):
            continue
        parent = payload.get("label")
        if not isinstance(parent, str):
            continue
        bucket = theme_to_subthemes.setdefault(parent, set())
        for child in payload.get("children") or payload.get("subthemes") or []:
            if isinstance(child, dict) and isinstance(child.get("label"), str):
                bucket.add(child["label"])
    for candidate in retrieved_candidates:
        parent = candidate.get("parent_label")
        label = candidate.get("label")
        if isinstance(parent, str) and isinstance(label, str):
            theme_to_subthemes.setdefault(parent, set()).add(label)

    definitions = []
    for theme, subthemes in sorted(theme_to_subthemes.items()):
        definitions.append(
            {
                "theme": theme,
                "definition": get_theme_definition(theme),
                "subthemes": [
                    {
                        "subtheme": subtheme,
                        "definition": get_subtheme_definition(theme, subtheme),
                    }
                    for subtheme in sorted(subthemes)
                ],
            }
        )
    return definitions


def _summary_excerpt(summary: str, max_chars: int = 360) -> str:
    normalized = " ".join(summary.strip().split())
    if len(normalized) <= max_chars:
        return normalized
    return normalized[:max_chars].rstrip(" ,;:")


def _bucket_distribution(values: list[float], bucket_size: float = 0.1) -> list[dict[str, Any]]:
    buckets = [
        {
            "bucket": f"{index / 10:.1f}-{(index + 1) / 10:.1f}",
            "count": 0,
        }
        for index in range(10)
    ]
    for value in values:
        bounded = max(0.0, min(float(value), 0.999999))
        index = min(int(bounded / bucket_size), len(buckets) - 1)
        buckets[index]["count"] += 1
    return buckets


def _percentile(values: list[float], percentile: int) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, math.ceil((percentile / 100) * len(ordered)) - 1)
    return ordered[index]


def _rank_counts(counts: dict[str, int], label_key: str, limit: int = 20) -> list[dict[str, Any]]:
    return [
        {label_key: label, "count": count}
        for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:limit]
    ]
