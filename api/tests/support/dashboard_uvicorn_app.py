"""Two-worker dashboard fixture backed by a real Redis instance.

This module is imported only by ``test_dashboard_two_workers.py`` in a Uvicorn
subprocess. It keeps the real dashboard route, cache, and lock code while
replacing database analytics with a deterministic slow computation.
"""
import asyncio
import os
from datetime import datetime
from types import SimpleNamespace

import redis

from app.auth import get_current_verified_user
from app.db import get_db
from app.dependencies import get_insights_service, get_metrics_service
from app.main import app
from app.routers import batch


class _FakeQuery:
    def filter(self, *args):
        del args
        return self

    def first(self):
        return SimpleNamespace(id=3)


class _FakeDB:
    def query(self, model):
        del model
        return _FakeQuery()

    def close(self):
        pass


def _db_override():
    yield _FakeDB()


app.dependency_overrides[get_db] = _db_override
app.dependency_overrides[get_metrics_service] = lambda: object()
app.dependency_overrides[get_insights_service] = lambda: object()
app.dependency_overrides[get_current_verified_user] = lambda: SimpleNamespace(id=3)
batch.SessionLocal = _FakeDB
batch.crud_portfolios.get_portfolio = (
    lambda db, portfolio_id: SimpleNamespace(id=portfolio_id, user_id=3)
)


async def _slow_dashboard(portfolio_id, visible_widgets, include_sold, user, db):
    del include_sold, user, db
    client = redis.Redis.from_url(os.environ["DASHBOARD_TEST_REDIS_URL"], decode_responses=True)
    client.incr("dashboard-regression:computations")
    await asyncio.sleep(0.75)
    return {
        "data": {"metrics": {"total_value": 123}},
        "errors": None,
        "cached": False,
        "timestamp": datetime.now().isoformat(),
        "widgets_requested": len(visible_widgets),
        "data_fetched": 1,
        "worker_portfolio_id": portfolio_id,
    }


batch._compute_dashboard_response = _slow_dashboard


@app.get("/dashboard-regression/light")
async def dashboard_regression_light():
    return {"ok": True}
