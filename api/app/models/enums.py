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
