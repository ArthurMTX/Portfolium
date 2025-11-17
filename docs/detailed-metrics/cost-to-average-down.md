## Cost to Average Down

### What It Shows
**Cost to Average Down** tells you how much additional money you would need to invest to **reduce your average cost per share** (breakeven price) by a specific amount.

In Portfolium, this metric answers:

- "How much must I invest to lower my average cost by 5%?"
- "How many shares do I need to buy at today's price to meaningfully improve my position?"
- "Is averaging down financially realistic or too expensive?"

Portfolium uses a **–5% target** by default (i.e., lowering your average cost to 95% of the current average).

---

### How It's Calculated

Portfolium defines a *target average cost*:

$$
P_{\text{target}} = 0.95 \times P_{\text{avg}}
$$

We want to know how many additional shares $(x)$ you must buy at the **current price** $(P_{\text{cur}})$ to reach this new, lower average cost.

The formula for new average cost after buying $(x)$ shares is:

$$
P_{\text{new}} = \frac{Q \cdot P_{\text{avg}} + x \cdot P_{\text{cur}}}{Q + x}
$$

We solve the equation:

$$
P_{\text{new}} = P_{\text{target}}
$$

This leads to:

$$
x 
= \frac{(P_{\text{avg}} - P_{\text{target}}) \cdot Q}{P_{\text{target}} - P_{\text{cur}}}
$$

And the **cost to average down** is:

$$
\text{Cost} = x \times P_{\text{cur}}
$$

Portfolium only computes this metric when:

- the position is **negative** (you are in a loss),
- the current price is **below** the average cost,
- the target average cost is **above** the current price.

---

### Example

**Suppose:**

- Current shares: $(Q = 10)$
- Average cost: $(P_{\text{avg}} = 100\,\$)$
- Current price: $(P_{\text{cur}} = 80\,\$)$
- Target average cost: $P_{\text{target}} = 0.95 \times 100 = 95\,\$$

Compute required shares:

$$
x = \frac{(100 - 95) \cdot 10}{95 - 80}
= \frac{50}{15}
\approx 3.33 \text{ shares}
$$

Cost:

$$
3.33 \times 80 = 266.67\,\$
$$

So you would need to invest $\$266.67$ to bring your average cost from $\$100 \rightarrow \$95$.

---

### When To Use It
This metric is useful when:

- you want to know if **averaging down is financially reasonable**,  
- you want a **concrete cost estimate** instead of guessing,
- you're trying to calculate how much more capital is required to recover faster,
- you want to evaluate the **risk–reward trade-off** before adding to a losing position.

It is especially helpful when:

- managing long-term stock positions,
- considering whether adding to a losing trade is worth it,
- building a disciplined averaging strategy.

---

### Notes & Limitations

- **Averaging down increases exposure**  
  You are committing more capital to a losing position.
- **Does not guarantee recovery**  
  Even after lowering your average, the stock may continue to fall.
- **Price must be below your target**  
  If the stock rebounds too fast, the calculation becomes irrelevant.
- **Volatile or speculative assets**  
  Averaging down in high-risk assets can amplify losses dramatically.
- **Not calculated for profitable positions**  
  If you are already above breakeven, there is nothing to "average down."

This metric should be used thoughtfully, not as a justification to blindly add to losing trades, but as a tool to evaluate whether doing so makes financial sense.
