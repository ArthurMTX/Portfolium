# Insights

Discover powerful analytics and performance metrics for your investment portfolio.

## Overview

The Insights page provides comprehensive analysis of your portfolio performance, risk metrics, asset allocation, and benchmark comparisons. Use these insights to make informed investment decisions and track your progress toward financial goals.

## Getting Started

### Accessing Insights

1. Select a portfolio from the dropdown
2. Navigate to the **Insights** page
3. Insights are automatically calculated and displayed

!!! note "Requirements"
    You need at least one transaction in your portfolio to view insights. The more historical data you have, the more accurate and meaningful the insights become.

### Time Period Selection

Choose from multiple time periods to analyze:

- **1m**: Last month
- **3m**: Last 3 months
- **6m**: Last 6 months
- **1y**: Last year (default)
- **ytd**: Year-to-date
- **all**: Since first transaction

### Benchmark Selection

Compare your portfolio against market indexes:

- **SPY**: S&P 500 (default)
- **QQQ**: Nasdaq 100
- **IWM**: Russell 2000
- **DIA**: Dow Jones Industrial Average
- **VTI**: Total US Stock Market

## Key Performance Indicators

At the top of the Insights page, you'll find four key metrics:

### Total Return

- Shows total profit or loss in currency
- Includes both realized and unrealized gains/losses
- Percentage change displayed below

### Annualized Return

- Your portfolio's average annual return rate
- Useful for comparing with benchmark returns
- Accounts for compounding over time

### Win Rate

- Percentage of days with positive returns
- Helps understand consistency of performance
- Higher win rate indicates more stable growth

### Diversification Score

- Measures how well-diversified your portfolio is (0-100)
- Higher score = better diversification
- Based on:
    - Number of different holdings
    - Distribution of assets (concentration)

!!! tip "Diversification Guidelines"
    - **0-30**: Low diversification, high concentration risk
    - **30-60**: Moderate diversification
    - **60-80**: Well-diversified portfolio
    - **80-100**: Highly diversified

## Performance Metrics

### Total Return Analysis

View detailed return information:

- **Period Return**: Total gain/loss for selected period
- **Percentage Return**: Performance as a percentage
- **Annualized Return**: Average annual growth rate
- **Start Value**: Portfolio value at period start
- **End Value**: Current portfolio value

### Cash Flow Metrics

Track money movement in your portfolio:

- **Total Invested**: New money added during period
- **Total Withdrawn**: Money taken out during period
- Shows capital additions vs withdrawals

### Daily Performance

- **Best Day**: Highest single-day return (% and date)
- **Worst Day**: Lowest single-day return (% and date)
- **Positive Days**: Number of days with gains
- **Negative Days**: Number of days with losses

## Benchmark Comparison

### Performance Chart

Interactive chart comparing your portfolio to the benchmark:

- **Blue line**: Your portfolio value over time
- **Orange line**: Benchmark index value (normalized)
- Hover to see exact values on specific dates
- Both start at the same value for easy comparison

### Alpha (Excess Return)

- Shows how much you outperformed or underperformed the benchmark
- **Positive alpha**: You beat the benchmark
- **Negative alpha**: Benchmark performed better
- Displayed as percentage points difference

### Correlation

- Measures how closely your portfolio follows the benchmark
- **1.0**: Perfect correlation (moves exactly with benchmark)
- **0.0**: No correlation
- **-1.0**: Perfect inverse correlation (moves opposite)

!!! note "Understanding Correlation"
    High correlation (0.7-1.0) means your portfolio moves similarly to the market. Lower correlation means you have unique positions that perform independently of the benchmark.

## Risk Metrics

Understanding your portfolio's risk profile:

### Volatility

- Annualized standard deviation of returns
- Measures how much your portfolio value fluctuates
- **Higher volatility**: More unpredictable, riskier
- **Lower volatility**: More stable, less risky
- Expressed as percentage

### Sharpe Ratio

- Risk-adjusted return metric
- Higher is better (more return per unit of risk)
- **< 1.0**: Poor risk-adjusted returns
- **1.0-2.0**: Good risk-adjusted returns
- **> 2.0**: Excellent risk-adjusted returns
- Assumes 2% risk-free rate

### Maximum Drawdown

- Largest peak-to-trough decline in portfolio value
- Shows worst-case historical loss scenario
- Date of maximum drawdown displayed
- Helps understand downside risk
- **Lower is better**: Less severe losses

