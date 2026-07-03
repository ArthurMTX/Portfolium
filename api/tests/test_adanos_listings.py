"""Tests for the Adanos free ticker database import/sync/matching logic."""
from unittest.mock import Mock

import requests
from sqlalchemy.dialects import postgresql

from app.models.reference_data import AdanosListing
from app.services.reference_data import adanos_listings as al

# Real, verified rows from the Adanos CSV
# (https://raw.githubusercontent.com/adanos-software/free-ticker-database/main/data/listings.csv)
# plus a deliberately duplicated QBTS row (defensive dedup coverage) and two
# rows exercising empty/malformed ISIN handling.
FIXTURE_CSV = (
    "listing_key,ticker,exchange,name,asset_type,stock_sector,etf_category,country,country_code,isin,aliases\n"
    'NYSE::QBTS,QBTS,NYSE,"D-Wave Quantum, Inc.",Stock,Information Technology,,United States,US,US26740W1099,d-wave quantum\n'
    'NYSE::QBTS,QBTS,NYSE,"D-Wave Quantum, Inc.",Stock,Information Technology,,United States,US,US26740W1099,d-wave quantum\n'
    "Euronext::CL2,CL2,Euronext,Amundi ETF Leveraged MSCI USA Daily UCITS ETF,ETF,,Other,France,FR,FR0010755611,amundi leveraged msci usa\n"
    "NASDAQ::NVDA,NVDA,NASDAQ,NVIDIA Corporation,Stock,Information Technology,,United States,US,US67066G1040,nvidia\n"
    "NYSE::NOISIN,NOISIN,NYSE,No ISIN Co,Stock,Industrials,,United States,US,,noisin co\n"
    "NYSE::BADISIN,BADISIN,NYSE,Bad ISIN Co,Stock,Industrials,,United States,US,US0000000000,bad isin co\n"
)


def test_validate_header_rejects_missing_columns():
    try:
        al._validate_header(["ticker", "exchange"])
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "listing_key" in str(exc)
        assert "isin" in str(exc)


def test_validate_header_accepts_full_header():
    al._validate_header(list(al.REQUIRED_COLUMNS))  # should not raise


def test_parse_rows_handles_quoted_comma_in_name():
    reader, fieldnames = al._parse_rows(FIXTURE_CSV)
    rows = list(reader)
    assert set(fieldnames) == al.REQUIRED_COLUMNS
    assert rows[0]["name"] == "D-Wave Quantum, Inc."


def test_row_to_upsert_dict_valid_isin():
    row = {
        "listing_key": "NASDAQ::NVDA", "ticker": "NVDA", "exchange": "NASDAQ",
        "name": "NVIDIA Corporation", "asset_type": "Stock", "stock_sector": "Information Technology",
        "etf_category": "", "country": "United States", "country_code": "US",
        "isin": "US67066G1040", "aliases": "nvidia",
    }
    values, isin_invalid = al._row_to_upsert_dict(row)
    assert values["isin"] == "US67066G1040"
    assert isin_invalid is False


def test_row_to_upsert_dict_empty_isin_kept_without_isin():
    row = {
        "listing_key": "NYSE::NOISIN", "ticker": "NOISIN", "exchange": "NYSE",
        "name": "No ISIN Co", "asset_type": "Stock", "stock_sector": "Industrials",
        "etf_category": "", "country": "United States", "country_code": "US",
        "isin": "", "aliases": "",
    }
    values, isin_invalid = al._row_to_upsert_dict(row)
    assert values is not None
    assert values["isin"] is None
    assert isin_invalid is True


def test_row_to_upsert_dict_missing_ticker_is_unusable():
    row = {"listing_key": "NYSE::X", "ticker": "", "exchange": "NYSE", "isin": "US67066G1040"}
    values, _ = al._row_to_upsert_dict(row)
    assert values is None


def test_sync_dedupes_by_listing_key_and_counts_invalid_isins(test_db, monkeypatch):
    monkeypatch.setattr(al, "_download_csv", lambda: FIXTURE_CSV)

    result = al.sync_adanos_listings(test_db)

    assert result["downloaded"] is True
    assert result["total_rows"] == 6
    assert result["skipped_duplicate"] == 1
    assert result["skipped_invalid_isin"] == 2
    assert result["inserted"] == 5  # 6 rows - 1 duplicate
    assert result["updated"] == 0
    assert result["errors"] == []

    qbts_rows = test_db.query(AdanosListing).filter(AdanosListing.listing_key == "NYSE::QBTS").all()
    assert len(qbts_rows) == 1

    no_isin = test_db.query(AdanosListing).filter(AdanosListing.listing_key == "NYSE::NOISIN").one()
    assert no_isin.isin is None
    bad_isin = test_db.query(AdanosListing).filter(AdanosListing.listing_key == "NYSE::BADISIN").one()
    assert bad_isin.isin is None


