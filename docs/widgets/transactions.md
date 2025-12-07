# Recent Transactions

The **Recent Transactions** widget shows a quick timeline of your **latest activity** in the selected portfolio.  
It helps you review what you've just bought, sold or received without leaving the Dashboard.

---

## What It Shows

For each transaction (up to the most recent 5), the widget displays:

- **Asset logo**, **symbol**, and **name**  
- **Type badge**, with color coding:

    - Green → **Buy**
    - Red → **Sell**
    - Blue → **Dividend**
    - Purple → **Split**
    - Orange → **Fee**

- **Amount**:

    - For BUY/SELL/DIVIDEND/FEE → total cash amount (quantity × price) in your portfolio currency  
    - For SPLIT → split ratio (e.g. `2:1`)

- **Extra line with details**:

    - For normal trades → `quantity @ price` (e.g. `10 @ $175.50`)  
    - For splits → split ratio text

- **Date and "time ago"**:

    - Example: `Apr 12 – 2 days ago`
    - Automatically formatted in your language

If there are no recent transactions, the widget shows an empty state message instead.

---

## How It Works

- The widget loads the **most recent transactions** for the active portfolio (from the API or batch data).  
- Each transaction is classified by **type** (`BUY`, `SELL`, `DIVIDEND`, `SPLIT`, `FEE`, etc.) and mapped to a **label + badge color**.  
- For monetary transactions, the total amount is calculated as:

  > **Total Amount = Quantity × Price**

- All amounts are **formatted in your portfolio's base currency**.  
- Dates are formatted using your current **interface language** and shown both as a calendar date and as a relative time ("x days ago").

---

## Example

A BUY transaction might be displayed as:

- Symbol: **AAPL**  
- Type: **Buy** (green badge)  
- Amount: **$1,755.00**  
- Detail line: **10 @ $175.50**  
- Date: **Apr 10 – 2 days ago**

A dividend transaction might look like:

- Symbol: **MSFT**  
- Type: **Dividend** (blue badge)  
- Amount: **$125.00**  
- Detail line: **1 @ $125.00** (or note text if available)  
- Date: **Apr 7 – 5 days ago**

A stock split might show:

- Symbol: **GOOGL**  
- Type: **Split** (purple badge)  
- Amount: **2:1**  
- Detail line: **2-for-1 stock split**  

---

## When To Use It

The Recent Transactions widget is useful for:

- Quickly checking **what changed recently** in your portfolio  
- Verifying that your **last orders** were recorded correctly  
- Reviewing **dividends, fees, and splits** without opening the full Transactions page  
- Keeping an eye on your activity after an intense trading session  

---

## Notes

- The widget only shows transactions for the **currently selected portfolio** 
- For more advanced filters and full history, use the **Transactions** page
- Currency and date formatting follow your **portfolio settings** and **interface language** 
- Split transactions display **split ratios** instead of cash amounts
