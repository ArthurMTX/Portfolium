# Logo Fetching

Technical reference for how Portfolium resolves and caches asset logos.

## Overview

Logo resolution is orchestrated by `resolve_asset_logo()` in
`api/app/services/market_data/logo_resolver.py`. It tries providers in a fixed
priority order and persists the result on the `Asset` row so later requests are
served from the database instead of re-resolving:

1. **Trade Republic** (via ISIN) — for all listed instrument types (stocks,
   ETFs, funds, ETCs, ETNs).
2. **Sibling reuse** — if another asset with a different ticker/exchange suffix
   (e.g. `ASML` vs `ASML.AS`) already resolved a Trade Republic logo, reuse its
   image bytes without a new lookup.
3. **Brandfetch** — company/brand search and CDN fetch, mainly effective for
   equities with a resolvable domain. ETFs and cryptocurrencies skip straight to
   step 4.
4. **Generated SVG fallback** — a gradient square with the ticker's first three
   letters, built locally with no external calls.

Brandfetch is **not** the first provider anymore — Trade Republic is tried
first for any non-crypto asset that has (or can get) an ISIN.

## Resolving an ISIN

Trade Republic's CDN is keyed by ISIN, not ticker, so an asset needs an ISIN
before it can be tried. `resolve_asset_logo()` resolves a missing ISIN itself,
in order:

1. **Adanos reference data** (`lookup_adanos_isin`, a local, indexed Postgres
   query against synced listings — see the reference-data sync task) — tried
   first because it's been more reliable than yfinance's scrape for some
   symbols, and it's cheap enough to run on the request path.
2. **Yahoo Finance's experimental ISIN scrape** (`provider.get_isin(...)`) —
   only used as a fallback when Adanos has nothing, and only outside the
   request path (`allow_isin_lookup=True`, i.e. the Celery backfill task or
   CLI). The synchronous HTTP logo endpoint always passes
   `allow_isin_lookup=False` so a slow/fragile scrape never blocks a response.

Cryptocurrency assets (`asset_type` in `CRYPTO`/`CRYPTOCURRENCY`) skip ISIN
resolution and Trade Republic entirely and go straight to Brandfetch's crypto
CDN namespace.

A `force=True` re-resolution (used by admin/backfill flows) re-checks the ISIN
even if one is already stored, since it can correct a lower-confidence ISIN
that came from the Yahoo scrape. Yahoo's scrape itself never overwrites an
existing ISIN, even under `force` — it's the least-trusted of the two sources
and only ever fills a true gap.

## Trade Republic provider

`api/app/services/market_data/trade_republic_logos.py` fetches SVGs from:

```
https://assets.traderepublic.com/img/logos/{isin}/v2/{variant}.min.svg
```

for `variant` in `light` and `dark`. This is an unofficial, undocumented CDN:
a missing logo can come back as an HTTP 200 with an XML `AccessDenied` body
instead of a normal error status. `validate_trade_republic_logo_response()`
therefore inspects the response body itself — rejecting non-2xx status, bodies
outside a 20-byte–2MB sane size range, bodies whose first real XML tag isn't
`<svg>`, and bodies containing `AccessDenied`/`<Error` markers — rather than
trusting the status code alone.

`fetch_trade_republic_logos(isin)` fetches both variants independently and
never raises; a variant that fails validation or the network call is simply
omitted from the result dict, so an asset can end up with only a light or only
a dark logo.

## Brandfetch provider

`api/app/services/market_data/logos.py` implements the Brandfetch fallback,
tried only when Trade Republic yields nothing (or for assets that skip Trade
Republic, like ETFs by design — Brandfetch's own generic-brand-match risk means
ETFs bypass brand search and go straight to the generated fallback):

1. Direct CDN fetch using the ticker itself as the brand ID.
2. Company-name search (tries the full name, then progressively strips common
   legal suffixes like `Inc.`, `Corporation`, `Ltd`, `AG`, `SE`, etc.) and
   scores candidate brands by quality score, verified/claimed status, and
   domain length.
3. API search using a normalized ticker (exchange suffix stripped) as a last
   resort.

Every fetched image is validated with `is_valid_image()` — minimum byte size,
minimum 16x16 dimensions, rejecting fully/near-fully transparent images and
solid-color placeholders — then resized to a 64px WebP via
`resize_and_optimize_image()` before caching. Brandfetch requires
`BRANDFETCH_API_KEY`; without it, all Brandfetch calls short-circuit to `None`
and resolution falls through to the generated SVG.

Cryptocurrencies use a separate Brandfetch crypto CDN path
(`cdn.brandfetch.io/crypto/{ticker}`) and skip the name/ticker search
strategies (which are tuned for equities and would risk matching unrelated
companies with the same ticker text).

