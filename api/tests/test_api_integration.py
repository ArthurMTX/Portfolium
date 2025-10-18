"""
Simple integration test example
Run with: pytest tests/test_api_integration.py -v
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    """Test that health endpoint returns 200"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "degraded"]
    assert "timestamp" in data


def test_get_assets():
    """Test getting list of assets"""
    response = client.get("/assets")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_create_asset():
    """Test creating a new asset"""
    asset_data = {
        "symbol": "TEST",
        "name": "Test Asset",
        "currency": "USD",
        "class": "stock"
    }
    response = client.post("/assets", json=asset_data)
    
    # May fail if asset already exists (409) or succeed (201)
    assert response.status_code in [201, 400]
    
    if response.status_code == 201:
        data = response.json()
        assert data["symbol"] == "TEST"


def test_get_portfolios():
    """Test getting list of portfolios"""
    response = client.get("/portfolios")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_api_docs_available():
    """Test that API documentation is available"""
    response = client.get("/docs")
    assert response.status_code == 200
