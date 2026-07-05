## Crypto Sentiment

### What It Shows

Crypto Sentiment gives you a quick read on the overall mood of the crypto market — fearful or greedy — on a $0$–$100$ scale.

Unlike most widgets on your dashboard, this one is not about your portfolio at all. It's a market-wide contextual gauge, sourced from the **Crypto Fear & Greed Index** (published by Alternative.me), showing:

- a **gauge** from $0$ to $100$ with a pointer at the current score;
- a **text label** for where that score falls — Extreme Fear, Fear, Neutral, Greed, or Extreme Greed;
- a small **change indicator** versus the previous reading (e.g. $+4$ or $-5$).

The zones behind the gauge are:

- $0$–$25$: Extreme Fear
- $25$–$45$: Fear
- $45$–$55$: Neutral
- $55$–$75$: Greed
- $75$–$100$: Extreme Greed

It answers: "Is the crypto market currently fearful, calm, or euphoric?"

---

### How It's Built

Portfolium does not compute this score itself — it's fetched from the public Alternative.me Fear & Greed Index API, which aggregates its own mix of volatility, momentum, social sentiment, and other market signals into a single daily number.

Portfolium's role is to:

1. Request the latest two readings (today's and the prior one) from the Alternative.me API.
2. Extract the current score, its text rating, and the previous score.
3. Compute the change since the prior reading:

$$
\Delta = \text{Score}_{\text{today}} - \text{Score}_{\text{previous}}
$$

shown as $+\Delta$ in green when sentiment improved (more greed), or $-\Delta$ in red when it worsened (more fear).

4. Cache the result for a few minutes server-side, since sentiment data doesn't change second-to-second and this avoids hammering the external API.

If the external API is unreachable or returns something unexpected, the widget degrades gracefully — showing a fallback state rather than breaking.

---

### Example

If today's index reading is $72$ ("Greed") versus a previous reading of $68$:

- gauge pointer sits at $72$, in the Greed zone;
- label reads **Greed**;
- change indicator shows **$+4$** in green.

---

### When To Use It

Use Crypto Sentiment when you want to:

- get a fast read on the crowd's mood before making a crypto trade;
- add context to a crypto position's price swing — is it moving with a fearful/euphoric market, or against it?
- avoid emotional decisions during sentiment extremes — historically, extreme fear and extreme greed readings are often cited as contrarian signals, though this is not a guarantee of future performance.

---

### Notes & Limitations

- **Third-party data.** This score comes entirely from Alternative.me's public Fear & Greed Index, not from Portfolium's own analytics — Portfolium only fetches, caches, and displays it.
- **Market-wide, not portfolio-specific.** It reflects the broad crypto market's mood, regardless of which coins (if any) you actually hold.
- **Not predictive.** A "fear" or "greed" reading describes current sentiment, not a forecast of where prices go next.
- **Cached briefly** (a few minutes) to reduce load on the external API — the number you see may lag the very latest reading slightly.
- A separate stock-market version of this same widget exists, backed by the CNN Fear & Greed Index instead.
