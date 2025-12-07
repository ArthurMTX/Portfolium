# Performance Metrics

The **Performance Metrics** widget shows your portfolio performance over key time periods, using a return that adjusts for **deposits and withdrawals**.  
It gives you a clean view of how your portfolio has actually performed over:

- **Last week**
- **Last month**
- **Year-to-date (YTD)**

---

## What It Shows

For each period, the widget displays:

- **Weekly performance** - return over approximately the last 7 days  
- **Monthly performance** - return over approximately the last 30 days  
- **YTD performance** - return since the start of the year  

Each line shows:

- A small icon indicating the direction:

    - Up arrow for **positive** performance
    - Down arrow for **negative** performance
    - Neutral bar icon when performance is flat or unavailable

- The **period label** (e.g. "Last 7 days", "Last 30 days", "Year-to-date")  
- The **percentage return** for that period (or **N/A** if it can't be calculated)

Color coding:

- **Green** for positive returns  
- **Red** for negative returns  
- **Neutral grey** when performance is exactly 0% or data is missing  

This widget answers the question:  
> "How has my portfolio actually performed over the last week, month, and since the beginning of the year?"

---

## How It's Calculated

Performance is based on your **portfolio history**, taking into account **cash flows** (deposits/withdrawals).  
For each period (1W, 1M, YTD), the widget looks at:

- The **first** data point in the period (start)  
- The **last** data point in the period (end)  

Each point contains:

- `value` - total portfolio value at that time  
- `invested` - total capital invested up to that time (if missing, `value` is used)

**Step 1 - Define values**

- Start value:

    - $V_{\text{start}} = \text{firstPoint.value}$

- End value:  

    - $V_{\text{end}} = \text{lastPoint.value}$ 

- Start invested:  

    - $I_{\text{start}} = \text{firstPoint.invested}$ (or `value` if not available) 

- End invested:  

    - $I_{\text{end}} = \text{lastPoint.invested}$ (or `value` if not available)  

**Step 2 - Net capital change (deposits/withdrawals)**

$$
\text{Net Capital Change} = I_{\text{end}} - I_{\text{start}}
$$

Positive value = net deposits, negative value = net withdrawals.

**Step 3 - Period return**

$$
\text{Period Return (\%)} =
\frac{V_{\text{end}} - V_{\text{start}} - \text{Net Capital Change}}
{V_{\text{start}}}
\times 100
$$

Additional notes:

- If the start value is **0 or less**, return for that period is set to **N/A**.  
- The result is shown with two decimal places (e.g. `+5.67%`).  

---

## Example

Imagine the **Monthly** period:

- At the start of the period:
  - $V_{\text{start}} = \text{€}10\,000$  
  - $I_{\text{start}} = \text{€}9\,000$  

- At the end of the period:
  - $V_{\text{end}} = \text{€}11\,500$  
  - $I_{\text{end}} = \text{€}10\,000$  

**Step 1 - Net capital change**

$$
\text{Net Capital Change} = 10\,000 - 9\,000 = 1\,000
$$

(You deposited €1,000 during the month.)

**Step 2 - Period return**

$$
\text{Period Return (\%)} =
\frac{11\,500 - 10\,000 - 1\,000}{10\,000} \times 100
=
\frac{500}{10\,000} \times 100 = 5.00
$$

The **Monthly** line would display:

- **+5.00%** (in green)

---

## When To Use It

The Performance Metrics widget is useful for:

- Tracking your **short-term** (weekly) and **medium-term** (monthly) performance  
- Monitoring your **Year-to-date** results as the year progresses  
- Seeing performance adjusted for **deposits and withdrawals**, not just raw value changes  
- Complementing charts with simple, clear numbers

---

## Notes

- The widget uses the same portfolio history as the **performance charts**, so values are consistent 
- If history data is missing or incomplete for a period, that period is shown as **N/A**
- Returns are **not annualized**; they reflect performance over the specific period only (1W, 1M, YTD)
- Values are based on the **active portfolio**; switching portfolios will change the metrics
