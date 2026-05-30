from __future__ import annotations

import argparse
import json
from typing import Optional

from app.db import SessionLocal
from app.models import Asset
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
                info = FundamentalsService.fetch_info(
                    asset.symbol,
                    action="asset_theme_cli_refresh",
                ) or {}

                summary = info.get("longBusinessSummary") or info.get("description")

                if not summary or not str(summary).strip():
                    result["skipped_no_summary"] += 1
                    print(f"[{index}/{len(assets)}] SKIP {asset.symbol}: no summary", flush=True)
                    continue

                classification = service.refresh_gemini_classification(
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


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    refresh_parser = subparsers.add_parser("refresh-themes")
    refresh_parser.add_argument("--symbol", type=str, default=None)
    refresh_parser.add_argument("--force", action="store_true")

    args = parser.parse_args()

    if args.command == "refresh-themes":
        refresh_themes(symbol=args.symbol, force=args.force)


if __name__ == "__main__":
    main()
