## Max Drawdown

### What It Shows

Max Drawdown answers the question:
> "From my portfolio's best moment, how far did it fall before recovering?"

It's the largest **peak-to-trough decline** your portfolio experienced during the period — the deepest hole you were in at any point, measured from the highest value you'd reached up to that point. It's shown as a negative percentage (for example, $-12.30\%$) and highlighted in red, since it represents your worst-case stretch, not a typical day.

This is one of the most intuitive risk numbers there is: it's literally "how bad did it get" in plain terms, independent of how quickly the portfolio bounced back afterward.

### How It's Calculated

Portfolium builds an equity curve from your portfolio's **daily value history over the past year** (adjusted for deposits and withdrawals, so cash flows don't get counted as gains or losses), then walks through it day by day:

1. Track the highest point reached so far (the running peak).
2. For every day, measure how far the current value has fallen from that peak.
3. Keep the largest such decline — that's the maximum drawdown.
4. Record the date it occurred (used internally, not shown on the card).

$$
\text{Max Drawdown} = \frac{\text{Peak Value} - \text{Trough Value}}{\text{Peak Value}} \times 100
$$

If there isn't enough daily history to build the curve, the widget shows **N/A**.

### Example

| Step | Value |
|---|---|
| Portfolio peak value | $10{,}000$ |
| Subsequent trough value | $8{,}700$ |
| Decline | $\frac{10{,}000 - 8{,}700}{10{,}000} \times 100 = 13\%$ |

The widget would display **$-13.00\%$**.

### When To Use It

Check Max Drawdown when you want to:

- understand the worst decline you'd have had to sit through in the past year;
- stress-test your own tolerance for losses before increasing risk in your portfolio;
- compare two strategies with similar returns but very different "pain" along the way.

### Notes & Limitations

- Always shown as a negative percentage; a deeper (more negative) number means a rougher ride.
- Based on the portfolio's own daily value history over the default $1$-year window, not a single asset.
- A shallow max drawdown doesn't guarantee safety going forward — it only describes what already happened during the selected period.
- Works well alongside [Volatility](volatility.md), [Sharpe Ratio](sharpe-ratio.md), and [Value at Risk](value-at-risk.md) for a fuller risk picture.
