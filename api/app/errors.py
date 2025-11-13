"""
Standardized error handling for Portfolium API

This module provides custom exception classes that ensure consistent
error responses across all endpoints.
"""
from datetime import date
from fastapi import HTTPException, status
from typing import Optional, Dict


class PortfoliumException(HTTPException):
    """Base exception for all Portfolium errors"""
    
    def __init__(
        self,
        status_code: int,
        detail: str,
        headers: Optional[Dict[str, str]] = None
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)


# Portfolio-related errors
class PortfolioNotFoundError(PortfoliumException):
    """Raised when a portfolio is not found"""
    
    def __init__(self, portfolio_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )


class UnauthorizedPortfolioAccessError(PortfoliumException):
    """Raised when user tries to access a portfolio they don't own"""
    
    def __init__(self, portfolio_id: int):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Not authorized to access portfolio {portfolio_id}"
        )


class PortfolioAlreadyExistsError(PortfoliumException):
    """Raised when trying to create a portfolio with a duplicate name"""
    
    def __init__(self, name: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Portfolio with name '{name}' already exists"
        )


class CannotGetPortfolioInsightsError(PortfoliumException):
    """Raised when portfolio insights cannot be retrieved"""
    
    def __init__(self, portfolio_id: int, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get insights for portfolio {portfolio_id}: {reason}"
        )


class CannotGetPortfolioMetricsError(PortfoliumException):
    """Raised when portfolio metrics cannot be retrieved"""
    
    def __init__(self, portfolio_id: int, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get metrics for portfolio {portfolio_id}: {reason}"
        )


class CannotGetPortfolioHistoryError(PortfoliumException):
    """Raised when portfolio history cannot be retrieved"""
    
    def __init__(self, portfolio_id: int, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get history for portfolio {portfolio_id}: {reason}"
        )


class CannotGetPortfolioReportError(PortfoliumException):
    """Raised when portfolio report generation fails"""
    
    def __init__(self, portfolio_id: int, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report for portfolio {portfolio_id}: {reason}"
        )


class CannotGetPortfolioPricesError(PortfoliumException):
    """Raised when batch price retrieval for a portfolio fails"""
    
    def __init__(self, portfolio_id: int, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get prices for portfolio {portfolio_id}: {reason}"
        )


# Asset-related errors
class AssetNotFoundError(PortfoliumException):
    """Raised when an asset is not found by symbol or ID"""
    
    def __init__(self, identifier: str | int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset '{identifier}' not found"
        )


class AssetAlreadyExistsError(PortfoliumException):
    """Raised when trying to create an asset that already exists"""
    
    def __init__(self, symbol: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Asset '{symbol}' already exists"
        )


class InvalidAssetSymbolError(PortfoliumException):
    """Raised when an asset symbol is invalid"""
    
    def __init__(self, symbol: str, reason: Optional[str] = None):
        detail = f"Invalid asset symbol: '{symbol}'"
        if reason:
            detail += f" - {reason}"
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


# Transaction-related errors
class TransactionNotFoundError(PortfoliumException):
    """Raised when a transaction is not found"""
    
    def __init__(self, transaction_id: int, portfolio_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found in portfolio {portfolio_id}"
        )


class InvalidTransactionError(PortfoliumException):
    """Raised when a transaction is invalid"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transaction: {reason}"
        )


# Price-related errors
class PriceNotFoundError(PortfoliumException):
    """Raised when price data is not found"""
    
    def __init__(self, symbol: str, date: Optional[str] = None):
        detail = f"Price data not found for {symbol}"
        if date:
            detail += f" on {date}"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class InvalidPriceRequestError(PortfoliumException):
    """Raised when a price request is invalid"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid price request: {reason}"
        )


class PriceFetchError(PortfoliumException):
    """Raised when price fetching fails"""
    
    def __init__(self, symbol: str, reason: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch price for {symbol}: {reason}"
        )


class PriceAlertTaskError(PortfoliumException):
    """Raised when price alert check task fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Price alert task failed: {reason}"
        )


class PriceRefreshTaskError(PortfoliumException):
    """Raised when price refresh task fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Price refresh task failed: {reason}"
        )


class CannotSellMoreThanOwnedError(PortfoliumException):
    """Raised when trying to sell more shares than owned"""
    
    def __init__(self, symbol: str, owned: float, attempted_sell: float, tx_date: date):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot sell {attempted_sell} shares of {symbol} on {tx_date}. "
                   f"Position at that date: {owned} shares. "
                   f"(This check can be disabled in settings: VALIDATE_SELL_QUANTITY=false)"
        )


class CannotSplitWithoutBuyError(PortfoliumException):
    """Raised when trying to record a stock split without prior buy transactions"""
    
    def __init__(self, symbol: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot record a split for {symbol} without any existing position transactions. "
                   f"Please add at least one BUY transaction before recording a split."
        )


