"""
Adanos free ticker database (secondary, non-authoritative ISIN enrichment).

Yahoo Finance remains the primary source of truth for asset metadata. Adanos
(https://github.com/adanos-software/free-ticker-database) is a static CSV of
exchange listings used only to backfill an asset's ISIN when Yahoo does not
provide one. The CSV is downloaded and bulk-upserted into the local
`adanos_listings` table by a weekly Celery task (app.tasks.reference_data_tasks);
application code never parses the CSV or reaches out to GitHub at request
time -- lookups always query Postgres.
"""
import csv
import io
import logging
import re
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional, Tuple

import requests
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as postgresql_insert

from app.models.reference_data import AdanosListing
from app.utils.isin import normalize_isin
from app.utils.exchange_calendars import SUFFIX_TO_EXCHANGE as _YAHOO_SUFFIX_KEYS

logger = logging.getLogger(__name__)

ADANOS_CSV_URL = "https://raw.githubusercontent.com/adanos-software/free-ticker-database/main/data/listings.csv"
_DOWNLOAD_TIMEOUT_SECONDS = 60  # ~8.3MB plain GET; no streaming needed
_MAX_ERROR_ENTRIES = 50

REQUIRED_COLUMNS = {
    "listing_key",
    "ticker",
    "exchange",
    "name",
    "asset_type",
    "stock_sector",
    "etf_category",
    "country",
    "country_code",
    "isin",
    "aliases",
}

_UPSERT_COLUMNS = (
    "ticker",
    "exchange",
    "name",
    "asset_type",
    "stock_sector",
    "etf_category",
    "country",
    "country_code",
    "isin",
    "aliases",
    "imported_at",
)


# ---------------------------------------------------------------------------
# Matching / lookup
# ---------------------------------------------------------------------------

# Best-effort mapping from Yahoo Finance ticker suffixes to the (much
# coarser) set of ~82 human-readable exchange labels used in Adanos's
# `exchange` column. This is intentionally a *separate* vocabulary from
# app.utils.exchange_calendars.SUFFIX_TO_EXCHANGE, which maps the same Yahoo
# suffixes to `exchange_calendars` library codes (e.g. "XPAR") for trading
# calendar lookups -- an unrelated purpose. Do not conflate the two dicts.
# Only ~10 of the ~82 Adanos exchange labels are mapped here; any suffix not
# present falls back to "no disambiguation possible" in lookup_adanos_isin,
# which is the safe default (returns None on ambiguity rather than guessing).
SUFFIX_TO_ADANOS_EXCHANGES: Dict[str, set] = {
    ".PA": {"Euronext"},
    ".AS": {"Euronext"},
    ".BR": {"Euronext"},
    ".LS": {"Euronext"},
    ".DE": {"XETRA"},
    ".SW": {"SIX"},
    ".L": {"LSE"},
    ".TO": {"TSX"},
    ".V": {"TSXV"},
    ".AX": {"ASX"},
    ".HK": {"HKEX"},
}

# US tickers carry no Yahoo suffix at all, and Adanos spreads US listings
# across several venue labels Yahoo does not distinguish between.
US_NO_SUFFIX_ADANOS_EXCHANGES: set = {"NYSE", "NASDAQ", "NYSE ARCA", "NYSE MKT", "OTC", "BATS"}

# Hong Kong stock codes have a well-known, systematic mismatch: Yahoo
# displays a 4-digit code (e.g. "1810.HK") while Adanos (like many other
# data sources) stores the "official" 5-digit zero-padded HKEX code
# (e.g. "01810"). Widen the ticker search to include the zero-padded form
# specifically for ".HK" symbols rather than guessing at other exchanges.
_HKEX_TICKER_WIDTH = 5


def _ticker_search_variants(bare_ticker: str, suffix: Optional[str]) -> List[str]:
    if suffix == ".HK" and bare_ticker.isdigit():
        return sorted({bare_ticker, bare_ticker.zfill(_HKEX_TICKER_WIDTH)})
    return [bare_ticker]


def strip_yahoo_suffix(symbol: str) -> Tuple[str, Optional[str]]:
    """Return (bare_ticker, suffix_or_None).

    Reuses exchange_calendars' SUFFIX_TO_EXCHANGE *keys* purely as the
    canonical list of known Yahoo suffixes for detection -- its values
    (exchange_calendars codes) are a different vocabulary and are not used
    here. Falls back to generically stripping anything after the last "."
    when the suffix isn't in the curated map (e.g. a broker-specific suffix
    like ".IL" that Yahoo itself doesn't use) -- this is safe because the
    caller still requires an unambiguous single match before trusting it.
    """
    upper = (symbol or "").strip().upper()
    for suffix in _YAHOO_SUFFIX_KEYS:
        if upper.endswith(suffix):
            return upper[: -len(suffix)], suffix
    if "." in upper:
        base, _, ext = upper.rpartition(".")
        if base:
            return base, f".{ext}"
    return upper, None


