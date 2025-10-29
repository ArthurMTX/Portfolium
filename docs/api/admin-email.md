# Admin Email Configuration & Testing

## Overview

The admin panel provides comprehensive email configuration management and testing capabilities. Administrators can view, update, and test email settings without restarting the server.

## Endpoints

### Get Email Configuration

```http
GET /api/admin/email/config
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "enable_email": true,
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "your-email@gmail.com",
  "smtp_password": "********",
  "smtp_tls": true,
  "from_email": "noreply@example.com",
  "from_name": "Portfolium",
  "frontend_url": "http://localhost:5173"
}
```

**Note:** Password is always masked in responses for security.

---

### Update Email Configuration

```http
PATCH /api/admin/email/config
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "enable_email": true,
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "your-email@gmail.com",
  "smtp_password": "your-app-password",
  "smtp_tls": true,
  "from_email": "noreply@example.com",
  "from_name": "Portfolium",
  "frontend_url": "http://localhost:5173"
}
```

All fields are optional. Only provided fields will be updated.

**Response:** Same as GET config endpoint

**Important Notes:**
- Changes are applied immediately at runtime
- Changes are **NOT** persisted to `.env` file
- To make changes permanent, update `.env` manually
- Useful for testing different SMTP providers without server restart

---

### Test Email Connection

```http
POST /api/admin/email/test
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "to_email": "test@example.com",
  "test_type": "simple"
}
```

**Test Types:**

1. **`simple`** - Basic test email with current configuration details
2. **`verification`** - Test the email verification template
3. **`password_reset`** - Test the password reset template
4. **`daily_report`** - Test daily report email with PDF (requires user with portfolios)

**Response (Success):**
```json
{
  "success": true,
  "message": "Test email sent successfully to test@example.com",
  "test_type": "simple",
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "from_email": "noreply@example.com"
}
```

**Response (Error):**
```json
{
  "detail": "Email test failed: [SMTP] Connection refused"
}
```

---

### Get Email Statistics

```http
GET /api/admin/email/stats
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "total_active_users": 25,
  "verified_users": 20,
  "email_enabled": true,
  "notifications": {
    "daily_reports_enabled": 12,
    "daily_changes_enabled": 18,
    "transaction_notifications_enabled": 15
  },
  "smtp_configured": true
}
```

---

## Common Use Cases

### 1. Initial Email Setup

```bash
# 1. Configure SMTP settings
curl -X PATCH http://localhost:8000/api/admin/email/config \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enable_email": true,
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 587,
    "smtp_user": "your-email@gmail.com",
    "smtp_password": "your-app-password",
    "smtp_tls": true,
    "from_email": "noreply@example.com"
  }'

# 2. Test the configuration
curl -X POST http://localhost:8000/api/admin/email/test \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_email": "admin@example.com",
    "test_type": "simple"
  }'
```

### 2. Switching SMTP Providers

```bash
# Switch from Gmail to SendGrid
curl -X PATCH http://localhost:8000/api/admin/email/config \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "smtp_host": "smtp.sendgrid.net",
    "smtp_port": 587,
    "smtp_user": "apikey",
    "smtp_password": "YOUR_SENDGRID_API_KEY"
  }'
```

### 3. Testing Email Templates

```bash
# Test verification email
curl -X POST http://localhost:8000/api/admin/email/test \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_email": "test@example.com",
    "test_type": "verification"
  }'

# Test password reset email
curl -X POST http://localhost:8000/api/admin/email/test \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_email": "test@example.com",
    "test_type": "password_reset"
  }'

# Test daily report (requires existing user with portfolios)
curl -X POST http://localhost:8000/api/admin/email/test \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_email": "user@example.com",
    "test_type": "daily_report"
  }'
```

### 4. Temporarily Disable Email

```bash
# Disable email without losing configuration
curl -X PATCH http://localhost:8000/api/admin/email/config \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enable_email": false
  }'

# Re-enable later
curl -X PATCH http://localhost:8000/api/admin/email/config \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enable_email": true
  }'
```

---

## SMTP Provider Configuration Examples

### Gmail

```json
{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "your-email@gmail.com",
  "smtp_password": "your-app-password",
  "smtp_tls": true
}
```

