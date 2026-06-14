from __future__ import annotations

import argparse
import csv
import json
import math
import time
from pathlib import Path
from statistics import mean
from typing import Optional

from sqlalchemy.orm import joinedload

from app.db import SessionLocal
from app.models import Asset
from app.services.asset_theme_minilm import (
    AssetThemeMiniLMClassifier,
    cosine_similarity,
    download_default_model,
)
from app.services.asset_theme_taxonomy_separability import (
    build_taxonomy_separability_report,
    write_taxonomy_separability_reports,
)
from app.services.asset_themes import AssetThemeService
from app.services.fundamentals import FundamentalsService


def refresh_themes(symbol: Optional[str], force: bool) -> None:
    db = SessionLocal()

    try:
        query = db.query(Asset).order_by(Asset.symbol)

        if symbol:
            query = query.filter(Asset.symbol == symbol.upper())

        assets = query.all()

        if not assets:
            raise SystemExit(f"No assets found for symbol={symbol}")

        service = AssetThemeService(db)

        result = {
            "total": len(assets),
            "refreshed": 0,
            "skipped_no_summary": 0,
            "failed": 0,
            "failures": [],
        }

        print(f"Refreshing themes for {len(assets)} asset(s)", flush=True)

        for index, asset in enumerate(assets, start=1):
            try:
                yahoo_started_at = time.perf_counter()
                info = FundamentalsService.fetch_info(
                    asset.symbol,
                    action="asset_theme_cli_refresh",
                ) or {}
                yahoo_duration = time.perf_counter() - yahoo_started_at

                summary = info.get("longBusinessSummary") or info.get("description")

                if not summary or not str(summary).strip():
                    result["skipped_no_summary"] += 1
                    print(f"[{index}/{len(assets)}] SKIP {asset.symbol}: no summary", flush=True)
                    continue

                service.record_external_timing(
                    "Yahoo metadata",
                    yahoo_duration,
                    metadata={
                        "symbol": asset.symbol,
                        "fields": len(info),
                        "action": "asset_theme_cli_refresh",
                    },
                )

                classification = service.refresh_classification(
                    asset=asset,
                    summary=summary,
                    sector=info.get("sector") or asset.sector,
                    industry=info.get("industry") or asset.industry,
                    name=info.get("longName") or info.get("shortName") or asset.name,
                    force=force,
                )

                result["refreshed"] += 1
                labels = [
                    {
                        "label": theme.get("label"),
                        "tier": theme.get("tier"),
                        "weight": theme.get("weight"),
                        "confidence": theme.get("confidence"),
                        "evidence": theme.get("evidence", []),
                        "children": [
                            {
                                "label": child.get("label"),
                                "confidence": child.get("confidence"),
                                "evidence": child.get("evidence", []),
                            }
                            for child in theme.get("children", [])
                        ],
                    }
                    for theme in (classification.themes or [])
                ]

                print(f"[{index}/{len(assets)}] OK {asset.symbol}:")
                print(json.dumps(labels, indent=2), flush=True)

            except Exception as exc:
                db.rollback()
                result["failed"] += 1
                result["failures"].append({
                    "symbol": asset.symbol,
                    "error": str(exc)[:240],
                })
                print(f"[{index}/{len(assets)}] FAIL {asset.symbol}: {exc}", flush=True)

        print(json.dumps(result, indent=2), flush=True)

    finally:
        db.close()


