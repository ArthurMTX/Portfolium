from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo
from unittest.mock import MagicMock

import pandas as pd
import pytest

pytest.importorskip("exchange_calendars")

from app.services.market_data.market_calendar import MarketCalendarService


def test_as_utc_timestamp_uses_zoneinfo_for_naive_and_aware_datetimes():
    naive_ts = MarketCalendarService._as_utc_timestamp(datetime(2026, 5, 28, 12, 0))
    aware_ts = MarketCalendarService._as_utc_timestamp(
        datetime(2026, 5, 28, 12, 0, tzinfo=timezone.utc)
    )

    assert naive_ts.tz.key == "UTC"
    assert aware_ts.tz.key == "UTC"


def test_get_market_close_time_uses_timezone_naive_session_label(monkeypatch):
    calendar = MagicMock()
    calendar.is_session.return_value = True
    calendar.session_close.return_value = pd.Timestamp(
        datetime(2026, 5, 28, 20, 0),
        tz=ZoneInfo("UTC"),
    )
    monkeypatch.setattr(
        MarketCalendarService,
        "get_calendar",
        staticmethod(lambda exchange_code: calendar),
    )

    close_time = MarketCalendarService.get_market_close_time("XNYS", for_date=date(2026, 5, 28))

    session_label = calendar.is_session.call_args.args[0]
    assert session_label.tz is None
    assert close_time == datetime(2026, 5, 28, 20, 0)