**Important:** Use [App Passwords](https://support.google.com/accounts/answer/185833) for Gmail

### SendGrid

```json
{
  "smtp_host": "smtp.sendgrid.net",
  "smtp_port": 587,
  "smtp_user": "apikey",
  "smtp_password": "YOUR_SENDGRID_API_KEY",
  "smtp_tls": true
}
```

### Amazon SES

```json
{
  "smtp_host": "email-smtp.us-east-1.amazonaws.com",
  "smtp_port": 587,
  "smtp_user": "YOUR_SMTP_USERNAME",
  "smtp_password": "YOUR_SMTP_PASSWORD",
  "smtp_tls": true
}
```

### Mailgun

```json
{
  "smtp_host": "smtp.mailgun.org",
  "smtp_port": 587,
  "smtp_user": "postmaster@your-domain.mailgun.org",
  "smtp_password": "YOUR_SMTP_PASSWORD",
  "smtp_tls": true
}
```

### Office 365

```json
{
  "smtp_host": "smtp.office365.com",
  "smtp_port": 587,
  "smtp_user": "your-email@yourdomain.com",
  "smtp_password": "your-password",
  "smtp_tls": true
}
```

---

## Troubleshooting

### Connection Refused

**Error:** `[SMTP] Connection refused`

**Solutions:**
- Check SMTP host and port
- Verify firewall allows outbound SMTP connections
- Ensure TLS setting matches provider requirements
- Try port 465 (SSL) instead of 587 (TLS)

### Authentication Failed

**Error:** `[SMTP] Authentication failed`

**Solutions:**
- Verify username and password
- For Gmail: Use App Password, not account password
- Check if 2FA is enabled (requires app-specific password)
- Verify account is not locked or suspended

### TLS/SSL Errors

**Error:** `[SSL] certificate verify failed`

**Solutions:**
- Ensure `smtp_tls` matches provider requirements
- Try different port (587 for TLS, 465 for SSL)
- Check server certificates are up to date

### Emails in Spam

**Solutions:**
- Configure SPF records for your domain
- Set up DKIM signing
- Use verified sender email address
- Avoid spam trigger words in templates

### Test Email Not Received

**Checklist:**
1. Check spam/junk folder
2. Verify `to_email` address is correct
3. Check API response for errors
4. Review API logs: `docker compose logs api | grep email`
5. Ensure `enable_email` is `true`
6. Verify SMTP credentials are correct

---

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use App Passwords** for services that support them (Gmail, etc.)
3. **Rotate credentials** regularly
4. **Monitor email logs** for suspicious activity
5. **Limit admin access** to authorized personnel only
6. **Use environment variables** for production credentials
7. **Enable rate limiting** to prevent abuse

---

## Making Changes Permanent

To persist email configuration changes:

1. Update `.env` file in project root:
```env
ENABLE_EMAIL=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_TLS=true
FROM_EMAIL=noreply@example.com
FROM_NAME=Portfolium
FRONTEND_URL=http://localhost:5173
```

2. Restart the API:
```bash
docker compose restart api
```

---

## Monitoring

### Check Email Statistics

```bash
curl -X GET http://localhost:8000/api/admin/email/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

Monitor:
- Total users with email notifications enabled
- Daily report subscriptions
- SMTP configuration status

### Check Logs

```bash
# View email-related logs
docker compose logs api | grep -i "email\|smtp"

# Watch logs in real-time
docker compose logs -f api | grep -i email
```

---

## API Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (invalid parameters) |
| 401 | Unauthorized (invalid or missing admin token) |
| 403 | Forbidden (not an admin user) |
| 500 | Server error (SMTP connection failed, etc.) |

---

## Example Admin Panel Integration

For frontend developers building the admin panel:

```typescript
// Get current email config
async function getEmailConfig() {
  const response = await fetch('/api/admin/email/config', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  return response.json();
}

// Update email config
async function updateEmailConfig(config: Partial<EmailConfig>) {
  const response = await fetch('/api/admin/email/config', {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  });
  return response.json();
}

// Test email
async function testEmail(toEmail: string, testType: string) {
  const response = await fetch('/api/admin/email/test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ to_email: toEmail, test_type: testType })
  });
  return response.json();
}

// Get email stats
async function getEmailStats() {
  const response = await fetch('/api/admin/email/stats', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  return response.json();
}
```

---

## Summary

The admin email configuration system provides:

✅ **Real-time configuration** - Update settings without restart  
✅ **Testing capabilities** - Test all email templates  
✅ **Security** - Passwords are masked in responses  
✅ **Statistics** - Monitor email usage across users  
✅ **Multiple providers** - Easy switching between SMTP services  
✅ **Comprehensive error handling** - Detailed error messages  

Perfect for managing email infrastructure in production environments!
