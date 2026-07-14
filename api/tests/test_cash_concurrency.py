"""
Strict-mode concurrency tests.

SQLite (used by the offline suite) serializes writers, so it cannot prove
row-lock semantics. Coverage is split in three layers:

1. a compile-level assertion that lock_accounts emits SELECT ... FOR UPDATE
   on the PostgreSQL dialect (see test_cash_balances.py);
2. a lock-ordering spy proving every cash-affecting write path acquires the
   account locks (sorted currencies) BEFORE validating balances;
3. an opt-in real-PostgreSQL race test, enabled by setting CASH_PG_TEST_URL
   to a scratch database URL (wired into the CI migrations job which has a
   real PostgreSQL service).
"""
import os
import threading
from datetime import date
from decimal import Decimal

import pytest

from app.models import CashMode, CashMovementType
from app.services.cash import ledger
from tests.factories import CashMovementFactory, PortfolioFactory, UserFactory

D = Decimal
TODAY = date(2026, 6, 1)


class TestLockOrdering:
    """Locks must be acquired (sorted) before any balance validation"""

    @pytest.fixture
    def spy(self, monkeypatch):
        calls = []
        from app.crud import cash as crud_cash

        real_lock = crud_cash.lock_accounts
        real_validate = ledger.validate_cash_impact

        def lock_spy(db, portfolio_id, currencies):
            calls.append(("lock", tuple(sorted(set(currencies)))))
            return real_lock(db, portfolio_id, currencies)

        def validate_spy(*args, **kwargs):
            calls.append(("validate",))
            return real_validate(*args, **kwargs)

        monkeypatch.setattr(crud_cash, "lock_accounts", lock_spy)
        # ledger.py resolves crud_cash.lock_accounts at call time via the
        # module attribute, so patching crud_cash is enough
        monkeypatch.setattr(ledger, "validate_cash_impact", validate_spy)
        return calls

    def test_manual_movement_locks_before_validating(self, test_db, spy):
        user = UserFactory()
        portfolio = PortfolioFactory(
            user_id=user.id, base_currency="USD", cash_mode=CashMode.TRACKED_STRICT
        )
        CashMovementFactory(
            portfolio_id=portfolio.id, currency="USD",
            type=CashMovementType.DEPOSIT, amount=D("1000"), occurred_on=TODAY,
        )
        ledger.record_manual_movement(
            test_db, portfolio,
            movement_type=CashMovementType.WITHDRAWAL,
            currency="USD", amount=D("100"), occurred_on=TODAY,
        )
        assert spy.index(("lock", ("USD",))) < spy.index(("validate",))

    def test_fx_conversion_locks_both_currencies_sorted(self, test_db, spy):
        user = UserFactory()
        portfolio = PortfolioFactory(
            user_id=user.id, base_currency="USD", cash_mode=CashMode.TRACKED_WARN
        )
        ledger.record_fx_conversion(
            test_db, portfolio,
            source_currency="USD", target_currency="CHF",
            source_amount=D("100"), target_amount=D("90"),
            occurred_on=TODAY,
        )
        assert spy.index(("lock", ("CHF", "USD"))) < spy.index(("validate",))


@pytest.mark.skipif(
    not os.getenv("CASH_PG_TEST_URL"),
    reason="real-PostgreSQL race test; set CASH_PG_TEST_URL to enable",
)
class TestPostgresRace:
    """Two concurrent strict purchases fighting over the same cash.

    available: 1000 USD; both requests attempt a 700 USD purchase.
    Exactly one must succeed; the loser gets insufficient_cash.
    """

    def test_concurrent_strict_purchases_one_wins(self):
        from sqlalchemy import create_engine, text
        from sqlalchemy.orm import sessionmaker
        from app.db import Base
        from app.errors import InsufficientCashError
        from app.models import CashMovement, Portfolio, User
        from app.schemas import TransactionCreate
        from app.models import TransactionType, Asset, AssetClass

        engine = create_engine(os.environ["CASH_PG_TEST_URL"])
        with engine.connect() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS portfolio"))
            conn.commit()
        Base.metadata.create_all(engine)
        SessionLocal = sessionmaker(bind=engine)

        setup = SessionLocal()
        try:
            user = User(
                username="race", email="race@test.example.com",
                hashed_password="x", is_active=True,
            )
            setup.add(user)
            setup.flush()
            portfolio = Portfolio(
                user_id=user.id, name="race",
                base_currency="USD", cash_mode=CashMode.TRACKED_STRICT,
            )
            setup.add(portfolio)
            asset = Asset(symbol="RACE", name="Race", currency="USD", class_=AssetClass.STOCK)
            setup.add(asset)
            setup.flush()
            setup.add(CashMovement(
                portfolio_id=portfolio.id, currency="USD",
                type=CashMovementType.DEPOSIT, amount=D("1000"), occurred_on=TODAY,
            ))
            setup.commit()
            portfolio_id, asset_id = portfolio.id, asset.id
        finally:
            setup.close()

        barrier = threading.Barrier(2)
        results = []

        def attempt():
            session = SessionLocal()
            try:
                p = session.get(Portfolio, portfolio_id)
                payload = TransactionCreate(
                    asset_id=asset_id, tx_date=TODAY, type=TransactionType.BUY,
                    quantity=D("7"), price=D("100"), fees=D("0"), currency="USD",
                )
                barrier.wait(timeout=10)
                ledger.create_transaction_with_cash(session, p, payload)
                results.append("ok")
            except InsufficientCashError:
                session.rollback()
                results.append("rejected")
            finally:
                session.close()

        threads = [threading.Thread(target=attempt) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)

        assert sorted(results) == ["ok", "rejected"], results

        check = SessionLocal()
        try:
            total = check.query(CashMovement).filter(
                CashMovement.portfolio_id == portfolio_id,
                CashMovement.currency == "USD",
            ).count()
            # deposit + exactly one buy movement
            assert total == 2
        finally:
            check.close()
            Base.metadata.drop_all(engine)
            engine.dispose()