def sanity_theme_minilm(
    classifier: Optional[AssetThemeMiniLMClassifier] = None,
) -> dict:
    """Print fixed MiniLM phrase-pair similarities without touching Gemini."""

    classifier = classifier or AssetThemeMiniLMClassifier()
    pairs = [
        (
            "high",
            "smartphones personal computers tablets wearables consumer electronics",
            "smartphones tablets personal computers wearables consumer hardware",
        ),
        (
            "high",
            "cloud services app store digital payments",
            "cloud platforms digital commerce digital finance",
        ),
        (
            "high",
            "graphics processors chips CPUs custom silicon",
            "semiconductor chip design processors integrated circuits",
        ),
        (
            "low",
            "smartphones personal computers tablets wearables",
            "vitamins supplements digestive health respiratory health",
        ),
        (
            "low",
            "consumer electronics hardware",
            "fertilizer ammonia nitrogen products",
        ),
        (
            "low",
            "cloud software services",
            "funeral homes cemeteries cremation services",
        ),
    ]
    texts = [text for _, left, right in pairs for text in (left, right)]
    vectors = classifier.embedding_backend.embed(texts)
    rows = []
    for index, (expected, left, right) in enumerate(pairs):
        left_vector = vectors[index * 2]
        right_vector = vectors[index * 2 + 1]
        rows.append(
            {
                "expected": expected,
                "left": left,
                "right": right,
                "cosine_similarity": round(cosine_similarity(left_vector, right_vector), 6),
            }
        )

    result = {
        "model": classifier._model_debug_metadata(),
        "embedding_dimension": len(vectors[0]) if vectors and vectors[0] else 0,
        "pairs": rows,
    }
    print(json.dumps(result, indent=2), flush=True)
    return result


