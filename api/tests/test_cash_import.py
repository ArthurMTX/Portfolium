"""
CSV import cash integration: mode behavior matrix, preview cash warnings,
strict all-or-nothing atomicity, warn-mode movement generation.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.models import CashMode, CashMovement, CashMovementType, Transaction
from app.services.workflows.import_csv import CsvImportService
from tests.factories import AssetFactory, CashMovementFactory, PortfolioFactory

D = Decimal

CSV_HEADER = "date,symbol,type,quantity,price,fees,currency\n"
CSV_TWO_BUYS = CSV_HEADER + (
    "2026-05-01,IMPA,BUY,10,100,2,USD\n"
    "2026-05-10,IMPA,SELL,5,120,1,USD\n"
)


@pytest.fixture
def service(test_db, monkeypatch):
    # Assets pre-exist so the import never hits the provider (offline)
    AssetFactory(symbol="IMPA", currency="USD")
    AssetFactory(symbol="IMPB", currency="USD")
    svc = CsvImportService(test_db)
    monkeypatch.setattr(svc, "_validate_symbols_in_provider", lambda symbols: [])
    # No network price backfill during tests
    from app.services.market_data.pricing import PricingService
    monkeypatch.setattr(
        PricingService, "ensure_historical_prices", lambda self, *a, **k: 0
    )
    return svc


def _portfolio(test_db, test_user, mode):
    return PortfolioFactory(user_id=test_user.id, base_currency="USD", cash_mode=mode)


def _fund(portfolio, amount, currency="USD"):
    return CashMovementFactory(
        portfolio_id=portfolio.id, currency=currency,
        type=CashMovementType.DEPOSIT, amount=D(amount),
        occurred_on=date(2026, 1, 1),
    )


class TestUntrackedImport:
    def test_behavior_unchanged_no_movements(self, test_db, test_user, service):
        portfolio = _portfolio(test_db, test_user, CashMode.UNTRACKED)
        result = service.import_csv(portfolio.id, CSV_TWO_BUYS)
        assert result.success, result.errors
        assert result.imported_count == 2
        assert test_db.query(CashMovement).count() == 0

    def test_preview_has_no_cash_warnings(self, test_db, test_user, service):
        portfolio = _portfolio(test_db, test_user, CashMode.UNTRACKED)
        preview = service.preview_csv(portfolio.id, CSV_TWO_BUYS)
        assert preview.cash_warnings == []


class TestWarnImport:
    def test_generates_movements_and_reports_warnings(self, test_db, test_user, service):
        portfolio = _portfolio(test_db, test_user, CashMode.TRACKED_WARN)
        _fund(portfolio, "500")
        result = service.import_csv(portfolio.id, CSV_TWO_BUYS)
        assert result.success, result.errors
        assert result.imported_count == 2
        # buy+fee, sell+fee
        assert test_db.query(CashMovement).filter(
            CashMovement.transaction_id.isnot(None)
        ).count() == 4
        # 500 - 1002 dip reported
        assert any("negative USD cash balance" in w for w in result.warnings)
        # Final: 500 - 1000 - 2 + 600 - 1 = 97
        from app.crud import cash as crud_cash
        assert crud_cash.get_balance(
            test_db, portfolio.id, "USD", as_of=date(2026, 12, 31)
        ) == D("97")

    def test_preview_reports_projected_dips(self, test_db, test_user, service):
        portfolio = _portfolio(test_db, test_user, CashMode.TRACKED_WARN)
        _fund(portfolio, "500")
        preview = service.preview_csv(portfolio.id, CSV_TWO_BUYS)
        assert len(preview.cash_warnings) == 1
        warning = preview.cash_warnings[0]
        assert warning.currency == "USD"
        assert warning.date == "2026-05-01"
        assert warning.projected_balance == "-502.00000000"
        # Preview writes nothing
        assert test_db.query(Transaction).count() == 0
        assert test_db.query(CashMovement).count() == 1  # just the funding row


class TestStrictImport:
    def test_sufficient_cash_imports_atomically(self, test_db, test_user, service):
        portfolio = _portfolio(test_db, test_user, CashMode.TRACKED_STRICT)
        _fund(portfolio, "2000")
        result = service.import_csv(portfolio.id, CSV_TWO_BUYS)
        assert result.success, result.errors
        assert result.imported_count == 2
        assert test_db.query(Transaction).count() == 2
        assert test_db.query(CashMovement).count() == 5  # funding + 4 derived

    def test_insufficient_cash_rejects_whole_file(self, test_db, test_user, service):
        portfolio = _portfolio(test_db, test_user, CashMode.TRACKED_STRICT)
        _fund(portfolio, "500")
        result = service.import_csv(portfolio.id, CSV_TWO_BUYS)
        assert not result.success
        assert result.imported_count == 0
        assert any("Insufficient USD cash" in e for e in result.errors)
        assert any("atomic" in e for e in result.errors)
        # NOTHING persisted: no transactions, no derived movements
        assert test_db.query(Transaction).count() == 0
        assert test_db.query(CashMovement).count() == 1  # just the funding row

    def test_one_bad_row_rejects_whole_file(self, test_db, test_user, service):
        portfolio = _portfolio(test_db, test_user, CashMode.TRACKED_STRICT)
        _fund(portfolio, "5000")
        bad_csv = CSV_HEADER + (
            "2026-05-01,IMPA,BUY,10,100,2,USD\n"
            "not-a-date,IMPA,BUY,1,1,0,USD\n"
        )
        result = service.import_csv(portfolio.id, bad_csv)
        assert not result.success
        assert result.imported_count == 0
        assert test_db.query(Transaction).count() == 0

    def test_same_day_sell_funds_buy(self, test_db, test_user, service):
        # Date-boundary semantics also hold for imports
        portfolio = _portfolio(test_db, test_user, CashMode.TRACKED_STRICT)
        _fund(portfolio, "1000")
        csv_content = CSV_HEADER + (
            "2026-05-01,IMPA,BUY,10,100,0,USD\n"
            "2026-06-01,IMPA,SELL,10,150,0,USD\n"
            "2026-06-01,IMPB,BUY,10,150,0,USD\n"
        )
        result = service.import_csv(portfolio.id, csv_content)
        assert result.success, result.errors
        assert result.imported_count == 3

    def test_streaming_variant_is_atomic_too(self, test_db, test_user, service):
        portfolio = _portfolio(test_db, test_user, CashMode.TRACKED_STRICT)
        _fund(portfolio, "500")
        events = list(service.import_csv_with_progress(portfolio.id, CSV_TWO_BUYS))
        final = events[-1]
        assert final["type"] == "error"
        assert final["result"]["imported_count"] == 0
        assert test_db.query(Transaction).count() == 0

    def test_retry_after_failure_succeeds_without_duplicates(
        self, test_db, test_user, service
    ):
        portfolio = _portfolio(test_db, test_user, CashMode.TRACKED_STRICT)
        _fund(portfolio, "500")
        result = service.import_csv(portfolio.id, CSV_TWO_BUYS)
        assert not result.success
        # Top up and retry the same file: exactly one set of rows/movements
        _fund(portfolio, "1500")
        result = service.import_csv(portfolio.id, CSV_TWO_BUYS)
        assert result.success, result.errors
        assert test_db.query(Transaction).count() == 2
        assert test_db.query(CashMovement).filter(
            CashMovement.transaction_id.isnot(None)
        ).count() == 4
