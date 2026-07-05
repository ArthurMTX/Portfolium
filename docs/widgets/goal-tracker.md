## Goal Tracker

### What It Shows

Goal Tracker turns a savings target — a house down payment, retirement number, emergency fund — into something you can actually watch move. You create one or more goals (a title, a target amount, an optional target date, and an optional monthly contribution), and the widget shows:

- a **progress ring** with the percentage of the goal reached so far;
- your **current value**, **goal amount**, and **amount remaining**;
- your **monthly contribution**, if you set one;
- an **estimated time to goal**, based on simulated portfolio growth;
- a **target date** (if you set one), flagged if it's already in the past;
- an **achievement probability** — the odds your goal is reached by the projected date;
- three **projection scenarios** (pessimistic / median / optimistic) showing where your money could realistically land.

If you track more than one goal, arrows let you flip between them. Each goal is tied to your account and portfolio, so it follows you across devices.

### How It's Calculated

**Progress and remaining amount** are straightforward:

$$
\text{progress} = \min\left(\frac{\text{current value}}{\text{target amount}} \times 100,\ 100\right)
\qquad
\text{remaining} = \max(\text{target amount} - \text{current value},\ 0)
$$

The current value is your portfolio's total value; the goal is reached as soon as it meets or exceeds the target.

**Time to goal and probability** come from a Monte Carlo simulation run on the server, not a simple compounding formula:

1. Portfolium reconstructs your portfolio's daily mark-to-market value over roughly the last year from your actual transaction and price history, and derives its **historical annualized return and volatility** from those daily log-returns.
2. If there isn't enough history (fewer than $60$ trading days of data), it falls back to conservative defaults: an $8\%$ annual return and $15\%$ volatility.
3. Either way, the return is capped between $-60\%$ and $+40\%$ a year, and volatility is capped between $5\%$ and $40\%$ — bounds meant to keep projections within realistic equity-market ranges.
4. Using these numbers, it simulates $1{,}000$ possible future paths for your portfolio with geometric Brownian motion (monthly steps, random shocks drawn from a normal distribution), adding your monthly contribution at each step, out to your target date (or $10$ years if you didn't set one).
5. From the $1{,}000$ simulated outcomes it reads off the $10^{\text{th}}$, $50^{\text{th}}$, and $90^{\text{th}}$ percentiles — these become your **Pessimistic**, **Median**, and **Optimistic** scenarios.
6. The **achievement probability** is simply the share of the $1{,}000$ simulated paths that reach your target amount by the target date.
7. The **estimated time to goal** shown in the widget uses the months-to-target from the **Median** scenario.

Four **milestones** are also tracked at $25\%$, $50\%$, $75\%$, and $100\%$ of the target amount, each marked as achieved once your current value passes it.

If your target date has already passed, the widget still runs the projection (using a $1$-month horizon) and shows a warning that the timeline reflects your current trajectory rather than the original plan.

### Example

Say your goal is **€100,000** for retirement, you currently hold **€42,000**, contribute **€500/month**, and your portfolio's historical performance works out to roughly $9\%$ annual return with $16\%$ volatility.

| Scenario | Annual Return (implied) | Projected Value | Meets Goal? |
|---|---|---|---|
| Pessimistic (P10) | ≈ $2\%$ | €68,000 | No |
| Median (P50) | ≈ $9\%$ | €101,500 | Yes |
| Optimistic (P90) | ≈ $17\%$ | €148,000 | Yes |

With an achievement probability of, say, $58\%$, the widget would show a **58% achievement probability** bar in amber (moderate confidence), a progress ring at **42%**, and an estimated time to goal drawn from the median scenario's projected months.

### When To Use It

Use Goal Tracker when you want to:

- keep a concrete savings target in view instead of just watching total portfolio value drift;
- get a realistic (not just optimistic) read on whether your current contribution rate is enough;
- decide whether to increase your monthly contribution, extend your timeline, or adjust the target;
- track multiple goals at once — retirement, a house, a vacation — each with its own pace.

### Notes & Limitations

- **Projections are simulations, not promises.** They're driven by your own historical return and volatility, which may not repeat going forward, especially over long horizons.
- **New or low-history portfolios** fall back to generic default assumptions ($8\%$ return, $15\%$ volatility) until enough trading history accumulates.
- **A very low achievement probability** (under $5\%$) triggers an explicit warning that the goal is unlikely to be met as currently configured.
- **Past target dates** are handled gracefully — the widget flags them rather than showing a nonsensical negative time-to-goal.
- Related pages: [Total Value](total-value.md), [Total Return](total-return.md).
