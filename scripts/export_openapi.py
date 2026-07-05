#!/usr/bin/env python3
"""Export the FastAPI OpenAPI schema used by the public documentation."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "api"
OUTPUT_PATH = ROOT / "docs" / "api" / "openapi.json"


def configure_safe_environment() -> None:
    """Set deterministic values so importing the app does not require local secrets."""
    defaults = {
        "ADMIN_AUTO_CREATE": "false",
        "DATABASE_URL": "sqlite:///:memory:",
        "ENABLE_BACKGROUND_TASKS": "false",
        "LOG_FILE_ENABLED": "false",
        "REDIS_ENABLED": "false",
        "SECRET_KEY": "docs-export-secret-key-change-me-123456",
        "TESTING": "true",
    }
    for key, value in defaults.items():
        os.environ.setdefault(key, value)


def main() -> int:
    configure_safe_environment()
    sys.path.insert(0, str(API_ROOT))

    from app.main import app

    schema = app.openapi()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Exported OpenAPI schema to {OUTPUT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
