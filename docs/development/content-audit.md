# Content Audit

The content audit is the source of truth for the documentation refactor. It tracks every current Markdown page, the code or product surface it should follow, and the action to take during the rewrite.

Machine-readable manifest:

```text
docs/audit.yml
```

Validation:

```bash
python scripts/check_docs_audit.py
```

## Audit Categories

| Status | Meaning |
| --- | --- |
| `current` | Aligned enough with the current codebase. |
| `partial` | Useful but incomplete or missing important current behavior. |
| `stale` | Contains outdated paths, architecture, endpoints, or workflows. |
| `needs_verification` | Likely useful but must be checked against implementation or formulas. |
| `obsolete` | Should be removed, archived, merged, or rewritten from scratch. |
| `planned` | Missing page that should be created. |

## Immediate Findings

| Area | Finding | Next action |
| --- | --- | --- |
| Technical overview | Still references the old scheduler model. | Rewrite around FastAPI, Celery, Redis, PostgreSQL, React, and Docker. |
| Currency conversion | Documents nonexistent `/api/currencies/*` endpoints. | Rewrite around service integration and transaction FX helpers. |
| Logo fetching | Still includes old `/api/assets/logo/*` examples and old provider assumptions. | Rewrite around `logo_resolver.py`, Trade Republic variants, Brandfetch, generated fallback, and cache columns. |
| Dashboard docs | Does not distinguish `/dashboard` overview from `/dashboard/widgets`. | Rewrite the Dashboard guide and widget overview together. |
| Example layouts | Contains outdated suggested widgets. | Remove from nav or rebuild from real default/example layouts. |
| Widgets | Registry has 42 widgets; docs have stale names and missing pages. | Rename stale widget docs and add `today-brief` and `theme-allocation`. |
| Product guide | Missing pages for calendar, allocation, profile/security, public sharing, asset research, and pending dividends. | Add planned pages during Phase 2/3. |
| Operations | No dedicated backup, restore, reverse proxy, HTTPS, upgrade, or troubleshooting docs. | Add an Operations section. |

## Rewrite Batches

### P0: Information Architecture

- Remove or hide obsolete pages.
- Add an Operations section.
- Split user docs by actual frontend routes.
- Merge duplicate pricing and admin email pages.

### P1: Operator and Technical Truth

- Rewrite configuration from `api/app/config.py`.
- Add background jobs from `api/app/celery_app.py`.
- Rewrite data models from `api/app/models` and Alembic migrations.
- Rewrite pricing, currency, and logo docs from current services.

### P2: Product Workflows

- Dashboard overview and widget grid.
- Transactions, imports, conversions, pending dividends.
- Portfolios, goals, and public sharing.
- Assets, asset research, investment notes, and metadata.
- Calendar, allocation, notifications, profile/security.

### P3: Widgets and Metrics

- Rename stale widget pages to registry IDs.
- Add missing widget pages.
- Verify detailed metrics against backend/frontend builders.

### P4: Polish

- Add current screenshots from `.github/assets`.
- Replace the gallery with a compact visual tour.
- Keep internal-only design notes outside the primary user path.
