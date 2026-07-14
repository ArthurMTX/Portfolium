"""Production-like two-Uvicorn-worker dashboard starvation regression."""
import asyncio
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx
import pytest
import redis


def _free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.mark.integration
@pytest.mark.slow
def test_two_uvicorn_workers_single_flight_and_keep_light_endpoint_responsive():
    redis_url = os.getenv("DASHBOARD_TEST_REDIS_URL")
    if not redis_url:
        pytest.skip("set DASHBOARD_TEST_REDIS_URL to run the two-worker regression")

    parsed = urlparse(redis_url)
    redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
    redis_client.ping()
    redis_client.delete("dashboard-regression:computations")
    for key in redis_client.scan_iter("dashboard_batch:7:*"):
        redis_client.delete(key)
    for key in redis_client.scan_iter("dashboard_refresh_lock:dashboard_batch:7:*"):
        redis_client.delete(key)

    port = _free_port()
    api_dir = Path(__file__).resolve().parents[1]
    env = {
        **os.environ,
        "TESTING": "true",
        "ENVIRONMENT": "test",
        "DATABASE_URL": "sqlite:///:memory:",
        "REDIS_ENABLED": "true",
        "REDIS_HOST": parsed.hostname or "127.0.0.1",
        "REDIS_PORT": str(parsed.port or 6379),
        "REDIS_DB": (parsed.path or "/0").lstrip("/") or "0",
        "REDIS_PASSWORD": parsed.password or "",
        "DASHBOARD_TEST_REDIS_URL": redis_url,
        "LOG_FILE_ENABLED": "false",
        "ENABLE_BACKGROUND_TASKS": "false",
        "ENABLE_EMAIL": "false",
    }
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "tests.support.dashboard_uvicorn_app:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--workers",
            "2",
            "--no-access-log",
        ],
        cwd=api_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    base_url = f"http://127.0.0.1:{port}"

    async def exercise():
        async with httpx.AsyncClient(base_url=base_url, timeout=10) as client:
            deadline = time.monotonic() + 10
            while True:
                try:
                    if (await client.get("/dashboard-regression/light")).status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                if time.monotonic() >= deadline:
                    raise AssertionError("Uvicorn workers did not become ready")
                await asyncio.sleep(0.1)

            payload = {"portfolio_id": 7, "visible_widgets": ["performance-metrics"]}
            first = asyncio.create_task(client.post("/batch/dashboard", json=payload))
            second = asyncio.create_task(client.post("/batch/dashboard", json=payload))
            await asyncio.sleep(0.1)
            light_started = time.monotonic()
            light = await client.get("/dashboard-regression/light")
            light_elapsed = time.monotonic() - light_started
            responses = await asyncio.gather(first, second)
            return light, light_elapsed, responses

    try:
        light, light_elapsed, responses = asyncio.run(exercise())
        assert light.status_code == 200
        assert light_elapsed < 0.5
        assert all(response.status_code == 200 for response in responses)
        assert redis_client.get("dashboard-regression:computations") == "1"
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
