## Recent Transactions

### What It Shows

Recent Transactions is a quick timeline of what just happened in your portfolio — the last **5 transactions**, most recent first, without opening the full transaction history.

For each entry you see:

- the asset's **logo, symbol, and name**;
- a **type badge**: Buy (green), Sell (red), Dividend (blue), Split (violet), Fee (orange), or a transfer/conversion type;
- the **amount** — the total cash value of the transaction (or the split ratio, for stock splits);
- a detail line showing **quantity @ price**;
- the **date**, shown both as a calendar date and as relative time (e.g. "2 days ago").

It answers the question:
> "What have I just bought, sold, or received?"

---

### How It's Built

The widget pulls the most recent transactions recorded for your active portfolio and formats each one for quick scanning.

- **Amount shown** — for buys, sells, dividends, fees, and transfers, the widget displays:

$$
\text{Amount} = \text{Quantity} \times \text{Price}
$$

  For stock splits, there's no cash amount — the split ratio (e.g. $2\!:\!1$) is shown instead.

- **Type badge colors** map directly to the transaction type: green for buy, red for sell, blue for dividend, violet for split, orange for fee, and indigo/cyan for currency conversions and account transfers.
- **Amounts** are formatted in your **portfolio's base currency**.
- **Dates** are shown as a calendar date (e.g. "Apr 12") plus a relative "time ago" string, both localized to your interface language.
- Only the **5 most recent** transactions are shown, regardless of type.

---

### Example

| Symbol | Type | Amount | Detail | Date |
|---|---|---|---|---|
| AAPL | Buy | $1,755.00 | $10 @ \$175.50$ | Apr 10 – 2 days ago |
| MSFT | Dividend | $125.00 | $1 @ \$125.00$ | Apr 7 – 5 days ago |
| TSLA | Sell | $1,100.00 | $5 @ \$220.00$ | Apr 5 – 7 days ago |
| GOOGL | Split | $2\!:\!1$ | 2-for-1 stock split | Mar 22 – 14 days ago |
| NVDA | Buy | $4,280.00 | $100 @ \$42.80$ | Mar 15 – 21 days ago |

---

### When To Use It

Use Recent Transactions when you want to:

- quickly confirm that a **trade you just logged** was recorded correctly;
- review **dividends, fees, and splits** without opening the full transactions page;
- get a sense of your **recent trading activity** at a glance;
- spot-check activity after importing transactions in bulk.

For the complete transaction ledger with filters and search, use the dedicated Transactions page. For a broader daily summary that includes performance and alerts alongside recent activity, see [Today's Brief](today-brief.md).

---

### Notes & Limitations

- **Only 5 transactions** are shown — this is a snapshot, not a full history.
- Reflects only the **currently selected portfolio**; switching portfolios changes the list.
- Currency and date formatting follow your **portfolio settings** and **interface language**.
- Split transactions show a ratio instead of a monetary amount, since no cash changes hands in a split.
