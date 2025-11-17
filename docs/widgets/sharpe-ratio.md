# Sharpe Ratio

The **Sharpe Ratio** widget measures how much **excess return** your portfolio generates **per unit of risk**.  
It tells you whether your returns compensate you enough for the volatility you are taking, compared to a risk-free investment.

---

## What It Shows

The widget displays:

- Your portfolio's **Sharpe ratio** over a selected period (default: **1 year**)  
- A **single numeric value** (e.g., `1.42`), rounded to two decimals  
- A **higher value** indicates **better risk-adjusted performance**

Rule-of-thumb interpretation:

- **< 0** – returns worse than the risk-free rate  
- **0 to 1** – low risk-adjusted performance  
- **1 to 2** – good risk-adjusted performance  
- **> 2** – excellent risk-adjusted performance  

This metric answers the question:  
> "Am I being properly compensated for the risk I'm taking?"

---

## How It's Calculated

The Sharpe ratio compares your portfolio's **excess return** (return minus risk-free rate) with its **volatility**.

**Formula**

$$
\text{Sharpe Ratio} =
\frac{R_p - R_f}{\sigma_p}
$$

Where:

- $R_p$ = portfolio return  
- $R_f$ = risk-free rate  
- $\sigma_p$ = portfolio volatility (standard deviation of returns)  

In Portfolium:

- Daily returns are computed from **daily portfolio values**  
- A **2% annual risk-free rate** is assumed  
- Both volatility and excess return are **annualized** using 252 trading days  

Additional notes:

- If volatility is zero or too small, the ratio may appear as **N/A**  

---

## Example

Imagine your portfolio over the past year produced:

- Annualized return: **8%**  
- Risk-free rate: **2%**  
- Annualized volatility: **4%**

Sharpe ratio:

$$
\text{Sharpe Ratio} = \frac{0.08 - 0.02}{0.04} = 1.50
$$

The widget would display:

- **1.50**

---

## When To Use It

The Sharpe Ratio widget is useful for:

- Evaluating **risk-adjusted performance**, not just raw returns  
- Comparing strategies or portfolios with different risk levels  
- Identifying whether higher returns are worth the added volatility  
- Supporting long-term investment and rebalancing decisions  

---

## Notes

- Always based on **your portfolio's daily value history**  
- Risk-free rate is fixed at **2%**  
- Formatting follows your portfolio's display settings  
