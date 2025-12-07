"""
Test CSV import with yfinance symbol validation
"""
import pytest
from unittest.mock import Mock, patch
from app.services.import_csv import CsvImportService
from tests.factories import PortfolioFactory


def test_validate_symbols_valid(test_db):
    """Test validation with valid symbols"""
    service = CsvImportService(test_db)
    
    # Mock yfinance responses for valid symbols
    with patch('app.services.import_csv.yf.Ticker') as mock_ticker:
        # Configure mock to return valid info
        mock_ticker.return_value.info = {
            'symbol': 'AAPL',
            'regularMarketPrice': 150.0,
            'previousClose': 149.0
        }
        
        invalid = service._validate_symbols_in_yfinance(['AAPL', 'MSFT'])
        assert invalid == []


def test_validate_symbols_invalid(test_db):
    """Test validation with invalid symbols"""
    service = CsvImportService(test_db)
    
    # Mock yfinance responses for invalid symbols
    with patch('app.services.import_csv.yf.Ticker') as mock_ticker:
        # Configure mock to return empty info (invalid symbol)
        mock_ticker.return_value.info = {}
        
        invalid = service._validate_symbols_in_yfinance(['INVALID123'])
        assert 'INVALID123' in invalid


def test_validate_symbols_mixed(test_db):
    """Test validation with mix of valid and invalid symbols"""
    service = CsvImportService(test_db)
    
    def mock_ticker_side_effect(symbol):
        mock = Mock()
        if symbol == 'AAPL':
            mock.info = {'symbol': 'AAPL', 'regularMarketPrice': 150.0}
        else:
            mock.info = {}
        return mock
    
    with patch('app.services.import_csv.yf.Ticker', side_effect=mock_ticker_side_effect):
        invalid = service._validate_symbols_in_yfinance(['AAPL', 'INVALID123'])
        assert invalid == ['INVALID123']


def test_import_csv_with_invalid_symbols(test_db):
    """Test that CSV import fails when symbols are invalid"""
    service = CsvImportService(test_db)
    portfolio = PortfolioFactory(db=test_db)
    
    csv_content = """date,symbol,type,quantity,price,fees,currency
2024-01-01,INVALID123,BUY,10,100,5,USD"""
    
    # Mock yfinance to return invalid symbol
    with patch('app.services.import_csv.yf.Ticker') as mock_ticker:
        mock_ticker.return_value.info = {}
        
        result = service.import_csv(portfolio.id, csv_content)
        
        assert result.success is False
        assert result.imported_count == 0
        assert any('INVALID123' in error for error in result.errors)
        assert 'do not exist in yfinance' in result.errors[0]


def test_import_csv_with_valid_symbols(test_db):
    """Test that CSV import proceeds when symbols are valid"""
    service = CsvImportService(test_db)
    portfolio = PortfolioFactory(db=test_db)
    
    csv_content = """date,symbol,type,quantity,price,fees,currency
2024-01-01,AAPL,BUY,10,150,5,USD"""
    
    # Mock yfinance to return valid symbol
    with patch('app.services.import_csv.yf.Ticker') as mock_ticker:
        mock_ticker.return_value.info = {
            'symbol': 'AAPL',
            'regularMarketPrice': 150.0,
            'previousClose': 149.0
        }
        
        result = service.import_csv(portfolio.id, csv_content)
        
        assert result.success is True
        assert result.imported_count == 1
        assert len(result.errors) == 0


def test_import_csv_with_progress_invalid_symbols(test_db):
    """Test that CSV import with progress fails when symbols are invalid"""
    service = CsvImportService(test_db)
    portfolio = PortfolioFactory(db=test_db)
    
    csv_content = """date,symbol,type,quantity,price,fees,currency
2024-01-01,BADSTOCK,BUY,10,100,5,USD"""
    
    # Mock yfinance to return invalid symbol
    with patch('app.services.import_csv.yf.Ticker') as mock_ticker:
        mock_ticker.return_value.info = {}
        
        updates = list(service.import_csv_with_progress(portfolio.id, csv_content))
        
        # Find the error update
        error_updates = [u for u in updates if u.get('type') == 'error']
        assert len(error_updates) > 0
        
        error_update = error_updates[0]
        assert 'BADSTOCK' in error_update['message']
        assert 'do not exist in yfinance' in error_update['message']
        
        # Check final result
        assert error_update['result']['success'] is False
        assert error_update['result']['imported_count'] == 0


def test_import_csv_multiple_invalid_symbols(test_db):
    """Test that CSV import reports all invalid symbols"""
    service = CsvImportService(test_db)
    portfolio = PortfolioFactory(db=test_db)
    
    csv_content = """date,symbol,type,quantity,price,fees,currency
2024-01-01,INVALID1,BUY,10,100,5,USD
2024-01-02,INVALID2,BUY,5,50,2,USD
2024-01-03,AAPL,BUY,10,150,5,USD"""
    
    def mock_ticker_side_effect(symbol):
        mock = Mock()
        if symbol == 'AAPL':
            mock.info = {'symbol': 'AAPL', 'regularMarketPrice': 150.0}
        else:
            mock.info = {}
        return mock
    
    with patch('app.services.import_csv.yf.Ticker', side_effect=mock_ticker_side_effect):
        result = service.import_csv(portfolio.id, csv_content)
        
        assert result.success is False
        assert result.imported_count == 0
        assert len(result.errors) > 0
        
        # Check that both invalid symbols are mentioned
        error_msg = result.errors[0]
        assert 'INVALID1' in error_msg
        assert 'INVALID2' in error_msg
        assert 'do not exist in yfinance' in error_msg
