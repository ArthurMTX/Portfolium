"""
Tests for transaction CSV import validation and preview.
"""
from datetime import date
from decimal import Decimal

from app.models import Asset, Transaction, TransactionType
from app.services.workflows.import_csv import CsvImportService
from tests.factories import AssetFactory, PortfolioFactory, TransactionFactory, UserFactory


def make_portfolio():
    user = UserFactory.create()
    return PortfolioFactory.create(user_id=user.id)


def allow_symbols(monkeypatch, service: CsvImportService, invalid_symbols=None):
    invalid_symbols = set(invalid_symbols or [])
    monkeypatch.setattr(
        service,
        "_validate_symbols_in_provider",
        lambda symbols: [symbol for symbol in symbols if symbol in invalid_symbols],
    )


def test_preview_csv_valid_counts_rows_and_types(test_db, monkeypatch):
    service = CsvImportService(test_db)
    portfolio = make_portfolio()
    AssetFactory.create(symbol="AAPL")
    AssetFactory.create(symbol="MSFT")
    allow_symbols(monkeypatch, service)

    csv_content = """date,symbol,type,quantity,price,fees,currency
2024-01-01,AAPL,BUY,10,150,5,USD
2024-01-02,MSFT,DIVIDEND,0,12,0,USD"""

    result = service.preview_csv(portfolio.id, csv_content)

    assert result.total_rows == 2
    assert result.valid_count == 2
    assert result.error_count == 0
    assert result.summary_by_type == {"BUY": 1, "DIVIDEND": 1}


def test_preview_csv_reports_invalid_rows_without_writing(test_db, monkeypatch):
    service = CsvImportService(test_db)
    portfolio = make_portfolio()
    allow_symbols(monkeypatch, service)
    asset_count_before = test_db.query(Asset).count()
    transaction_count_before = test_db.query(Transaction).count()

    csv_content = """date,symbol,type,quantity,price,fees,currency
2024-01-01,AAPL,BUY,10,150,5,USD
not-a-date,MSFT,BUY,1,2,0,USD
2024-01-03,MSFT,UNKNOWN,1,2,0,USD"""

    result = service.preview_csv(portfolio.id, csv_content)

    assert result.total_rows == 3
    assert result.valid_count == 1
    assert result.error_count == 2
    assert test_db.query(Asset).count() == asset_count_before
    assert test_db.query(Transaction).count() == transaction_count_before


def test_preview_csv_requires_split_ratio(test_db, monkeypatch):
    service = CsvImportService(test_db)
    portfolio = make_portfolio()
    AssetFactory.create(symbol="AAPL")
    allow_symbols(monkeypatch, service)

    csv_content = """date,symbol,type,quantity,price,fees,currency
2024-06-01,AAPL,SPLIT,0,0,0,USD"""

    result = service.preview_csv(portfolio.id, csv_content)

    assert result.valid_count == 0
    assert result.error_count == 1
    assert "split_ratio" in result.errors[0].message


def test_preview_csv_requires_conversion_id(test_db, monkeypatch):
    service = CsvImportService(test_db)
    portfolio = make_portfolio()
    AssetFactory.create(symbol="BTC-USD")
    allow_symbols(monkeypatch, service)

    csv_content = """date,symbol,type,quantity,price,fees,currency
2024-01-01,BTC-USD,CONVERSION_OUT,1,40000,0,USD"""

    result = service.preview_csv(portfolio.id, csv_content)

    assert result.valid_count == 0
    assert result.error_count == 1
    assert "conversion_id" in result.errors[0].message


def test_preview_csv_detects_csv_duplicates(test_db, monkeypatch):
    service = CsvImportService(test_db)
    portfolio = make_portfolio()
    AssetFactory.create(symbol="AAPL")
    allow_symbols(monkeypatch, service)

    csv_content = """date,symbol,type,quantity,price,fees,currency
2024-01-01,AAPL,BUY,10,150,5,USD
2024-01-01,AAPL,BUY,10.0,150.00,5.00,USD"""

    result = service.preview_csv(portfolio.id, csv_content)

    assert result.error_count == 0
    assert result.duplicate_count == 1
    assert result.duplicates[0].scope == "csv"


def test_preview_csv_detects_database_duplicates(test_db, monkeypatch):
    service = CsvImportService(test_db)
    portfolio = make_portfolio()
    asset = AssetFactory.create(symbol="AAPL")
    TransactionFactory.create(
        portfolio_id=portfolio.id,
        asset_id=asset.id,
        tx_date=date(2024, 1, 1),
        type=TransactionType.BUY,
        quantity=Decimal("10"),
        price=Decimal("150"),
        fees=Decimal("5"),
        currency="USD",
    )
    allow_symbols(monkeypatch, service)

    csv_content = """date,symbol,type,quantity,price,fees,currency
2024-01-01,AAPL,BUY,10,150,5,USD"""

    result = service.preview_csv(portfolio.id, csv_content)

    assert result.error_count == 0
    assert result.duplicate_count == 1
    assert result.duplicates[0].scope == "database"


def test_import_csv_existing_endpoint_behavior_still_creates_transaction(test_db, monkeypatch):
    service = CsvImportService(test_db)
    portfolio = make_portfolio()
    asset = AssetFactory.create(symbol="AAPL")
    allow_symbols(monkeypatch, service)

    csv_content = """date,symbol,type,quantity,price,fees,currency
2024-01-01,AAPL,FEE,0,0,5,USD"""

    result = service.import_csv(portfolio.id, csv_content)

    assert result.success is True
    assert result.imported_count == 1
    created = test_db.query(Transaction).filter_by(portfolio_id=portfolio.id, asset_id=asset.id).one()
    assert created.type == TransactionType.FEE
