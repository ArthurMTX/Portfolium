# Bitcoin Pizza Index

The **Bitcoin Pizza Index** widget is a fun, historical metric that shows how much the famous **[10,000 BTC pizza purchase](https://bitcoinwiki.org/wiki/laszlo-hanyecz)** would be worth today.  
It multiplies the current **BTC-USD price** by **10,000 BTC** and displays the result in US dollars.

This widget is for **context and curiosity**, not for portfolio risk or performance analysis.

---

## What It Shows

The widget displays:

- The **current value of 10,000 BTC** in USD, e.g. **$1,000,000,000**  
- A small line with the current **BTC price**, e.g. `BTC @ $100,000`  
- A short subtitle reminding you that this index is based on the original “Bitcoin pizza” trade

Behavior:

- In **normal mode**, the price is fetched live from your data provider (`BTC-USD`)  
- In **preview mode**, a mock BTC price is used (e.g. `$100,000`) so the widget always shows a meaningful value  
- If the BTC price cannot be retrieved, the value falls back to **`N/A`**

This metric answers the question:  
> "How much would the original 10,000 BTC pizza be worth at today’s BTC price?"

---

## How It's Calculated

The index is calculated using a simple formula:

1. Fetch the **current BTC-USD price**:

   - From the prices API under the symbol **`BTC-USD`**
   - If the price is a string, it is converted to a number
   - If no valid price is available, the widget shows **`N/A`**

2. Multiply this price by **10,000 BTC**:

   $$
   \text{Bitcoin Pizza Index} =
   \text{BTC Price (USD)} \times 10{,}000
   $$

3. Format the result as a large USD amount:

   - No decimal places  
   - Thousands separators (commas or local equivalent), e.g. `$1,234,567,890`

4. Display a secondary line for the BTC price itself:

   - For example: `BTC @ $98,500`

---

## Example

Assume the current BTC price is:

- **BTC-USD = $68,500**

Then:

$$
\text{Bitcoin Pizza Index} =
68{,}500 \times 10{,}000 = 685{,}000{,}000
$$

The widget would display:

- Main value: **`$685,000,000`**  
- Secondary line: **`BTC @ $68,500`**

If the API fails or returns no valid price, the widget would show:

- **`N/A`** and no BTC price line.

---

## When To Use It

The Bitcoin Pizza Index widget is useful for:

- Getting a **fun, emotional benchmark** of how far Bitcoin has come  
- Adding a bit of **context and perspective** to your crypto dashboard  
- Explaining the **opportunity cost** of early Bitcoin spending  
- Creating a more engaging experience when reviewing your portfolio

It is **not** intended as a technical risk metric or a replacement for performance analytics. I just find it funny :)

---

## Notes

- The widget does **not** depend on your portfolio positions, it is based solely on the **global BTC-USD price**  
- Values are always shown in **USD**, regardless of your portfolio base currency  
- If no reliable BTC-USD price is available, the widget gracefully falls back to **`N/A`**
