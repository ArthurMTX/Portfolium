## Volume & Average Volume

### What It Shows
**Volume** represents the number of shares traded during the latest trading session.  
**Average Volume** represents the typical daily trading activity, usually averaged over the last 10-30 days.

It answers the question:
> "Is there strong market interest in this stock right now?"

Together, they help you instantly understand:

- how actively the stock is traded today,
- whether the current trading activity is normal or unusual,
- how liquid the stock is (how easily you can buy or sell),
- whether a price move is backed by strong participation.

These are **liquidity and market-attention metrics**, not indicators of valuation or fundamentals.

---

### How It's Calculated

Portfolium does **not** compute these values manually.  
It fetches:

- **Volume** → from the data provider's `volume` field  
- **Average Volume** → from `averageVolume`

To understand if today's activity is significant, Portfolium computes a ratio:

- Current volume: $V_{\text{current}}$
- Average volume: $V_{\text{avg}}$

#### Volume Ratio

$$
\text{Volume Ratio} = \frac{V_{\text{current}}}{V_{\text{avg}}}
$$

Portfolium interprets the ratio using the following ranges:

- **Very High Volume**: $\text{Ratio} \ge 2$
- **Above Average**: $\text{Ratio} \ge 1.2$
- **Normal / In Line**: $0.8 < \text{Ratio} < 1.2$
- **Below Average**: $0.4 < \text{Ratio} \le 0.8$
- **Very Low Volume**: $\text{Ratio} \le 0.4$

These thresholds generate the qualitative text you see under the widget.

---

### Examples

#### Example 1 — Very High Volume

- Volume: $12{,}000{,}000$
- Average Volume: $5{,}000{,}000$

$$
\text{Ratio} = \frac{12\,000\,000}{5\,000\,000} = 2.4
$$

Classification: **Very High Volume**, strong market participation.

---

#### Example 2 — In Line With Average

- Volume: $980{,}000$
- Average Volume: $1{,}050{,}000$

$$
\text{Ratio} = \frac{980\,000}{1\,050\,000} \approx 0.93
$$

Classification: **Normal / In Line**, typical trading activity.

---

#### Example 3 — Very Low Volume

- Volume: $300{,}000$
- Average Volume: $750{,}000$

$$
\text{Ratio} = \frac{300\,000}{750\,000} = 0.40
$$

Classification: **Very Low Volume**, limited market interest.

---

### When To Use It

Use Volume + Average Volume to:

- **Confirm price action strength**  
  A breakout or selloff on high volume is more trustworthy.
- **Evaluate liquidity before trading**  
  Low volume can cause slippage and wide spreads.
- **Identify unusual market interest**  
  Volume spikes often accompany news, earnings, or sentiment shifts.
- **Gauge investor attention**  
  Stocks with consistently low volume may behave erratically.

These metrics are especially useful when:
- entering or exiting positions,
- evaluating risk on small-cap or niche stocks,
- checking whether a price move is meaningful.

---

### Notes & Limitations

- **Volume doesn't show direction**  
  High volume can be bullish or bearish, +-it only measures activity.
- **Average volume smooths volatility**  
  But it may lag during rapidly changing market conditions.
- **Low-volume stocks behave unpredictably**  
  Prices can jump randomly with minimal trades.
- **Provider dependency**  
  Portfolium depends on external data (yfinance). Missing or delayed data can impact accuracy.

Volume and average volume together provide one of the quickest ways to judge a stock's liquidity and the strength of current market interest.