def benchmark_theme_minilm(
    sample: int = 100,
    symbols: Optional[list[str]] = None,
    refresh_gemini: bool = False,
    download_model: bool = False,
    json_output: Optional[str] = None,
    csv_output: Optional[str] = None,
    compare_json: Optional[str] = None,
    db=None,
    classifier: Optional[AssetThemeMiniLMClassifier] = None,
) -> dict:
    """Compare local MiniLM agreement against stored or opt-in refreshed Gemini themes."""

    if refresh_gemini:
        print(
            "WARNING: --refresh-gemini may call the Gemini API and may cost money. "
            "Refreshed Gemini results are used in memory only and are not persisted.",
            flush=True,
        )

    if download_model:
        paths = download_default_model()
        print(
            f"MiniLM model assets available at {paths.model_path.parent.parent}",
            flush=True,
        )

    owns_db = db is None
    db = db or SessionLocal()
    classifier = classifier or AssetThemeMiniLMClassifier()

    result = {
        "metric_label": "agreement with stored Gemini classifications"
        if not refresh_gemini
        else "agreement with refreshed Gemini classifications",
        "sample_size_requested": len(symbols) if symbols else sample,
        "sample_size_used": 0,
        "skipped_missing_asset": 0,
        "skipped_no_summary": 0,
        "skipped_no_stored_gemini_classification": 0,
        "failed": 0,
        "top1_parent_match_rate": 0.0,
        "top3_parent_match_rate": 0.0,
        "top5_parent_match_rate": 0.0,
        "top1_subtheme_match_rate": None,
        "top3_subtheme_match_rate": None,
        "subtheme_top3_match_rate": None,
        "theme_confidence_distribution": [],
        "candidate_score_distribution": [],
        "average_runtime_ms": 0.0,
        "p95_runtime_ms": 0.0,
        "model_load_ms": 0.0,
        "estimated_model_disk_mb": None,
        "estimated_memory_mb": None,
        "embedding_document_count": 0,
        "average_candidates_per_asset": 0.0,
        "segments": {},
        "examples_of_matches": [],
        "examples_of_misses": [],
        "high_confidence_disagreements": [],
        "low_confidence_assets": [],
        "potential_taxonomy_gaps": [],
        "comparison": None,
        "asset_results": [],
    }

    try:
        assets = _select_benchmark_assets(db, sample=sample, symbols=symbols)
        if symbols:
            found_symbols = {asset.symbol.upper() for asset in assets}
            result["skipped_missing_asset"] = len(
                [symbol for symbol in symbols if symbol.upper() not in found_symbols]
            )

        runtime_ms_values: list[float] = []
        candidate_counts: list[int] = []
        theme_confidence_values: list[float] = []
        candidate_score_values: list[float] = []
        parent_match_counts = {1: 0, 3: 0, 5: 0}
        subtheme_match_counts = {1: 0, 3: 0}
        subtheme_comparisons = 0
        segment_stats = _new_segment_stats()

        gemini_service = AssetThemeService(db) if refresh_gemini else None

        for index, asset in enumerate(assets, start=1):
            try:
                stored_themes = _stored_gemini_theme_payload(asset)
                if not refresh_gemini and not stored_themes:
                    result["skipped_no_stored_gemini_classification"] += 1
                    print(
                        f"[{index}/{len(assets)}] SKIP {asset.symbol}: "
                        "no stored Gemini classification",
                        flush=True,
                    )
                    continue

                info = FundamentalsService.fetch_info(
                    asset.symbol,
                    action="asset_theme_minilm_benchmark",
                ) or {}
                summary = _extract_asset_summary(info)
                if not summary:
                    result["skipped_no_summary"] += 1
                    print(f"[{index}/{len(assets)}] SKIP {asset.symbol}: no summary", flush=True)
                    continue

                company_name = info.get("longName") or info.get("shortName") or asset.name
                sector = info.get("sector") or asset.sector
                industry = info.get("industry") or asset.industry

                baseline_themes = stored_themes
                if refresh_gemini:
                    assert gemini_service is not None
                    baseline_themes, _taxonomy_gap = gemini_service.generate_theme_payload(
                        name=company_name,
                        sector=sector,
                        industry=industry,
                        summary=summary,
                    )
                    if not baseline_themes:
                        result["skipped_no_stored_gemini_classification"] += 1
                        print(
                            f"[{index}/{len(assets)}] SKIP {asset.symbol}: "
                            "Gemini returned no benchmark baseline themes",
                            flush=True,
                        )
                        continue

                started_at = time.perf_counter()
                minilm_themes = classifier.classify_asset(
                    name=company_name,
                    sector=sector,
                    industry=industry,
                    summary=summary,
                )
                runtime_ms = (time.perf_counter() - started_at) * 1000

                runtime_ms_values.append(runtime_ms)
                candidate_counts.append(len(minilm_themes))
                theme_confidence_values.extend(
                    float(theme.get("confidence") or 0.0)
                    for theme in minilm_themes
                    if isinstance(theme, dict)
                )
                candidate_score_values.extend(
                    float(theme.get("score") or 0.0)
                    for theme in minilm_themes
                    if isinstance(theme, dict)
                )
                result["sample_size_used"] += 1
                segment = _asset_segment(asset)
                segment_stats[segment]["sample_size_used"] += 1

                stored_parent_labels = _extract_parent_labels(baseline_themes)
                minilm_parent_labels = _extract_parent_labels(minilm_themes)
                parent_matches = {}
                for limit in parent_match_counts:
                    parent_matches[limit] = _has_top_k_match(
                        stored_parent_labels,
                        minilm_parent_labels,
                        limit,
                    )
                    if parent_matches[limit]:
                        parent_match_counts[limit] += 1
                        segment_stats[segment][f"top{limit}_matches"] += 1

                stored_subthemes = _extract_subtheme_labels(baseline_themes)
                minilm_subthemes = _extract_subtheme_labels(minilm_themes)
                subtheme_matches_for_asset: dict[int, Optional[bool]] = {1: None, 3: None}
                if stored_subthemes and minilm_subthemes:
                    subtheme_comparisons += 1
                    segment_stats[segment]["subtheme_comparisons"] += 1
                    for limit in subtheme_match_counts:
                        subtheme_matches_for_asset[limit] = _has_top_k_match(
                            stored_subthemes,
                            minilm_subthemes,
                            limit,
                        )
                        if subtheme_matches_for_asset[limit]:
                            subtheme_match_counts[limit] += 1
                    if subtheme_matches_for_asset[3]:
                        segment_stats[segment]["subtheme_matches"] += 1

                example = {
                    "symbol": asset.symbol,
                    "company_name": company_name,
                    "segment": segment,
                    "stored_gemini_themes": stored_parent_labels,
                    "minilm_candidates": _candidate_summary(minilm_themes),
                }
                top5_match = _has_top_k_match(stored_parent_labels, minilm_parent_labels, 5)
                top_candidate = minilm_themes[0] if minilm_themes else {}
                top_needs_review = bool(top_candidate.get("needs_review"))
                top_gemini_confidence = _top_confidence(baseline_themes)
                top_minilm_confidence = _top_confidence(minilm_themes)
                confidence_delta = (
                    round(top_minilm_confidence - top_gemini_confidence, 4)
                    if top_gemini_confidence is not None and top_minilm_confidence is not None
                    else None
                )
                result["asset_results"].append(
                    {
                        "symbol": asset.symbol,
                        "company_name": company_name,
                        "segment": segment,
                        "stored_gemini_parent_themes": stored_parent_labels,
                        "stored_gemini_subthemes": stored_subthemes,
                        "minilm_parent_themes": minilm_parent_labels,
                        "minilm_subthemes": minilm_subthemes,
                        "parent_top1_match": parent_matches[1],
                        "parent_top3_match": parent_matches[3],
                        "parent_top5_match": parent_matches[5],
                        "subtheme_top1_match": subtheme_matches_for_asset[1],
                        "subtheme_top3_match": subtheme_matches_for_asset[3],
                        "gemini_top_confidence": top_gemini_confidence,
                        "minilm_top_confidence": top_minilm_confidence,
                        "confidence_delta": confidence_delta,
                        "top_candidate_score": _top_score(minilm_themes),
                        "needs_review": top_needs_review,
                        "review_reasons": top_candidate.get("review_reasons", []),
                        "runtime_ms": round(runtime_ms, 2),
                        "minilm_candidates": _candidate_summary(minilm_themes),
                        "summary_excerpt": _summary_excerpt(summary),
                    }
                )

                if top5_match:
                    if len(result["examples_of_matches"]) < 5:
                        result["examples_of_matches"].append(example)
                    print(f"[{index}/{len(assets)}] OK {asset.symbol}: parent match", flush=True)
                else:
                    if len(result["examples_of_misses"]) < 5:
                        miss_example = dict(example)
                        miss_example["summary_excerpt"] = _summary_excerpt(summary)
                        result["examples_of_misses"].append(miss_example)
                    if (
                        float(top_candidate.get("confidence") or 0.0) >= 0.70
                        and not top_needs_review
                        and len(result["high_confidence_disagreements"]) < 10
                    ):
                        disagreement = dict(example)
                        disagreement["summary_excerpt"] = _summary_excerpt(summary)
                        result["high_confidence_disagreements"].append(disagreement)
                    print(f"[{index}/{len(assets)}] MISS {asset.symbol}: no top-5 parent match", flush=True)

                if top_needs_review and len(result["low_confidence_assets"]) < 10:
                    low_confidence = dict(example)
                    low_confidence["review_reasons"] = top_candidate.get("review_reasons", [])
                    low_confidence["summary_excerpt"] = _summary_excerpt(summary)
                    result["low_confidence_assets"].append(low_confidence)

                if _is_potential_taxonomy_gap(top_candidate) and len(result["potential_taxonomy_gaps"]) < 10:
                    taxonomy_gap = dict(example)
                    taxonomy_gap["review_reasons"] = top_candidate.get("review_reasons", [])
                    taxonomy_gap["summary_excerpt"] = _summary_excerpt(summary)
                    result["potential_taxonomy_gaps"].append(taxonomy_gap)

            except Exception as exc:
                db.rollback()
                result["failed"] += 1
                print(f"[{index}/{len(assets)}] FAIL {asset.symbol}: {exc}", flush=True)

        used = result["sample_size_used"]
        if used:
            result["top1_parent_match_rate"] = round(parent_match_counts[1] / used, 4)
            result["top3_parent_match_rate"] = round(parent_match_counts[3] / used, 4)
            result["top5_parent_match_rate"] = round(parent_match_counts[5] / used, 4)
            result["average_runtime_ms"] = round(mean(runtime_ms_values), 2)
            result["p95_runtime_ms"] = round(_percentile(runtime_ms_values, 95), 2)
            result["average_candidates_per_asset"] = round(mean(candidate_counts), 2)

        if subtheme_comparisons:
            result["top1_subtheme_match_rate"] = round(
                subtheme_match_counts[1] / subtheme_comparisons,
                4,
            )
            result["top3_subtheme_match_rate"] = round(
                subtheme_match_counts[3] / subtheme_comparisons,
                4,
            )
            result["subtheme_top3_match_rate"] = result["top3_subtheme_match_rate"]

        result["theme_confidence_distribution"] = _bucket_distribution(theme_confidence_values)
        result["candidate_score_distribution"] = _bucket_distribution(candidate_score_values)

        result["model_load_ms"] = round(float(getattr(classifier, "model_load_ms", 0.0) or 0.0), 2)
        disk_estimate = getattr(classifier, "estimated_model_disk_mb", None)
        result["estimated_model_disk_mb"] = disk_estimate() if callable(disk_estimate) else None
        memory_estimate = getattr(classifier, "estimated_memory_mb", None)
        result["estimated_memory_mb"] = memory_estimate() if callable(memory_estimate) else None
        result["embedding_document_count"] = int(getattr(classifier, "embedding_document_count", 0) or 0)
        result["segments"] = _finalize_segment_stats(segment_stats)
        if compare_json:
            result["comparison"] = _compare_benchmark_reports(compare_json, result)

        _write_benchmark_reports(result, json_output=json_output, csv_output=csv_output)
        print(json.dumps(result, indent=2), flush=True)
        return result
    finally:
        if owns_db:
            db.close()


