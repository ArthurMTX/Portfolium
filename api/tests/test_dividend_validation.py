from datetime import date, timedelta
from decimal import Decimal


def test_dividend_tax_cannot_exceed_gross(client, auth_headers, sample_portfolio, sample_asset, sample_transaction):
    # sample_transaction is a BUY of 10 shares in the sample_portfolio/sample_asset
    dividend_date = date.today() + timedelta(days=1)

    payload = {
        "asset_id": sample_asset.id,
        "tx_date": dividend_date.isoformat(),
        "type": "DIVIDEND",
        "quantity": str(Decimal("10")),
        "price": str(Decimal("1")),
        "fees": str(Decimal("11")),  # tax > gross (10)
        "currency": "USD",
        "metadata": {},
        "notes": None,
    }

    resp = client.post(
        f"/{sample_portfolio.id}/transactions",
        json=payload,
        headers=auth_headers,
    )

    assert resp.status_code == 422
    detail = resp.json().get("detail", "")
    assert "fees" in detail
    assert "Tax cannot exceed" in detail
