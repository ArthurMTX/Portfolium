## Distance to All-Time High (ATH)

### What It Shows
**Distance to ATH** tells you how far the current price is from the asset's **official all-time high** (ATH), i.e. the highest price the stock has ever reached in its entire trading history.

It answers the question:

> "Is this asset close to breaking new highs, or still far below its peak?"

This is a **global historical metric**, not personal to your portfolio.  
It helps assess momentum, recovery potential, and whether you are buying strength or weakness.

---

### How It's Calculated
Portfolium uses two values:

1. **Official ATH price** of the asset (historical highest).
2. **Current price** (converted into your portfolio currency if needed).

The formula is:

$$
\text{Distance to ATH (\%)} =
\frac{\text{Current Price} - \text{ATH Price}}{\text{ATH Price}} \times 100
$$

This gives:

- a **negative percentage** when the asset is below ATH,  
- **0%** when the asset is exactly at ATH,  
- a **positive value** only if the current price surpasses the previous ATH (rare).

#### Currency Conversion Logic
If the asset is priced in a different currency than your portfolio:

- Portfolium converts the ATH **using historical FX data at the ATH date** (for accuracy),
- If unavailable, it falls back to the current FX rate.

This ensures that both values (ATH and current price) are expressed in **the same currency** before comparison.

---

### Example

#### Example 1 — Asset Far Below ATH

- ATH Price: **$200**
- Current Price: **$120**

$$
\frac{120 - 200}{200} \times 100 = -40\%
$$

The asset is **40% below its all-time high**.

---

#### Example 2 — Close to ATH

- ATH Price: **€85**
- Current Price: **€82**

$$
\frac{82 - 85}{85} \times 100 \approx -3.53\%
$$

The stock is only **3.5% below ATH**, showing strong momentum.

---

#### Example 3 — Currency Conversion Example

- ATH: **¥18,000**  
- Date FX rate: **¥120 = 1€**  
- Converted ATH: $18{,}000 \div 120 = 150\,\text{€}$
- Current price converted to EUR: **€135**

$$
\frac{135 - 150}{150} \times 100 = -10\%
$$

Distance to ATH = **–10%**

---

### When To Use It
Use Distance to ATH to:

- measure **long-term recovery potential**,  
- see if a stock is still **deeply discounted** or nearing a **breakout**,  
- compare assets within the same sector based on recovery progress,  
- detect momentum conditions (close to ATH often signals strength),  
- avoid buying stocks still **–70% from ATH** unless intentionally seeking deep-value plays.

Especially helpful when:

- evaluating high-volatility tech stocks,
- reviewing positions that crashed in the past,
- studying momentum signals or trend-following strategies.

---

### Notes & Limitations

- **Not a valuation metric**  
  Being far below ATH doesn't mean a stock is cheap or undervalued.

- **ATH can be outdated**  
  Some stocks never return to a decade-old ATH.  
  A permanent decline can make distance-to-ATH misleading.

- **FX rate changes influence ATH distance**  
  If the ATH occurred when currency rates were different, your converted ATH may fluctuate.

- **Depends on historical price completeness**  
  Missing early price records can underestimate the true ATH.

Distance to ATH provides a market-wide historical reference point, helping you gauge whether an asset is in recovery, stagnation, or close to breaking new highs.