# Kept as a private alias for internal call sites that predate the public rename.
_strip_yahoo_suffix = strip_yahoo_suffix


# --- Name-based fallback matching (used when ticker matching finds nothing) ---

# Common corporate-form suffixes stripped from the *end* of a normalized name
# before comparison, so e.g. "Obducat AB" and "NVIDIA Corporation" reduce to
# their distinctive core ("obducat", "nvidia"). Deliberately conservative --
# only whole trailing tokens are stripped, never mid-string substrings.
_CORPORATE_SUFFIX_TOKENS = {
    "inc", "incorporated", "corp", "corporation", "co", "company",
    "holdings", "holding", "group", "grp", "limited", "ltd", "plc",
    "ab", "asa", "ag", "gmbh", "nv", "sa", "se", "oyj", "spa", "oy",
    "bhd", "pjsc", "jsc", "kk", "llc", "lp", "srl", "bv", "kgaa",
}

_NAME_FIRST_TOKEN_MIN_LEN = 3

# Adanos exchange labels considered secondary/non-primary venues: OTC desks
# and their regional variants list foreign companies' shares (often as an
# unsponsored ADR-like arrangement) alongside the company's real, primary
# listing. When two exact name matches disagree on ISIN, a non-OTC exchange
# is preferred over these -- conservatively, only when it uniquely
# disambiguates (exactly one non-OTC candidate remains).
_SECONDARY_MARKET_EXCHANGES = {"OTC", "OTC US", "OTC MARKETS", "PINK", "GREY MARKET"}

# Markers for depositary-receipt / derivative products (SDRs, ADRs, GDRs,
# warrants, ratio-converted certificates, etc.). These frequently share a
# company's name prefix (e.g. "Xiaomi HK SDR 2to1") but represent a
# genuinely different instrument with its own distinct ISIN -- they must be
# excluded from name-based matching entirely, or they'd otherwise dilute an
# otherwise-unanimous name match into a false "ambiguous, refuse to guess".
_DERIVATIVE_PRODUCT_MARKERS = {"sdr", "adr", "gdr", "warrant", "warrants", "certificate", "certificates", "depositary"}
_DERIVATIVE_RATIO_PATTERN = re.compile(r"\b\d+to\d+\b")


def _is_derivative_product_name(name: Optional[str]) -> bool:
    if not name:
        return False
    lowered = name.lower()
    if _DERIVATIVE_RATIO_PATTERN.search(lowered):
        return True
    tokens = set(re.sub(r"[^a-z0-9\s]", " ", lowered).split())
    return bool(tokens & _DERIVATIVE_PRODUCT_MARKERS)


def _normalize_company_name(name: Optional[str]) -> List[str]:
    """Lowercase, strip punctuation, and drop trailing corporate-suffix
    tokens, returning the remaining significant name tokens.

    Also drops trailing single-character tokens (e.g. a stray "N" from a
    garbled import like "OBDUCAT AB                    N") -- these are
    never meaningful parts of a company's distinctive name, and without
    dropping them they can block the corporate-suffix strip from ever
    reaching a real suffix token earlier in the trailing run.

    Leading single-character tokens are dropped for the same reason -- an
    elided article like "L'Air Liquide" otherwise tokenizes to a spurious
    leading "l" token, which becomes the (too-short, useless) anchor token
    instead of "air".
    """
    if not name:
        return []
    text = name.lower().replace(".", "")  # collapse dotted abbreviations first: "N.V." -> "nv", "S.A." -> "sa"
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    tokens = [t for t in text.split() if t]
    while tokens and (tokens[-1] in _CORPORATE_SUFFIX_TOKENS or len(tokens[-1]) <= 1):
        tokens.pop()
    while tokens and len(tokens[0]) <= 1:
        tokens.pop(0)
    return tokens


def _is_token_prefix(shorter: List[str], longer: List[str]) -> bool:
    return bool(shorter) and len(shorter) <= len(longer) and longer[: len(shorter)] == shorter


def _candidate_name_variants(candidate: AdanosListing) -> List[str]:
    return [candidate.name] + (candidate.aliases.split("|") if candidate.aliases else [])


