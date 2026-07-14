"""
Cash ledger core tests: movement derivation, sign assignment, currency
policy, strict/warn sweep validation, FX conversion legs, replace-on-edit.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.crud import cash as crud_cash
from app.errors import (
    AdjustmentReasonRequiredError,
    CashError,
    InsufficientCashError,
    InvalidCurrencyCodeError,
)
from app.models import CashMode, CashMovement, CashMovementType, TransactionType
from app.services.cash import ledger
from app.services.cash.currencies import is_supported_currency, normalize_currency
from tests.factories import CashMovementFactory, PortfolioFactory, UserFactory

D = Decimal
TODAY = date(2026, 6, 1)


@pytest.fixture
def tracked_portfolio(test_db):
    user = UserFactory()
    return PortfolioFactory(
        user_id=user.id, base_currency="USD", cash_mode=CashMode.TRACKED_WARN
    )


@pytest.fixture
def strict_portfolio(test_db):
    user = UserFactory()
    return PortfolioFactory(
        user_id=user.id, base_currency="USD", cash_mode=CashMode.TRACKED_STRICT
    )


def _deposit(portfolio, amount, currency="USD", occurred_on=TODAY):
    return CashMovementFactory(
        portfolio_id=portfolio.id,
        currency=currency,
        type=CashMovementType.DEPOSIT,
        amount=D(amount),
        occurred_on=occurred_on,
    )


# ---------------------------------------------------------------------------
# Currency policy
# ---------------------------------------------------------------------------

class TestCurrencyPolicy:
    def test_normalizes_to_uppercase(self):
        assert normalize_currency("usd") == "USD"
        assert normalize_currency(" eur ") == "EUR"

    def test_accepts_stablecoin_settlement_units(self):
        assert normalize_currency("usdt") == "USDT"
        assert normalize_currency("USDC") == "USDC"

    def test_rejects_unknown_codes(self):
        with pytest.raises(InvalidCurrencyCodeError):
            normalize_currency("DOGE")
        with pytest.raises(InvalidCurrencyCodeError):
            normalize_currency("")

    def test_rejects_pence_quotation_with_dedicated_message(self):
        with pytest.raises(InvalidCurrencyCodeError) as exc:
            normalize_currency("GBX")
        assert "GBP" in exc.value.detail["message"]
        with pytest.raises(InvalidCurrencyCodeError):
            normalize_currency("gbx")

    def test_is_supported_currency(self):
        assert is_supported_currency("usd")
        assert not is_supported_currency("GBX")
        assert not is_supported_currency("BTC")


# ---------------------------------------------------------------------------
# Derivation of movements from transactions
# ---------------------------------------------------------------------------

class TestDeriveMovementSpecs:
    def _derive(self, tx_type, qty="10", price="100", fees="2", currency="USD"):
        return ledger.derive_movement_specs(
            tx_type=tx_type,
            quantity=D(qty),
            price=D(price),
            fees=D(fees),
            currency=currency,
            tx_date=TODAY,
        )

    def test_buy_debits_gross_and_fee(self):
        specs = self._derive(TransactionType.BUY)
        assert [(s.type, s.amount) for s in specs] == [
            (CashMovementType.BUY, D("-1000")),
            (CashMovementType.FEE, D("-2")),
        ]
        assert all(s.currency == "USD" and s.occurred_on == TODAY for s in specs)

    def test_sell_credits_gross_and_debits_fee(self):
        specs = self._derive(TransactionType.SELL, qty="10", price="120")
        assert [(s.type, s.amount) for s in specs] == [
            (CashMovementType.SELL, D("1200")),
            (CashMovementType.FEE, D("-2")),
        ]

    def test_dividend_credits_gross_and_debits_withholding_tax(self):
        specs = self._derive(TransactionType.DIVIDEND, qty="5", price="5", fees="5")
        assert [(s.type, s.amount) for s in specs] == [
            (CashMovementType.DIVIDEND, D("25")),
            (CashMovementType.TAX, D("-5")),
        ]

    def test_no_fee_movement_when_fees_zero(self):
        specs = self._derive(TransactionType.BUY, fees="0")
        assert [s.type for s in specs] == [CashMovementType.BUY]

    def test_standalone_fee_uses_fees_column(self):
        specs = self._derive(TransactionType.FEE, qty="0", price="0", fees="7.5")
        assert [(s.type, s.amount) for s in specs] == [(CashMovementType.FEE, D("-7.5"))]

    def test_standalone_fee_falls_back_to_price(self):
        specs = self._derive(TransactionType.FEE, qty="1", price="9", fees="0")
        assert [(s.type, s.amount) for s in specs] == [(CashMovementType.FEE, D("-9"))]

    def test_cash_neutral_types(self):
        for tx_type in (
            TransactionType.SPLIT,
            TransactionType.TRANSFER_IN,
            TransactionType.TRANSFER_OUT,
            TransactionType.CONVERSION_IN,
        ):
            assert self._derive(tx_type) == []

    def test_conversion_out_only_debits_fee(self):
        specs = self._derive(TransactionType.CONVERSION_OUT, fees="1.25")
        assert [(s.type, s.amount) for s in specs] == [(CashMovementType.FEE, D("-1.25"))]

    def test_currency_normalized(self):
        specs = self._derive(TransactionType.BUY, currency="usd")
        assert specs[0].currency == "USD"

    def test_precision_rounds_half_up_to_8dp(self):
        specs = ledger.derive_movement_specs(
            tx_type=TransactionType.BUY,
            quantity=D("0.333333333"),
            price=D("3"),
            fees=D("0"),
            currency="USD",
            tx_date=TODAY,
        )
        assert specs[0].amount == D("-1.00000000")


# ---------------------------------------------------------------------------
# Sign assignment for manual movements
# ---------------------------------------------------------------------------

class TestSignedManualAmount:
    def test_credit_types(self):
        assert ledger.signed_manual_amount(CashMovementType.DEPOSIT, D("10")) == D("10")
        assert ledger.signed_manual_amount(CashMovementType.INTEREST, D("1")) == D("1")

    def test_debit_types(self):
        assert ledger.signed_manual_amount(CashMovementType.WITHDRAWAL, D("10")) == D("-10")
        assert ledger.signed_manual_amount(CashMovementType.FEE, D("2")) == D("-2")
        assert ledger.signed_manual_amount(CashMovementType.TAX, D("3")) == D("-3")

    def test_adjustment_requires_direction(self):
        with pytest.raises(CashError) as exc:
            ledger.signed_manual_amount(CashMovementType.ADJUSTMENT, D("10"))
        assert exc.value.detail["code"] == "adjustment_direction_required"
        assert ledger.signed_manual_amount(CashMovementType.ADJUSTMENT, D("10"), "debit") == D("-10")
        assert ledger.signed_manual_amount(CashMovementType.ADJUSTMENT, D("10"), "credit") == D("10")

    def test_rejects_non_positive_amounts(self):
        with pytest.raises(CashError):
            ledger.signed_manual_amount(CashMovementType.DEPOSIT, D("0"))
        with pytest.raises(CashError):
            ledger.signed_manual_amount(CashMovementType.DEPOSIT, D("-5"))


# ---------------------------------------------------------------------------
# Sweep validation (strict + warn)
# ---------------------------------------------------------------------------

class TestValidateCashImpact:
    def _buy_specs(self, amount, fees="0", occurred_on=TODAY, currency="USD"):
        return ledger.derive_movement_specs(
            tx_type=TransactionType.BUY,
            quantity=D("1"),
            price=D(amount),
            fees=D(fees),
            currency=currency,
            tx_date=occurred_on,
        )

    def test_untracked_never_validates(self, test_db):
        user = UserFactory()
        portfolio = PortfolioFactory(user_id=user.id, cash_mode=CashMode.UNTRACKED)
        warnings = ledger.validate_cash_impact(
            test_db, portfolio, self._buy_specs("1000000")
        )
        assert warnings == []

    def test_strict_rejects_insufficient_balance(self, test_db, strict_portfolio):
        _deposit(strict_portfolio, "500")
        with pytest.raises(InsufficientCashError) as exc:
            ledger.validate_cash_impact(
                test_db, strict_portfolio, self._buy_specs("1000", fees="2")
            )
        context = exc.value.detail["context"]
        assert context["currency"] == "USD"
        assert D(context["available"]) == D("500")
        assert D(context["required"]) == D("1002")
        assert D(context["missing"]) == D("502")
        assert context["date"] == TODAY.isoformat()
        assert context["portfolio_id"] == strict_portfolio.id

    def test_strict_includes_fees_in_required_amount(self, test_db, strict_portfolio):
        _deposit(strict_portfolio, "1000")
        with pytest.raises(InsufficientCashError):
            ledger.validate_cash_impact(
                test_db, strict_portfolio, self._buy_specs("1000", fees="2")
            )
        # Without the fee it passes
        assert (
            ledger.validate_cash_impact(test_db, strict_portfolio, self._buy_specs("1000"))
            == []
        )

    def test_strict_validates_at_historical_date(self, test_db, strict_portfolio):
        # Deposit only exists from June; a backdated May purchase must fail
        _deposit(strict_portfolio, "5000", occurred_on=date(2026, 6, 1))
        with pytest.raises(InsufficientCashError) as exc:
            ledger.validate_cash_impact(
                test_db,
                strict_portfolio,
                self._buy_specs("100", occurred_on=date(2026, 5, 1)),
            )
        assert exc.value.detail["context"]["date"] == "2026-05-01"

    def test_strict_forward_sweep_catches_later_stranding(self, test_db, strict_portfolio):
        # 1000 deposited, 900 spent later; inserting an earlier 200 buy
        # would strand the existing 900 buy
        _deposit(strict_portfolio, "1000", occurred_on=date(2026, 5, 1))
        CashMovementFactory(
            portfolio_id=strict_portfolio.id,
            currency="USD",
            type=CashMovementType.BUY,
            amount=D("-900"),
            occurred_on=date(2026, 5, 20),
        )
        with pytest.raises(InsufficientCashError) as exc:
            ledger.validate_cash_impact(
                test_db,
                strict_portfolio,
                self._buy_specs("200", occurred_on=date(2026, 5, 10)),
            )
        assert exc.value.detail["context"]["date"] == "2026-05-20"

    def test_same_day_sell_funds_same_day_buy(self, test_db, strict_portfolio):
        # Date-boundary semantics: movements of one day apply together
        CashMovementFactory(
            portfolio_id=strict_portfolio.id,
            currency="USD",
            type=CashMovementType.SELL,
            amount=D("1500"),
            occurred_on=TODAY,
        )
        assert (
            ledger.validate_cash_impact(
                test_db, strict_portfolio, self._buy_specs("1500", occurred_on=TODAY)
            )
            == []
        )

    def test_no_cross_currency_netting(self, test_db, strict_portfolio):
        _deposit(strict_portfolio, "10000", currency="EUR")
        with pytest.raises(InsufficientCashError) as exc:
            ledger.validate_cash_impact(
                test_db, strict_portfolio, self._buy_specs("100", currency="USD")
            )
        assert exc.value.detail["context"]["currency"] == "USD"

    def test_warn_mode_returns_warnings_instead(self, test_db, tracked_portfolio):
        _deposit(tracked_portfolio, "500")
        warnings = ledger.validate_cash_impact(
            test_db, tracked_portfolio, self._buy_specs("1000", fees="2")
        )
        assert len(warnings) == 1
        warning = warnings[0]
        assert warning.code == "negative_cash_balance"
        assert warning.currency == "USD"
        assert warning.occurred_on == TODAY
        assert warning.projected_balance == D("-502")

    def test_warn_mode_no_warning_when_covered(self, test_db, tracked_portfolio):
        _deposit(tracked_portfolio, "2000")
        assert (
            ledger.validate_cash_impact(test_db, tracked_portfolio, self._buy_specs("1000"))
            == []
        )


# ---------------------------------------------------------------------------
# Movement persistence: insert + replace-on-edit
# ---------------------------------------------------------------------------

class TestApplyTransactionMovements:
    def _make_tx(self, test_db, portfolio, **overrides):
        from tests.factories import AssetFactory, TransactionFactory

        asset = AssetFactory()
        defaults = dict(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            type=TransactionType.BUY,
            quantity=D("10"),
            price=D("100"),
            fees=D("2"),
            currency="USD",
            tx_date=TODAY,
        )
        defaults.update(overrides)
        return TransactionFactory(**defaults)

    def test_creates_traceable_movements(self, test_db, tracked_portfolio):
        tx = self._make_tx(test_db, tracked_portfolio)
        movements = ledger.apply_transaction_movements(test_db, tracked_portfolio, tx)
        test_db.commit()
        assert [(m.type, m.amount) for m in movements] == [
            (CashMovementType.BUY, D("-1000")),
            (CashMovementType.FEE, D("-2")),
        ]
        assert all(m.transaction_id == tx.id for m in movements)
        # base enrichment: portfolio base is USD, movement is USD => rate 1
        assert movements[0].base_exchange_rate == D("1")
        assert movements[0].base_currency_amount == D("-1000")

    def test_replace_on_edit_regenerates_without_duplicates(self, test_db, tracked_portfolio):
        tx = self._make_tx(test_db, tracked_portfolio)
        ledger.apply_transaction_movements(test_db, tracked_portfolio, tx)
        test_db.commit()

        tx.quantity = D("5")
        tx.fees = D("0")
        ledger.apply_transaction_movements(test_db, tracked_portfolio, tx)
        test_db.commit()

        rows = crud_cash.get_movements_for_transaction(test_db, tx.id)
        assert [(m.type, m.amount) for m in rows] == [(CashMovementType.BUY, D("-500"))]

    def test_delete_movements_for_transaction(self, test_db, tracked_portfolio):
        tx = self._make_tx(test_db, tracked_portfolio)
        ledger.apply_transaction_movements(test_db, tracked_portfolio, tx)
        test_db.commit()
        assert crud_cash.delete_movements_for_transaction(test_db, tx.id) == 2
        test_db.commit()
        assert crud_cash.get_movements_for_transaction(test_db, tx.id) == []

    def test_duplicate_derived_movements_blocked_by_constraint(self, test_db, tracked_portfolio):
        from sqlalchemy.exc import IntegrityError

        tx = self._make_tx(test_db, tracked_portfolio)
        ledger.apply_transaction_movements(test_db, tracked_portfolio, tx)
        test_db.commit()
        # Bypassing the replace step must hit uq_cash_movements_tx_type
        test_db.add(
            CashMovement(
                portfolio_id=tracked_portfolio.id,
                currency="USD",
                type=CashMovementType.BUY,
                amount=D("-1000"),
                occurred_on=TODAY,
                transaction_id=tx.id,
            )
        )
        with pytest.raises(IntegrityError):
            test_db.commit()
        test_db.rollback()

    def test_enrichment_failure_leaves_null_rates(self, test_db, monkeypatch):
        user = UserFactory()
        portfolio = PortfolioFactory(
            user_id=user.id, base_currency="EUR", cash_mode=CashMode.TRACKED_WARN
        )
        from app.services.market_data.currency import CurrencyService

        monkeypatch.setattr(
            CurrencyService, "get_historical_exchange_rate", staticmethod(lambda *a, **k: None)
        )
        tx = self._make_tx(test_db, portfolio, currency="USD")
        movements = ledger.apply_transaction_movements(test_db, portfolio, tx)
        test_db.commit()
        assert movements[0].base_exchange_rate is None
        assert movements[0].base_currency_amount is None

    def test_enrichment_uses_historical_rate(self, test_db, monkeypatch):
        user = UserFactory()
        portfolio = PortfolioFactory(
            user_id=user.id, base_currency="EUR", cash_mode=CashMode.TRACKED_WARN
        )
        from app.services.market_data.currency import CurrencyService

        monkeypatch.setattr(
            CurrencyService,
            "get_historical_exchange_rate",
            staticmethod(lambda f, t, d: D("0.9")),
        )
        tx = self._make_tx(test_db, portfolio, currency="USD", fees=D("0"))
        movements = ledger.apply_transaction_movements(test_db, portfolio, tx)
        test_db.commit()
        assert movements[0].base_exchange_rate == D("0.9")
        assert movements[0].base_currency_amount == D("-900")


# ---------------------------------------------------------------------------
# Manual movements
# ---------------------------------------------------------------------------

class TestManualMovements:
    def test_deposit_and_withdrawal_roundtrip(self, test_db, tracked_portfolio):
        movement, warnings = ledger.record_manual_movement(
            test_db,
            tracked_portfolio,
            movement_type=CashMovementType.DEPOSIT,
            currency="usd",
            amount=D("1000"),
            occurred_on=TODAY,
        )
        test_db.commit()
        assert warnings == []
        assert movement.amount == D("1000")
        assert movement.currency == "USD"

        movement, warnings = ledger.record_manual_movement(
            test_db,
            tracked_portfolio,
            movement_type=CashMovementType.WITHDRAWAL,
            currency="USD",
            amount=D("400"),
            occurred_on=TODAY + timedelta(days=1),
        )
        test_db.commit()
        assert warnings == []
        assert movement.amount == D("-400")
        assert crud_cash.get_balance(test_db, tracked_portfolio.id, "USD", as_of=TODAY + timedelta(days=1)) == D("600")

    def test_opening_balance_not_allowed_manually(self, test_db, tracked_portfolio):
        with pytest.raises(CashError) as exc:
            ledger.record_manual_movement(
                test_db,
                tracked_portfolio,
                movement_type=CashMovementType.OPENING_BALANCE,
                currency="USD",
                amount=D("100"),
                occurred_on=TODAY,
            )
        assert exc.value.detail["code"] == "invalid_movement_type"

    def test_adjustment_requires_reason(self, test_db, tracked_portfolio):
        with pytest.raises(AdjustmentReasonRequiredError):
            ledger.record_manual_movement(
                test_db,
                tracked_portfolio,
                movement_type=CashMovementType.ADJUSTMENT,
                currency="USD",
                amount=D("100"),
                occurred_on=TODAY,
                direction="credit",
            )
        movement, _ = ledger.record_manual_movement(
            test_db,
            tracked_portfolio,
            movement_type=CashMovementType.ADJUSTMENT,
            currency="USD",
            amount=D("100"),
            occurred_on=TODAY,
            direction="debit",
            reason="Broker reconciliation",
        )
        assert movement.amount == D("-100")
        assert movement.reason == "Broker reconciliation"

    def test_strict_withdrawal_rejected_when_insufficient(self, test_db, strict_portfolio):
        _deposit(strict_portfolio, "100")
        with pytest.raises(InsufficientCashError):
            ledger.record_manual_movement(
                test_db,
                strict_portfolio,
                movement_type=CashMovementType.WITHDRAWAL,
                currency="USD",
                amount=D("150"),
                occurred_on=TODAY,
            )

    def test_strict_delete_deposit_strands_later_debits(self, test_db, strict_portfolio):
        deposit = _deposit(strict_portfolio, "1000", occurred_on=date(2026, 5, 1))
        CashMovementFactory(
            portfolio_id=strict_portfolio.id,
            currency="USD",
            type=CashMovementType.WITHDRAWAL,
            amount=D("-800"),
            occurred_on=date(2026, 5, 10),
        )
        with pytest.raises(InsufficientCashError):
            ledger.delete_manual_movement(test_db, strict_portfolio, deposit)
        test_db.rollback()

    def test_update_manual_movement_revalidates(self, test_db, strict_portfolio):
        deposit = _deposit(strict_portfolio, "1000", occurred_on=date(2026, 5, 1))
        CashMovementFactory(
            portfolio_id=strict_portfolio.id,
            currency="USD",
            type=CashMovementType.WITHDRAWAL,
            amount=D("-800"),
            occurred_on=date(2026, 5, 10),
        )
        with pytest.raises(InsufficientCashError):
            ledger.update_manual_movement(
                test_db, strict_portfolio, deposit, amount=D("500")
            )
        test_db.rollback()

        updated, warnings = ledger.update_manual_movement(
            test_db, strict_portfolio, deposit, amount=D("900")
        )
        test_db.commit()
        assert warnings == []
        assert updated.amount == D("900")


# ---------------------------------------------------------------------------
# Forex conversions
# ---------------------------------------------------------------------------

class TestFxConversions:
    def test_legs_are_linked_and_rate_stored(self, test_db, tracked_portfolio):
        _deposit(tracked_portfolio, "2000", currency="EUR")
        conversion_id, movements, warnings = ledger.record_fx_conversion(
            test_db,
            tracked_portfolio,
            source_currency="EUR",
            target_currency="USD",
            source_amount=D("950"),
            target_amount=D("1002"),
            occurred_on=TODAY,
            fee_amount=D("2"),
        )
        test_db.commit()
        assert warnings == []
        legs = crud_cash.get_conversion_movements(test_db, tracked_portfolio.id, conversion_id)
        assert [(m.type, m.currency, m.amount) for m in legs] == [
            (CashMovementType.FX_DEBIT, "EUR", D("-950")),
            (CashMovementType.FX_CREDIT, "USD", D("1002")),
            (CashMovementType.FEE, "EUR", D("-2")),
        ]
        # Rate convention: target units per 1 source unit
        expected_rate = (D("1002") / D("950")).quantize(D("0.00000001"))
        assert legs[0].conversion_rate == expected_rate
        assert legs[1].conversion_rate == expected_rate
        assert all(m.conversion_id == conversion_id for m in legs)

    def test_fee_in_target_currency(self, test_db, tracked_portfolio):
        _deposit(tracked_portfolio, "1000", currency="EUR")
        _, movements, _ = ledger.record_fx_conversion(
            test_db,
            tracked_portfolio,
            source_currency="EUR",
            target_currency="USD",
            source_amount=D("100"),
            target_amount=D("105"),
            occurred_on=TODAY,
            fee_amount=D("1"),
            fee_currency="USD",
        )
        fee = [m for m in movements if m.type == CashMovementType.FEE][0]
        assert fee.currency == "USD"
        assert fee.amount == D("-1")

    def test_same_currency_rejected(self, test_db, tracked_portfolio):
        with pytest.raises(CashError) as exc:
            ledger.record_fx_conversion(
                test_db,
                tracked_portfolio,
                source_currency="EUR",
                target_currency="eur",
                source_amount=D("100"),
                target_amount=D("100"),
                occurred_on=TODAY,
            )
        assert exc.value.detail["code"] == "fx_same_currency"

    def test_strict_requires_source_balance_not_target(self, test_db, strict_portfolio):
        # No EUR cash at all: conversion must fail on the source currency
        with pytest.raises(InsufficientCashError) as exc:
            ledger.record_fx_conversion(
                test_db,
                strict_portfolio,
                source_currency="EUR",
                target_currency="USD",
                source_amount=D("950"),
                target_amount=D("1002"),
                occurred_on=TODAY,
            )
        assert exc.value.detail["context"]["currency"] == "EUR"

    def test_warn_allows_negative_source_with_warning(self, test_db, tracked_portfolio):
        _, _, warnings = ledger.record_fx_conversion(
            test_db,
            tracked_portfolio,
            source_currency="EUR",
            target_currency="USD",
            source_amount=D("950"),
            target_amount=D("1002"),
            occurred_on=TODAY,
        )
        assert [w.currency for w in warnings] == ["EUR"]
        assert warnings[0].projected_balance == D("-950")

    def test_update_replaces_all_legs(self, test_db, tracked_portfolio):
        _deposit(tracked_portfolio, "5000", currency="EUR")
        conversion_id, _, _ = ledger.record_fx_conversion(
            test_db,
            tracked_portfolio,
            source_currency="EUR",
            target_currency="USD",
            source_amount=D("950"),
            target_amount=D("1002"),
            occurred_on=TODAY,
            fee_amount=D("2"),
        )
        test_db.commit()
        movements, warnings = ledger.update_fx_conversion(
            test_db,
            tracked_portfolio,
            conversion_id,
            source_currency="EUR",
            target_currency="CHF",
            source_amount=D("500"),
            target_amount=D("470"),
            occurred_on=TODAY,
        )
        test_db.commit()
        legs = crud_cash.get_conversion_movements(test_db, tracked_portfolio.id, conversion_id)
        assert [(m.type, m.currency, m.amount) for m in legs] == [
            (CashMovementType.FX_DEBIT, "EUR", D("-500")),
            (CashMovementType.FX_CREDIT, "CHF", D("470")),
        ]

    def test_delete_removes_all_legs_atomically(self, test_db, tracked_portfolio):
        _deposit(tracked_portfolio, "5000", currency="EUR")
        conversion_id, movements, _ = ledger.record_fx_conversion(
            test_db,
            tracked_portfolio,
            source_currency="EUR",
            target_currency="USD",
            source_amount=D("950"),
            target_amount=D("1002"),
            occurred_on=TODAY,
        )
        test_db.commit()
        ledger.delete_fx_conversion(test_db, tracked_portfolio, conversion_id, movements)
        test_db.commit()
        assert crud_cash.get_conversion_movements(test_db, tracked_portfolio.id, conversion_id) == []

    def test_strict_delete_conversion_strands_target_spending(self, test_db, strict_portfolio):
        _deposit(strict_portfolio, "2000", currency="EUR", occurred_on=date(2026, 5, 1))
        conversion_id, movements, _ = ledger.record_fx_conversion(
            test_db,
            strict_portfolio,
            source_currency="EUR",
            target_currency="USD",
            source_amount=D("950"),
            target_amount=D("1002"),
            occurred_on=date(2026, 5, 2),
        )
        test_db.commit()
        CashMovementFactory(
            portfolio_id=strict_portfolio.id,
            currency="USD",
            type=CashMovementType.WITHDRAWAL,
            amount=D("-500"),
            occurred_on=date(2026, 5, 10),
        )
        with pytest.raises(InsufficientCashError) as exc:
            ledger.delete_fx_conversion(test_db, strict_portfolio, conversion_id, movements)
        assert exc.value.detail["context"]["currency"] == "USD"
        test_db.rollback()