class ImportTransactionsError(PortfoliumException):
    """Raised when importing transactions fails"""
    
    def __init__(self, reason: str, imported_count: int):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import transactions: {reason}. Imported count: {imported_count}"
        )


class LogoCacheStatsError(PortfoliumException):
    """Raised when fetching logo cache stats fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch logo cache stats: {reason}"
        )        


class LogoCacheClearError(PortfoliumException):
    """Raised when clearing logo cache fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear logo cache: {reason}"
        )


class SearchTickerError(PortfoliumException):
    """Raised when searching for a ticker fails"""
    
    def __init__(self, status: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Yahoo Finance search failed with status: {status}"
        )


class FailedToFetchYahooFinanceDataError(PortfoliumException):
    """Raised when fetching data from Yahoo Finance fails"""
    
    def __init__(self, symbol: str, reason: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch data for {symbol} from Yahoo Finance: {reason}"
        )


class FailedToConnectToYahooError(PortfoliumException):
    """Raised when unable to connect to Yahoo Finance"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to Yahoo Finance: {reason}"
        )


class SetMetadataError(PortfoliumException):
    """Raised when trying to set asset metadata when Yahoo Finance data exists"""
    
    def __init__(self, symbol: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot set metadata for asset '{symbol}' because Yahoo Finance data exists. Use overrides instead."
        )


class InvalidPriceHistoryPeriodError(PortfoliumException):
    """Raised when an invalid price history period is specified"""
    
    def __init__(self, period: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid price history period: '{period}'. Valid values: 1W, 1M, 3M, 6M, YTD, 1Y, ALL"
        )


class AssetNotFoundInDatabaseError(PortfoliumException):
    """Raised when an asset is not found in the database by ID"""
    
    def __init__(self, asset_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID '{asset_id}' not found in database"
        )


class InvalidAssetIDOrSymbolError(PortfoliumException):
    """Raised when both asset ID and symbol are missing or invalid"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either asset ID or symbol must be provided and valid"
        )

# User-related errors
class UserNotFoundError(PortfoliumException):
    """Raised when a user is not found"""
    
    def __init__(self, user_id: Optional[int] = None, email: Optional[str] = None):
        if user_id:
            detail = f"User {user_id} not found"
        elif email:
            detail = f"User with email '{email}' not found"
        else:
            detail = "User not found"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class InvalidCredentialsError(PortfoliumException):
    """Raised when login credentials are invalid"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )


class EmailAlreadyRegisteredError(PortfoliumException):
    """Raised when trying to register with an email that's already in use"""
    
    def __init__(self, email: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{email}' is already registered"
        )


class UsernameAlreadyRegisteredError(PortfoliumException):
    """Raised when trying to register with a username that's already in use"""
    
    def __init__(self, username: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{username}' is already registered"
        )

class UsernameOrEmailAlreadyRegisteredError(PortfoliumException):
    """Raised when trying to register with a username or email that's already in use"""
    
    def __init__(self, identifier: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username or email '{identifier}' is already registered"
        )


class EmailNotVerifiedError(PortfoliumException):
    """Raised when a user tries to perform an action requiring email verification"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email address."
        )


class EmailAlreadyVerifiedError(PortfoliumException):
    """Raised when trying to verify an already verified email"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified"
        )


class IncorrectPasswordError(PortfoliumException):
    """Raised when the provided password is incorrect"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
            headers={"WWW-Authenticate": "Bearer"}
        )


class InvalidTokenError(PortfoliumException):
    """Raised when a JWT token is invalid or expired"""
    
    def __init__(self, reason: str = "Invalid or expired token"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=reason,
            headers={"WWW-Authenticate": "Bearer"}
        )


class InactiveUserError(PortfoliumException):
    """Raised when an inactive user tries to perform an action"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account"
        )


class NotEnoughPermissionsError(PortfoliumException):
    """Raised when a user lacks necessary permissions"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to perform this action"
        )


class FailedToDeleteDataError(PortfoliumException):
    """Raised when deletion of user data fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user data: {reason}"
        )


class CannotRevokeSuperAdminError(PortfoliumException):
    """Raised when trying to revoke superadmin rights from the first superadmin"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revoke superadmin rights from the first superadmin"
        )


class CannotDeactivateSuperAdminError(PortfoliumException):
    """Raised when trying to deactivate the first superadmin"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate the first superadmin"
        )

class CannotDeleteSuperAdminError(PortfoliumException):
    """Raised when trying to delete the first superadmin"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the first superadmin"
        )


class EmailSystemDisabledError(PortfoliumException):
    """Raised when email system is disabled but an email action is attempted"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email system is currently disabled. Please enable it in the email configuration before testing."
        )


class FailedToSendTestEmailError(PortfoliumException):
    """Raised when sending a test email fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send test email: {reason}"
        )


class InvalidTestEmailTypeError(PortfoliumException):
    """Raised when an invalid test email type is specified"""
    
    def __init__(self, test_type: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid test email type: '{test_type}'. Use: simple, verification, password_reset, or daily_report"
        )


class SMTPConfigurationError(PortfoliumException):
    """Raised when SMTP configuration is invalid"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SMTP configuration error: {reason}"
        )


