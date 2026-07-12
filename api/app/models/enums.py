"""
Enumeration types for the application
"""
import enum


class AssetClass(str, enum.Enum):
    """Asset class enumeration"""
    STOCK = "stock"
    ETF = "etf"
    CRYPTO = "crypto"
    CASH = "cash"


class TransactionType(str, enum.Enum):
    """Transaction type enumeration"""
    BUY = "BUY"
    SELL = "SELL"
    DIVIDEND = "DIVIDEND"
    FEE = "FEE"
    SPLIT = "SPLIT"
    TRANSFER_IN = "TRANSFER_IN"
    TRANSFER_OUT = "TRANSFER_OUT"
    CONVERSION_OUT = "CONVERSION_OUT"  # Selling asset in a swap (e.g., BTC in BTC→ETH)
    CONVERSION_IN = "CONVERSION_IN"    # Buying asset in a swap (e.g., ETH in BTC→ETH)


class CashMode(str, enum.Enum):
    """Per-portfolio cash tracking mode.

    UNTRACKED reproduces the historical Portfolium behavior: no cash ledger,
    no cash valuation, transactions are never rejected for insufficient cash.
    TRACKED_WARN maintains the ledger and surfaces warnings on negative
    balances. TRACKED_STRICT rejects operations that would make a settlement
    currency balance negative at any date.
    """
    UNTRACKED = "untracked"
    TRACKED_WARN = "tracked_warn"
    TRACKED_STRICT = "tracked_strict"


class CashMovementType(str, enum.Enum):
    """Cash ledger movement type.

    opening_balance is reserved for activation/reconstruction workflows;
    buy/sell/dividend movements are derived from asset transactions;
    fx_debit/fx_credit are the two legs of an explicit Forex conversion.
    """
    OPENING_BALANCE = "opening_balance"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    BUY = "buy"
    SELL = "sell"
    DIVIDEND = "dividend"
    INTEREST = "interest"
    FEE = "fee"
    TAX = "tax"
    FX_DEBIT = "fx_debit"
    FX_CREDIT = "fx_credit"
    ADJUSTMENT = "adjustment"


class NotificationType(str, enum.Enum):
    """Notification type enumeration"""
    TRANSACTION_CREATED = "TRANSACTION_CREATED"
    TRANSACTION_UPDATED = "TRANSACTION_UPDATED"
    TRANSACTION_DELETED = "TRANSACTION_DELETED"
    LOGIN = "LOGIN"
    PRICE_ALERT = "PRICE_ALERT"
    DAILY_CHANGE_UP = "DAILY_CHANGE_UP"
    DAILY_CHANGE_DOWN = "DAILY_CHANGE_DOWN"
    SYSTEM = "SYSTEM"
    PENDING_DIVIDEND = "PENDING_DIVIDEND"  # Auto-fetched dividend awaiting review
    ATH = "ATH"  # All-Time High notification
    ATL = "ATL"  # All-Time Low notification
