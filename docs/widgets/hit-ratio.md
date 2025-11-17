# Hit Ratio

The **Hit Ratio** widget shows the **percentage of your open positions that are currently profitable**.  
It focuses on how often you are "right" on your active trades, based on **unrealized P&L**.

This metric gives a quick view of your **win rate across current positions**, not closed trades.

---

## What It Shows

The widget displays:

- Your **Hit Ratio (%)**, the share of open positions with **positive unrealized P&L**  
- A single value, e.g. **63.5%**  
- A subtitle like:  
  > "X of Y positions profitable"

Color logic:

- **Green** value when hit ratio is **≥ 50%**  
- **Amber** value when hit ratio is **< 50%**  

If you have **no positions**, the widget shows:

- **N/A** and a specific "no trades / no positions" subtitle

This metric answers the question:  
> "What percentage of my current positions are in profit right now?"

---

## How It's Calculated

The Hit Ratio looks at all open positions and counts how many have a **strictly positive unrealized P&L**.

For each position:

- If `unrealized_pnl > 0` → counted as **profitable**  
- If `unrealized_pnl ≤ 0` or missing/null → counted as **non-profitable**

**Formula**

$$
\text{Hit Ratio (\%)} =
\frac{\text{Number of profitable positions}}{\text{Total number of positions}} \times 100
$$

Additional notes:

- Only **open positions** are considered, closed positions are ignored
- Positions with `null` or `undefined` unrealized P&L are treated as **0**, i.e. **not profitable**  
- The final result is rounded to **one decimal place**, e.g. `63.5%`

---

## Example

Imagine your portfolio contains 8 open positions with the following unrealized P&L:

| Position | Unrealized P&L |
|----------|----------------|
| A        | +$120          |
| B        | -$45           |
| C        | +$10           |
| D        | $0             |
| E        | +$250          |
| F        | -$30           |
| G        | +$5            |
| H        | -$12           |

Profitable positions (unrealized P&L > 0): **A, C, E, G** → 4 positions

Total positions: **8**

Hit Ratio:

$$
\text{Hit Ratio} = \frac{4}{8} \times 100 = 50\%
$$

The widget would display:

- **50.0%**  
- Subtitle like: **"4 of 8 positions profitable"**  
- Value colored **green** (since hit ratio ≥ 50%)

---

## When To Use It

The Hit Ratio widget is useful for:

- Getting a **quick snapshot** of how many of your current trades are working  
- Monitoring the **quality of your entries** on open positions  
- Evaluating your portfolio's **short-term "health"** at a glance  
- Complementing deeper metrics like **Unrealized P&L**, **Top/Bottom Performers**, and **Concentration Risk**

---

## Notes

- Hit Ratio uses **only open positions** and **unrealized P&L**  
- It does **not** reflect position size or magnitude of gains/losses  
    - A small winning position and a large losing position are counted equally  
- A high hit ratio does not guarantee overall profit if losers are much bigger than winners  
- Formatting follows your portfolio's display settings (percentage with one decimal place)
