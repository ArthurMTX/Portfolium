## Unrealized P&L

### What It Shows

Unrealized P&L tells you how much you're up or down **on paper**, right now, on the positions you still hold — before you actually sell anything. It answers:
> "If I sold everything today, how much would I gain or lose compared to what I paid?"

The widget shows both a currency amount and a percentage, colored green when you're ahead and red when you're behind.

---

### How It's Calculated

Unrealized P&L compares the **current market value** of your open positions to what you originally paid for them (your cost basis):

$$
\text{Unrealized PNL} = V_{\text{current}} - C_{\text{total}}
$$

$$
\text{Unrealized PNL \%} = \frac{V_{\text{current}} - C_{\text{total}}}{C_{\text{total}}} \times 100
$$

Where:

- $V_{\text{current}}$ = current market value of all open positions
- $C_{\text{total}}$ = total cost basis of those same positions (what you paid, including fees at purchase)

The cost basis is tracked per asset using a moving weighted-average cost: every time you buy more of something, your average cost per share shifts toward the new purchase price; every time you sell, the corresponding share of cost basis is removed. Only positions you **currently hold** are counted — once fully sold, an asset's result moves to [Realized P&L](realized-pnl.md) instead.

---

### Example

- Total cost basis: $C_{\text{total}} = €10{,}000$
- Current value of open positions: $V_{\text{current}} = €11{,}500$

$$
\text{Unrealized PNL} = 11{,}500 - 10{,}000 = 1{,}500
$$

$$
\text{Unrealized PNL \%} = \frac{1{,}500}{10{,}000} \times 100 = 15.00\%
$$

The widget displays **+€1,500.00** and **+15.00%**.

---

### When To Use It

Check Unrealized P&L when you want to:

- see how your **current holdings** are performing before deciding to sell;
- decide whether it's a good time to **take profits or cut losses**;
- compare your paper gains against your original investment;
- keep tabs on risk exposure across open positions.

Pair it with [Realized P&L](realized-pnl.md) for gains already locked in, and [Total Return](total-return.md) for the full picture including dividends and fees.

---

### Notes & Limitations

- Unrealized P&L moves continuously with market prices — it isn't locked in until you sell.
- Once a position is fully closed, its result leaves Unrealized P&L and becomes part of Realized P&L.
- If cost basis is zero (no recorded purchases), the percentage isn't meaningful and is treated as zero.
- Values depend on up-to-date market prices; a stale or missing price for one asset can make the total look temporarily incomplete.
- Currency and formatting follow your portfolio's base currency settings.
