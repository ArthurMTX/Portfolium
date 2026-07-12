## VIX Index

### What It Shows

The VIX widget shows the current level of the **CBOE Volatility Index**, widely nicknamed the market's "fear gauge." It measures how much price movement options traders expect from the S&P 500 in the near term — the higher it is, the more turbulence the market is bracing for.

It answers:
> "How nervous or calm is the stock market right now?"

The card shows:

- the current VIX value, e.g. $17.28$;
- the percentage change versus the previous close, e.g. $-0.50\%$ (red when volatility is rising, green when it's easing — the reverse of most tickers, since rising VIX means more fear);
- a volatility label — **Low**, **Normal**, **Elevated**, or **High** — color-coded to match.

Like the other index widgets, this is macro context independent of your own holdings.

### How It's Calculated

Portfolium fetches live data for the ticker **`^VIX`** from its market data provider, refreshed roughly once a minute and cached briefly on the backend.

Change figures use the standard formulas:

$$
\Delta = \text{current price} - \text{previous close}, \qquad \Delta\% = \frac{\Delta}{\text{previous close}} \times 100
$$

The volatility label comes from fixed thresholds on the VIX level itself:

| Range | Label |
|---|---|
| $< 12$ | Low Volatility |
| $12 \le \text{VIX} < 20$ | Normal Volatility |
| $20 \le \text{VIX} < 30$ | Elevated Volatility |
| $\ge 30$ | High Volatility |

If no current price can be fetched, the widget falls back to an "Unknown" state showing **N/A**.

### Example

- Current VIX: $21.40$
- Previous close: $19.00$

$$
\Delta = 21.40 - 19.00 = 2.40, \qquad \Delta\% = \frac{2.40}{19.00}\times 100 \approx 12.63\%
$$

The widget would display **$21.40$**, a **$+12.63\%$** change badge in red (volatility rising), and the label **Elevated Volatility** (since $21.40$ falls between $20$ and $30$).

### When To Use It

Check the VIX widget when you want to:

- gauge whether the broader market is calm or bracing for turbulence;
- put your own portfolio's recent swings in context — a high-VIX environment makes bigger daily moves normal, not alarming;
- decide whether it's a reasonable time to add risk, or perhaps to sit tight until things settle.

It pairs naturally with the [10-Year Treasury Yield](tnx-index.md) and [DXY Index](dxy-index.md) widgets for a fuller macro picture, and with your own [Volatility](volatility.md) widget to compare your portfolio's swings against the market's mood.

### Notes & Limitations

- The VIX reflects expected volatility priced into S&P 500 options — it's a market-wide reading, not a measure of your own portfolio.
- Values are index points, not percentages — a VIX around $20$ roughly corresponds to an expected annualized volatility near $20\%$, but the number itself isn't a percentage change.
- Color coding is intentionally inverted from most widgets: a VIX increase is shown in red because rising fear is the "bad" direction.
- If the data source is temporarily unavailable, the widget shows an "Unknown" state rather than stale data.
