## Dividends

### What It Shows

The Dividends widget shows the total cash income your holdings have paid you over the life of this portfolio, plus a reminder of what you've paid out in fees along the way. It answers:
> "How much income have my investments generated, and how much have I paid in fees to get it?"

The main figure is your **total dividends received**; a subtitle shows **total fees paid**, both in your portfolio's base currency.

---

### How It's Calculated

Both figures are cumulative sums over every recorded transaction in the portfolio, since inception — not just the current period.

**Total Dividends**

$$
\text{Total Dividends} = \sum_{i=1}^{n} D_i
$$

Where $D_i$ is the cash amount of each transaction recorded as a **dividend** (quantity × price per share), converted into your portfolio's base currency using the exchange rate on the day it was received if the dividend was paid in a different currency.

**Total Fees**

$$
\text{Total Fees} = \sum_{j=1}^{m} F_j
$$

Where $F_j$ is the fee amount attached to **every transaction** in the portfolio — not just dividend-related ones, but buys, sells, transfers, and conversions too — also converted to your base currency where needed.

---

### Example

Recorded transactions for your portfolio:

- Dividend from Asset A: $€120.00$
- Dividend from Asset B: $€80.00$
- Trading fees across all transactions: $€25.00$

$$
\text{Total Dividends} = 120 + 80 = 200
$$

$$
\text{Total Fees} = 25
$$

The widget displays a main value of **€200.00** with a subtitle of **Fees: €25.00**.

---

### When To Use It

Check the Dividends widget when you want to:

- track the **passive income** your dividend-paying holdings have generated;
- see how much of your returns have come from **dividends versus price appreciation**;
- keep an eye on how much **fees** have eaten into your results over time;
- get a lifetime cash-flow view rather than a single period's snapshot.

Pair it with [Total Return](total-return.md), which folds dividends and fees together with unrealized and realized P&L into one overall figure.

---

### Notes & Limitations

- Both numbers are **cumulative since inception**, not limited to the current month or year.
- This widget relies entirely on your recorded transactions — a dividend you forgot to log won't be reflected here. If your account has [pending dividend confirmation](notifications.md) enabled, unconfirmed dividends won't count until you confirm them.
- Fees include costs from every transaction type, not just dividend receipts — so this figure can be larger than "fees on dividends" alone.
- Currency and formatting follow your portfolio's base currency; amounts in other currencies are converted using the historical rate at the time of the transaction where available.
