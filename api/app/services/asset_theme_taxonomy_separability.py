"""Read-only MiniLM taxonomy separability diagnostics."""
from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path
from statistics import mean
from typing import Any, Dict, Optional, Sequence

from app.services.asset_theme_minilm import (
    AssetThemeMiniLMClassifier,
    ThemeDocument,
    cosine_similarity,
)


DEFAULT_PARENT_SIMILARITY_THRESHOLD = 0.68
DEFAULT_SUBTHEME_SIMILARITY_THRESHOLD = 0.72
DEFAULT_CLUSTER_SIMILARITY_THRESHOLD = 0.70
DEFAULT_NEAREST_NEIGHBORS = 5

FOCUS_OVERLAP_GROUPS = [
    (
        "financial_platforms",
        (
            "Investment Platforms",
            "Digital Finance",
            "Market Infrastructure",
            "Crypto Infrastructure",
        ),
    ),
    (
        "enterprise_ai_industrial_software",
        ("Enterprise SaaS", "AI Applications", "Industrial Digitalization"),
    ),
    (
        "biotech_precision_consumer_health",
        (
            "Biotechnology Platforms",
            "Precision Medicine",
            "AI Drug Discovery",
            "Consumer Health",
            "Medical Technology",
        ),
    ),
    ("commerce_media_adtech", ("Digital Commerce", "Digital Media", "AdTech")),
    (
        "automation_industrial_autonomy",
        ("Robotics & Automation", "Industrial Digitalization", "Autonomous Mobility"),
    ),
]


def build_taxonomy_separability_report(
    *,
    classifier: Optional[AssetThemeMiniLMClassifier] = None,
    parent_similarity_threshold: float = DEFAULT_PARENT_SIMILARITY_THRESHOLD,
    subtheme_similarity_threshold: float = DEFAULT_SUBTHEME_SIMILARITY_THRESHOLD,
    cluster_similarity_threshold: float = DEFAULT_CLUSTER_SIMILARITY_THRESHOLD,
    nearest_neighbors: int = DEFAULT_NEAREST_NEIGHBORS,
) -> Dict[str, Any]:
    """Embed MiniLM taxonomy documents and report theme collisions without side effects."""

    classifier = classifier or AssetThemeMiniLMClassifier()
    parent_documents = classifier._build_parent_documents(classifier.theme_registry)
    subtheme_documents = classifier._build_subtheme_documents(classifier.theme_registry)

    all_documents = [*parent_documents, *subtheme_documents]
    vectors = classifier.embedding_backend.embed([document.document for document in all_documents])
    parent_count = len(parent_documents)
    parent_vectors = vectors[:parent_count]
    subtheme_vectors = vectors[parent_count:]

    parent_pairs = _pairwise_rows(parent_documents, parent_vectors)
    subtheme_pairs = _pairwise_rows(
        subtheme_documents,
        subtheme_vectors,
        cross_parent_only=True,
    )
    high_parent_pairs = [
        row for row in parent_pairs if row["cosine_similarity"] >= parent_similarity_threshold
    ]
    high_subtheme_pairs = [
        row for row in subtheme_pairs if row["cosine_similarity"] >= subtheme_similarity_threshold
    ]

    all_pairs = _pairwise_rows(all_documents, vectors)
    clusters = _ambiguity_clusters(
        documents=all_documents,
        pair_rows=all_pairs,
        threshold=cluster_similarity_threshold,
    )

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "diagnostic": "theme_taxonomy_separability",
        "model": classifier._model_debug_metadata(),
        "thresholds": {
            "parent_similarity": parent_similarity_threshold,
            "subtheme_similarity": subtheme_similarity_threshold,
            "cluster_similarity": cluster_similarity_threshold,
            "nearest_neighbors": nearest_neighbors,
        },
        "document_counts": {
            "parents": len(parent_documents),
            "subthemes": len(subtheme_documents),
            "total": len(all_documents),
        },
        "parent_pairwise_similarities": parent_pairs,
        "highly_similar_parent_themes": high_parent_pairs,
        "subtheme_pairwise_similarity_count": len(subtheme_pairs),
        "subtheme_pairwise_similarities": subtheme_pairs,
        "highly_similar_subthemes_across_parents": high_subtheme_pairs,
        "nearest_neighbors_per_parent": _nearest_neighbors(
            parent_documents,
            parent_vectors,
            nearest_neighbors,
        ),
        "nearest_neighbors_per_subtheme": _nearest_neighbors(
            subtheme_documents,
            subtheme_vectors,
            nearest_neighbors,
            cross_parent_only=True,
        ),
        "ambiguity_clusters": clusters,
        "focus_overlap_groups": _focus_overlap_groups(parent_pairs),
    }


