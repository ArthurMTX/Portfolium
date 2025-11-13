"""
Test utilities and helper functions
"""
from typing import Optional
from decimal import Decimal
from datetime import date, datetime, timedelta
import random
import string


def random_string(length: int = 10) -> str:
    """Generate a random string"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))


def random_email() -> str:
    """Generate a random email address"""
    return f"{random_string(10)}@test.example.com"


def random_price(min_price: float = 1.0, max_price: float = 1000.0) -> Decimal:
    """Generate a random price"""
    return Decimal(str(round(random.uniform(min_price, max_price), 2)))


def random_quantity(min_qty: int = 1, max_qty: int = 100) -> Decimal:
    """Generate a random quantity"""
    return Decimal(str(random.randint(min_qty, max_qty)))


def random_date(start_date: Optional[date] = None, end_date: Optional[date] = None) -> date:
    """Generate a random date between start_date and end_date"""
    if start_date is None:
        start_date = date.today() - timedelta(days=365)
    if end_date is None:
        end_date = date.today()
    
    time_between = end_date - start_date
    days_between = time_between.days
    random_days = random.randrange(days_between)
    return start_date + timedelta(days=random_days)


def assert_decimal_equal(actual: Decimal, expected: Decimal, places: int = 2):
    """Assert two decimals are equal within a certain number of decimal places"""
    assert round(actual, places) == round(expected, places), \
        f"Expected {expected}, got {actual}"


def assert_response_success(response, expected_status: int = 200):
    """Assert a response was successful"""
    assert response.status_code == expected_status, \
        f"Expected status {expected_status}, got {response.status_code}. Response: {response.text}"


def assert_response_error(response, expected_status: int = 400):
    """Assert a response was an error"""
    assert response.status_code == expected_status, \
        f"Expected error status {expected_status}, got {response.status_code}"


class MockYFinanceData:
    """Mock data for yfinance testing"""
    
    @staticmethod
    def get_stock_data(symbol: str) -> dict:
        """Get mock stock data for a symbol"""
        return {
            "symbol": symbol,
            "longName": f"{symbol} Inc.",
            "currency": "USD",
            "regularMarketPrice": float(random_price(50, 500)),
            "regularMarketVolume": random.randint(1000000, 100000000),
            "marketCap": random.randint(1000000000, 1000000000000),
            "fiftyTwoWeekHigh": float(random_price(100, 600)),
            "fiftyTwoWeekLow": float(random_price(20, 400)),
        }
    
    @staticmethod
    def get_history(symbol: str, period: str = "1mo") -> dict:
        """Get mock historical data"""
        days = 30 if period == "1mo" else 365
        base_price = float(random_price(100, 500))
        
        history = []
        for i in range(days):
            day_date = datetime.now() - timedelta(days=days-i)
            price = base_price + random.uniform(-10, 10)
            history.append({
                "date": day_date.date(),
                "open": price,
                "high": price + random.uniform(0, 5),
                "low": price - random.uniform(0, 5),
                "close": price,
                "volume": random.randint(1000000, 10000000)
            })
        
        return history
