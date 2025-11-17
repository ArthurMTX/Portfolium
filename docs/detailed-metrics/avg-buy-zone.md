# Average Buy Zone

## What It Shows  
The **Average Buy Zone** tells you how far the current price is from **your personal average cost (cost basis)** for this asset.

It helps you quickly see:

- if the stock is trading **below your cost basis** → potential buy/add zone,  
- if the stock is **above your cost basis** → you're in profit,  
- how attractive or expensive the asset is **relative to your own entries**, not just the market.

This metric is **personal to you**: two investors holding the same stock can have very different Average Buy Zone values depending on their transaction history.

---

## How It's Calculated  

Portfolium first reconstructs your **average cost (cost basis)** from your full transaction history:

- **BUY / TRANSFER_IN** → increase quantity and total cost  
- **SELL / TRANSFER_OUT** → reduce quantity and total cost proportionally  
- **SPLIT** → scales both quantity and total cost by the split ratio  

From this, it derives:

- $AC = \text{your average cost (cost basis)}$ 
- $P = \text{current market price (in portfolio currency)}$

Then it computes:

$$
\text{Average Buy Zone (\%)} = 
\frac{AC - P}{P} \times 100
$$

Interpretation:

- If $P < AC \Rightarrow \text{Average Buy Zone} > 0$:  
  Price is **below** your cost basis → potential "discount" relative to your entries.
- If $P > AC \Rightarrow \text{Average Buy Zone} < 0$:  
  Price is **above** your cost basis → you're in profit on this position.
- If $P = AC \Rightarrow \text{Average Buy Zone} = 0$:  
  You are exactly **break-even**.

Portfolium shows the resulting value as a **percentage**, e.g. `+25%` or `-18.5%`.

---

## Examples  

### Example 1 — Price Below Your Cost Basis (Potential Buy Zone)

- Average cost $AC = \$50$  
- Current price $P = \$40$

$$
\text{Average Buy Zone} =
\frac{50 - 40}{40} \times 100 = 25\%
$$

**Displayed value:** `+25%`  

Meaning:

- The stock trades **25% below** your cost basis.
- If you still believe in the thesis, this may look like a **buy / averaging opportunity**.

---

### Example 2 — Price Above Your Cost Basis (In Profit)

- Average cost $AC = \$20$  
- Current price $P = \$30$

$$
\text{Average Buy Zone} =
\frac{20 - 30}{30} \times 100 \approx -33.33\%
$$

**Displayed value:** `-33%`  

Meaning:

- The stock trades **33% above** your cost basis.
- You are **solidly in profit** relative to your entries.

---

### Example 3 — Break-Even

- Average cost $AC = \$10$  
- Current price $P = \$10$

$$
\text{Average Buy Zone} =
\frac{10 - 10}{10} \times 100 = 0\%
$$

**Displayed value:** `0%`  

Meaning:

- Current price and average cost are the same.
- You are **exactly flat** on this position (ignoring dividends/fees).

---

## When To Use It  

Use the Average Buy Zone when you want to:

- **Decide whether to add to a losing position**  
  If the value is strongly **positive**, the stock is far below your cost basis. 

  This can indicate:

  - a genuine **opportunity** if fundamentals are intact, or  
  - a **value trap** if the thesis is broken.

- **Check if a stock is in your "buy zone"**  

  For example: you might decide you only add if the Average Buy Zone is **above +10%** (price at least 10% below your cost basis).

- **Manage profit-taking and risk**  

  When the Average Buy Zone is strongly **negative**, you know the stock is far above your cost basis, which may be a:

  - **trim / partial take-profit** zone, or  
  - **hold and ride the trend** zone, depending on your strategy.

- **Compare across holdings**  

  You can quickly see which positions are:
  - deep underwater and need monitoring,  
  - slightly below cost (possible staggered buy zone),  
  - nicely in profit.

---

## Notes & Limitations  

- **Position-specific metric** 

  This is **not** a market-wide valuation measure. It only tells you where **you** stand relative to your own entries.

- **Depends on transaction history quality**  

  If your transaction history is incomplete, mis-labeled, or imports are missing, the average cost and therefore this metric can be inaccurate.

- **Does not include all cash flows**  

  The metric is based on **price and quantity**, not on:

  - taxes,  
  - dividends received,  
  - separate option strategies, etc.  

  Those can change your real economic P&L even if the Average Buy Zone stays the same.

- **No recommendation by itself**  

  A high positive value is **not** an automatic "buy" signal, and a strongly negative value is **not** an automatic "sell" signal.  
  It should be used together with:
  
  - fundamentals (growth, margins, balance sheet),  
  - risk metrics (volatility, beta, risk score),  
  - and your overall portfolio allocation.