def test_sync_insert_then_update_roundtrip(test_db, monkeypatch):
    monkeypatch.setattr(al, "_download_csv", lambda: FIXTURE_CSV)
    first = al.sync_adanos_listings(test_db)
    assert first["inserted"] == 5
    assert first["updated"] == 0

    updated_csv = FIXTURE_CSV.replace("NVIDIA Corporation", "NVIDIA Corp (Updated)")
    monkeypatch.setattr(al, "_download_csv", lambda: updated_csv)
    second = al.sync_adanos_listings(test_db)
    assert second["inserted"] == 0
    assert second["updated"] == 5

    nvda = test_db.query(AdanosListing).filter(AdanosListing.listing_key == "NASDAQ::NVDA").one()
    assert nvda.name == "NVIDIA Corp (Updated)"


def test_sync_handles_download_failure_gracefully(monkeypatch, test_db):
    def raising_get(url, timeout=None):
        raise requests.ConnectionError("network unreachable")

    monkeypatch.setattr(al.requests, "get", raising_get)

    result = al.sync_adanos_listings(test_db)

    assert result["downloaded"] is False
    assert result["errors"]
    assert result["total_rows"] == 0


def test_sync_handles_bad_header_gracefully(monkeypatch, test_db):
    monkeypatch.setattr(al, "_download_csv", lambda: "ticker,exchange\nAAA,NYSE\n")

    result = al.sync_adanos_listings(test_db)

    assert result["downloaded"] is True
    assert result["errors"]
    assert result["total_rows"] == 0


def test_bulk_upsert_uses_postgresql_on_conflict_path():
    mock_db = Mock()
    mock_db.bind.dialect.name = "postgresql"
    mock_db.query.return_value.filter.return_value.all.return_value = []

    rows = [
        {
            "listing_key": "NASDAQ::NVDA", "ticker": "NVDA", "exchange": "NASDAQ",
            "name": "NVIDIA Corporation", "asset_type": "Stock", "stock_sector": "Information Technology",
            "etf_category": None, "country": "United States", "country_code": "US",
            "isin": "US67066G1040", "aliases": "nvidia",
        }
    ]

    inserted, updated = al._bulk_upsert_listings(mock_db, rows)

    statement = mock_db.execute.call_args.args[0]
    compiled = str(statement.compile(dialect=postgresql.dialect()))

    assert inserted == 1
    assert updated == 0
    assert "ON CONFLICT" in compiled
    assert "listing_key" in compiled
    mock_db.commit.assert_called_once()


# --- Matching / lookup -------------------------------------------------

def _seed(test_db, monkeypatch, csv_text=FIXTURE_CSV):
    monkeypatch.setattr(al, "_download_csv", lambda: csv_text)
    al.sync_adanos_listings(test_db)


def test_lookup_qbts_returns_expected_isin(test_db, monkeypatch):
    _seed(test_db, monkeypatch)
    assert al.lookup_adanos_isin(test_db, "QBTS") == "US26740W1099"


def test_lookup_cl2_pa_returns_expected_isin(test_db, monkeypatch):
    _seed(test_db, monkeypatch)
    assert al.lookup_adanos_isin(test_db, "CL2.PA") == "FR0010755611"


def test_lookup_nvda_returns_expected_isin(test_db, monkeypatch):
    _seed(test_db, monkeypatch)
    assert al.lookup_adanos_isin(test_db, "NVDA") == "US67066G1040"


def test_lookup_unknown_ticker_returns_none(test_db, monkeypatch):
    _seed(test_db, monkeypatch)
    assert al.lookup_adanos_isin(test_db, "ZZZZNOTREAL") is None


def test_lookup_ambiguous_ticker_returns_none(test_db, monkeypatch):
    ambiguous_csv = (
        "listing_key,ticker,exchange,name,asset_type,stock_sector,etf_category,country,country_code,isin,aliases\n"
        "LSE::ART,ART,LSE,Artisanal Spirits Company PLC,Stock,Communication Services,,United Kingdom,GB,GB00BNXM3P96,artisanal spirits\n"
        "BME::ART,ART,BME,Arteche Lantegi Elkartea Sa,Stock,Industrials,,Spain,ES,ES0105521001,arteche lantegi elkartea\n"
        "WSE::ART,ART,WSE,Artifex Mundi Sa,Stock,Communication Services,,Poland,PL,PLARTFX00011,artifex mundi\n"
    )
    _seed(test_db, monkeypatch, ambiguous_csv)

    # No suffix at all -- can't disambiguate among LSE/BME/WSE.
    assert al.lookup_adanos_isin(test_db, "ART") is None
    # .L maps to {"LSE"} -- resolves unambiguously.
    assert al.lookup_adanos_isin(test_db, "ART.L") == "GB00BNXM3P96"
    # .DE has no rows for ART at all -- no candidates match after suffix filter.
    assert al.lookup_adanos_isin(test_db, "ART.DE") is None


