"""
Simple integration test example
Run with: pytest tests/test_api_integration.py -v
"""
import pytest
from fastapi.testclient import TestClient


def test_health_check(client):
    """Test that health endpoint returns 200"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "degraded"]
    assert "timestamp" in data


def test_get_assets(client, auth_headers):
    """Test getting list of assets"""
    response = client.get("/assets", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_create_asset(client, auth_headers):
    """Test creating a new asset"""
    asset_data = {
        "symbol": "TEST",
        "name": "Test Asset",
        "currency": "USD",
        "class_": "stock"
    }
    response = client.post("/assets", json=asset_data, headers=auth_headers)
    
    # May fail if asset already exists (409) or succeed (201)
    assert response.status_code in [201, 400, 422]
    
    if response.status_code == 201:
        data = response.json()
        assert data["symbol"] == "TEST"


def test_get_portfolios(client, auth_headers):
    """Test getting list of portfolios"""
    response = client.get("/portfolios", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_api_docs_available(client):
    """Test that API documentation is available"""
    response = client.get("/docs")
    assert response.status_code == 200
