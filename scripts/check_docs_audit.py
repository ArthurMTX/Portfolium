#!/usr/bin/env python3
"""Validate that the documentation audit manifest tracks every Markdown page."""

from __future__ import annotations

import sys
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
DOCS_ROOT = ROOT / "docs"
AUDIT_PATH = DOCS_ROOT / "audit.yml"
ALLOWED_STATUS = {
    "current",
    "partial",
    "stale",
    "needs_verification",
    "obsolete",
    "planned",
}
ALLOWED_ACTION = {
    "keep",
    "revise",
    "rewrite",
    "merge",
    "rename",
    "remove_from_nav",
    "archive",
    "verify_against_code",
    "add",
}


def _load_manifest() -> dict:
    with AUDIT_PATH.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ValueError("docs/audit.yml must contain a mapping")
    return data


def _entry_path(entry: object) -> str | None:
    if not isinstance(entry, dict):
        return None
    path = entry.get("path")
    return path if isinstance(path, str) else None


def main() -> int:
    failures: list[str] = []
    manifest = _load_manifest()
    pages = manifest.get("pages", [])
    planned_pages = manifest.get("planned_pages", [])

    if not isinstance(pages, list):
        failures.append("`pages` must be a list")
        pages = []
    if not isinstance(planned_pages, list):
        failures.append("`planned_pages` must be a list")
        planned_pages = []

    tracked_paths: set[str] = set()
    for section_name, entries in (("pages", pages), ("planned_pages", planned_pages)):
        for index, entry in enumerate(entries):
            if not isinstance(entry, dict):
                failures.append(f"{section_name}[{index}] must be a mapping")
                continue
            path = _entry_path(entry)
            if not path:
                failures.append(f"{section_name}[{index}] is missing a string `path`")
                continue
            if path in tracked_paths:
                failures.append(f"{path}: duplicate audit entry")
            tracked_paths.add(path)

            status = entry.get("status")
            action = entry.get("action")
            if status not in ALLOWED_STATUS:
                failures.append(f"{path}: invalid status `{status}`")
            if action not in ALLOWED_ACTION:
                failures.append(f"{path}: invalid action `{action}`")

            source = entry.get("source", [])
            if source is not None and not isinstance(source, list):
                failures.append(f"{path}: `source` must be a list when present")

            if section_name == "pages" and not (ROOT / path).exists():
                failures.append(f"{path}: tracked page does not exist")

    actual_pages = {
        str(path.relative_to(ROOT))
        for path in DOCS_ROOT.rglob("*.md")
    }
    missing = sorted(actual_pages - tracked_paths)
    extra_existing = sorted(
        path
        for path in tracked_paths - actual_pages
        if path.startswith("docs/") and path not in {entry.get("path") for entry in planned_pages if isinstance(entry, dict)}
    )

    for path in missing:
        failures.append(f"{path}: Markdown page is missing from docs/audit.yml")
    for path in extra_existing:
        failures.append(f"{path}: audit references a missing page outside planned_pages")

    if failures:
        print("Documentation audit check failed:")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print(f"Documentation audit check passed: {len(actual_pages)} Markdown pages tracked.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
