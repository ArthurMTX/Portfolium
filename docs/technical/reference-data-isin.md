# Reference Data & ISIN Enrichment

How Portfolium backfills an asset's ISIN when the primary market data provider doesn't supply one.

## Overview

Yahoo Finance remains the primary source of truth for asset metadata, including ISIN when available. For assets where Yahoo doesn't provide an ISIN, Portfolium falls back to [Adanos](https://github.com/adanos-software/free-ticker-database), a free, static CSV database of exchange listings, as a secondary, non-authoritative enrichment source.

Implementation lives in `api/app/services/reference_data/adanos_listings.py`, backed by the `adanos_listings` table (see [Data Models](data-models.md)).

## How It Stays Up to Date

The Adanos CSV is **not** fetched at request time. A weekly Celery task (`sync_adanos_listings_task`, part of [Background Jobs](background-jobs.md)) downloads the CSV and bulk-upserts it into the local `adanos_listings` table. Application code only ever queries Postgres for lookups — there's no live dependency on GitHub or the CSV source when resolving an asset's ISIN.

## Lookup Strategy

When an asset needs ISIN enrichment, Portfolium tries to match it against the local listings table using:

- **Ticker matching** — the Yahoo ticker is stripped of its exchange suffix (e.g. `.PA`, `.L`) and matched against known listing variants for that base ticker.
- **Name matching** — if ticker matching fails, a normalized company name comparison is used as a fallback, filtering out derivative product names that would produce false matches.

Matches are looked up by `listing_key` (`"{exchange}::{ticker}"`) in the local table — no network call happens during a user-facing request.

## Why This Matters

ISIN is used for cross-referencing an asset across exchanges and data sources. Since Adanos data is community-maintained and not authoritative, it's only ever used to **fill a gap** — it never overrides an ISIN Yahoo Finance already provides.

## Related

- [Data Models](data-models.md) — `adanos_listings` table schema
- [Background Jobs](background-jobs.md) — the weekly sync schedule
