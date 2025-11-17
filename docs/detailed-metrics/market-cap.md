## Market Capitalization

### What It Shows
Market Capitalization (often shortened to *market cap*) represents the **total market value of a company's equity**.

It answers the question:
> "How much would it cost to buy the entire company at current market prices?"

In Portfolium, it helps you quickly understand:

- how big the company is,
- the kind of risk profile it usually has,
- whether you are dealing with a tiny speculative stock or a global giant.

It is a **size and profile metric**, not a direct measure of how "good" or "cheap" the company is.

---

### How It's Calculated
Market cap is based on the company's share price and the number of shares in circulation.

$$
\text{Market Cap} = \text{Current Share Price} \times \text{Shares Outstanding}
$$

So:
- if the **share price goes up**, market cap goes up;
- if the **company issues more shares**, market cap goes up;
- if the **share price falls**, market cap goes down.

Portfolium does **not** compute this manually from raw share counts.  
Instead, it pulls the value from the data provider (e.g. yfinance's `marketCap` field) and uses that as the reference.

Internally, Portfolium then classifies the company into size buckets based on this value:

- **Mega Cap**: $\text{Market Cap} \ge 200\,\text{B}$
- **Large Cap**: $\text{Market Cap} \ge 10\,\text{B}$
- **Mid Cap**: $\text{Market Cap} \ge 2\,\text{B}$
- **Small Cap**: $\text{Market Cap} \ge 300\,\text{M}$
- **Micro Cap**: $\text{Market Cap} < 300\,\text{M}$

These thresholds are used to generate the textual conclusion shown under the card (e.g. "Mega cap tech giant", "Small cap, higher risk", etc.).

---

### Example

**Example 1 — Mega Cap**

- Current share price: $125\,\$$
- Shares outstanding: $2\,000\,000\,000$

$$
\text{Market Cap} = 125 \times 2\,000\,000\,000 = 250\,000\,000\,000\,\$ = 250\,\text{B}
$$

Portfolium classifies this as **Mega Cap**.

---

**Example 2 — Small Cap**

- Current share price: $9\,\$$
- Shares outstanding: $50\,000\,000$

$$
\text{Market Cap} = 9 \times 50\,000\,000 = 450\,000\,000\,\$ = 450\,\text{M}
$$

Portfolium classifies this as **Small Cap**.

---

### When To Use It
Use market cap to:

- **Compare company size** inside a sector  
  e.g. large-cap bank vs. small regional bank.
- **Understand risk profile**  
  Smaller caps usually have more volatility and business risk.
- **Balance your portfolio**  
  For example, you might not want 80% of your portfolio in micro caps.
- **Interpret other metrics**  
  Growth rates or margins can be viewed differently depending on whether the business is tiny or huge.

It's particularly useful when:
- you are screening new stocks,
- you want to check if a position is a "small speculative bet" or a "core blue-chip holding",
- you are building a diversified portfolio across size segments (large/mid/small).

---

### Notes & Limitations

- **Not a valuation metric**  
  A high market cap does **not** mean the stock is expensive or overvalued. It only means the company is large.
- **Price-driven and dynamic**  
  Market cap changes continuously with the share price. Big moves in price can temporarily push a company into a different bucket (e.g. from mid cap to small cap).
- **Share count matters**  
  Share buybacks and new share issues change the number of shares outstanding, which affects market cap even if the price stays flat.
- **Data-source dependent**  
  Portfolium relies on external data (yfinance). If the provider data is missing or outdated, the metric may be unavailable or temporarily inaccurate.
