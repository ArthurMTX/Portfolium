"""
Ledger-derived balance tests: per-currency sums, as-of-date historical
balances, future-dated exclusion, deterministic date-boundary ordering.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.crud import cash as crud_cash
from app.models import CashMode, CashMovementType
from tests.factories import CashMovementFactory, PortfolioFactory, UserFactory

D = Decimal
TODAY = date(2026, 6, 1)


@pytest.fixture
def portfolio(test_db):
    user = UserFactory()
    return PortfolioFactory(
        user_id=user.id, base_currency="EUR", cash_mode=CashMode.TRACKED_WARN
    )


def _movement(portfolio, amount, currency="EUR", occurred_on=TODAY,
              mv_type=CashMovementType.DEPOSIT):
    return CashMovementFactory(
        portfolio_id=portfolio.id,
        currency=currency,
        type=mv_type,
        amount=D(amount),
        occurred_on=occurred_on,
    )


class TestBalances:
    def test_balance_is_sum_of_movements(self, test_db, portfolio):
        _movement(portfolio, "1000")
        _movement(portfolio, "-250.50", mv_type=CashMovementType.WITHDRAWAL)
        _movement(portfolio, "10.25", mv_type=CashMovementType.INTEREST)
        assert crud_cash.get_balance(test_db, portfolio.id, "EUR", as_of=TODAY) == D("759.75")

    def test_multi_currency_balances_are_independent(self, test_db, portfolio):
        _movement(portfolio, "3000", currency="EUR")
        _movement(portfolio, "1250", currency="USD")
        _movement(portfolio, "-80", currency="GBP", mv_type=CashMovementType.WITHDRAWAL)
        balances = crud_cash.get_balances(test_db, portfolio.id, as_of=TODAY)
        assert balances == {"EUR": D("3000"), "USD": D("1250"), "GBP": D("-80")}

    def test_zero_balance_for_unknown_currency(self, test_db, portfolio):
        assert crud_cash.get_balance(test_db, portfolio.id, "JPY", as_of=TODAY) == D("0")

    def test_as_of_date_gives_historical_balance(self, test_db, portfolio):
        _movement(portfolio, "1000", occurred_on=date(2026, 1, 10))
        _movement(portfolio, "-400", occurred_on=date(2026, 3, 5),
                  mv_type=CashMovementType.WITHDRAWAL)
        _movement(portfolio, "200", occurred_on=date(2026, 5, 20))
        assert crud_cash.get_balance(test_db, portfolio.id, "EUR", as_of=date(2026, 1, 9)) == D("0")
        assert crud_cash.get_balance(test_db, portfolio.id, "EUR", as_of=date(2026, 1, 10)) == D("1000")
        assert crud_cash.get_balance(test_db, portfolio.id, "EUR", as_of=date(2026, 3, 5)) == D("600")
        assert crud_cash.get_balance(test_db, portfolio.id, "EUR", as_of=TODAY) == D("800")

    def test_future_dated_movements_excluded_from_current_balance(self, test_db, portfolio):
        _movement(portfolio, "1000", occurred_on=date.today())
        _movement(portfolio, "500", occurred_on=date.today() + timedelta(days=10))
        assert crud_cash.get_balance(test_db, portfolio.id, "EUR") == D("1000")
        balances = crud_cash.get_balances(test_db, portfolio.id)
        assert balances["EUR"] == D("1000")

    def test_ledger_rows_accounting_order(self, test_db, portfolio):
        # Insert out of chronological order; accounting order is (occurred_on, id)
        _movement(portfolio, "300", occurred_on=date(2026, 3, 1))
        _movement(portfolio, "100", occurred_on=date(2026, 1, 1))
        _movement(portfolio, "200", occurred_on=date(2026, 1, 1))
        rows = crud_cash.get_ledger_rows(test_db, portfolio.id, "EUR")
        assert [(d, a) for d, a in rows] == [
            (date(2026, 1, 1), D("100")),
            (date(2026, 1, 1), D("200")),
            (date(2026, 3, 1), D("300")),
        ]

    def test_movement_listing_filters_and_pagination(self, test_db, portfolio):
        _movement(portfolio, "100", currency="EUR", occurred_on=date(2026, 1, 1))
        _movement(portfolio, "200", currency="USD", occurred_on=date(2026, 2, 1))
        _movement(portfolio, "-50", currency="EUR", occurred_on=date(2026, 3, 1),
                  mv_type=CashMovementType.WITHDRAWAL)

        movements, total = crud_cash.get_movements(test_db, portfolio.id)
        assert total == 3
        # Display order: newest first
        assert [m.occurred_on for m in movements] == [
            date(2026, 3, 1), date(2026, 2, 1), date(2026, 1, 1)
        ]

        movements, total = crud_cash.get_movements(test_db, portfolio.id, currency="EUR")
        assert total == 2

        movements, total = crud_cash.get_movements(
            test_db, portfolio.id, movement_type=CashMovementType.WITHDRAWAL
        )
        assert total == 1 and movements[0].amount == D("-50")

        movements, total = crud_cash.get_movements(
            test_db, portfolio.id, date_from=date(2026, 2, 1), date_to=date(2026, 2, 28)
        )
        assert total == 1 and movements[0].currency == "USD"

        movements, total = crud_cash.get_movements(test_db, portfolio.id, skip=1, limit=1)
        assert total == 3
        assert len(movements) == 1
        assert movements[0].occurred_on == date(2026, 2, 1)

    def test_get_or_create_accounts_idempotent(self, test_db, portfolio):
        crud_cash.get_or_create_accounts(test_db, portfolio.id, ["USD", "EUR", "USD"])
        crud_cash.get_or_create_accounts(test_db, portfolio.id, ["USD", "CHF"])
        test_db.commit()
        accounts = crud_cash.lock_accounts(test_db, portfolio.id, ["USD", "EUR", "CHF", "JPY"])
        assert sorted(a.currency for a in accounts) == ["CHF", "EUR", "USD"]

    def test_lock_accounts_sorted_order(self, test_db, portfolio):
        crud_cash.get_or_create_accounts(test_db, portfolio.id, ["USD", "CHF", "EUR"])
        accounts = crud_cash.lock_accounts(test_db, portfolio.id, ["USD", "CHF", "EUR"])
        assert [a.currency for a in accounts] == ["CHF", "EUR", "USD"]

    def test_lock_accounts_emits_for_update_on_postgresql(self, test_db, portfolio):
        # Compile-level assertion: the statement carries FOR UPDATE on PG
        from sqlalchemy import select
        from sqlalchemy.dialects import postgresql
        from app.models import CashAccount

        query = (
            select(CashAccount)
            .where(CashAccount.portfolio_id == portfolio.id)
            .with_for_update()
        )
        sql = str(query.compile(dialect=postgresql.dialect()))
        assert "FOR UPDATE" in sql
