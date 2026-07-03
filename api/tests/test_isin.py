from app.utils.isin import isin_checksum_is_valid, normalize_isin

VALID_AAPL_ISIN = "US0378331005"  # Publicly known, real-world ISIN for AAPL


def test_normalize_isin_accepts_valid_uppercase():
    assert normalize_isin(VALID_AAPL_ISIN) == VALID_AAPL_ISIN


def test_normalize_isin_accepts_lowercase():
    assert normalize_isin(VALID_AAPL_ISIN.lower()) == VALID_AAPL_ISIN


def test_normalize_isin_strips_whitespace():
    assert normalize_isin(f"  {VALID_AAPL_ISIN}  ") == VALID_AAPL_ISIN


def test_normalize_isin_rejects_yfinance_not_found_sentinel():
    assert normalize_isin("-") is None


def test_normalize_isin_rejects_empty_and_none():
    assert normalize_isin("") is None
    assert normalize_isin(None) is None
    assert normalize_isin("   ") is None


def test_normalize_isin_rejects_wrong_length():
    assert normalize_isin("US037833100") is None  # 11 chars
    assert normalize_isin("US03783310055") is None  # 13 chars


def test_normalize_isin_rejects_bad_pattern():
    assert normalize_isin("us-0378331005") is None
    assert normalize_isin("1S0378331005") is None  # country code must be letters


def test_normalize_isin_rejects_bad_checksum():
    # Mutate the last digit of a known-valid ISIN to break the checksum.
    mutated = VALID_AAPL_ISIN[:-1] + str((int(VALID_AAPL_ISIN[-1]) + 1) % 10)
    assert normalize_isin(mutated) is None


def test_isin_checksum_is_valid_true_for_known_good_isin():
    assert isin_checksum_is_valid(VALID_AAPL_ISIN) is True


def test_isin_checksum_is_valid_false_for_mutated_isin():
    mutated = VALID_AAPL_ISIN[:-1] + str((int(VALID_AAPL_ISIN[-1]) + 1) % 10)
    assert isin_checksum_is_valid(mutated) is False
