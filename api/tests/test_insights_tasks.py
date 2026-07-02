"""Tests for insights background tasks."""
from contextlib import contextmanager

from app.tasks import insights_tasks


def test_calculate_portfolio_insights_treats_empty_portfolio_as_normal(
    monkeypatch,
    test_db,
    sample_portfolio,
):
    @contextmanager
    def test_db_context():
        yield test_db

    monkeypatch.setattr(insights_tasks, "get_db_context", test_db_context)

    result = insights_tasks.calculate_portfolio_insights.apply(
        args=(sample_portfolio.id, sample_portfolio.user_id, "1y")
    ).get()

    assert result["status"] == "empty"
    assert result["portfolio_id"] == sample_portfolio.id
    assert result["period"] == "1y"
    assert "No positions found" in result["message"]
