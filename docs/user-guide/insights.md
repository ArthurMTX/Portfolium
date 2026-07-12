# Insights

Understand not just how your portfolio is doing, but why, what it's exposed to, and what could go wrong.

## Overview

The Insights page is Portfolium's analytics workspace. Where the Dashboard shows you live numbers and Charts shows you visual history, Insights answers deeper questions about your investing: which positions are actually driving your returns, what hidden exposures your holdings share, how risky your portfolio really is, and how it would hold up under a market shock.

Insights is organized into five sections, each built around a different question:

| Section | Question it answers |
|---|---|
| Performance | What happened? |
| Attribution | Why did it happen? |
| Exposure | What am I exposed to? |
| Risk | What can go wrong? |
| AI Insights | Reserved for future AI-generated portfolio narratives |

## Accessing Insights

1. Select a portfolio from the dropdown
2. Click **Insights** in the main navigation
3. Choose a section (Performance, Attribution, Exposure, Risk, or AI Insights)
4. Adjust the time period and benchmark if the section supports them

!!! note "Requirements"
    You need at least one open position in your portfolio to see insights. Add a buy transaction first if the page prompts you to.

### Time Period Selection

Most sections let you pick the window of history to analyze:

- **1M**: Last month
- **3M**: Last 3 months
- **6M**: Last 6 months
- **YTD**: Year-to-date
- **1Y**: Last year (default)
- **All**: Since your first transaction

### Benchmark Selection

Performance and Risk let you compare your portfolio against a market index:

- **S&P 500** (default)
- **Nasdaq 100**
- **Russell 2000**
- **Dow Jones**
- Total US market

Attribution and Exposure are based on your current holdings, so they don't use the time period or benchmark selectors.

## Performance

Performance summarizes what your portfolio actually did over the selected period, and how that compares to the market.

**Headline metrics**

- **Total Return** — profit or loss over the period, in currency and percentage
- **Annualized Return** — your return converted to a yearly rate, useful for comparing periods of different lengths
- **Sharpe Ratio** — return earned per unit of risk taken; higher generally means a smoother ride to the same (or better) return
- **Alpha vs benchmark** — how much you beat or lagged the selected index over the period

**Performance vs Benchmark chart**

An overlay of your portfolio's cumulative return against the benchmark's, so you can see at a glance whether you're keeping pace, pulling ahead, or falling behind. Below the chart:

- **Portfolio Return** and **Benchmark Return** — cumulative return for each over the period
- **Alpha** — portfolio return minus benchmark return
- **Correlation** — how closely your portfolio's day-to-day moves track the benchmark, from $-1$ (perfectly opposite) to $+1$ (perfectly in sync)

**Performance Statistics**

- **Best Day** / **Worst Day** — the single biggest daily swing in your performance, with the date
- **Positive Days** / **Negative Days** — the split between good and bad days
- **Win Rate** — the percentage of observed days that were positive

**Risk Summary**

A compact preview of volatility, beta, maximum drawdown, and Value at Risk for the period — the full detail lives in the Risk section.

!!! tip "Reading annualized return"
    Annualized return lets you compare a 3-month result to a 5-year result on equal footing. A strong 3-month period can look impressive in raw terms but translate to a much more modest annualized rate.

## Attribution

Attribution breaks your returns down by source, so you can see which specific positions or groups of positions are actually responsible for your gains or losses — rather than just knowing the portfolio total moved.

**Why Does My Portfolio Move?**

Shows which of your current holdings explain the most recent daily move in your portfolio, using each position's latest daily price change. You'll see:

- Today's overall daily change, in percent and currency
- The value explained by your current holdings
- The 5 best and 5 worst movers of the day

**Top Contributors / Top Detractors**

