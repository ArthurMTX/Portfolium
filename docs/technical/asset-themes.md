# Asset Themes

How Portfolium classifies assets into investment themes (e.g. "AI Infrastructure", "Clean Energy") beyond the standard sector/industry taxonomy from market data providers.

## Overview

Theme classification runs in `api/app/services/asset_intelligence/`. Unlike sector/industry (sourced from Yahoo Finance), themes are assigned by Portfolium itself — either through a lightweight local model or an LLM — and stored per-asset in `asset_theme_classifications` (see [Data Models](data-models.md)).

## Classification Methods

Two classifiers implement the same interface (`AssetThemeClassifier` protocol), selectable per deployment:

- **MiniLM** (`sentence-transformers/all-MiniLM-L6-v2`) — a small local embedding model that runs without external API calls. Fast and free, but coarser than an LLM. See the [MiniLM benchmark](../development/theme-minilm-benchmark.md) for accuracy notes.
- **Gemini** — an LLM-based classifier that reads asset context (name, sector, description) and assigns themes with a reasoning trace. More accurate on ambiguous or niche assets, but requires API access and costs more per classification.

Only stock/equity-class assets are classified — ETFs and crypto are excluded, since their multi-asset or single-asset nature doesn't map cleanly onto a single theme.

## Confidence and Weight Filtering

Classifications are filtered before being stored:

- A theme assignment is only kept if its confidence is at least $0.55$ (`MIN_THEME_CONFIDENCE`).
- A theme's contribution weight must be at least $0.05$ (`MIN_THEME_WEIGHT`) to be included — this keeps the [Theme Allocation](../widgets/theme-allocation.md) widget from being cluttered with negligible, low-confidence tags.

## Provenance

Each stored classification records how it was produced: `method` (minilm/gemini), `model` name, and a `source_hash` of the input used, so re-classifying an asset after its description changes is detectable, and results can be traced back to the model/version that produced them.

## Taxonomy Suggestions

When a classifier encounters a theme that doesn't exist in the current taxonomy, it can propose one via `asset_theme_taxonomy_suggestions` rather than silently inventing a new tag. Suggestions sit in a `pending` state until an administrator reviews and approves or rejects them through the admin theme taxonomy tools, keeping the theme list curated rather than uncontrolled.

## Related

- [Theme Allocation widget](../widgets/theme-allocation.md) — the user-facing view built on this classification data
- [MiniLM Theme Benchmark](../development/theme-minilm-benchmark.md) — accuracy evaluation for the local classifier
- [Data Models](data-models.md) — schema for `asset_theme_classifications` and `asset_theme_taxonomy_suggestions`
