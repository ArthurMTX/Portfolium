# Relative Performance (vs Sector ETF)

## What It Shows  
Relative Performance tells you **how your asset performed compared to its sector benchmark ETF** over different time periods.

Instead of only showing *absolute returns* (e.g., +12% YTD), Portfolium also shows whether your stock:

- **outperformed** its sector (did better),
- **underperformed** its sector (did worse),
- or stayed **in line** with the sector.

This metric answers one key question:
> "Is the stock strong or weak relative to its peers?"

Portfolium selects the benchmark based on the SPDR sector classification of the asset via its GICS sector. If the asset lacks a sector, the metric is unavailable.

| Sector                  | SPDR Sector ETF  |
|-------------------------|------------------|
| Basic Materials         | XLB              |
| Communication Services  | XLC              |
| Consumer Cyclical       | XLY              |
| Consumer Defensive      | XLP              |
| Energy                  | XLE              |
| Financial Services      | XLF              |
| Healthcare              | XLV              |
| Industrials             | XLI              |
| Real Estate             | XLRE             |
| Technology              | XLK              |
| Utilities               | XLU              |

Portfolium computes this for **30d, 90d, YTD, and 1Y**.

---

## How It's Calculated  

For each time period:

1. Portfolium retrieves the **asset price** on the start date  
2. Retrieves the **sector ETF price** on the same date  
3. Calculates asset return and sector return  
4. Computes the **difference**:

$$
\text{Relative Performance} = R_{\text{asset}} - R_{\text{sector}}
$$

Where:

$$
R = \frac{P_{\text{end}} - P_{\text{start}}}{P_{\text{start}}} \times 100
$$

So:

$$
\text{Relative Performance} = 
\left( \frac{P_a^{end} - P_a^{start}}{P_a^{start}} \right)
-
\left( \frac{P_e^{end} - P_e^{start}}{P_e^{start}} \right)
$$

Where:  
- $P_a^{start}$, $P_a^{end}$ → asset start/end prices  
- $P_e^{start}$, $P_e^{end}$ → sector ETF start/end prices  

### Interpretation

- **Positive value** → Asset outperformed its sector (stronger than peers)
- **Negative value** → Asset underperformed (weaker than peers)
- **Near zero** → In line with the sector trend  

Portfolium displays:

- Asset return  
- Sector return  
- Relative return  
- A textual **performance conclusion** (moderate, strong, severe underperformance, etc.)

---

## Examples

### Example 1 — Outperforming

**Asset: +20% YTD**  
**Sector ETF: +12% YTD**

$$
\text{Relative Performance} = 20 - 12 = +8\%
$$

Portfolium shows:  
**`+8%` — Moderate outperformance**

---

### Example 2 — Underperforming

**Asset: –5% last 30d**  
**Sector ETF: +3% last 30d**

$$
\text{Relative Performance} = (-5) - 3 = -8\%
$$

Portfolium shows:  
**`-8%` — Moderate underperformance**

---

### Example 3 — Extreme Case

**Asset (small-cap biotech): +600% 1Y**  
**Sector ETF: +12% 1Y**

$$
\text{Relative Performance} = 600 - 12 = 588\%
$$

Portfolium labels this as:  
**"Exceptional Outlier — speculative surge"**

---

## When To Use It  

Relative Performance is extremely valuable when:

- **Evaluating strength within a sector**  
  E.g., two semiconductor stocks: which one is leading the pack?
- **Detecting laggards or leaders**  
  Negative values may signal weakness before fundamentals show it.
- **Risk management**  
  Consistent underperformance may justify reducing or trimming a position.
- **Confirming investment theses**  
  A company you're bullish on should ideally outperform its sector.
- **Comparing potential investments**  
  Helps avoid buying weak stocks in strong sectors.

Works especially well for:

- tech, biotech, energy, consumer sectors,  
- cyclical industries,  
- growth stocks with high dispersion inside the sector.

---

## Notes & Limitations

- **Requires a known sector**  
  If the asset has no sector classification, the metric is unavailable.
- **ETF data comes from yfinance**  
  If the ETF has missing historical data (rare), the period may be skipped.
- **Does not reflect fundamentals**  
  A company can outperform while actually deteriorating (short-term hype).
- **Asset must have historical prices in the database**  
  If the database lacks older price entries, some periods may be unavailable.
- **Not a prediction tool**  
  Relative strength is descriptive, not predictive, it shows *what happened*, not *what will happen*.