def analyze_theme_taxonomy_separability(
    *,
    json_output: Optional[str] = None,
    csv_output: Optional[str] = None,
    parent_similarity_threshold: float = 0.68,
    subtheme_similarity_threshold: float = 0.72,
    cluster_similarity_threshold: float = 0.70,
    nearest_neighbors: int = 5,
    classifier: Optional[AssetThemeMiniLMClassifier] = None,
) -> dict:
    """Run read-only MiniLM taxonomy document separability diagnostics."""

    classifier = classifier or AssetThemeMiniLMClassifier()
    report = build_taxonomy_separability_report(
        classifier=classifier,
        parent_similarity_threshold=parent_similarity_threshold,
        subtheme_similarity_threshold=subtheme_similarity_threshold,
        cluster_similarity_threshold=cluster_similarity_threshold,
        nearest_neighbors=nearest_neighbors,
    )
    write_taxonomy_separability_reports(
        report,
        json_output=json_output,
        csv_output=csv_output,
    )
    print(json.dumps(report, indent=2), flush=True)
    return report


def _select_benchmark_assets(db, sample: int, symbols: Optional[list[str]]) -> list[Asset]:
    query = db.query(Asset).options(joinedload(Asset.theme_classification))
    if symbols:
        normalized = [symbol.upper() for symbol in symbols]
        return query.filter(Asset.symbol.in_(normalized)).order_by(Asset.symbol).all()
    return query.order_by(Asset.symbol).limit(sample).all()