def _candidate_matches_name(candidate: AdanosListing, target_tokens: List[str]) -> bool:
    """
    Loose compatibility check used to validate a ticker-matched candidate:
    requires the two names to share their "anchor" (first significant)
    token. This is intentionally forgiving of stylistic wording differences
    between Yahoo's and Adanos's names for the *same* company (e.g. ETF
    naming variations), while still catching a ticker collision between two
    genuinely unrelated companies (e.g. Adanos's "OBD" = Oxford Biodynamics
    vs. Portfolium's "OBD.DU" meaning Obducat -- zero anchor overlap).

    If no target name was provided at all, there is nothing to validate
    against, so the ticker match is trusted as-is (preserves prior
    behavior for callers that don't pass a name).
    """
    if not target_tokens:
        return True
    if _is_derivative_product_name(candidate.name):
        return False
    target_anchor = target_tokens[0]
    for candidate_name in _candidate_name_variants(candidate):
        candidate_tokens = _normalize_company_name(candidate_name)
        if not candidate_tokens:
            continue
        candidate_anchor = candidate_tokens[0]
        if target_anchor == candidate_anchor or target_anchor in candidate_tokens or candidate_anchor in target_tokens:
            return True
    return False


def _lookup_by_name(db: Session, name: str) -> Optional[str]:
    """
    Bounded, conservative name/alias fallback: normalizes the target name,
    prefilters Adanos candidates via a SQL ILIKE on the first significant
    name token (keeps this an indexed-ish, bounded query rather than a full
    table scan), then requires the normalized target to be a whole-token
    prefix of a candidate's normalized name/alias (or vice versa) in Python.

    Only returns a result when exactly one distinct ISIN qualifies across
    the whole candidate set -- otherwise refuses to guess, same as the
    ticker-based path. Exception: if exactly one candidate is an *exact*
    token-for-token name match (as opposed to only a prefix-relation
    match), that candidate wins even when other, unrelated companies whose
    name is a superset of the target's also matched via the prefix rule
    (e.g. "TotalEnergies SE" vs. "TotalEnergies Marketing Nigeria PLC").
    """
    target_tokens = _normalize_company_name(name)
    if not target_tokens:
        return None

    first_token = target_tokens[0]
    if len(first_token) < _NAME_FIRST_TOKEN_MIN_LEN:
        return None  # too short a prefilter token to be a safe/useful index hit

    candidates = (
        db.query(AdanosListing)
        .filter(
            AdanosListing.isin.isnot(None),
            or_(
                AdanosListing.name.ilike(f"{first_token}%"),
                AdanosListing.aliases.ilike(f"%{first_token}%"),
            ),
        )
        .limit(200)
        .all()
    )

    matched_isins: Dict[str, List[AdanosListing]] = defaultdict(list)
    exact_isins: Dict[str, List[AdanosListing]] = defaultdict(list)
    for candidate in candidates:
        if _is_derivative_product_name(candidate.name):
            continue
        for candidate_name in _candidate_name_variants(candidate):
            candidate_tokens = _normalize_company_name(candidate_name)
            if not candidate_tokens:
                continue
            if candidate_tokens == target_tokens:
                matched_isins[candidate.isin].append(candidate)
                exact_isins[candidate.isin].append(candidate)
                break
            if _is_token_prefix(target_tokens, candidate_tokens) or _is_token_prefix(candidate_tokens, target_tokens):
                matched_isins[candidate.isin].append(candidate)
                break

    # An exact token-for-token name match is strong evidence of being the
    # right company even when a *different* company's name happens to have
    # the target as a proper prefix (e.g. "TotalEnergies SE" is an exact
    # match, while "TotalEnergies Marketing Nigeria PLC" is only a
    # prefix-superset match for a distinct regional subsidiary with its own
    # ISIN). Only trust this tiebreak when it is itself unambiguous -- i.e.
    # exactly one distinct ISIN achieves an exact match -- otherwise fall
    # through to the general "exactly one distinct ISIN overall" rule.
    if len(exact_isins) == 1:
        return normalize_isin(next(iter(exact_isins.values()))[0].isin)

    if len(exact_isins) > 1:
        primary = _primary_listing_isin(exact_isins)
        if primary is not None:
            return normalize_isin(primary)

    if len(matched_isins) == 1:
        return normalize_isin(next(iter(matched_isins.values()))[0].isin)
    return None  # no match, or matched more than one distinct company -- refuse to guess