def write_taxonomy_separability_reports(
    report: Dict[str, Any],
    *,
    json_output: Optional[str] = None,
    csv_output: Optional[str] = None,
) -> None:
    if json_output:
        path = Path(json_output).expanduser()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"Wrote JSON taxonomy separability report to {path}", flush=True)

    if csv_output:
        path = Path(csv_output).expanduser()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=[
                    "row_type",
                    "label",
                    "parent",
                    "other_label",
                    "other_parent",
                    "level",
                    "cosine_similarity",
                    "rank",
                    "cluster_id",
                    "cluster_size",
                    "avg_similarity",
                ],
            )
            writer.writeheader()
            _write_pair_rows(writer, "parent_pair", report["parent_pairwise_similarities"])
            _write_pair_rows(
                writer,
                "subtheme_pair",
                report["subtheme_pairwise_similarities"],
            )
            _write_pair_rows(
                writer,
                "high_subtheme_pair",
                report["highly_similar_subthemes_across_parents"],
            )
            _write_neighbor_rows(writer, "parent_neighbor", report["nearest_neighbors_per_parent"])
            _write_neighbor_rows(writer, "subtheme_neighbor", report["nearest_neighbors_per_subtheme"])
            for index, cluster in enumerate(report["ambiguity_clusters"], start=1):
                for member in cluster["members"]:
                    writer.writerow(
                        {
                            "row_type": "cluster_member",
                            "label": member["label"],
                            "parent": member["parent_label"],
                            "level": member["level"],
                            "cluster_id": index,
                            "cluster_size": cluster["size"],
                            "avg_similarity": cluster["average_similarity"],
                        }
                    )
        print(f"Wrote CSV taxonomy separability report to {path}", flush=True)


