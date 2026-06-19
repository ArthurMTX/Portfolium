"""Tests for request correlation, structured logging, and Prometheus exposition."""
from __future__ import annotations

import json
import logging

from app.observability.logging import JsonFormatter
from app.observability.metrics import cache_name_from_key, daily_gain_reason_category


def test_request_id_is_accepted_and_returned(client):
    response = client.get("/health", headers={"X-Request-ID": "test-request-123"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "test-request-123"


def test_invalid_request_id_is_replaced(client):
    response = client.get("/health", headers={"X-Request-ID": "invalid request id"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] != "invalid request id"
    assert len(response.headers["X-Request-ID"]) == 32


def test_metrics_endpoint_exposes_http_metrics(client):
    client.get("/health")
    response = client.get("/metrics")

    assert response.status_code == 200
    assert "portfolium_http_requests_total" in response.text
    assert 'route="/health"' in response.text


def test_json_formatter_redacts_sensitive_values():
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="email=user@example.com Authorization: Bearer abc123 password=hunter2",
        args=(),
        exc_info=None,
    )

    payload = json.loads(JsonFormatter().format(record))

    assert "user@example.com" not in payload["message"]
    assert "abc123" not in payload["message"]
    assert "hunter2" not in payload["message"]
    assert "[REDACTED" in payload["message"]


def test_metric_categories_do_not_expose_cache_keys_or_raw_reasons():
    assert cache_name_from_key("positions:12345") == "positions"
    assert cache_name_from_key("unknown:secret-value") == "other"
    assert (
        daily_gain_reason_category(["AAPL: no official historical close before 2026-06-19"])
        == "previous_close_unavailable"
    )