class EmailSendingError(PortfoliumException):
    """Raised when sending an email fails"""
    
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {detail}"
        )


class FailedToGetEmailStatsError(PortfoliumException):
    """Raised when fetching email statistics fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get email statistics: {reason}"
        )

# Watchlist-related errors
class WatchlistItemNotFoundError(PortfoliumException):
    """Raised when a watchlist item is not found"""
    
    def __init__(self, item_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist item {item_id} not found"
        )


class WatchlistItemAlreadyExistsError(PortfoliumException):
    """Raised when trying to add an asset that's already in the watchlist"""
    
    def __init__(self, symbol: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Asset '{symbol}' is already in your watchlist"
        )


class NotAuthorizedWatchlistAccessError(PortfoliumException):
    """Raised when a user tries to access a watchlist item they don't own"""
    
    def __init__(self, item_id: int):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Not authorized to access watchlist item {item_id}"
        )


class WrongImportFormatError(PortfoliumException):
    """Raised when the watchlist import file format is incorrect"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid watchlist import format. Must be a CSV."
        )


class FailedToParseWatchlistImportError(PortfoliumException):
    """Raised when parsing the watchlist import file fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse watchlist import file: {reason}"
        )


# Notification-related errors
class NotificationNotFoundError(PortfoliumException):
    """Raised when a notification is not found"""
    
    def __init__(self, notification_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification {notification_id} not found"
        )


class InvalidNotificationTypeError(PortfoliumException):
    """Raised when a notification type is invalid"""
    
    def __init__(self, notification_type: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid notification type: '{notification_type}'"
        )


class FailedToCreateNotificationError(PortfoliumException):
    """Raised when creating a notification fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create notification: {reason}"
        )


class NotAuthorizedNotificationAccessError(PortfoliumException):
    """Raised when a user tries to access a notification they don't own"""
    
    def __init__(self, notification_id: int):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Not authorized to access notification {notification_id}"
        )


# Dashboard-related errors
class DashboardLayoutNotFoundError(PortfoliumException):
    """Raised when a dashboard layout is not found"""
    
    def __init__(self, layout_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dashboard layout {layout_id} not found"
        )


class InvalidDashboardLayoutError(PortfoliumException):
    """Raised when a dashboard layout is invalid"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid dashboard layout: {reason}"
        )


class FailedToCreateDashboardLayoutError(PortfoliumException):
    """Raised when creating a dashboard layout fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create dashboard layout: {reason}"
        )


class FailedToImportDashboardLayoutError(PortfoliumException):
    """Raised when importing a dashboard layout fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import dashboard layout: {reason}"
        )


class SourceLayoutNotFoundError(PortfoliumException):
    """Raised when the source layout for duplication is not found"""
    
    def __init__(self, source_layout_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source layout {source_layout_id} not found"
        )


# External service errors
class ExternalServiceError(PortfoliumException):
    """Raised when an external service (API) fails"""
    
    def __init__(self, service: str, reason: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"External service '{service}' unavailable: {reason}"
        )


class RateLimitExceededError(PortfoliumException):
    """Raised when rate limit is exceeded for external service"""
    
    def __init__(self, service: str, retry_after: Optional[int] = None):
        detail = f"Rate limit exceeded for {service}"
        headers = None
        if retry_after:
            detail += f". Retry after {retry_after} seconds"
            headers = {"Retry-After": str(retry_after)}
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers=headers
        )


class FailedToFetchMarketSentimentError(PortfoliumException):
    """Raised when fetching market sentiment data fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch market sentiment data: {reason}"
        )


class FailedToFetchCryptoSentimentError(PortfoliumException):
    """Raised when fetching crypto sentiment data fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch crypto sentiment data: {reason}"
        )


class InvalidMarketSentimentTypeError(PortfoliumException):
    """Raised when an invalid market sentiment type is specified"""
    
    def __init__(self, sentiment_type: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid market sentiment type: '{sentiment_type}'. Use: stock or crypto"
        )


class VIXDataFetchError(PortfoliumException):
    """Raised when fetching VIX data fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch VIX data: {reason}"
        )


class TNXDataFetchError(PortfoliumException):
    """Raised when fetching TNX data fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch TNX data: {reason}"
        )


class DXYDataFetchError(PortfoliumException):
    """Raised when fetching DXY data fails"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch DXY data: {reason}"
        )


class LogFileNotFoundError(PortfoliumException):
    """Raised when the log file is not found"""
    
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Log file not found"
        )


# Validation errors
class ValidationError(PortfoliumException):
    """Raised when input validation fails"""
    
    def __init__(self, field: str, reason: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Validation error for '{field}': {reason}"
        )


class DateRangeError(PortfoliumException):
    """Raised when a date range is invalid"""
    
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date range: {reason}"
        )
