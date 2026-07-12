#!/usr/bin/env python3
"""Small documentation quality gates that complement `mkdocs build --strict`."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS_ROOT = ROOT / "docs"

BLOCKED_PATTERNS = (
    re.compile(r"documentation coming soon", re.IGNORECASE),
    re.compile(r"\bTODO\b", re.IGNORECASE),
    re.compile(r"\bTBD\b", re.IGNORECASE),
    re.compile(r"\bFIXME\b", re.IGNORECASE),
)


def main() -> int:
    failures: list[str] = []

    for path in sorted(DOCS_ROOT.rglob("*.md")):
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT)
        for pattern in BLOCKED_PATTERNS:
            for match in pattern.finditer(text):
                line_number = text.count("\n", 0, match.start()) + 1
                failures.append(f"{rel}:{line_number}: placeholder marker `{match.group(0)}`")

    if failures:
        print("Documentation health check failed:")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print("Documentation health check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
