"""Tests for the Adanos listings sync Celery task."""
from contextlib import contextmanager

from app.models.reference_data import AdanosListing
from app.services.reference_data import adanos_listings as al
from app.tasks import reference_data_tasks
from app.tasks import decorators as task_decorators

FIXTURE_CSV = (
    "listing_key,ticker,exchange,name,asset_type,stock_sector,etf_category,country,country_code,isin,aliases\n"
    "NASDAQ::NVDA,NVDA,NASDAQ,NVIDIA Corporation,Stock,Information Technology,,United States,US,US67066G1040,nvidia\n"
    "NYSE::QBTS,QBTS,NYSE,D-Wave Quantum Inc.,Stock,Information Technology,,United States,US,US26740W1099,d-wave quantum\n"
)


def test_sync_adanos_listings_task_populates_table(monkeypatch, test_db):
    @contextmanager
    def test_db_context():
        yield test_db

    monkeypatch.setattr(reference_data_tasks, "get_db_context", test_db_context)
    monkeypatch.setattr(task_decorators.CacheService, "set", lambda *args, **kwargs: True)
    monkeypatch.setattr(task_decorators.CacheService, "delete", lambda *args, **kwargs: None)
    monkeypatch.setattr(al, "_download_csv", lambda: FIXTURE_CSV)

    result = reference_data_tasks.sync_adanos_listings_task.apply().get()

    assert result["downloaded"] is True
    assert result["total_rows"] == 2
    assert result["inserted"] == 2
    assert result["updated"] == 0
    assert result["errors"] == []

    rows = test_db.query(AdanosListing).all()
    assert len(rows) == 2
