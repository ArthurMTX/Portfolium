## Total Value

### What It Shows

Total Value is the current market worth of everything you still hold in this portfolio — the number that answers:
> "What would my portfolio be worth right now if I sold everything at today's prices?"

It's a single figure, shown in your portfolio's base currency, and it updates as market prices move.

---

### How It's Calculated

Total Value adds up the current market value of every open position — quantity held times current price:

$$
\text{Total Value} = \sum_{i=1}^{n} \left( Q_i \times P_i \right)
$$

Where:

- $Q_i$ = quantity currently held of asset $i$
- $P_i$ = current market price of asset $i$, converted into your portfolio's base currency

Only **open positions** count. As soon as a position is fully sold, it drops out of Total Value entirely — its result lives on in [Realized P&L](realized-pnl.md) instead. Prices in a foreign currency are converted to your portfolio's base currency before being summed, so multi-currency portfolios still add up to one coherent number.

---

### Example

| Asset | Quantity | Current Price | Value |
|---|---|---|---|
| AAPL | 10 | $190 | $1,900 |
| MSFT | 5 | $420 | $2,100 |

$$
\text{Total Value} = 1{,}900 + 2{,}100 = 4{,}000
$$

The widget displays **$4,000.00** (or in your portfolio's own currency).

---

### When To Use It

Look at Total Value when you want to:

- get an instant read on **how big your portfolio is right now**;
- track how your **overall wealth** in this portfolio evolves over time;
- gauge your **market exposure** at a glance;
- compare your current holdings against a savings goal or benchmark.

For how much you've gained or lost to get here, pair this with [Total Return](total-return.md), [Unrealized P&L](unrealized-pnl.md), and [Realized P&L](realized-pnl.md).

---

### Notes & Limitations

- Reflects **open positions only** — cash you've withdrawn or fully sold holdings don't appear here.
- If a current price can't be fetched for one of your assets, the widget may show **N/A** until prices refresh rather than silently underestimating your value.
- Values depend on the freshness of market data; prices may lag slightly outside market hours or for illiquid assets.
- Currency formatting follows your portfolio's base currency settings.