def _primary_listing_isin(isin_groups: Dict[str, List[AdanosListing]]) -> Optional[str]:
    """
    Last-resort, conservative tiebreak between multiple *exact* name matches
    that resolved to different ISINs (e.g. a European company's ordinary
    share vs. a separate US OTC listing under a slightly different legal
    name, such as Airbus Group SE's NL-ISIN ordinary share vs. "Airbus
    Group NV"'s US-ISIN OTC listing).

    Prefers the ISIN group that has at least one row on a primary (non-OTC)
    exchange over a group whose every row is OTC-only -- but only when
    exactly one ISIN group qualifies as "has a primary listing". If every
    group has a primary listing, or none do, this refuses to pick (returns
    None) rather than guess between two normal primary listings.
    """
    has_primary = {
        isin: any((row.exchange or "").upper() not in _SECONDARY_MARKET_EXCHANGES for row in rows)
        for isin, rows in isin_groups.items()
    }
    primary_isins = [isin for isin, is_primary in has_primary.items() if is_primary]
    if len(primary_isins) == 1:
        return primary_isins[0]
    return None


def lookup_adanos_isin(
    db: Session,
    symbol: str,
    asset_type: Optional[str] = None,
    name: Optional[str] = None,
) -> Optional[str]:
    """
    Local, indexed Postgres lookup only -- safe to call synchronously from
    request paths (unlike yfinance's ISIN scrape, which is slow/experimental
    and stays async-only).

    Returns a validated ISIN string, or None if no unambiguous match exists.
    Never guesses across an ambiguous ticker (e.g. the same ticker existing
    on multiple exchanges) -- disambiguates via the ticker's Yahoo suffix
    when possible, else refuses to match.

    Ticker matching is tried first (more reliable when it resolves). Its
    result is cross-checked against `name` when one is given -- this catches
    the case where Portfolium's suffix-stripped ticker happens to collide
    with a *different, unrelated* company that already occupies that ticker
    in Adanos (confirmed to happen in practice: ticker "OBD" is Oxford
    Biodynamics in Adanos, but "OBD.DU"/"OBD.F" in Portfolium mean Obducat --
    a completely different company). If the ticker match is rejected or none
    was found, falls back to a bounded name/alias match.

    asset_type is accepted for call-site symmetry with other provider
    lookups but is not used in filtering today (reserved for future use).
    """
    target_tokens = _normalize_company_name(name) if name else []

    if symbol:
        bare_ticker, suffix = strip_yahoo_suffix(symbol)
        ticker_variants = _ticker_search_variants(bare_ticker, suffix)

        candidates = (
            db.query(AdanosListing)
            .filter(func.upper(AdanosListing.ticker).in_(ticker_variants), AdanosListing.isin.isnot(None))
            .all()
        )

        matched_candidate: Optional[AdanosListing] = None
        if len(candidates) == 1:
            matched_candidate = candidates[0]
        elif len(candidates) > 1:
            allowed_exchanges = SUFFIX_TO_ADANOS_EXCHANGES.get(suffix) if suffix else US_NO_SUFFIX_ADANOS_EXCHANGES
            if allowed_exchanges:
                filtered = [c for c in candidates if c.exchange in allowed_exchanges]
                if len(filtered) == 1:
                    matched_candidate = filtered[0]

        if matched_candidate is not None and _candidate_matches_name(matched_candidate, target_tokens):
            return normalize_isin(matched_candidate.isin)

    return _lookup_by_name(db, name) if name else None


# ---------------------------------------------------------------------------
# CSV download / parse / sync
# ---------------------------------------------------------------------------

def _download_csv() -> str:
    response = requests.get(ADANOS_CSV_URL, timeout=_DOWNLOAD_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.text


def _validate_header(fieldnames: Optional[List[str]]) -> None:
    present = set(fieldnames or [])
    missing = REQUIRED_COLUMNS - present
    if missing:
        raise ValueError(f"Adanos CSV missing required columns: {sorted(missing)}")


def _parse_rows(csv_text: str) -> Tuple[Iterator[Dict[str, Any]], Optional[List[str]]]:
    reader = csv.DictReader(io.StringIO(csv_text))
    return reader, reader.fieldnames


def _clean_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _row_to_upsert_dict(row: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], bool]:
    """Return (values_or_None, isin_was_invalid_or_empty).

    A missing listing_key/ticker/exchange makes the row unusable (returns
    None). An empty/invalid ISIN does NOT drop the row -- the listing's
    other fields (ticker/exchange/name) are still useful for future
    non-ISIN uses of this table, so it's stored with isin=None and counted
    separately via the second return value.
    """
    listing_key = _clean_str(row.get("listing_key"))
    ticker = _clean_str(row.get("ticker"))
    exchange = _clean_str(row.get("exchange"))
    if not listing_key or not ticker or not exchange:
        return None, False

    isin = normalize_isin(row.get("isin"))
    isin_empty_or_invalid = isin is None

    values = {
        "listing_key": listing_key,
        "ticker": ticker,
        "exchange": exchange,
        "name": _clean_str(row.get("name")),
        "asset_type": _clean_str(row.get("asset_type")),
        "stock_sector": _clean_str(row.get("stock_sector")),
        "etf_category": _clean_str(row.get("etf_category")),
        "country": _clean_str(row.get("country")),
        "country_code": _clean_str(row.get("country_code")),
        "isin": isin,
        "aliases": _clean_str(row.get("aliases")),
    }
    return values, isin_empty_or_invalid


