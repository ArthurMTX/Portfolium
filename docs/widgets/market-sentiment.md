## Market Sentiment

### What It Shows

Market Sentiment is a fear-versus-greed gauge for the **overall stock market** — it tells you the broader mood investors are in right now, independent of what you personally hold. It displays:

- a **semicircular gauge from 0 to 100**, with a needle pointing at the current reading;
- a **text label** for the current zone: Extreme Fear, Fear, Neutral, Greed, or Extreme Greed;
- a small **change indicator** versus the previous reading (e.g. $+4$ in green, $-5$ in red).

This is the stock-market variant of the sentiment gauge; a separate [Crypto Sentiment](crypto-sentiment.md) widget covers digital assets using a different underlying index. Both share the same gauge design but pull from different sources.

### How It's Calculated

For stocks, Portfolium sources the score from the **CNN Fear & Greed Index**, fetched from CNN's public data feed and cached server-side for about five minutes to avoid hammering the external API. The score already arrives pre-computed on a $0$–$100$ scale, along with a text rating and the previous day's close.

The gauge is split into five color-coded zones:

- **Extreme Fear:** $0$–$25$
- **Fear:** $25$–$45$
- **Neutral:** $45$–$55$
- **Greed:** $55$–$75$
- **Extreme Greed:** $75$–$100$

The zone label shown under the gauge comes directly from CNN's own rating field (matched case-insensitively against "extreme fear," "fear," "neutral," "greed," "extreme greed"), not recomputed from the score independently — so the label and the gauge position should always agree.

The change indicator is simply:

$$
\Delta = \text{score}_{\text{today}} - \text{score}_{\text{previous close}}
$$

shown as $+\Delta$ in green when the market has gotten greedier, or $-\Delta$ in red when it's gotten more fearful.

### Example

Suppose today's reading comes back as:

| Field | Value |
|---|---|
| Score | $72$ |
| Rating | Greed |
| Previous close | $68$ |

The gauge needle sits at $72$, inside the "Greed" band ($55$–$75$), the label reads **Greed**, and the change indicator shows **+4** in green.

### When To Use It

Use Market Sentiment when you want to:

- get a quick sense of overall market risk appetite before deciding to add or trim exposure;
- add context to a portfolio swing — a broad market at "Extreme Fear" explains a lot more than an isolated news headline;
- avoid herd behavior — extreme readings in either direction are often flagged as a caution sign rather than a reason to chase the crowd.

It pairs well with [Beta](../detailed-metrics/beta.md), [Volatility](volatility.md), and [Value at Risk](value-at-risk.md) for a fuller risk picture.

### Notes & Limitations

- **Market-wide, not personal.** The gauge reflects overall stock-market mood and has no connection to your specific holdings or performance.
- **Third-party data.** The score comes from CNN's Fear & Greed Index; if that feed is unreachable, the widget may show stale cached data or fail to update.
- **Refreshes periodically**, not in real time — expect the reading to lag slightly behind intraday swings.
- Related page: [Crypto Sentiment](crypto-sentiment.md) for the digital-asset equivalent.
