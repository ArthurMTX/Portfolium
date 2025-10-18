"""
CSV import service
"""
import logging
import csv
from io import StringIO
from datetime import datetime
from decimal import Decimal
from typing import List
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
        """
        errors = []
        warnings = []
        imported_count = 0
        
        try:
            # Parse CSV
            csv_file = StringIO(csv_content)
            reader = csv.DictReader(csv_file, delimiter=delimiter)
            
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is 1)
                try:
                    # Parse row
                    import_row = self._parse_row(row)
                    
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
                    
                    # Handle SPLIT metadata
                    meta_data = {}
                    if import_row.type == TransactionType.SPLIT and import_row.split_ratio:
                        meta_data["split"] = import_row.split_ratio
                    
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
        notes = row.get("notes", "").strip() or None
        
        return CsvImportRow(
            date=tx_date,
            symbol=symbol,
            type=tx_type,
            quantity=quantity,
            price=price,
            fees=fees,
            currency=currency,
            split_ratio=split_ratio,
            notes=notes
        )


def get_csv_import_service(db: Session = Depends(get_db)) -> CsvImportService:
    """Dependency for getting CSV import service"""
    return CsvImportService(db)