def _stored_gemini_theme_payload(asset: Asset) -> list[dict]:
    classification = getattr(asset, "theme_classification", None)
    if not classification:
        return []
    source = getattr(classification, "source", None)
    if source and source != "gemini":
        return []
    if not source and classification.method not in {"gpt", "llm"}:
        return []
    if not classification.themes:
        return []
    return list(classification.themes or [])


def _extract_asset_summary(info: dict) -> str:
    summary = info.get("longBusinessSummary") or info.get("description") or info.get("summary")
    if not isinstance(summary, str):
        return ""
    return summary.strip()


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
        if not isinstance(children, list):
            continue
        for child in children:
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


def _candidate_summary(themes: list[dict]) -> list[dict]:
    return [
        {
            "label": theme.get("label"),
            "theme": theme.get("theme") or theme.get("label"),
            "score": theme.get("score"),
            "confidence": theme.get("confidence"),
            "score_gap_to_next": theme.get("score_gap_to_next"),
            "weight": theme.get("weight"),
            "needs_review": theme.get("needs_review"),
            "review_reasons": theme.get("review_reasons", []),
            "max_subtheme_similarity": theme.get("max_subtheme_similarity"),
            "matching_subtheme_count": theme.get("matching_subtheme_count"),
            "children": [
                {
                    "label": child.get("label"),
                    "confidence": child.get("confidence"),
                    "score": child.get("score"),
                }
                for child in theme.get("children", [])[:3]
                if isinstance(child, dict)
            ],
        }
        for theme in themes[:5]
        if isinstance(theme, dict)
    ]