# --- Generic suffix stripping (non-Yahoo, broker-specific suffixes) ------

def test_strip_yahoo_suffix_known_suffix():
    assert al.strip_yahoo_suffix("CL2.PA") == ("CL2", ".PA")


def test_strip_yahoo_suffix_generic_fallback_for_unknown_suffix():
    # ".IL" is not a real Yahoo suffix, but some brokers/imports use it --
    # still strip it generically so ticker-only lookups have a chance to match.
    assert al.strip_yahoo_suffix("SMSD.IL") == ("SMSD", ".IL")


def test_strip_yahoo_suffix_no_dot_at_all():
    assert al.strip_yahoo_suffix("NVDA") == ("NVDA", None)


def test_lookup_smsd_il_matches_via_generic_suffix_fallback(test_db, monkeypatch):
    csv_text = (
        "listing_key,ticker,exchange,name,asset_type,stock_sector,etf_category,country,country_code,isin,aliases\n"
        "LSE::SMSD,SMSD,LSE,Samsung Electronics Co. Ltd,Stock,Information Technology,,United States,US,US7960502018,\n"
    )
    _seed(test_db, monkeypatch, csv_text)

    assert al.lookup_adanos_isin(test_db, "SMSD.IL") == "US7960502018"


# --- Name normalization and cross-check safety net -----------------------

def test_normalize_company_name_strips_dotted_abbreviations_and_corp_suffixes():
    assert al._normalize_company_name("ASML Holding N.V.") == ["asml"]
    assert al._normalize_company_name("Obducat AB") == ["obducat"]
    assert al._normalize_company_name("NVIDIA Corporation") == ["nvidia"]
    assert al._normalize_company_name(None) == []


def test_ticker_collision_with_unrelated_company_is_rejected_by_name_check(test_db, monkeypatch):
    # Real-world case: ticker "OBD" already exists in Adanos as a completely
    # different company (Oxford Biodynamics) than what Portfolium's
    # "OBD.DU"/"OBD.F" mean (Obducat). Without a name to cross-check against,
    # the single ticker match is trusted (existing behavior); with a name
    # that clearly doesn't match, it must be rejected instead of returning
    # the wrong company's ISIN.
    csv_text = (
        "listing_key,ticker,exchange,name,asset_type,stock_sector,etf_category,country,country_code,isin,aliases\n"
        "LSE::OBD,OBD,LSE,Oxford Biodynamics PLC,Stock,Health Care,,United Kingdom,GB,GB00BD5H8572,oxford biodynamics\n"
        "STO::OBDU-B,OBDU-B,STO,Obducat B,Stock,Information Technology,,Sweden,SE,SE0000514705,\n"
    )
    _seed(test_db, monkeypatch, csv_text)

    # No name provided -- ticker match trusted as before.
    assert al.lookup_adanos_isin(test_db, "OBD.DU") == "GB00BD5H8572"
    # Name provided and it doesn't match the ticker-collided company -- rejected,
    # falls through to the name-based fallback and finds the *correct* company.
    assert al.lookup_adanos_isin(test_db, "OBD.DU", name="Obducat AB") == "SE0000514705"
    assert al.lookup_adanos_isin(test_db, "OBD.F", name="Obducat AB") == "SE0000514705"


def test_lookup_by_name_requires_unique_match(test_db, monkeypatch):
    # Two distinct companies both reduce to the same anchor token ("acme") --
    # name-based fallback must refuse rather than guess.
    csv_text = (
        "listing_key,ticker,exchange,name,asset_type,stock_sector,etf_category,country,country_code,isin,aliases\n"
        "NYSE::ACM1,ACM1,NYSE,Acme Rockets Inc,Stock,Industrials,,United States,US,US26740W1099,\n"
        "NASDAQ::ACM2,ACM2,NASDAQ,Acme Anvils Corp,Stock,Industrials,,United States,US,US67066G1040,\n"
    )
    _seed(test_db, monkeypatch, csv_text)

    assert al.lookup_adanos_isin(test_db, "UNRELATEDTICKER", name="Acme Holdings") is None


# --- Hong Kong ticker zero-padding (Yahoo "1810.HK" vs Adanos's "01810") --

