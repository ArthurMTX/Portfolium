"""Reverse-proxy security and public API documentation contracts."""

from pathlib import Path


NGINX_CONFIG = Path(__file__).resolve().parents[2] / "web" / "nginx.conf"


def test_nginx_blocks_only_public_metrics_proxy():
    config = NGINX_CONFIG.read_text(encoding="utf-8")
    assert "location = /api/metrics" in config
    assert "deny all;" in config
    # Prometheus keeps an authorized internal path by scraping the API service
    # directly; nginx must not remove the FastAPI endpoint itself.
    assert "location = /api/docs" not in config
    assert "location = /api/scalar" not in config
    assert "location = /api/openapi.json" not in config


def test_nginx_forwards_external_request_identity_and_repairs_redirects():
    config = NGINX_CONFIG.read_text(encoding="utf-8")
    assert "absolute_redirect off;" in config
    assert "server api:8000 resolve;" in config
    for header in (
        "Host $http_host",
        "X-Forwarded-Host $http_host",
        "X-Forwarded-Proto $portfolium_forwarded_proto",
        "X-Forwarded-Port $portfolium_forwarded_port",
        "X-Forwarded-For $proxy_add_x_forwarded_for",
    ):
        assert f"proxy_set_header {header};" in config
    assert "proxy_redirect ~^https?://[^/]+/(.*)$ /api/$1;" in config


def test_metrics_and_documentation_remain_available_inside_api(client):
    assert client.get("/metrics").status_code == 200
    assert client.get("/docs").status_code == 200
    assert client.get("/scalar").status_code == 200
    assert client.get("/openapi.json").status_code == 200