def _top_confidence(themes: list[dict]) -> Optional[float]:
    for theme in themes or []:
        if not isinstance(theme, dict):
            continue
        confidence = theme.get("confidence")
        if confidence is None:
            continue
        try:
            return round(float(confidence), 4)
        except (TypeError, ValueError):
            continue
    return None


def _top_score(themes: list[dict]) -> Optional[float]:
    for theme in themes or []:
        if not isinstance(theme, dict):
            continue
        score = theme.get("score")
        if score is None:
            continue
        try:
            return round(float(score), 4)
        except (TypeError, ValueError):
            continue
    return None


def _bucket_distribution(values: list[float], bucket_size: float = 0.1) -> list[dict]:
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


def _write_benchmark_reports(
    result: dict,
    *,
    json_output: Optional[str] = None,
    csv_output: Optional[str] = None,
) -> None:
    if json_output:
        path = Path(json_output).expanduser()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"Wrote JSON benchmark report to {path}", flush=True)

    if csv_output:
        path = Path(csv_output).expanduser()
        path.parent.mkdir(parents=True, exist_ok=True)
        rows = result.get("asset_results") or []
        fieldnames = [
            "symbol",
            "company_name",
            "segment",
            "stored_gemini_parent_themes",
            "stored_gemini_subthemes",
            "minilm_parent_themes",
            "minilm_subthemes",
            "parent_top1_match",
            "parent_top3_match",
            "parent_top5_match",
            "subtheme_top1_match",
            "subtheme_top3_match",
            "gemini_top_confidence",
            "minilm_top_confidence",
            "confidence_delta",
            "top_candidate_score",
            "needs_review",
            "review_reasons",
            "runtime_ms",
            "summary_excerpt",
        ]
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            for row in rows:
                writer.writerow({
                    field: _csv_value(row.get(field))
                    for field in fieldnames
                })
        print(f"Wrote CSV benchmark report to {path}", flush=True)


