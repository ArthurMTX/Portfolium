# Daily Portfolio Reports

## Overview

The Daily Portfolio Reports feature automatically generates and emails comprehensive PDF reports to users at the end of each trading day. These reports provide a complete overview of portfolio performance, daily changes, transactions, and asset allocation.

## Features

Each daily report includes:

### 📊 Portfolio Summary
- Total portfolio value
- Total cost basis
- Unrealized profit/loss (P&L)
- P&L percentage
- Number of holdings
- Total dividends received
- Total fees paid

### 🌡️ Daily Performance Heatmap
A visual heatmap showing daily performance of all holdings, with:
- Grid layout sized proportionally by market value
- Color-coded by daily percentage change (red for losses, green for gains)
- Asset logos for visual recognition
- All positions displayed (no limit)
- Responsive grid that adapts to portfolio size

### 📈 Holdings & Daily Changes
Detailed table of all positions including:
- Asset symbol with logo
- Quantity held
- Average cost
- Current price
- Market value
- Unrealized P&L (color-coded: green for gains, red for losses)
- **Daily change percentage** (key metric!)

### 🔄 Recent Activity
All transactions from the report date:
- Transaction type indicators (🟢 BUY, 🔴 SELL, 💰 DIVIDEND, etc.)
- Asset symbol with logo
- Quantity and price
- Total amount
- Fees (if applicable)

### 🥧 Asset Allocation
Visual representation showing:
- Distribution of assets in your portfolio (no longer included in PDF)
- This feature is available on the web dashboard

!!! note "PDF Content Update"
    The daily report PDF has been redesigned to focus on key metrics and daily changes. Asset allocation pie charts are available on the web dashboard's Portfolio page.

## Enabling Daily Reports

### For Users

1. Navigate to **Settings** → **Notifications**
2. Scroll to the "**Daily Portfolio Reports**" section
3. Toggle "Enable daily portfolio reports" on
4. Click "**Save Notification Settings**"
5. Reports will be sent weekdays at **4:00 PM ET** (after US market close)
6. Check your email for the PDF attachment
7. You'll also receive an in-app notification confirming delivery

!!! tip "When Reports Are Sent"
    Reports are sent Monday through Friday at 4:00 PM Eastern Time, right after the US stock market closes. No reports are sent on weekends or when markets are closed.

### Notification Confirmation

After each successful report delivery, you'll receive an in-app notification:

- **Title**: "📊 Daily Portfolio Report Sent"
- **Message**: Confirms the report date and your email address
- **Metadata**: Includes number of portfolios in the report

This provides transparency and confirmation that your report was generated and emailed successfully.

### For Administrators

Daily reports can be enabled/disabled per user in the database (though users can now control this via Settings):

```sql
-- Enable daily reports for a user
UPDATE portfolio.users 
SET daily_report_enabled = TRUE 
WHERE email = 'user@example.com';

-- Disable daily reports for a user
UPDATE portfolio.users 
SET daily_report_enabled = FALSE 
WHERE email = 'user@example.com';
```

## Email Configuration

Daily reports require email to be enabled. Set the following environment variables:

```env
ENABLE_EMAIL=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_TLS=true
FROM_EMAIL=noreply@example.com
FROM_NAME=Portfolium
```

## Report Schedule

Reports are generated and sent:
- **Time**: 4:00 PM ET (16:00 Eastern Time)
- **Frequency**: Weekdays only (Monday-Friday)
- **Report Date**: Previous trading day
- **Delivery**: Email with PDF attachment
- **Confirmation**: In-app notification upon successful delivery

This timing ensures:
- US markets have closed (4:00 PM EST standard close)
- After-hours trading has begun
- Price data has settled and is accurate
- Reports align with end-of-day market activity
- No weekend emails (markets are closed)

## Technical Details

### Components

1. **PDF Generation Service** (`app/services/pdf_reports.py`)
   - Uses **WeasyPrint** for HTML-to-PDF conversion
   - CSS Grid and Flexbox for layout
   - Beautiful pink gradient theme matching web app
   - Base64-encoded asset logos
   - Async operations for efficiency

2. **Email Service** (`app/services/email.py`)
   - MIME multipart emails with PDF attachments
   - HTML and plain text email bodies

3. **Scheduler Task** (`app/tasks/scheduler.py`)
   - APScheduler cron job at 4:00 PM ET on weekdays
   - Async execution to prevent blocking
   - Error handling and logging
   - Automatic notification creation on success

4. **Notification Service** (`app/services/notifications.py`)
   - Creates system notification after successful delivery
   - Includes report metadata
   - Provides user confirmation

### Database Schema

```sql
ALTER TABLE portfolio.users 
ADD COLUMN daily_report_enabled BOOLEAN DEFAULT FALSE;
```

### Dependencies

New packages added to `pyproject.toml`:
- `weasyprint>=66.0` - HTML/CSS to PDF conversion
- `pillow>=10.0.0` - Image processing for logos

System dependencies (Docker):
- `libpango-1.0-0` - Text rendering
- `libpangoft2-1.0-0` - Font support
- `libgdk-pixbuf-2.0-0` - Image loading
- `libffi-dev` - Foreign function interface
- `shared-mime-info` - MIME type detection

## Troubleshooting

### Reports Not Received

1. **Check user settings**: Verify `daily_report_enabled = TRUE` in database
2. **Verify email configuration**: Ensure SMTP settings are correct
3. **Check logs**: Look for errors in `api/logs/app.log.*`
4. **Portfolio data**: Users must have at least one portfolio with transactions

### Email Delivery Issues

- Check spam/junk folder
- Verify SMTP credentials
- Check email service quotas (e.g., Gmail daily limits)
- Review error logs for SMTP connection issues

### PDF Generation Errors

Common issues:
- Missing position data: Ensure portfolios have current price data
- Chart generation: Matplotlib requires working directory access
- Memory: Large portfolios may require more memory

## Future Enhancements

Potential improvements:
- Weekly/monthly report options
- Customizable report content
- Report delivery time preferences
- Historical report archive
- Performance benchmarking in reports
- Tax loss/gain summaries

## API Integration

For programmatic access, you can generate reports on-demand:

```python
from app.services.pdf_reports import PDFReportService

# Generate report for specific user/portfolio
pdf_service = PDFReportService(db)
pdf_bytes = await pdf_service.generate_daily_report(
    user_id=1,
    portfolio_id=1,  # Optional: specific portfolio
    report_date=date(2025, 10, 29)  # Optional: specific date
)

# pdf_bytes can be saved to file or sent via email
```

## Security & Privacy

- Reports are sent only to verified email addresses
- PDF attachments are generated in-memory (not saved to disk)
- Email configuration uses secure SMTP/TLS
- Users can opt-out anytime via settings
- Reports contain sensitive financial data - use secure email

---

**Note**: This feature requires active email configuration and at least one portfolio with transaction history. Users with no portfolios or transactions will not receive reports.
