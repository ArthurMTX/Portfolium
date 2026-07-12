## Performance Metrics

### What It Shows

Performance Metrics gives you three quick numbers that answer: **"How has my portfolio actually performed recently?"**

It shows your return over three windows, side by side:

- **Weekly** — roughly the last $7$ days;
- **Monthly** — roughly the last $30$ days;
- **Year-to-date (YTD)** — since January 1st of the current year.

Each row has an icon (up arrow for a gain, down arrow for a loss, neutral bar when flat or unavailable) and the return itself, colored green for positive and red for negative. If Portfolium doesn't have enough history to calculate a period, it shows `N/A` instead of a misleading number.

Critically, these returns are **adjusted for deposits and withdrawals** — if you added money during the month, that deposit isn't counted as "performance."

---

### How It's Calculated

For each period, Portfolium takes the first and last data point of your portfolio's value history within that window. Each data point carries both the portfolio's **value** and the **amount invested** (capital in) at that time.

$$
\text{net capital change} = I_{\text{end}} - I_{\text{start}}
$$

where $I_{\text{start}}$ and $I_{\text{end}}$ are the invested amounts at the start and end of the period (a positive number means you deposited more than you withdrew).

$$
\text{period return} = \frac{V_{\text{end}} - V_{\text{start}} - \text{net capital change}}{V_{\text{start}}} \times 100
$$

where $V_{\text{start}}$ and $V_{\text{end}}$ are the portfolio's total value at the start and end of the period. Subtracting the net capital change strips out the effect of your own deposits/withdrawals, leaving only the return driven by market performance.

If the starting value is $0$ or less, that period's return is shown as `N/A`.

---

### Example

Say your Monthly window looks like this:

| | Value | Invested |
|---|---|---|
| Start of month | $10{,}000 | $9{,}000 |
| End of month | $11{,}500 | $10{,}000 |

$$
\text{net capital change} = 10{,}000 - 9{,}000 = 1{,}000
$$

You deposited $1{,}000$ during the month, so:

$$
\text{monthly return} = \frac{11{,}500 - 10{,}000 - 1{,}000}{10{,}000} \times 100 = 5.00\%
$$

The widget displays **Monthly: +5.00%** in green — the deposit itself isn't counted as a gain.

---

### When To Use It

Check Performance Metrics when you want to:

- get a fast read on **short and medium-term performance** without opening a chart;
- confirm your recent returns are genuinely from market movement, not just money you added;
- track how YTD performance is trending as the year progresses;
- compare against a target or benchmark you keep in mind.

---

### Notes & Limitations

- **Not annualized** — each figure reflects the actual return over that specific window (1 week, 1 month, year-to-date), not a projected yearly rate.
- **Depends on history depth** — a brand-new portfolio may show `N/A` for periods that predate its first recorded value.
- **Uses the same history as your performance charts**, so the numbers here always line up with what you see in the charts.
- Values reflect the **currently active portfolio** — switching portfolios changes all three figures.
