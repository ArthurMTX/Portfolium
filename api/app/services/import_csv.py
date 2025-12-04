"""
CSV import service
"""
import logging
import csv
from io import StringIO
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Callable, Dict, Any, Generator
from sqlalchemy.orm import Session
from fastapi import Depends

from app.models import TransactionType
from app.schemas import CsvImportRow, CsvImportResult, TransactionCreate
from app.crud import assets as crud_assets, transactions as crud_transactions
from app.db import get_db

logger = logging.getLogger(__name__)


class CsvImportService:
    """Service for importing transactions from CSV"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def import_csv_with_progress(
        self, 
        portfolio_id: int,
        csv_content: str,
        delimiter: str = ","
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Import transactions from CSV content with progress updates
        
        Yields progress updates as dictionaries with:
        - type: 'progress' | 'log' | 'complete' | 'error'
        - message: str (for logs)
        - current: int (for progress)
        - total: int (for progress)
        - row_num: int (current row being processed)
        - result: CsvImportResult (final result on complete)
        """
        errors = []
        warnings = []
        imported_count = 0
        total_rows = 0
        
        try:
            # First pass: count total rows and parse for sorting
            csv_file = StringIO(csv_content)
            reader = csv.DictReader(csv_file, delimiter=delimiter)
            rows = list(reader)
            total_rows = len(rows)
            
            # Sort rows by sequence if present, to preserve original order
            # This is important for same-day transactions
            def get_sequence(row):
                seq = row.get("sequence", "").strip()
                return int(seq) if seq else float('inf')
            
            rows.sort(key=get_sequence)
            
            yield {
                "type": "log",
                "message": f"Starting import of {total_rows} rows",
                "current": 0,
                "total": total_rows
            }
            
            # Second pass: process rows
            for row_num, row in enumerate(rows, start=2):  # Start at 2 (header is 1)
                try:
                    yield {
                        "type": "log",
                        "message": f"Processing row {row_num - 1}/{total_rows}...",
                        "current": row_num - 2,
                        "total": total_rows,
                        "row_num": row_num
                    }
                    
                    # Parse row
                    import_row = self._parse_row(row)
                    
                    yield {
                        "type": "log",
                        "message": f"Row {row_num - 1}: {import_row.type.value} {import_row.quantity} {import_row.symbol}",
                        "current": row_num - 2,
                        "total": total_rows,
                        "row_num": row_num
                    }
                    
                    # Validate SPLIT transactions
                    if import_row.type == TransactionType.SPLIT and not import_row.split_ratio:
                        raise ValueError(f'SPLIT transactions must include a split_ratio (e.g., "2:1")')
                    
                    # Validate CONVERSION transactions must have conversion_id
                    if import_row.type in [TransactionType.CONVERSION_IN, TransactionType.CONVERSION_OUT]:
                        if not import_row.conversion_id:
                            raise ValueError(
                                f'{import_row.type.value} transactions require a conversion_id to link pairs'
                            )
                    
                    # Get or create asset
                    asset = crud_assets.get_asset_by_symbol(self.db, import_row.symbol)
                    if not asset:
                        # Auto-create asset
                        from app.schemas import AssetCreate
                        from app.models import AssetClass
                        
                        yield {
                            "type": "log",
                            "message": f"Creating new asset: {import_row.symbol}",
                            "current": row_num - 2,
                            "total": total_rows,
                            "row_num": row_num
                        }
                        
                        # Guess asset class from symbol
                        asset_class = AssetClass.CRYPTO if "-USD" in import_row.symbol else AssetClass.STOCK
                        
                        asset_create = AssetCreate(
                            symbol=import_row.symbol,
                            name=import_row.symbol,
                            currency=import_row.currency,
                            class_=asset_class
                        )
                        asset = crud_assets.create_asset(self.db, asset_create)
                        warning_msg = f"Row {row_num}: Auto-created asset {import_row.symbol}"
                        warnings.append(warning_msg)
                        
                        yield {
                            "type": "log",
                            "message": warning_msg,
                            "current": row_num - 2,
                            "total": total_rows,
                            "row_num": row_num
                        }
                    
                    # Handle SPLIT metadata and conversion_id
                    meta_data = {}
                    if import_row.type == TransactionType.SPLIT and import_row.split_ratio:
                        meta_data["split"] = import_row.split_ratio
                    if import_row.conversion_id:
                        meta_data["conversion_id"] = import_row.conversion_id
                    
                    # Create transaction
                    tx_create = TransactionCreate(
                        asset_id=asset.id,
                        tx_date=import_row.date,
                        type=import_row.type,
                        quantity=import_row.quantity,
                        price=import_row.price,
                        fees=import_row.fees,
                        currency=import_row.currency,
                        notes=import_row.notes,
                        meta_data=meta_data
                    )
                    
                    crud_transactions.create_transaction(self.db, portfolio_id, tx_create)
                    imported_count += 1
                    
                    yield {
                        "type": "progress",
                        "message": f"Created transaction {imported_count}/{total_rows}",
                        "current": row_num - 1,
                        "total": total_rows,
                        "row_num": row_num
                    }
                    
                    # Update first_transaction_date if this is earlier than the current value
                    if tx_create.type in [TransactionType.BUY, TransactionType.TRANSFER_IN]:
                        if asset.first_transaction_date is None or import_row.date < asset.first_transaction_date:
                            asset.first_transaction_date = import_row.date
                            self.db.commit()
                            self.db.refresh(asset)
                            logger.info(f"Updated first_transaction_date for {asset.symbol} to {import_row.date}")
                    
                    # Auto-backfill historical prices for BUY/TRANSFER_IN transactions
                    if tx_create.type in [TransactionType.BUY, TransactionType.TRANSFER_IN]:
                        from app.services.pricing import PricingService
                        pricing_service = PricingService(self.db)
                        start_date = datetime.combine(import_row.date, datetime.min.time())
                        end_date = datetime.utcnow()
                        
                        try:
                            yield {
                                "type": "log",
                                "message": f"Backfilling prices for {asset.symbol}...",
                                "current": row_num - 1,
                                "total": total_rows,
                                "row_num": row_num
                            }
                            
                            count = pricing_service.ensure_historical_prices(asset, start_date, end_date)
                            if count > 0:
                                logger.info(f"Auto-backfilled {count} historical prices for {asset.symbol}")
                                yield {
                                    "type": "log",
                                    "message": f"Backfilled {count} prices for {asset.symbol}",
                                    "current": row_num - 1,
                                    "total": total_rows,
                                    "row_num": row_num
                                }
                        except Exception as e:
                            logger.warning(f"Failed to auto-backfill prices for {asset.symbol}: {e}")
                            yield {
                                "type": "log",
                                "message": f"Warning: Failed to backfill prices for {asset.symbol}",
                                "current": row_num - 1,
                                "total": total_rows,
                                "row_num": row_num
                            }
                    
                except Exception as e:
                    error_msg = f"Row {row_num}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(f"Error importing row {row_num}: {e}")
                    
                    yield {
                        "type": "error",
                        "message": error_msg,
                        "current": row_num - 1,
                        "total": total_rows,
                        "row_num": row_num
                    }
            
            success = len(errors) == 0
            result = CsvImportResult(
                success=success,
                imported_count=imported_count,
                errors=errors,
                warnings=warnings
            )
            
            yield {
                "type": "complete",
                "message": f"Import complete: {imported_count} transactions imported",
                "current": total_rows,
                "total": total_rows,
                "result": result.model_dump()
            }
            
        except Exception as e:
            logger.error(f"CSV import failed: {e}")
            result = CsvImportResult(
                success=False,
                imported_count=0,
                errors=[f"CSV parsing failed: {str(e)}"],
                warnings=[]
            )
            
            yield {
                "type": "error",
                "message": f"CSV parsing failed: {str(e)}",
                "current": 0,
                "total": total_rows,
                "result": result.model_dump()
            }

    
    def import_csv(
        self, 
        portfolio_id: int,
        csv_content: str,
        delimiter: str = ","
    ) -> CsvImportResult:
        """
        Import transactions from CSV content
        
        Expected columns:
        - date (YYYY-MM-DD)
        - symbol
        - type (BUY, SELL, DIVIDEND, FEE, SPLIT)
        - quantity
        - price
        - fees (optional)
        - currency (optional, defaults to USD)
        - notes (optional)
        - split_ratio (optional, for SPLIT type, e.g., "2:1")
        - conversion_id (optional, links CONVERSION_IN/OUT pairs)
        - sequence (optional, preserves order within same date)
        """
        errors = []
        warnings = []
        imported_count = 0
        
        try:
            # Parse CSV
            csv_file = StringIO(csv_content)
            reader = csv.DictReader(csv_file, delimiter=delimiter)
            rows = list(reader)
            
            # Sort rows by sequence if present, to preserve original order
            # This is important for same-day transactions
            def get_sequence(row):
                seq = row.get("sequence", "").strip()
                return int(seq) if seq else float('inf')
            
            rows.sort(key=get_sequence)
            
            for row_num, row in enumerate(rows, start=2):  # Start at 2 (header is 1)
                try:
                    # Parse row
                    import_row = self._parse_row(row)
                    
                    # Validate SPLIT transactions
                    if import_row.type == TransactionType.SPLIT and not import_row.split_ratio:
                        raise ValueError(f'SPLIT transactions must include a split_ratio (e.g., "2:1")')
                    
                    # Validate CONVERSION transactions must have conversion_id
                    if import_row.type in [TransactionType.CONVERSION_IN, TransactionType.CONVERSION_OUT]:
                        if not import_row.conversion_id:
                            raise ValueError(
                                f'{import_row.type.value} transactions require a conversion_id to link pairs'
                            )
                    
                    # Get or create asset
                    asset = crud_assets.get_asset_by_symbol(self.db, import_row.symbol)
                    if not asset:
                        # Auto-create asset
                        from app.schemas import AssetCreate
                        from app.models import AssetClass
                        
                        # Guess asset class from symbol
                        asset_class = AssetClass.CRYPTO if "-USD" in import_row.symbol else AssetClass.STOCK
                        
                        asset_create = AssetCreate(
                            symbol=import_row.symbol,
                            name=import_row.symbol,
                            currency=import_row.currency,
                            class_=asset_class
                        )
                        asset = crud_assets.create_asset(self.db, asset_create)
                        warnings.append(f"Row {row_num}: Auto-created asset {import_row.symbol}")
                    
                    # Handle SPLIT metadata and conversion_id
                    meta_data = {}
                    if import_row.type == TransactionType.SPLIT and import_row.split_ratio:
                        meta_data["split"] = import_row.split_ratio
                    if import_row.conversion_id:
                        meta_data["conversion_id"] = import_row.conversion_id
                    
                    # Create transaction
                    tx_create = TransactionCreate(
                        asset_id=asset.id,
                        tx_date=import_row.date,
                        type=import_row.type,
                        quantity=import_row.quantity,
                        price=import_row.price,
                        fees=import_row.fees,
                        currency=import_row.currency,
                        notes=import_row.notes,
                        meta_data=meta_data
                    )
                    
                    crud_transactions.create_transaction(self.db, portfolio_id, tx_create)
                    imported_count += 1
                    
                    # Update first_transaction_date if this is earlier than the current value
                    if tx_create.type in [TransactionType.BUY, TransactionType.TRANSFER_IN]:
                        if asset.first_transaction_date is None or import_row.date < asset.first_transaction_date:
                            asset.first_transaction_date = import_row.date
                            self.db.commit()
                            self.db.refresh(asset)
                            logger.info(f"Updated first_transaction_date for {asset.symbol} to {import_row.date}")
                    
                    # Auto-backfill historical prices for BUY/TRANSFER_IN transactions
                    if tx_create.type in [TransactionType.BUY, TransactionType.TRANSFER_IN]:
                        from app.services.pricing import PricingService
                        pricing_service = PricingService(self.db)
                        start_date = datetime.combine(import_row.date, datetime.min.time())
                        end_date = datetime.utcnow()
                        
                        try:
                            count = pricing_service.ensure_historical_prices(asset, start_date, end_date)
                            if count > 0:
                                logger.info(f"Auto-backfilled {count} historical prices for {asset.symbol}")
                        except Exception as e:
                            logger.warning(f"Failed to auto-backfill prices for {asset.symbol}: {e}")
                    
                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")
                    logger.error(f"Error importing row {row_num}: {e}")
            
            success = len(errors) == 0
            
            return CsvImportResult(
                success=success,
                imported_count=imported_count,
                errors=errors,
                warnings=warnings
            )
            
        except Exception as e:
            logger.error(f"CSV import failed: {e}")
            return CsvImportResult(
                success=False,
                imported_count=0,
                errors=[f"CSV parsing failed: {str(e)}"],
                warnings=[]
            )
    
    def _parse_row(self, row: dict) -> CsvImportRow:
        """Parse a single CSV row"""
        # Required fields
        date_str = row.get("date", "").strip()
        symbol = row.get("symbol", "").strip().upper()
        type_str = row.get("type", "").strip().upper()
        
        if not date_str or not symbol or not type_str:
            raise ValueError("Missing required fields: date, symbol, or type")
        
        # Parse date
        try:
            tx_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except:
            raise ValueError(f"Invalid date format: {date_str} (expected YYYY-MM-DD)")
        
        # Parse transaction type
        try:
            tx_type = TransactionType[type_str]
        except:
            raise ValueError(f"Invalid transaction type: {type_str}")
        
        # Optional fields
        quantity = Decimal(row.get("quantity", "0").strip() or "0")
        price = Decimal(row.get("price", "0").strip() or "0")
        fees = Decimal(row.get("fees", "0").strip() or "0")
        currency = row.get("currency", "USD").strip().upper()
        split_ratio = row.get("split_ratio", "").strip() or None
        conversion_id = row.get("conversion_id", "").strip() or None
        notes = row.get("notes", "").strip() or None
        
        # Parse sequence number for ordering
        sequence_str = row.get("sequence", "").strip()
        sequence = int(sequence_str) if sequence_str else None
        
        return CsvImportRow(
            date=tx_date,
            symbol=symbol,
            type=tx_type,
            quantity=quantity,
            price=price,
            fees=fees,
            currency=currency,
            split_ratio=split_ratio,
            conversion_id=conversion_id,
            notes=notes,
            sequence=sequence
        )


def get_csv_import_service(db: Session = Depends(get_db)) -> CsvImportService:
    """Dependency for getting CSV import service"""
    return CsvImportService(db)
