# Testing

Portfolium uses focused backend tests, frontend unit checks, TypeScript checks, linting, and documentation build checks. The CI quality gate is defined in `.github/workflows/quality.yml`.

## Backend Tests

Backend tests live in `api/tests` and run with pytest.

```bash
cd api
pip install -e ".[dev]"
pytest -q
```

Useful targeted runs:

```bash
pytest tests/test_logo_resolver.py -q
pytest tests/test_pricing_service.py tests/test_prices.py -q
pytest tests/test_asset_theme_minilm.py -q
```

The Docker test profile runs the backend test suite in the same image family used by the app:

```bash
make test-backend
```

## Frontend Checks

Frontend checks live under `web`.

```bash
cd web
npm ci
npm test
npm run typecheck
npm run lint
```

`npm run build` also builds the documentation before compiling TypeScript and running the Vite production build.

## Documentation Checks

Documentation changes should pass:

```bash
pip install -r docs/requirements.txt -e ./api
make docs-check
```

This performs three checks:

1. exports `docs/api/openapi.json` from the FastAPI app;
2. fails on placeholder markers such as unfinished documentation notices;
3. runs `mkdocs build --strict` to catch broken navigation and links.

When API routes or schemas change, regenerate the OpenAPI file and commit the diff:

```bash
python scripts/export_openapi.py
```

## CI Quality Gate

The reusable quality workflow runs:

| Job | Checks |
| --- | --- |
| `frontend` | `npm test`, `npm run typecheck`, `npm run lint`, production dependency audit |
| `backend` | install API dev dependencies, critical Ruff rules, compileall, pytest, pip-audit |
| `docs` | install docs/API dependencies, export OpenAPI, require committed schema diff, docs health check, strict MkDocs build |
| `filesystem-security` | Trivy misconfiguration scan for `docker-compose.yml` |

Docker image builds depend on this quality gate.

## Test Selection Guidance

| Change area | Minimum checks |
| --- | --- |
| Router or schema changes | Targeted backend tests, `python scripts/export_openapi.py`, `make docs-check` |
| Pricing, market data, currency, calendars | Relevant service tests plus endpoint tests if responses change |
| Logo resolution and asset metadata | `test_logo_resolver.py`, `test_logos.py`, `test_assets_logo_endpoint.py`, docs for logo behavior |
| Portfolio metrics or insights | Metrics, insights, split, risk, and dashboard cache tests |
| Frontend UI behavior | `npm test`, `npm run typecheck`, `npm run lint`, manual smoke test in Vite |
| Docker or environment changes | `make docs-check`, Docker compose smoke test, update configuration docs |

## Writing New Tests

Prefer small tests that exercise the business rule directly. Add broader integration coverage when a change crosses routers, services, database models, or background tasks.

Keep fixtures realistic enough to catch portfolio-specific edge cases: multiple currencies, partial sells, dividends, stock splits, missing prices, sold positions, ETFs, crypto, and assets with incomplete metadata.
## Ruff scope

Ruff is immediately blocking for Python syntax errors, invalid control flow,
undefined names, duplicate definitions, malformed f-strings and bare `except`
clauses (`E9`, `F63`, `F7`, `F82`, `F541`, `F811`, `E722`). New code must pass
this gate.

The audit for 0.4.0 also found pre-existing import-order and unused-import debt,
plus modernization and framework-aware warnings. Those remain non-blocking to
avoid a mass formatting/refactoring change. A future cleanup can enable `I`,
the remainder of `F`, then selected `UP` and `B` rules in separate passes.
