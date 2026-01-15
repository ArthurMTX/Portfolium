"""
Dividend service for auto-fetching dividends from yfinance
"""
import asyncio
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
import yfinance as yf
from fastapi import Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    Asset, Transaction, TransactionType, Portfolio, 
    PendingDividend, PendingDividendStatus, User
)
from app.crud import pending_dividends as crud_pending
from app.schemas import PendingDividendCreate, TransactionCreate

logger = logging.getLogger(__name__)


class DividendService:
    """
    Service for fetching and managing dividend data from yfinance.
    
    Automatically detects dividends for user holdings and creates pending
    dividend records for user confirmation before affecting P&L.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_shares_at_date(
        self, 
        portfolio_id: int, 
        asset_id: int, 
        target_date: date
    ) -> Decimal:
        """
        Calculate how many shares were held on a specific date.
        
        Takes into account:
        - BUY/TRANSFER_IN (add shares)
        - SELL/TRANSFER_OUT (remove shares)
        - SPLIT (multiply shares by ratio)
        - CONVERSION_IN/OUT
        
        Args:
            portfolio_id: Portfolio ID
            asset_id: Asset ID
            target_date: Date to calculate shares for (ex-dividend date)
            
        Returns:
            Number of shares held on that date
        """
        transactions = (
            self.db.query(Transaction)
            .filter(
                Transaction.portfolio_id == portfolio_id,
                Transaction.asset_id == asset_id,
                Transaction.tx_date <= target_date
            )
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )
        
        shares = Decimal(0)
        
        for tx in transactions:
            if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.CONVERSION_IN]:
                shares += tx.quantity
            elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
                shares -= tx.quantity
            elif tx.type == TransactionType.SPLIT:
                # Parse split ratio from metadata (e.g., "2:1" means 2 shares for every 1)
                ratio = self._parse_split_ratio(tx.meta_data)
                if ratio:
                    shares *= ratio
        
        return max(shares, Decimal(0))  # Never return negative
    
    def _parse_split_ratio(self, meta_data: Optional[dict]) -> Optional[Decimal]:
        """Parse split ratio from transaction metadata"""
        if not meta_data:
            return None
        
        split_str = meta_data.get('split', '')
        if not split_str or ':' not in split_str:
            return None
        
        try:
            parts = split_str.split(':')
            numerator = Decimal(parts[0].strip())
            denominator = Decimal(parts[1].strip())
            if denominator == 0:
                return None
            return numerator / denominator
        except (ValueError, IndexError):
            return None
    
    def fetch_dividends_for_asset(
        self, 
        symbol: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict]:
        """
        Fetch dividend history from yfinance for an asset.
        
        Args:
            symbol: Ticker symbol
            start_date: Start of date range (default: 2 years ago)
            end_date: End of date range (default: 3 months in future for announced dividends)
            
        Returns:
            List of dicts with ex_date, dividend_per_share, payment_date (if available)
        """
        if start_date is None:
            start_date = date.today() - timedelta(days=730)  # 2 years
        if end_date is None:
            end_date = date.today() + timedelta(days=90)  # 3 months future
        
        try:
            ticker = yf.Ticker(symbol)
            dividends = ticker.dividends
            
            if dividends is None or dividends.empty:
                logger.debug(f"No dividends found for {symbol}")
                return []
            
            result = []
            for ex_date, div_amount in dividends.items():
                # Convert pandas Timestamp to date
                ex_date_py = ex_date.date() if hasattr(ex_date, 'date') else ex_date
                
                # Filter by date range
                if start_date <= ex_date_py <= end_date:
                    result.append({
                        'ex_date': ex_date_py,
                        'dividend_per_share': Decimal(str(div_amount)),
                        'raw_timestamp': str(ex_date),
                    })
            
            # Try to get additional info like payment dates from calendar
            try:
                calendar = ticker.calendar
                if calendar is not None and not calendar.empty:
                    # Calendar may have dividend date info
                    pass  # yfinance calendar structure varies, may not always have this
            except Exception:
                pass
            
            logger.info(f"Found {len(result)} dividends for {symbol} in date range")
            return result
            
        except Exception as e:
            logger.error(f"Error fetching dividends for {symbol}: {e}")
            return []
    
    def fetch_dividends_for_portfolio(
        self, 
        portfolio_id: int,
        lookback_days: int = 365,
        lookahead_days: int = 90
    ) -> List[PendingDividend]:
        """
        Fetch dividends for all assets in a portfolio and create pending records.
        
        This is the main method to call for auto-fetching dividends.
        
        Args:
            portfolio_id: Portfolio to fetch dividends for
            lookback_days: How far back to check for dividends
            lookahead_days: How far ahead to check for announced dividends
            
        Returns:
            List of newly created PendingDividend records
        """
        portfolio = self.db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        if not portfolio:
            logger.error(f"Portfolio {portfolio_id} not found")
            return []
        
        # Get all unique assets that have transactions in this portfolio
        asset_ids = (
            self.db.query(Transaction.asset_id)
            .filter(Transaction.portfolio_id == portfolio_id)
            .distinct()
            .all()
        )
        asset_ids = [a[0] for a in asset_ids]
        
        if not asset_ids:
            logger.info(f"No assets found in portfolio {portfolio_id}")
            return []
        
        assets = self.db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
        
        end_date = date.today() + timedelta(days=lookahead_days)
        
        created_pending = []
        
        for asset in assets:
            try:
                # Get first transaction date for this asset in this portfolio
                first_tx = (
                    self.db.query(Transaction)
                    .filter(
                        Transaction.portfolio_id == portfolio_id,
                        Transaction.asset_id == asset.id
                    )
                    .order_by(Transaction.tx_date.asc())
                    .first()
                )
                
                # Start from first transaction date or use default lookback
                if first_tx:
                    start_date = first_tx.tx_date
                    logger.info(f"Fetching dividends for {asset.symbol} from first purchase date: {start_date}")
                else:
                    start_date = date.today() - timedelta(days=lookback_days)
                    logger.info(f"No transactions found for {asset.symbol}, using default lookback: {start_date}")
                
                dividends = self.fetch_dividends_for_asset(
                    asset.symbol, 
                    start_date=start_date,
                    end_date=end_date
                )
                
                for div_data in dividends:
                    ex_date = div_data['ex_date']
                    div_per_share = div_data['dividend_per_share']
                    
                    # Check if already exists
                    if crud_pending.check_dividend_exists(
                        self.db, portfolio_id, asset.id, ex_date
                    ):
                        logger.debug(
                            f"Dividend for {asset.symbol} on {ex_date} already exists, skipping"
                        )
                        continue
                    
                    # Calculate shares held on ex-dividend date
                    shares_held = self.get_shares_at_date(portfolio_id, asset.id, ex_date)
                    
                    if shares_held <= 0:
                        logger.debug(
                            f"No shares held for {asset.symbol} on {ex_date}, skipping dividend"
                        )
                        continue
                    
                    # Calculate gross amount
                    gross_amount = div_per_share * shares_held
                    
                    # Convert date objects to strings for JSON serialization
                    yfinance_data = {
                        'ex_date': ex_date.isoformat() if ex_date else None,
                        'dividend_per_share': str(div_per_share),
                        'raw_timestamp': div_data.get('raw_timestamp'),
                        'payment_date': div_data.get('payment_date').isoformat() if div_data.get('payment_date') else None
                    }
                    
                    # Create pending dividend
                    pending_create = PendingDividendCreate(
                        portfolio_id=portfolio_id,
                        asset_id=asset.id,
                        user_id=portfolio.user_id,
                        ex_dividend_date=ex_date,
                        payment_date=div_data.get('payment_date'),
                        dividend_per_share=div_per_share,
                        shares_held=shares_held,
                        gross_amount=gross_amount,
                        currency=asset.currency,
                        yfinance_raw_data=yfinance_data
                    )
                    
                    try:
                        pending = crud_pending.create_pending_dividend(self.db, pending_create)
                        created_pending.append(pending)
                        logger.info(
                            f"Created pending dividend for {asset.symbol}: "
                            f"{gross_amount} {asset.currency} on {ex_date}"
                        )
                    except Exception as e:
                        logger.error(f"Failed to create pending dividend: {e}")
                        self.db.rollback()
                        
            except Exception as e:
                logger.error(f"Error processing dividends for {asset.symbol}: {e}")
                continue
        
        return created_pending
    
    def accept_pending_dividend(
        self,
        pending_id: int,
        tax_amount: Decimal = Decimal(0),
        notes: Optional[str] = None,
        override_gross: Optional[Decimal] = None,
        override_shares: Optional[Decimal] = None
    ) -> Optional[Transaction]:
        """
        Accept a pending dividend and create an actual DIVIDEND transaction.
        
        Args:
            pending_id: ID of the pending dividend
            tax_amount: Withholding tax to record (stored in fees field)
            notes: Optional notes for the transaction
            override_gross: Override the calculated gross amount
            override_shares: Override the calculated shares held
            
        Returns:
            Created Transaction or None if failed
        """
        from app.crud import transactions as crud_transactions
        from app.services.cache import invalidate_positions
        
        pending = crud_pending.get_pending_dividend(self.db, pending_id)
        if not pending:
            logger.error(f"Pending dividend {pending_id} not found")
            return None
        
        if pending.status != PendingDividendStatus.PENDING:
            logger.error(f"Pending dividend {pending_id} already processed (status: {pending.status})")
            return None
        
        # Use overrides if provided
        shares = override_shares if override_shares is not None else pending.shares_held
        gross = override_gross if override_gross is not None else pending.gross_amount
        
        # For DIVIDEND transactions:
        # - quantity = shares that earned the dividend (for record keeping)
        # - price = dividend per share (gross)
        # - fees = tax withheld
        # This way: gross = quantity * price, net = gross - fees
        
        # Recalculate dividend per share if gross was overridden
        if override_gross is not None and shares > 0:
            div_per_share = gross / shares
        else:
            div_per_share = pending.dividend_per_share
        
        # Create the transaction
        tx_create = TransactionCreate(
            asset_id=pending.asset_id,
            tx_date=pending.ex_dividend_date,
            type=TransactionType.DIVIDEND,
            quantity=shares,
            price=div_per_share,
            fees=tax_amount,
            currency=pending.currency or "USD",
            notes=notes or f"Auto-detected dividend (pending #{pending.id})",
            meta_data={
                "pending_dividend_id": pending.id,
                "auto_detected": True,
                "original_gross": float(pending.gross_amount),
                "original_shares": float(pending.shares_held)
            }
        )
        
        try:
            transaction = crud_transactions.create_transaction(
                self.db, 
                pending.portfolio_id, 
                tx_create
            )
            
            # Update pending dividend status
            crud_pending.update_pending_dividend_status(
                self.db,
                pending_id,
                PendingDividendStatus.ACCEPTED,
                transaction_id=transaction.id
            )
            
            # Invalidate cache
            invalidate_positions(pending.portfolio_id)
            
            logger.info(
                f"Accepted pending dividend {pending_id}, created transaction {transaction.id}"
            )
            
            return transaction
            
        except Exception as e:
            logger.error(f"Failed to create transaction from pending dividend: {e}")
            self.db.rollback()
            return None
    
    def reject_pending_dividend(self, pending_id: int) -> bool:
        """
        Reject a pending dividend (e.g., already recorded manually, incorrect data).
        
        Args:
            pending_id: ID of the pending dividend
            
        Returns:
            True if rejected successfully, False otherwise
        """
        pending = crud_pending.get_pending_dividend(self.db, pending_id)
        if not pending:
            logger.error(f"Pending dividend {pending_id} not found")
            return False
        
        if pending.status != PendingDividendStatus.PENDING:
            logger.error(f"Pending dividend {pending_id} already processed")
            return False
        
        crud_pending.update_pending_dividend_status(
            self.db,
            pending_id,
            PendingDividendStatus.REJECTED
        )
        
        logger.info(f"Rejected pending dividend {pending_id}")
        return True


def get_dividend_service(db: Session = Depends(get_db)) -> DividendService:
    """Dependency injection for DividendService"""
    return DividendService(db)
