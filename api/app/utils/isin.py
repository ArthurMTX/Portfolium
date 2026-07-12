"""ISIN (ISO 6166) normalization and validation.

Pure, framework-agnostic helpers with no DB/model imports so ISIN candidates
scraped from external providers (e.g. yfinance) can be validated in isolation
before ever touching a database row.
"""
import re
import string

_ISIN_PATTERN = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$")
_INVALID_SENTINELS = {"-", "N/A", "NONE", "NULL"}
_LETTER_VALUES = {letter: str(10 + index) for index, letter in enumerate(string.ascii_uppercase)}


def isin_checksum_is_valid(isin: str) -> bool:
    """Validate the ISO 6166 Luhn mod-10 check digit."""
    if not _ISIN_PATTERN.match(isin):
        return False

    digits = "".join(_LETTER_VALUES.get(char, char) for char in isin)

    total = 0
    parity = len(digits) % 2
    for index, char in enumerate(digits):
        digit = int(char)
        if index % 2 == parity:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit

    return total % 10 == 0


def normalize_isin(raw: "str | None") -> "str | None":
    """Normalize and validate a raw ISIN candidate.

    Returns the uppercased, trimmed ISIN if it is well-formed and passes the
    ISO 6166 checksum, otherwise None. Rejects yfinance's documented "not
    found" sentinel ("-") and other obviously invalid values.
    """
    if not raw:
        return None

    candidate = raw.strip().upper()
    if not candidate or candidate in _INVALID_SENTINELS:
        return None

    if not _ISIN_PATTERN.match(candidate):
        return None

    if not isin_checksum_is_valid(candidate):
        return None

    return candidate
