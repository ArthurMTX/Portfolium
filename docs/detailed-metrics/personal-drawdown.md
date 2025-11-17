## Personal Drawdown

### What It Shows
**Personal Drawdown** measures how far the current price is from the **highest price the asset has reached *since you bought it***.

It answers a very personal question:

> "How much am I down from the best moment this position has ever been for me?"

This is different from the official all-time high (ATH).  
It only considers the period you have actually held the stock, so it reflects **your real lived experience** with the asset.

---

### How It's Calculated
Portfolium looks at:

1. The **highest recorded price** of the asset *since your first transaction date*  
   (this is your personal peak or "local ATH").

2. The **current price** of the asset.

The formula is:

$$
\text{Personal Drawdown (\%)} =
\frac{\text{Current Price} - \text{Local ATH Price}}{\text{Local ATH Price}} \times 100
$$

This produces:

- a **negative value** when the price is below your personal peak,  
- **0%** when the asset is at your local ATH,
- occasionally a **slightly positive value** during data-sync anomalies (but normally never > 0).

Portfolium also records the **date of your local ATH**, so you can see when your position peaked.

#### How the Local ATH Is Determined
- Portfolium queries all recorded daily prices **starting from your first buy date**.
- It selects the **highest closing price** in that range.
- If your portfolio currency differs from the asset currency, the ATH is **converted** accordingly.

---

### Example

#### Example 1 — You Are Down From Your Peak

- Personal highest price since you bought: **$150**
- Current price: **$120**

$$
\text{Drawdown} = \frac{120 - 150}{150} \times 100 = -20\%
$$

Your position is **20% below** your personal record high.

---

#### Example 2 — You Are Just Slightly Below Peak

- Local ATH: **€92**
- Current price: **€89**

$$
\text{Drawdown} = \frac{89 - 92}{92} \times 100 \approx -3.26\%
$$

Your position is **only -3.3% below** its personal peak.

---

#### Example 3 — Currency Conversion

You bought a stock priced in USD but your portfolio is in EUR.

- Local ATH in USD: **\$110**  
- Historical FX rate on that day: **1.10**  
- Converted ATH: $110 \div 1.10 = 100\,€ $

- Current price today converted to EUR: **€85**

$$
\text{Drawdown} = \frac{85 - 100}{100} \times 100 = -15\%
$$

Portfolium ensures consistency by converting both values to your base currency.

---

### When To Use It
Personal Drawdown is useful when:

- evaluating whether a dip is large or still reasonable,
- comparing positions based on *your* experience, not the stock's history,
- identifying positions that previously performed well but never recovered,
- estimating whether you are underwater or close to break-even,
- balancing conviction across your holdings.

It's especially valuable for:

- swing traders,
- long-term holders wanting regret minimization,
- monitoring recovery potential during market downturns.

---

### Notes & Limitations

- **Not the same as official drawdown**  
  It only looks at the period *you* have held the position.

- **Dependent on historical price availability**  
  If early price data is missing, the local ATH may be underestimated.

- **Currency conversion affects the value**  
  Converted ATH might differ from the nominal value shown on financial websites.

- **Does not account for dividends**  
  Only price appreciation is measured.

Personal Drawdown offers a psychologically meaningful view of your position by measuring performance relative to *your* personal peak, not the asset's global price history.
