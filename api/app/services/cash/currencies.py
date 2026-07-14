"""
Cash currency policy

The cash ledger only accepts a known currency universe:

- active ISO 4217 alphabetic codes (vendored below as a frozen set so the
  check works offline and deterministically);
- an explicit supplemental set of stablecoin settlement units that can
  legitimately appear as a transaction settlement currency for crypto
  trades (USDT, USDC).

GBX/GBp (LSE pence quotation) is rejected with a dedicated message rather
than silently divided by 100: converting pence to pounds implicitly would
be an undisclosed conversion. Users must record cash in GBP.

Crypto coins themselves (BTC, ETH, ...) are not cash currencies: they are
assets held as positions, and coin-to-coin swaps remain CONVERSION_IN/OUT
transactions, which are cash-neutral.
"""
from app.errors import InvalidCurrencyCodeError

# Active ISO 4217 alphabetic codes (frozen snapshot; no network lookups).
ISO_4217_CURRENCIES = frozenset({
    "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
    "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL",
    "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY",
    "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP",
    "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD",
    "GNF", "GTQ", "GYD", "HKD", "HNL", "HTG", "HUF", "IDR", "ILS", "INR",
    "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF",
    "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL",
    "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR",
    "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR",
    "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR",
    "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD",
    "SHP", "SLE", "SOS", "SRD", "SSP", "STN", "SVC", "SYP", "SZL", "THB",
    "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX",
    "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XOF",
    "XPF", "YER", "ZAR", "ZMW", "ZWG",
})

# Stablecoin settlement units accepted in addition to ISO 4217.
CASH_SUPPLEMENTAL_CURRENCIES = frozenset({"USDT", "USDC"})

CASH_CURRENCIES = ISO_4217_CURRENCIES | CASH_SUPPLEMENTAL_CURRENCIES

def normalize_currency(code: str) -> str:
    """Normalize and validate a cash currency code.

    Returns the uppercase code, or raises InvalidCurrencyCodeError for
    unknown codes and pence quotations.
    """
    normalized = (code or "").strip().upper()
    if normalized == "GBX":
        raise InvalidCurrencyCodeError(
            code,
            reason="Pence quotations are not supported for cash; record cash amounts in GBP.",
        )
    if normalized not in CASH_CURRENCIES:
        raise InvalidCurrencyCodeError(code)
    return normalized


def is_supported_currency(code: str) -> bool:
    """True when the (case-insensitive) code is an accepted cash currency."""
    return (code or "").strip().upper() in CASH_CURRENCIES