Ranks your open positions by total unrealized profit or loss (not just today's move) — the assets doing the most to help or hurt your overall return.

**Contribution by Asset, Theme, Sector, Country, Currency**

Groups your current holdings by each of these dimensions and shows how much each group has contributed to your total unrealized return. This is where you can see, for example, that most of your gains actually came from one theme or sector rather than being spread evenly across the portfolio.

**Concentration Metrics**

Measures how much of your portfolio's value sits in a small number of positions:

- **Largest Position** — the weight of your single biggest holding
- **Top 3 Weight** / **Top 5 Weight** — combined weight of your largest few positions
- **Effective Positions** — a concentration-adjusted count of holdings (a portfolio of 10 equally-sized positions has 10 effective positions; one dominated by a single stock has far fewer)
- **Diversification** — a 0–100 score combining how many holdings you have and how evenly sized they are

!!! tip "Why effective positions matters more than holding count"
    Two portfolios can both hold 20 assets, but if one position is 60% of the portfolio, you're really only diversified across a handful of "effective" positions. This metric captures that nuance better than a simple headcount.

## Exposure

Exposure shows what your current holdings are actually exposed to — beyond the label on the ticker — so you can spot risks that aren't obvious from looking at individual positions.

**Exposure breakdowns**

Each of the following shows the current market-value split of your holdings along one dimension:

- **Theme Exposure** — thematic tilts (e.g. artificial intelligence, clean energy) across your holdings
- **Sector Exposure** — split across business sectors
- **Country Exposure** — geographic exposure by country
- **Currency Exposure** — which currencies your holdings are denominated in
- **Market Cap Exposure** — split across mega, large, mid, small, and micro-cap companies, with funds, crypto, and holdings missing market-cap data grouped separately

**Portfolio DNA**

A style summary of your portfolio built from your current holdings — concentration, dominant instrument type, geographic tilt, currency tilt, dominant theme, and breadth (effective position count). It's a quick way to describe your portfolio's overall character in a few traits rather than scrolling through every table.

**Duplicate Exposure**

Flags categories where several different holdings may all be exposed to the same underlying driver — for example, three different tickers that are all really "US mega-cap tech" bets. Two positions that look diversified on paper can still move together if they share the same underlying exposure.

**Hidden Concentration**

Highlights grouped exposure that's large as a group even though no single holding looks concentrated on its own — a risk that's easy to miss if you only look at individual position sizes.

**Theme Evolution**

A chart tracking how your top theme exposures have shifted over the selected period, based on your transaction and cost-basis history. Useful for seeing whether a thematic tilt you didn't intend to build has crept in over time.

!!! note "Exposure reflects current holdings only"
    Unlike Performance, the Exposure and Attribution sections describe your portfolio as it stands today — they don't use the time period selector (except Theme Evolution, which specifically tracks change over time).

## Risk

Risk quantifies how much your portfolio could move, in both typical and worst-case terms, and stress-tests it against hypothetical market shocks.

**Volatility**

- **Annualized Volatility** — how much your returns typically fluctuate over a year
- **Downside Deviation** — volatility measured using only negative return days, a better gauge of "bad" volatility than overall volatility
- **Sharpe Ratio** — return earned per unit of volatility

**Beta & Correlation**

- **Beta** — how sensitive your portfolio is to moves in the selected benchmark; a beta above $1.0$ means your portfolio tends to amplify market moves, below $1.0$ means it tends to dampen them
- **Correlation** — how closely your portfolio's returns track the benchmark's, from $-1$ to $+1$
- **Alpha** — your return in excess of (or behind) the benchmark

**Value at Risk**

Estimates how much you could lose on a bad day or month, based on your historical return distribution:

- **VaR 95% (1-day)** and **VaR 99% (1-day)** — the loss threshold you'd expect to exceed only 5% or 1% of days, respectively
- **CVaR 95%** — the average loss on the days that fall beyond the VaR 95% threshold (the "how bad is bad" complement to VaR)
- **VaR 95% (1-month)** — the 1-day VaR scaled to a monthly horizon

**Drawdown**

- **Maximum Drawdown** — the largest peak-to-trough decline in your portfolio's value over the selected period, with the date it occurred
- **Tail Exposure** — how often your returns fall into extreme territory (roughly 3 standard deviations from your average), a signal of fat-tail risk beyond what volatility alone captures

**Scenario Analysis**

Applies a set of predefined market scenarios (e.g. a rate shock, a tech selloff, a broad market correction) to your current exposure weights, estimating how much value each scenario would add or remove from your portfolio today.

**Stress Testing**

Highlights the most severe shocks against your current exposures — the scenarios that would hurt the most if they happened — so you know where your biggest hidden vulnerabilities are.

!!! warning "Risk metrics are historical, not predictive"
    Volatility, VaR, beta, and drawdown are all calculated from past returns. They describe how your portfolio has behaved, not how it's guaranteed to behave in the future — markets can and do shift regime, especially around shocks and crises.

## AI Insights

Reserved for future AI-generated portfolio review: hidden risk detection, diversification gaps, opportunity analysis, and narrative explanations of your portfolio in plain language. Not yet available in this release.

## Troubleshooting

### A section shows "no data available"

- Each block needs a minimum amount of underlying data (holdings, price history, or benchmark history) to compute. If a block is empty, it usually means that requirement isn't met yet.
- Add more transactions or wait for more price history to accumulate, then check back.
- Use the refresh icon in the section header to retry after adding data.

### "No positions found in portfolio"

- Insights are built from your current open positions. Add at least one buy transaction to your active portfolio.
- If you've sold everything, insights won't have anything to analyze until you hold something again.

### Missing risk metrics or beta

- Volatility, drawdown, and VaR need at least two days of historical portfolio value in the selected period — very new portfolios or very short periods may not qualify yet.
- Beta specifically needs a substantial number of days where your portfolio's returns and the benchmark's returns can be aligned; if your portfolio or the benchmark is missing price history for stretches of the period, beta may show as unavailable.
- Try a longer period (e.g. switch from 1M to 1Y) to give the calculation more data to work with.

### Benchmark data not loading

- Confirm you've selected a supported benchmark from the dropdown.
- Benchmark price history is fetched from the market data provider in the background; if it was just requested for the first time, give it a moment and refresh.
- Some benchmarks may not have complete history for very long "All time" periods.

### Sector, country, or theme data looks incomplete

- Exposure and Attribution group your holdings using each asset's classification data. If an asset is missing sector, country, or theme information, it may show up as "Unknown" or be excluded from a specific breakdown.
- Visit the Assets page and run metadata enrichment to fill in missing classification data.
- Funds, ETFs, and cryptocurrencies don't have a traditional sector, so they're expected to be grouped separately in some breakdowns (like Market Cap Exposure).

### Numbers seem stale after making changes

- Insights results are cached briefly to keep the page fast. After adding transactions or changing holdings, use the refresh icon on the affected section, or wait a few minutes for the cache to refresh automatically.

## Next Steps

- [Dashboard](dashboard.md) for real-time metrics and position tracking
- [Charts](charts.md) for visual portfolio value history and performance charts
- [Assets](assets.md) to enrich metadata and review individual asset details
- [Portfolios](portfolios.md) to review current holdings
- [Transactions](transactions.md) to keep your transaction history accurate and complete
