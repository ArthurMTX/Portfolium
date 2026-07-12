## TNX Index

### What It Shows

The TNX widget shows the current yield on the **U.S. 10-Year Treasury Note** — one of the most closely watched interest rates in the world, and a reference point for mortgage rates, bond prices, and equity valuations alike.

It answers:
> "Where are long-term interest rates right now, and which way are they moving?"

The card shows:

- the current yield as a percentage, e.g. $4.25\%$;
- the percentage change versus the previous close, e.g. $+0.30\%$ (red when yields are rising, green when they're falling);
- a yield-level label — **Very Low**, **Low**, **Normal**, **Elevated**, or **High** — color-coded to match.

This is macro context, independent of your own holdings.

### How It's Calculated

Portfolium fetches live data for the ticker **`^TNX`** from its market data provider, refreshed roughly once a minute and cached briefly on the backend.

Change figures use the standard formulas:

$$
\Delta = \text{current yield} - \text{previous close}, \qquad \Delta\% = \frac{\Delta}{\text{previous close}} \times 100
$$

The yield-level label comes from fixed thresholds on the yield itself:

| Range | Label |
|---|---|
| $< 2\%$ | Very Low |
| $2\% \le \text{yield} < 3\%$ | Low |
| $3\% \le \text{yield} < 4\%$ | Normal |
| $4\% \le \text{yield} < 5\%$ | Elevated |
| $\ge 5\%$ | High |

If no current price can be fetched, the widget falls back to an "Unknown" state showing **N/A**.

### Example

- Current yield: $4.25\%$
- Previous close: $3.95\%$

$$
\Delta = 4.25 - 3.95 = 0.30, \qquad \Delta\% = \frac{0.30}{3.95}\times 100 \approx 7.59\%
$$

The widget would display **$4.25\%$**, a **$+7.59\%$** change badge in red (yields rising), and the label **Elevated** (since $4.25\%$ falls between $4\%$ and $5\%$).

### When To Use It

Check the TNX widget when you want to:

- understand the interest-rate backdrop your portfolio is operating in;
- gauge how attractive "safe" yields look compared to the returns you're chasing in stocks or other risk assets;
- get context for moves in growth stocks and bonds — rising long-term yields tend to pressure both.

It pairs naturally with the [VIX Index](vix-index.md) and [DXY Index](dxy-index.md) widgets for a broader macro read.

### Notes & Limitations

- This is the nominal yield — it isn't adjusted for inflation.
- Shown directly as a percentage; it isn't annualized or transformed further.
- Purely contextual: it doesn't feed into your portfolio's own return or risk calculations.
- If the data source is temporarily unavailable, the widget shows an "Unknown" state rather than stale data.
