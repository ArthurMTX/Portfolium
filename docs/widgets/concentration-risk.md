## Concentration Risk

### What It Shows

Concentration Risk tells you how much of your portfolio's value rides on just a handful of positions — specifically, your **top $3$ holdings by market value**.

It answers the question:

> "How much of my portfolio depends on just a few positions?"

You'll see:

- a single **combined percentage** for your top $3$ positions;
- a color-coded risk indicator — a green shield when concentration is moderate, an orange warning icon when it's high;
- a short list of those top $3$ positions, each with its own individual share of the portfolio.

---

### How It's Calculated

1. Compute the current market value of every position you hold.
2. Sum them to get your total portfolio value, $V_{\text{total}}$.
3. Sort positions by market value and take the three largest: $V_1$, $V_2$, $V_3$.
4. Concentration is their combined share of the total:

$$
\text{Concentration Risk} = \frac{V_1 + V_2 + V_3}{V_{\text{total}}} \times 100
$$

The widget flags risk level using a single threshold:

- **Concentration $> 60\%$** → high concentration (orange warning icon)
- **Concentration $\le 60\%$** → moderate / diversified (green shield)

Only positions with a positive market value are considered. If you hold fewer than $3$ positions, the calculation simply uses however many you have.

---

### Example

| Position | Market value |
|---|---|
| A | $\text{\euro}6{,}000$ |
| B | $\text{\euro}3{,}000$ |
| C | $\text{\euro}1{,}000$ |
| D | $\text{\euro}2{,}000$ |

Total portfolio value: $\text{\euro}12{,}000$. Top $3$ by value are A, B, and D:

$$
\text{Concentration Risk} = \frac{6{,}000 + 3{,}000 + 2{,}000}{12{,}000} \times 100 \approx 91.7\%
$$

The widget shows **$91.7\%$** in orange (high risk), with a breakdown of A ($50.0\%$), B ($25.0\%$), and D ($16.7\%$).

---

### When To Use It

Check Concentration Risk when you want to:

- see quickly whether your portfolio's fate rests on just a few names;
- identify a position that may be worth trimming for better diversification;
- keep an eye on how new buys or price moves are shifting your overall risk profile — a stock that doubles in value also doubles its share of your concentration.

It pairs naturally with [Asset Allocation](asset-allocation.md), which shows diversification by sector/type/country rather than by individual position.

---

### Notes & Limitations

- **Position size, not performance.** A large losing position still counts fully toward concentration — this widget measures exposure, not quality.
- **Changes with price and trade activity.** A rally in one holding can push it into the top $3$ and raise your concentration score even without any new trades.
- **Per-portfolio.** Switching your active portfolio recalculates concentration for that portfolio only.
- The $60\%$ threshold is a fixed rule of thumb built into the widget, not a personalized risk tolerance — treat it as a general warning line rather than a hard rule for your situation.