## Generated fallback

`generate_etf_logo()` (despite the name, used as the universal last resort, not
just for ETFs) builds a 200x200 SVG with a pink gradient background and the
ticker's first three letters — no network call, always succeeds.

## Stickiness

A resolution result records its provider on `Asset.logo_provider`
(`'trade_republic'`, `'brandfetch'`, or `'generated'`):

- **Trade Republic and Brandfetch resolutions are sticky** — once set, later
  calls to `resolve_asset_logo()` short-circuit immediately
  (`LogoResolutionResult(provider="unchanged")`) rather than re-fetching, unless
  `force=True`.
- **Generated resolutions are not sticky** — an asset stuck with the SVG
  fallback keeps getting a real chance at Trade Republic/Brandfetch on
  subsequent resolution attempts (e.g. once an ISIN becomes available).

## HTTP endpoint

`GET /assets/logo/{symbol}` (`api/app/routers/assets.py`) serves the actual
image bytes for the frontend `<img>` tag. Query params: `name`, `asset_type`
(hints when the asset isn't in the DB yet), and `variant` (`light` or `dark`,
for Trade Republic theme-aware logos).

Response caching headers differ by source:

| Source | `Cache-Control` |
| --- | --- |
| Real logo (Trade Republic / Brandfetch) | `public, max-age=2592000, immutable` (30 days) |
| Generated SVG fallback | `public, max-age=300, must-revalidate` (5 minutes, so a real logo can supersede it soon) |

An `ETag` (MD5 of the image bytes) is set on every response.

For an asset that isn't persisted yet (e.g. a ticker the user is searching but
hasn't added), the endpoint still attempts a one-off Trade Republic lookup via
the local Adanos ISIN table before falling through to Brandfetch/generated, so
first-time searches don't miss out on a real logo just because there's no
`Asset` row yet to cache it on.

## Trade Republic variant caching

Trade Republic SVGs are cached in two places on `Asset`:

- `logo_light_url` / `logo_dark_url` — the canonical CDN URL for each theme
  variant (set by `resolve_asset_logo`).
- `logo_light_data` / `logo_dark_data` — the actual SVG bytes for each variant
  (added by migration `20260705_1000_add_trade_republic_logo_variant_cache.py`).

Caching the bytes, not just the URL, means the `/assets/logo/{symbol}` endpoint
proxies the SVG through Portfolium's own API instead of hot-linking or
redirecting to Trade Republic's CDN on every page view — the second and
subsequent requests for the same symbol/variant are served straight from
Postgres via `get_cached_trade_republic_logo_variant()`, which also does
cross-theme fallback (dark asked for but only light cached, and vice versa)
rather than returning nothing.

`cache_trade_republic_logo_variant()` (`api/app/crud/assets.py`) writes one
variant at a time and bumps `logo_fetched_at`, so a first Trade Republic
resolution that only found a light variant can later have its dark variant
filled in on demand without re-resolving the whole asset.

Non-Trade-Republic logos (Brandfetch results and, implicitly, the ISIN/provider
metadata) use the older single-variant columns:

| Column | Purpose |
| --- | --- |
| `logo_data` | Cached Brandfetch image bytes (WebP) |
| `logo_content_type` | MIME type (`image/webp` or `image/svg+xml`) |
| `logo_url` | Canonical, theme-agnostic logo URL |
| `logo_provider` | `'trade_republic'` \| `'brandfetch'` \| `'generated'` |
| `logo_fetched_at` | Last resolution/cache-write timestamp |

## Background backfill

New assets trigger an async backfill task
(`app.tasks.logo_tasks.backfill_asset_logos`) right after creation
(`POST /assets`), so ISIN/logo resolution — including the slower Yahoo ISIN
scrape, which is disallowed on the request path — happens off the request
path. See [Background Jobs](background-jobs.md) once published for the task
queue/retry details.

## Testing

`api/tests/test_logo_resolver.py` covers the provider chain end-to-end,
including: ISIN resolution then Trade Republic success; falling back to
Brandfetch when Trade Republic has no ISIN match; ETFs without an ISIN going
straight to the generated fallback; existing Trade Republic logos not being
re-resolved without `force`; `force=True` re-checking and correcting a wrong
ISIN via Adanos; crypto assets never triggering ISIN lookup or Trade Republic;
sibling-logo reuse across exchange listings (and its exclusion for crypto); and
that an ISIN lookup exception never breaks resolution (it just falls through to
the next provider).

## Related documentation

- [Data Models](data-models.md) — full `Asset` column reference.
- [Reference Data / ISIN](reference-data-isin.md) — the Adanos listings sync, once published.
- [Asset Metadata Overrides](asset-metadata-overrides.md) — user-specific classification, a related but separate override system.