def test_hk_ticker_matches_zero_padded_adanos_ticker(test_db, monkeypatch):
    csv_text = (
        "listing_key,ticker,exchange,name,asset_type,stock_sector,etf_category,country,country_code,isin,aliases\n"
        "HKEX::01810,01810,HKEX,XIAOMI-W,Stock,Information Technology,,Cayman Islands,KY,KYG9830T1067,xiaomi-w\n"
        # Unrelated companies that happen to share the un-padded ticker on other exchanges.
        "TWSE::1810,1810,TWSE,Some Taiwan Co,Stock,Industrials,,Taiwan,TW,TW0001810000,\n"
        "TSE::1810,1810,TSE,Matsui Construction Co Ltd,Stock,Industrials,,Japan,JP,JP3863600007,\n"
    )
    _seed(test_db, monkeypatch, csv_text)

    # Resolves even with no name at all -- the zero-padded ticker variant is
    # unambiguous once exchange-disambiguated to HKEX.
    assert al.lookup_adanos_isin(test_db, "1810.HK") == "KYG9830T1067"


def test_hk_zero_padding_only_applies_to_hk_suffix(test_db, monkeypatch):
    csv_text = (
        "listing_key,ticker,exchange,name,asset_type,stock_sector,etf_category,country,country_code,isin,aliases\n"
        "TSE::1810,1810,TSE,Matsui Construction Co Ltd,Stock,Industrials,,Japan,JP,JP3863600007,\n"
    )
    _seed(test_db, monkeypatch, csv_text)

    # A non-HK suffix must not trigger zero-padding lookup against unrelated tickers.
    assert al.lookup_adanos_isin(test_db, "1810.T") == "JP3863600007"
    assert al.lookup_adanos_isin(test_db, "01810.T") is None


# --- Derivative/depositary-receipt products excluded from name matching --

def test_derivative_product_listing_does_not_block_name_match(test_db, monkeypatch):
    # A same-company depositary-receipt product ("Xiaomi HK SDR 2to1") has a
    # genuinely different ISIN and must be excluded from name matching,
    # rather than causing a false "multiple companies matched" refusal.
    csv_text = (
        "listing_key,ticker,exchange,name,asset_type,stock_sector,etf_category,country,country_code,isin,aliases\n"
        "HKEX::01810,01810,HKEX,XIAOMI-W,Stock,Information Technology,,Cayman Islands,KY,KYG9830T1067,xiaomi-w\n"
        "OTC::XIACF,XIACF,OTC,Xiaomi Corp,Stock,Information Technology,,Cayman Islands,KY,KYG9830T1067,\n"
        "SGX::HXXD,HXXD,SGX,Xiaomi HK SDR 2to1,Stock,Information Technology,,Singapore,SG,SGXE85729692,\n"
    )
    _seed(test_db, monkeypatch, csv_text)

    assert al.lookup_adanos_isin(test_db, "XIAOMI-UNKNOWN-TICKER", name="Xiaomi Corporation") == "KYG9830T1067"


def test_is_derivative_product_name_detects_common_markers():
    assert al._is_derivative_product_name("Xiaomi HK SDR 2to1") is True
    assert al._is_derivative_product_name("Some Co ADR") is True
    assert al._is_derivative_product_name("Some Co GDR") is True
    assert al._is_derivative_product_name("Acme Warrants") is True
    assert al._is_derivative_product_name("NVIDIA Corporation") is False
    assert al._is_derivative_product_name(None) is False


# --- Real-world regression: Atos SE (ticker "ATO" collides with Atmos Energy) ---

def test_ato_pa_resolves_to_atos_not_atmos_energy(test_db, monkeypatch):
    csv_text = (
        "listing_key,ticker,exchange,name,asset_type,stock_sector,etf_category,country,country_code,isin,aliases\n"
        "NYSE::ATO,ATO,NYSE,Atmos Energy Corporation,Stock,Utilities,,United States,US,US0495601058,atmos energy\n"
        "OTC::AEXAF,AEXAF,OTC,Atos SE,Stock,Information Technology,,France,FR,FR001400X2S4,\n"
    )
    _seed(test_db, monkeypatch, csv_text)

    # No name -- ticker "ATO" is trusted (single candidate), even though it's
    # the wrong company for a Euronext Paris symbol; this is the documented
    # limitation of ticker-only matching without a name to cross-check.
    assert al.lookup_adanos_isin(test_db, "ATO.PA") == "US0495601058"
    # With the real company name, the ticker match is rejected (Atos vs
    # Atmos Energy share no anchor token) and the name-based fallback finds
    # the correct company under its actual Adanos ticker ("AEXAF").
    assert al.lookup_adanos_isin(test_db, "ATO.PA", name="Atos SE") == "FR001400X2S4"
