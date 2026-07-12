# MiniLM Theme Benchmark

Portfolium can classify assets into investment themes with a local MiniLM runtime. This page documents how to validate that taxonomy changes keep useful separation between themes and subthemes.

## Runtime Context

The default classifier mode is `minilm`, configured by `ASSET_THEME_CLASSIFIER_MODE`. Gemini remains available through `ASSET_THEME_CLASSIFIER_MODE=gemini` when `GEMINI_API_KEY` is configured, but the local path is the baseline for self-hosted installs.

Relevant modules:

- `api/app/services/asset_intelligence/asset_theme_minilm.py`
- `api/app/services/asset_intelligence/asset_theme_minilm_runtime.py`
- `api/app/services/asset_intelligence/asset_theme_minilm_registry.py`
- `api/app/services/asset_intelligence/asset_theme_taxonomy_separability.py`
- `api/tests/test_asset_theme_minilm.py`

## What to Check

Run the benchmark-oriented tests after changing theme labels, subthemes, scoring thresholds, or model loading behavior:

```bash
cd api
pytest tests/test_asset_theme_minilm.py tests/test_asset_theme_taxonomy_suggestions.py -q
```

The tests check that explicit theme documents remain more separable than generic documents and that taxonomy suggestions do not collapse unrelated labels into the same semantic bucket.

## Operational Notes

- The Docker dev stack stores the MiniLM cache in the `theme_minilm_cache` volume.
- `THEME_MINILM_AUTO_DOWNLOAD=true` allows first-run model download.
- `THEME_MINILM_MODEL_PATH` can point to a preloaded model directory for offline or pinned deployments.
- Keep `THEME_MINILM_TOP_K` high enough for diagnostics, but avoid treating a low-ranked match as a confident classification in user-facing flows.
