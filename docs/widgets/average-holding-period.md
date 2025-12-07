# Average Holding Period

The **Average Holding Period** widget shows how long, on average, you keep your investments before selling them (or up to today for positions you still hold).  
It gives you a clear view of whether your style is more **short-term trading** or **long-term investing**.

---

## What It Shows

The widget displays:

- Your portfolio's **average holding period**, in **days**, formatted as a readable duration  
    - For example: **"45 days"**  
- A single value summarising **all completed and current positions**  
- A subtitle explaining that it reflects your typical holding time

If there is not enough data (no buy/sell history), the widget shows: **N/A**

This metric answers the question:  
> "On average, how many days do I hold my positions?"

---

## How It's Calculated

The average holding period is based on your **transaction history** and uses **FIFO (First In, First Out)** matching of buys and sells.

### 1. Data used

For your selected portfolio, Portfolium takes:

- All **BUY** and **SELL** transactions  
- Grouped **by asset** and ordered by date  

### 2. Completed positions (closed lots)

For each asset:

1. Every **BUY** creates a "lot" with:
   - Buy date  
   - Quantity purchased  
2. Every **SELL** consumes the **oldest remaining buy lots first** (FIFO).  
3. Whenever a buy lot (or part of it) is sold, Portfolium computes:

   $$
   \text{Holding Days} = \text{Sell Date} - \text{Buy Date}
   $$

4. Each matched portion contributes one holding period entry in days.

### 3. Currently held positions (open lots)

After matching all sells:

- Any remaining **BUY** lots represent **positions you still hold**  
- For these, holding days are calculated from **buy date to today**:

  $$
  \text{Holding Days} = \text{Today} - \text{Buy Date}
  $$

### 4. Final average

All holding periods (closed lots + open lots) are collected into a single list, and the **average** is computed:

$$
\text{Average Holding Period} =
\frac{\sum \text{Holding Days}}{\text{Number of lots}}
$$

The resulting value (in days) is rounded and then formatted as a readable period.

If no holding periods can be computed, the result is **N/A**.

---

## Example

Imagine the following simplified history:

- **Asset A**
  - 2024-01-01: BUY 10 shares  
  - 2024-02-01: SELL 10 shares → holding = **31 days**  
- **Asset B**
  - 2024-03-01: BUY 5 shares (still held today, 2024-04-15) → holding ≈ **45 days**  

Holding periods:

- Lot 1 (A): **31 days**  
- Lot 2 (B): **45 days**  

Average:

$$
\text{Average Holding Period} =
\frac{31 + 45}{2} = 38 \text{ days}
$$

The widget might display:

- **"38 days"**

---

## When To Use It

The Average Holding Period widget is useful for:

- Understanding your **real investing style** (trader vs long-term holder)  
- Monitoring changes in behaviour over time (e.g. holding periods getting shorter)  
- Comparing actual behaviour to your **intended strategy**  
- Complementing metrics like **Turnover**, **Realized P&L**, and **Hit Ratio**

---

## Notes

- Uses **all available BUY/SELL transactions** for the portfolio  
- Closed and still-open positions are both included in the average  
- Matching logic is **FIFO**, which is standard in many portfolio and tax systems  
- The value is computed in **days**, then formatted as a human-readable duration  
- If you have no buy/sell history, the widget displays **N/A**