### Downside Deviation

- Volatility of negative returns only
- Focuses on downside risk rather than all volatility
- Useful for understanding loss potential
- **Lower is better**: More protection against losses

### Value at Risk (VaR 95%)

- Expected maximum loss on a bad day (95% confidence)
- Answers: "How much could I lose on a very bad day?"
- Expressed as percentage
- Based on historical return distribution

!!! warning "Risk Metrics Interpretation"
    Risk metrics are based on historical data and don't guarantee future performance. Markets can behave differently than in the past.

## Asset Allocation

### By Asset

View top holdings by portfolio percentage:

- Asset symbol and name
- Percentage of total portfolio value
- Dollar value of holding
- Quantity owned
- Asset type badge

Visualized in a pie chart showing relative sizes of your positions.

### By Sector

See how your investments are distributed across sectors:

- Technology
- Healthcare
- Financial Services
- Consumer Goods
- Energy
- And more...

Each sector shows:
    - Percentage of portfolio
    - Total value
    - Number of holdings

!!! tip "Sector Diversification"
    Avoid over-concentration in any single sector. Aim for exposure across multiple sectors to reduce sector-specific risk.

### By Geography

Understand your geographic exposure:

- Country name with flag
- Percentage of portfolio
- Total value
- Number of holdings

View pie chart showing geographic distribution of your investments.

## Top & Worst Performers

### Top 5 Performers

Assets with highest returns for the selected period:

- Asset symbol and name
- Return percentage (highlighted in green)
- Current value
- Unrealized profit/loss
- Asset type

### Worst 5 Performers

Assets with lowest returns (or largest losses):

- Asset symbol and name
- Return percentage (highlighted in red)
- Current value
- Unrealized profit/loss
- Asset type

!!! note "Performance Context"
    Individual asset performance should be viewed in context of your overall strategy. Some holdings may underperform temporarily while serving important portfolio roles.

## Using Insights for Decision Making

### Portfolio Health Check

Regularly review these key indicators:

1. **Return vs Benchmark**: Are you beating the market?
2. **Diversification Score**: Is your portfolio well-diversified?
3. **Risk Metrics**: Are you taking appropriate risk?
4. **Sector Balance**: Any over-concentration?
5. **Geographic Exposure**: Too much in one country?

### Rebalancing Decisions

Use insights to identify when to rebalance:

- Assets that have grown too large (>20% of portfolio)
- Sectors with over-concentration
- Underperforming assets to consider selling
- High volatility positions to reduce

### Performance Tracking

Monitor your progress:

- Compare different time periods
- Track annualized return trends
- Monitor win rate consistency
- Review risk metrics evolution

## Troubleshooting

### "No positions found in portfolio"

- Add transactions to your portfolio first
- Insights require at least one BUY transaction
- Ensure you have current holdings

### Loading Takes Too Long

- First load may take longer while calculating metrics
- Subsequent loads use 5-minute cache
- Try reducing the time period (use "1y" instead of "all")
- Ensure price data is available for your assets

### Benchmark Chart Not Showing

- Check that benchmark symbol is valid (SPY, QQQ, etc.)
- Benchmark price data may be loading
- Try refreshing the page
- Some benchmarks may not have historical data for your period

### Missing Risk Metrics

- Need at least 2 days of historical data
- Ensure transactions span the selected period
- Check that price data is available for dates

### Incorrect Sector/Geographic Data

- Run **Enrich Metadata** on the Assets page
- Some assets may not have sector/country data
- ETFs and cryptocurrencies don't have sectors

## Understanding Limitations

### Historical Data

- Insights are based on past performance
- Past performance doesn't guarantee future results
- Market conditions change over time
- Use as one tool among many for decision-making

### Data Accuracy

- Insights depend on accurate transaction data
- Price data comes from Yahoo Finance
- Some assets may have incomplete data
- Verify critical calculations manually

### Cache Behavior

- Insights are cached for 5 minutes
- May not reflect very recent changes immediately
- Refresh page or wait 5 minutes for updated data
- Cache improves performance for complex calculations

## Next Steps

- [Review Assets](assets.md) for detailed asset information
- [Check Portfolios](portfolios.md) to view current positions
- [Set Notifications](notifications.md) for performance alerts
- [Add Transactions](transactions.md) to keep data current