def _pairwise_rows(
    documents: Sequence[ThemeDocument],
    vectors: Sequence[Sequence[float]],
    *,
    cross_parent_only: bool = False,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for left_index, left_document in enumerate(documents):
        for right_index in range(left_index + 1, len(documents)):
            right_document = documents[right_index]
            if cross_parent_only and left_document.parent_label == right_document.parent_label:
                continue
            rows.append(
                _similarity_row(
                    left_document,
                    right_document,
                    cosine_similarity(vectors[left_index], vectors[right_index]),
                )
            )
    return sorted(rows, key=lambda row: (-row["cosine_similarity"], row["label"], row["other_label"]))


def _similarity_row(
    left: ThemeDocument,
    right: ThemeDocument,
    similarity: float,
) -> dict[str, Any]:
    return {
        "label": left.label,
        "parent_label": left.parent_label,
        "level": left.level,
        "other_label": right.label,
        "other_parent_label": right.parent_label,
        "other_level": right.level,
        "cosine_similarity": round(float(similarity), 6),
    }


def _nearest_neighbors(
    documents: Sequence[ThemeDocument],
    vectors: Sequence[Sequence[float]],
    limit: int,
    *,
    cross_parent_only: bool = False,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for left_index, document in enumerate(documents):
        candidates: list[dict[str, Any]] = []
        for right_index, other_document in enumerate(documents):
            if left_index == right_index:
                continue
            if cross_parent_only and document.parent_label == other_document.parent_label:
                continue
            candidates.append(
                {
                    "label": other_document.label,
                    "parent_label": other_document.parent_label,
                    "level": other_document.level,
                    "cosine_similarity": round(
                        cosine_similarity(vectors[left_index], vectors[right_index]),
                        6,
                    ),
                }
            )
        rows.append(
            {
                "label": document.label,
                "parent_label": document.parent_label,
                "level": document.level,
                "neighbors": sorted(
                    candidates,
                    key=lambda row: (-row["cosine_similarity"], row["parent_label"], row["label"]),
                )[:limit],
            }
        )
    return rows


def _ambiguity_clusters(
    *,
    documents: Sequence[ThemeDocument],
    pair_rows: Sequence[dict[str, Any]],
    threshold: float,
) -> list[dict[str, Any]]:
    adjacency: dict[int, set[int]] = {index: set() for index in range(len(documents))}
    index_by_key = {
        _document_key(document): index
        for index, document in enumerate(documents)
    }
    for row in pair_rows:
        if row["cosine_similarity"] < threshold:
            continue
        left = index_by_key.get((row["level"], row["parent_label"], row["label"]))
        right = index_by_key.get((row["other_level"], row["other_parent_label"], row["other_label"]))
        if left is None or right is None:
            continue
        adjacency[left].add(right)
        adjacency[right].add(left)

    clusters: list[dict[str, Any]] = []
    visited: set[int] = set()
    for start in range(len(documents)):
        if start in visited or not adjacency[start]:
            continue
        stack = [start]
        component: set[int] = set()
        while stack:
            current = stack.pop()
            if current in component:
                continue
            component.add(current)
            stack.extend(adjacency[current] - component)
        visited.update(component)
        if len(component) < 2:
            continue
        member_docs = [documents[index] for index in sorted(component)]
        parent_labels = sorted({document.parent_label for document in member_docs})
        edge_similarities = [
            row["cosine_similarity"]
            for row in pair_rows
            if row["cosine_similarity"] >= threshold
            and (row["level"], row["parent_label"], row["label"]) in {
                _document_key(document) for document in member_docs
            }
            and (row["other_level"], row["other_parent_label"], row["other_label"]) in {
                _document_key(document) for document in member_docs
            }
        ]
        clusters.append(
            {
                "size": len(member_docs),
                "parent_count": len(parent_labels),
                "parents": parent_labels,
                "average_similarity": round(mean(edge_similarities), 6)
                if edge_similarities
                else 0.0,
                "max_similarity": max(edge_similarities) if edge_similarities else 0.0,
                "members": [
                    {
                        "label": document.label,
                        "parent_label": document.parent_label,
                        "level": document.level,
                    }
                    for document in member_docs
                ],
            }
        )
    return sorted(
        clusters,
        key=lambda row: (-row["parent_count"], -row["average_similarity"], -row["size"]),
    )


def _document_key(document: ThemeDocument) -> tuple[str, str, str]:
    return (document.level, document.parent_label, document.label)


def _focus_overlap_groups(parent_pairs: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    pair_lookup = {
        frozenset((row["label"], row["other_label"])): row
        for row in parent_pairs
        if row["level"] == "parent" and row["other_level"] == "parent"
    }
    groups: list[dict[str, Any]] = []
    for name, labels in FOCUS_OVERLAP_GROUPS:
        rows: list[dict[str, Any]] = []
        for index, label in enumerate(labels):
            for other_label in labels[index + 1 :]:
                row = pair_lookup.get(frozenset((label, other_label)))
                if row:
                    rows.append(row)
        groups.append(
            {
                "name": name,
                "themes": list(labels),
                "pairwise_parent_similarities": sorted(
                    rows,
                    key=lambda row: -row["cosine_similarity"],
                ),
            }
        )
    return groups


def _write_pair_rows(
    writer: csv.DictWriter,
    row_type: str,
    rows: Sequence[dict[str, Any]],
) -> None:
    for row in rows:
        writer.writerow(
            {
                "row_type": row_type,
                "label": row["label"],
                "parent": row["parent_label"],
                "other_label": row["other_label"],
                "other_parent": row["other_parent_label"],
                "level": row["level"],
                "cosine_similarity": row["cosine_similarity"],
            }
        )


def _write_neighbor_rows(
    writer: csv.DictWriter,
    row_type: str,
    rows: Sequence[dict[str, Any]],
) -> None:
    for row in rows:
        for rank, neighbor in enumerate(row["neighbors"], start=1):
            writer.writerow(
                {
                    "row_type": row_type,
                    "label": row["label"],
                    "parent": row["parent_label"],
                    "other_label": neighbor["label"],
                    "other_parent": neighbor["parent_label"],
                    "level": row["level"],
                    "cosine_similarity": neighbor["cosine_similarity"],
                    "rank": rank,
                }
            )
