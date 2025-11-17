# Breakeven (Gain % & Target Price)

## What It Shows  
The Breakeven metrics tell you **how far a losing position needs to rise to get back to your average cost**.

Portfolium shows two related values when a position is currently in loss:

- **Breakeven Gain %** – the **percentage gain** required from the current price to return to your average cost.
- **Breakeven Target Price** – the **price level** at which your position would be back to zero P&L (no profit, no loss).

This answers the very practical question:

> "How much does this stock need to go up so I can at least break even?"

These metrics are **only shown for positions that are currently underwater** (negative unrealized P&L).

---

## How It's Calculated  

First, the position's **average cost** per share is computed (also called *cost basis per share*).  
Conceptually:

$$
\text{Average Cost} = \frac{\text{Total Cost Paid (incl. fees)}}{\text{Total Shares Held for Cost Basis}}
$$

Where **Total Cost** includes purchase prices and fees, adjusted for sales and splits.

Let:

- $P_{\text{avg}}$ = average cost per share,  
- $P_{\text{cur}}$ = current market price per share,  
- $Q$ = quantity held.

The **market value** is:

$$
\text{Market Value} = Q \times P_{\text{cur}}
$$

The **unrealized P&L** is:

$$
\text{Unrealized P\&L} = Q \times P_{\text{cur}} - \text{Total Cost}
$$

If this value is **negative**, the position is in loss and breakeven metrics are computed.

### Breakeven Gain %

Breakeven Gain % is the **price increase required from the current level to reach the average cost**:

$$
\text{Breakeven Gain \%} = 
\frac{P_{\text{avg}} - P_{\text{cur}}}{P_{\text{cur}}} \times 100
$$

- If $P_{\text{cur}} < P_{\text{avg}}$, the result is **positive** → you need that much **upside**.
- If $P_{\text{cur}} \ge P_{\text{avg}}$, the metric is not shown (you are not underwater).

### Breakeven Target Price

The target price for breakeven is simply the **average cost**:

$$
\text{Breakeven Target Price} = P_{\text{avg}}
$$

Once the market price reaches this level, your **unrealized P&L is approximately 0** (ignoring future fees, taxes, spreads, etc.).

---

### Understanding Required Gains After a Loss  

Because gains and losses are **asymmetric**, a small percentage loss requires a slightly larger percentage gain to recover, and a large loss requires an *enormous* gain.

This table highlights the relationship:

| Unrealized P&L | Gain % Required to Breakeven |
|----------------|------------------------------|
| 0% or Positive | N/A                          |
| -1%            | +1.01%                       |
| -5%            | +5.26%                       |
| -10%           | +11.11%                      |
| -20%           | +25.00%                      |
| -50%           | +100.00%                     |
| -75%           | +300.00%                     |
| -90%           | +900.00%                     |
| -99%           | +9 900.00%                   |

These values come directly from the breakeven formula:

$$
\text{Required Gain \%} = 
\frac{P_{\text{avg}} - P_{\text{cur}}}{P_{\text{cur}}} \times 100
$$

The deeper the loss, the more the denominator $(P_{\text{cur}})$ collapses, which makes the required gain explode.

This demonstrates why:

- **protecting capital matters**  
- **averaging down is risky**  
- **a –50% loss is not symmetrical with a +50% gain**  

A small loss is manageable; a huge drawdown becomes mathematically brutal to recover from.

---

## Examples  

### Example 1 — Moderate Loss

- Average cost: $P_{\text{avg}} = 50\,\$$  
- Current price: $P_{\text{cur}} = 40\,\$$

$$
\text{Breakeven Gain \%} = 
\frac{50 - 40}{40} \times 100 
= \frac{10}{40} \times 100 
= 25\%
$$

- **Breakeven Gain %** → `+25%`  
- **Breakeven Target Price** → `50 $`

Interpretation:  
The stock needs to rise **25% from the current price** to get back to your cost basis.

---

### Example 2 — Deep Drawdown

- Average cost: $P_{\text{avg}} = 100\,\$$  
- Current price: $P_{\text{cur}} = 60\,\$$

$$
\text{Breakeven Gain \%} = 
\frac{100 - 60}{60} \times 100 
= \frac{40}{60} \times 100 
\approx 66.67\%
$$

- **Breakeven Gain %** → `+66.7%`  
- **Breakeven Target Price** → `100 $`

Interpretation:  
You need **almost +67%** from here just to **break even**. This highlights how painful large drawdowns can be.

---

## When To Use It  

Breakeven metrics are helpful when you:

- **Evaluate whether averaging down makes sense**  
  A required gain of +20% is not the same decision as +200%.
- **Decide to cut or keep a losing position**  
  If the breakeven gain % is extremely high, it may signal dead money or excessive risk.
- **Visualize the "pain of drawdown"**  
  It quantifies how far you are from recovery.
- **Plan partial exits**  
  You can, for example, aim to trim once the price gets close to breakeven instead of waiting for full recovery.

Particularly useful for:

- long-term investors stuck in old positions,
- speculative trades that went wrong,
- crowded trades after a big crash.

---

## Notes & Limitations  

- **Only calculated for losing positions**  
  If your unrealized P&L is positive or zero, breakeven metrics are not shown, you are already at or above breakeven.
- **Assumes the same position size**  
  Breakeven is based on your current quantity. If you buy or sell more shares later, the average cost and breakeven level change.
- **Ignores taxes and transaction costs**  
  In reality, to "truly" break even after taxes and fees, you may need a slightly higher price than the average cost.
- **Based on current data**  
  If pricing or transaction data is incomplete or incorrect, the average cost and breakeven numbers will also be off.
- **Not a target recommendation**  
  The breakeven target price is **not** an investment goal or a suggested exit. It simply describes **where P&L becomes zero**, not where you *should* sell.