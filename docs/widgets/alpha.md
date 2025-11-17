# Alpha vs Benchmark

The **Alpha** widget measures how much your portfolio has **outperformed or underperformed a benchmark** over a given period.  
It represents your **excess return** compared to a reference index (by default **SPY - S&P 500**).

A **positive alpha** means you beat the benchmark; a **negative alpha** means you lagged behind it.

---

## What It Shows

The widget displays:

- **Alpha (%)** over the selected period (default: **1 year**)  
- A single value formatted like **+2.30%** or **-1.15%**  
- A subtitle explaining the comparison with the chosen benchmark  

Formatting:

- A leading `+` sign is added when alpha is **positive**, otherwise a `-` sign for **negative** values
- The value is shown with **two decimals**, in **percentage**  

By default, the benchmark is:

- **SPY** - used as a proxy for the **S&P 500**  

This metric answers the question:  
> "How much more (or less) did my portfolio return compared to the benchmark over this period?"

---

## How It's Calculated

Alpha is the difference between your **portfolio performance** and the **benchmark performance** over the selected period.

### Step 1 – Portfolio performance

For each day, Portfolium computes your **portfolio performance (%)** relative to your invested capital:

$$
\text{Portfolio Performance}_t =
\frac{V_t - I_t}{I_t} \times 100
$$

Where:

- $V_t$ = portfolio value on day *t*  
- $I_t$ = total invested amount on day *t*  

The **final portfolio return** used for alpha is the performance on the **last day** of the period.

### Step 2 – Benchmark performance

For the benchmark (e.g. SPY), Portfolium uses daily prices:

$$
\text{Benchmark Performance}_t =
\frac{P_t - P_0}{P_0} \times 100
$$

Where:

- $P_t$ = benchmark price on day *t*  
- $P_0$ = benchmark price on the **first day** of the period  

The **final benchmark return** is the performance on the **last day** of the period.

### Step 3 – Alpha

Alpha is simply:

$$
\alpha = R_{\text{portfolio}} - R_{\text{benchmark}}
$$

Where:

- $R_{\text{portfolio}}$ = final portfolio return (%)  
- $R_{\text{benchmark}}$ = final benchmark return (%)  

So:

- **α > 0** → portfolio outperformed the benchmark  
- **α < 0** → portfolio underperformed the benchmark  

If there is not enough data (portfolio or benchmark), the widget shows **N/A**.

---

## Example

Suppose over the last year:

- Your portfolio return: **+12.50%**  
- SPY (benchmark) return: **+10.20%**

Alpha:

$$
\alpha = 12.50\% - 10.20\% = 2.30\%
$$

The widget would display:

- **+2.30%**  

Interpretation:

- Your portfolio **outperformed SPY by 2.30 percentage points** over the period.

---

## When To Use It

The Alpha widget is useful for:

- Evaluating whether your **active decisions add value** beyond the benchmark  
- Comparing your portfolio's performance to a **broad market index**  
- Checking if taking extra risk or using specific strategies actually pays off  
- Complementing metrics like **Beta**, **Sharpe Ratio**, and **Volatility**

---

## Notes

- Default benchmark is **SPY (S&P 500)**, but the underlying system supports other symbols (e.g. QQQ, IWM)  
- Alpha is based on **total return over the selected period**, not annualized by default  
- Expressed as a **percentage**, with a leading `+` for positive values, `-` for negative 
- If benchmark price data is missing or incomplete, alpha may be **unavailable (N/A)**  
- Formatting and decimal precision follow your portfolio's display settings
