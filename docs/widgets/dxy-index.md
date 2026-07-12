## DXY Index

### What It Shows

The DXY widget shows the current level of the **U.S. Dollar Index** — a benchmark that tracks the U.S. dollar against a basket of major currencies (euro, yen, pound, and others). It's a quick read on one question:

> "Is the U.S. dollar strong or weak right now, and which way is it moving?"

The card shows:

- the current index level, e.g. $106.25$;
- the percentage change versus the previous close, e.g. $+0.15\%$ (green when the dollar is strengthening, red when it's weakening);
- a strength label — **Very Weak**, **Weak**, **Normal**, **Strong**, or **Very Strong** — with matching color coding on the value itself.

This is macro context, not something tied to your specific holdings — it applies the same way regardless of which portfolio you're viewing.

### How It's Calculated

Portfolium fetches live data for the ticker **`DX-Y.NYB`** from its market data provider (the same feed used for prices elsewhere in the app), refreshed roughly once a minute and cached briefly on the backend to avoid hammering the data source.

The point and percentage change are computed the standard way:

$$
\Delta = \text{current price} - \text{previous close}
$$

$$
\Delta\% = \frac{\Delta}{\text{previous close}} \times 100
$$

The strength label is assigned from fixed thresholds on the index level itself:

| Range | Label |
|---|---|
| $< 90$ | Very Weak |
| $90 \le \text{DXY} < 95$ | Weak |
| $95 \le \text{DXY} < 105$ | Normal |
| $105 \le \text{DXY} < 115$ | Strong |
| $\ge 115$ | Very Strong |

If the data source doesn't return a current price, the widget falls back to an "Unknown" state showing **N/A**.

### Example

- Current index level: $106.25$
- Previous close: $106.09$

$$
\Delta = 106.25 - 106.09 = 0.16, \qquad \Delta\% = \frac{0.16}{106.09}\times 100 \approx 0.15\%
$$

The widget would display **$106.25$**, a **$+0.15\%$** change badge in green, and the label **Strong** (since $106.25$ falls between $105$ and $115$).

### When To Use It

Check the DXY widget when you want to:

- get quick context on the currency backdrop behind your portfolio's moves;
- understand headwinds or tailwinds for international holdings — a stronger dollar tends to pressure non-U.S. assets and commodities;
- pair with the [VIX Index](vix-index.md) and [10-Year Treasury Yield](tnx-index.md) for a broader macro read.

### Notes & Limitations

- This is an index level, not a percentage — $106.25$ means $106.25$, not $106.25\%$.
- Reflects the dollar against a basket of major currencies, not any single currency pair.
- Purely contextual: it doesn't factor into your portfolio's own risk metrics or performance figures.
- If the data provider is temporarily unavailable, the widget shows an "Unknown" state rather than a stale number.