def _compare_benchmark_reports(baseline_json: str, current: dict) -> dict:
    path = Path(baseline_json).expanduser()
    baseline = json.loads(path.read_text(encoding="utf-8"))
    baseline_metrics = baseline.get("metrics") if isinstance(baseline.get("metrics"), dict) else baseline
    current_metrics = current.get("metrics") if isinstance(current.get("metrics"), dict) else current

    metric_names = (
        "top1_parent_match_rate",
        "top3_parent_match_rate",
        "top5_parent_match_rate",
        "top1_subtheme_match_rate",
        "top3_subtheme_match_rate",
    )
    metric_deltas = {}
    for metric_name in metric_names:
        baseline_value = baseline_metrics.get(metric_name)
        current_value = current_metrics.get(metric_name)
        metric_deltas[metric_name] = {
            "before": baseline_value,
            "after": current_value,
            "delta": _numeric_delta(current_value, baseline_value),
        }

    baseline_assets = {
        row.get("symbol"): row
        for row in baseline.get("asset_results", [])
        if isinstance(row, dict) and row.get("symbol")
    }
    current_assets = {
        row.get("symbol"): row
        for row in current.get("asset_results", [])
        if isinstance(row, dict) and row.get("symbol")
    }
    common_symbols = sorted(set(baseline_assets).intersection(current_assets))
    asset_deltas = []
    for symbol in common_symbols:
        before = baseline_assets[symbol]
        after = current_assets[symbol]
        before_score = _agreement_score(before)
        after_score = _agreement_score(after)
        before_confidence = float(before.get("minilm_top_confidence") or 0.0)
        after_confidence = float(after.get("minilm_top_confidence") or 0.0)
        asset_deltas.append(
            {
                "symbol": symbol,
                "company_name": after.get("company_name") or before.get("company_name"),
                "before_score": before_score,
                "after_score": after_score,
                "agreement_delta": round(after_score - before_score, 4),
                "before_minilm_parent_themes": before.get("minilm_parent_themes", []),
                "after_minilm_parent_themes": after.get("minilm_parent_themes", []),
                "stored_gemini_parent_themes": after.get("stored_gemini_parent_themes")
                or before.get("stored_gemini_parent_themes", []),
                "before_needs_review": before.get("needs_review"),
                "after_needs_review": after.get("needs_review"),
                "confidence_delta": round(after_confidence - before_confidence, 4),
            }
        )

    return {
        "baseline_json": str(path),
        "common_asset_count": len(common_symbols),
        "metric_deltas": metric_deltas,
        "most_improved_assets": sorted(
            asset_deltas,
            key=lambda row: (-row["agreement_delta"], -row["confidence_delta"], row["symbol"]),
        )[:10],
        "most_degraded_assets": sorted(
            asset_deltas,
            key=lambda row: (row["agreement_delta"], row["confidence_delta"], row["symbol"]),
        )[:10],
    }


def _numeric_delta(current_value, baseline_value) -> Optional[float]:
    if current_value is None or baseline_value is None:
        return None
    try:
        return round(float(current_value) - float(baseline_value), 4)
    except (TypeError, ValueError):
        return None


def _agreement_score(row: dict) -> float:
    if row.get("parent_top1_match"):
        return 1.0
    if row.get("parent_top3_match"):
        return 0.66
    if row.get("parent_top5_match"):
        return 0.33
    return 0.0


def _csv_value(value) -> object:
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return value


def _new_segment_stats() -> dict[str, dict[str, int]]:
    return {
        segment: {
            "sample_size_used": 0,
            "top1_matches": 0,
            "top3_matches": 0,
            "top5_matches": 0,
            "subtheme_comparisons": 0,
            "subtheme_matches": 0,
        }
        for segment in ("equities", "funds_etfs", "crypto")
    }


def _finalize_segment_stats(segment_stats: dict[str, dict[str, int]]) -> dict[str, dict[str, object]]:
    segments: dict[str, dict[str, object]] = {}
    for segment, stats in segment_stats.items():
        used = stats["sample_size_used"]
        comparisons = stats["subtheme_comparisons"]
        segments[segment] = {
            "sample_size_used": used,
            "top1_parent_match_rate": round(stats["top1_matches"] / used, 4) if used else 0.0,
            "top3_parent_match_rate": round(stats["top3_matches"] / used, 4) if used else 0.0,
            "top5_parent_match_rate": round(stats["top5_matches"] / used, 4) if used else 0.0,
            "subtheme_top3_match_rate": (
                round(stats["subtheme_matches"] / comparisons, 4)
                if comparisons
                else None
            ),
        }
    return segments


def _asset_segment(asset: Asset) -> str:
    class_value = _string_value(getattr(asset, "class_", None))
    asset_type = _string_value(getattr(asset, "asset_type", None))
    combined = f"{class_value} {asset_type}".casefold()

    if "crypto" in combined:
        return "crypto"
    if any(value in combined for value in ("etf", "fund", "mutual")):
        return "funds_etfs"
    return "equities"