def sync_adanos_listings(db: Session) -> Dict[str, Any]:
    """
    Download the Adanos CSV, validate its header, bulk-upsert it into
    adanos_listings, and return a summary dict. Never raises -- failures are
    captured in the returned dict so the caller (task) can log/report them.
    """
    result: Dict[str, Any] = {
        "downloaded": False,
        "total_rows": 0,
        "inserted": 0,
        "updated": 0,
        "skipped_invalid_isin": 0,
        "skipped_duplicate": 0,
        "errors": [],
    }

    def _add_error(message: str) -> None:
        if len(result["errors"]) < _MAX_ERROR_ENTRIES:
            result["errors"].append(message)

    try:
        csv_text = _download_csv()
        result["downloaded"] = True
    except requests.RequestException as exc:
        _add_error(f"download_failed: {exc}")
        return result

    reader, fieldnames = _parse_rows(csv_text)
    try:
        _validate_header(fieldnames)
    except ValueError as exc:
        _add_error(str(exc))
        return result

    deduped: Dict[str, Dict[str, Any]] = {}
    for row in reader:
        result["total_rows"] += 1
        values, isin_invalid = _row_to_upsert_dict(row)
        if isin_invalid:
            result["skipped_invalid_isin"] += 1
        if values is None:
            _add_error(f"unusable_row: {row.get('listing_key', '<unknown>')}")
            continue
        if values["listing_key"] in deduped:
            result["skipped_duplicate"] += 1
        deduped[values["listing_key"]] = values  # last-one-wins

    try:
        inserted, updated = _bulk_upsert_listings(db, list(deduped.values()))
        result["inserted"] = inserted
        result["updated"] = updated
    except Exception as exc:
        _add_error(f"upsert_failed: {exc}")

    return result


def _bulk_upsert_listings(db: Session, rows: List[Dict[str, Any]]) -> Tuple[int, int]:
    """
    Bulk insert-or-update adanos_listings rows keyed by listing_key.

    Mirrors app.crud.prices.bulk_upsert_prices's dialect-branch pattern:
    PostgreSQL uses ON CONFLICT on the unique listing_key index; SQLite (and
    other dialects, used by the test suite) use a query-then-mutate/insert
    fallback.
    """
    if not rows:
        return 0, 0

    now = datetime.utcnow()
    for row in rows:
        row["imported_at"] = now

    listing_keys = [row["listing_key"] for row in rows]
    existing_keys = {
        key
        for (key,) in db.query(AdanosListing.listing_key)
        .filter(AdanosListing.listing_key.in_(listing_keys))
        .all()
    }
    inserted = len(rows) - len(existing_keys)
    updated = len(existing_keys)

    if db.bind and db.bind.dialect.name == "postgresql":
        statement = postgresql_insert(AdanosListing).values(rows)
        statement = statement.on_conflict_do_update(
            index_elements=["listing_key"],
            set_={col: getattr(statement.excluded, col) for col in _UPSERT_COLUMNS},
        )
        try:
            db.execute(statement)
            db.commit()
        except Exception:
            db.rollback()
            raise
        return inserted, updated

    existing_rows = (
        db.query(AdanosListing)
        .filter(AdanosListing.listing_key.in_(listing_keys))
        .all()
    )
    existing_by_key: Dict[str, AdanosListing] = {row.listing_key: row for row in existing_rows}

    new_objects: List[AdanosListing] = []
    for row in rows:
        existing = existing_by_key.get(row["listing_key"])
        if existing:
            for col in _UPSERT_COLUMNS:
                setattr(existing, col, row[col])
        else:
            new_objects.append(AdanosListing(**row))

    if new_objects:
        db.add_all(new_objects)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return inserted, updated
