## Daily Gain

### What It Shows

Daily Gain shows how much your portfolio has genuinely gained or lost **today**, in both currency and percentage — color-coded green for a gain, red for a loss.

It answers:

> "Is my portfolio actually up or down today because of the market, not because I moved money around?"

Importantly, this is not just "today's value minus yesterday's value." If you deposited cash, made a withdrawal, bought, or sold something today, those actions don't count as gains or losses — Daily Gain is built to isolate genuine market performance from your own cash movements.

---

### How It's Calculated

Portfolium starts from the previous official market close and walks forward to today, formula:

$$
\text{Daily Gain} = V_{\text{today}} - V_{\text{previous close}} - \text{Net External Cash Flow}
$$

Where:

- $V_{\text{today}}$ = your current total portfolio value,
- $V_{\text{previous close}}$ = your portfolio's value as of the last official close for which historical prices are available,
- **Net External Cash Flow** = deposits, withdrawals, buys, sells, and transfers that happened between the previous close and now.

Subtracting cash flow is what makes this a meaningful *performance* number rather than a raw balance change — buying a new position with fresh cash increases your portfolio's value, but it isn't a "gain," so it's backed out. The percentage is then:

$$
\text{Daily Gain (\%)} = \frac{\text{Daily Gain}}{V_{\text{previous close}}} \times 100
$$

To build this, Portfolium reconstructs your holdings as of the previous close from your transaction history, tracks any external cash movements since then per asset, and combines it all into the figures above.

If there's no reliable previous close price (for example, a brand-new position with no historical data yet, or missing market data), the widget shows **N/A** rather than a misleading number — silently showing "$0$" would be worse than admitting the data isn't there.

---

### Example

Say your portfolio was worth $\text{\euro}12{,}000$ at the previous close, and today it's worth $\text{\euro}12{,}500$ — but you also deposited $\text{\euro}200$ and used it to buy shares this morning.

$$
\text{Daily Gain} = 12{,}500 - 12{,}000 - 200 = \text{\euro}300
$$

$$
\text{Daily Gain (\%)} = \frac{300}{12{,}000} \times 100 = 2.50\%
$$

The widget displays **$+\text{\euro}300.00$** and **$+2.50\%$** — reflecting genuine market performance, not the extra $\text{\euro}200$ you added.

---

### When To Use It

Check Daily Gain when you want to:

- get a quick sense of how the market treated your portfolio today, without your own deposits or trades muddying the picture;
- keep tabs on short-term volatility across your holdings as a whole;
- start your day on [Today's Brief](today-brief.md), which leads with this same number.

---

### Notes & Limitations

- **Excludes your own cash activity.** Deposits, withdrawals, buys, and sells are deliberately backed out so the number reflects market movement, not money movement.
- **Depends on having a reliable previous close.** New positions without historical price data, or missing market data for any held asset, can make the figure unavailable (**N/A**) rather than approximate.
- **Ties to official market closes**, so figures may lag slightly outside normal trading hours, especially for less liquid assets.
- For a deeper breakdown of which specific holdings drove today's move, see [Best & Worst Today](best-worst-today.md) or [Today's Brief](today-brief.md).