def _string_value(value) -> str:
    if value is None:
        return ""
    enum_value = getattr(value, "value", None)
    if enum_value is not None:
        return str(enum_value)
    return str(value)


def _is_potential_taxonomy_gap(top_candidate: dict) -> bool:
    if not top_candidate:
        return True
    reasons = set(top_candidate.get("review_reasons") or [])
    return (
        "no_strong_subtheme_evidence" in reasons
        or float(top_candidate.get("max_subtheme_similarity") or 0.0) < 0.30
    )


def _summary_excerpt(summary: str, max_chars: int = 320) -> str:
    normalized = " ".join(summary.strip().split())
    if len(normalized) <= max_chars:
        return normalized
    return normalized[:max_chars].rstrip(" ,;:")


def _percentile(values: list[float], percentile: int) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, math.ceil((percentile / 100) * len(ordered)) - 1)
    return ordered[index]


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    refresh_parser = subparsers.add_parser("refresh-themes")
    refresh_parser.add_argument("--symbol", type=str, default=None)
    refresh_parser.add_argument("--force", action="store_true")

    benchmark_parser = subparsers.add_parser("benchmark-theme-minilm")
    benchmark_parser.add_argument("--sample", type=int, default=100)
    benchmark_parser.add_argument("--symbols", type=str, default=None)
    refresh_group = benchmark_parser.add_mutually_exclusive_group()
    refresh_group.add_argument("--refresh-gemini", dest="refresh_gemini", action="store_true")
    refresh_group.add_argument("--no-gemini-refresh", dest="refresh_gemini", action="store_false")
    benchmark_parser.set_defaults(refresh_gemini=False)
    benchmark_parser.add_argument("--download-model", action="store_true")
    benchmark_parser.add_argument("--json-output", type=str, default=None)
    benchmark_parser.add_argument("--csv-output", type=str, default=None)
    benchmark_parser.add_argument(
        "--compare-json",
        type=str,
        default=None,
        help="Optional prior benchmark JSON to compare against this run.",
    )

    separability_parser = subparsers.add_parser("analyze-theme-taxonomy-separability")
    separability_parser.add_argument("--json-output", type=str, default=None)
    separability_parser.add_argument("--csv-output", type=str, default=None)
    separability_parser.add_argument("--parent-threshold", type=float, default=0.68)
    separability_parser.add_argument("--subtheme-threshold", type=float, default=0.72)
    separability_parser.add_argument("--cluster-threshold", type=float, default=0.70)
    separability_parser.add_argument("--nearest-neighbors", type=int, default=5)

    subparsers.add_parser("sanity-theme-minilm")

    args = parser.parse_args()

    if args.command == "refresh-themes":
        refresh_themes(symbol=args.symbol, force=args.force)
    elif args.command == "benchmark-theme-minilm":
        symbols = [
            symbol.strip().upper()
            for symbol in (args.symbols or "").split(",")
            if symbol.strip()
        ] or None
        benchmark_theme_minilm(
            sample=args.sample,
            symbols=symbols,
            refresh_gemini=args.refresh_gemini,
            download_model=args.download_model,
            json_output=args.json_output,
            csv_output=args.csv_output,
            compare_json=args.compare_json,
        )
    elif args.command == "analyze-theme-taxonomy-separability":
        analyze_theme_taxonomy_separability(
            json_output=args.json_output,
            csv_output=args.csv_output,
            parent_similarity_threshold=args.parent_threshold,
            subtheme_similarity_threshold=args.subtheme_threshold,
            cluster_similarity_threshold=args.cluster_threshold,
            nearest_neighbors=args.nearest_neighbors,
        )
    elif args.command == "sanity-theme-minilm":
        sanity_theme_minilm()


if __name__ == "__main__":
    main()
