# Email Configuration

## Overview

Portfolium can send transactional and notification emails (account verification, password
reset, welcome messages, daily portfolio reports) over SMTP. Administrators configure and
test the SMTP connection from the **Email** tab of the Admin dashboard, without needing to
restart the API.

## Accessing the Email tab

1. Sign in as a user with admin privileges (`is_admin` or `is_superuser`).
2. Open the Admin dashboard and click the **Email** tab (next to **Users** and **Logs**).
3. The current configuration and email statistics load automatically.

The tab is implemented by `AdminEmailTab` (`web/src/features/admin/components/AdminEmailTab.tsx`),
backed by the `useAdminEmail` hook (`web/src/features/admin/hooks/useAdminEmail.ts`), which calls
the admin email functions in `web/src/api/admin.ts`.

## Configuration fields

The configuration form exposes the following fields, all persisted together when you click **Save**:

| Field | Type | Description |
|---|---|---|
| `enable_email` | boolean | Master switch for the email system. When off, test emails and outgoing notification emails are not sent. |
| `smtp_host` | string | SMTP server hostname (e.g. `smtp.gmail.com`). |
| `smtp_port` | integer | SMTP server port (e.g. `587` for STARTTLS, `465` for SSL). |
| `smtp_user` | string | SMTP username. |
| `smtp_password` | string | SMTP password. Never returned by the API — always masked as `********` in responses when a password is set. |
| `smtp_tls` | boolean | Whether to use TLS (STARTTLS) when connecting. |
| `from_email` | string (email) | The address emails are sent from. |
| `from_name` | string | The display name used as the sender. |
| `frontend_url` | string | Base URL used to build links inside email templates (e.g. verification/reset links). |

All fields are optional on update — only the fields you send are changed.

## Backend endpoints

Implemented in `api/app/routers/admin.py`. All endpoints require an authenticated admin user
(`get_current_admin_user` dependency — `is_admin` or `is_superuser`) and are mounted under
`/api/admin/email/...`.

### Get current configuration

```http
GET /api/admin/email/config
Authorization: Bearer {admin_token}
```

Returns the stored configuration. The password field is masked (`"********"`) if a password
is set, `null` otherwise.

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

### Update configuration

```http
PATCH /api/admin/email/config
Authorization: Bearer {admin_token}
Content-Type: application/json
```

Request body — any subset of the fields listed above:

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
  "frontend_url": "https://portfolium.example.com"
}
```

Response: the updated configuration, in the same shape as `GET`.

### Send a test email

```http
POST /api/admin/email/test
Authorization: Bearer {admin_token}
Content-Type: application/json
```

Request body:

```json
{
  "to_email": "test@example.com",
  "test_type": "simple"
}
```

`test_type` selects which email is sent:

| Value | What it sends |
|---|---|
| `simple` (default) | A basic HTML/text test message showing the active SMTP host, port, encryption mode, and from address. |
| `verification` | The account verification email template, using a placeholder token and the requesting admin's preferred language. |
| `password_reset` | The password reset email template, using a placeholder token and the requesting admin's preferred language. |
| `welcome` | The welcome email template, using the requesting admin's preferred language. |
| `daily_report` | The daily portfolio report email, with a generated PDF attached per portfolio. If `to_email` matches an existing user, that user's portfolios and language preference are used; otherwise the requesting admin's own portfolios are used. Fails if the resolved user has no portfolios. |

If `enable_email` is currently `false`, this endpoint returns `503 Service Unavailable`
before attempting to send anything.

Success response:

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

### Get email statistics

```http
GET /api/admin/email/stats
Authorization: Bearer {admin_token}
```

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

`smtp_configured` is `true` when both a SMTP host and SMTP user are currently set.
Counts only include active users (`is_active = true`).

## Persistence behavior

Configuration is **persisted to the database**, in a single-row `config` table (columns:
`smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `smtp_tls`, `from_email`, `from_name`,
`frontend_url`, `enable_email`, `updated_at`). `PATCH` writes the changed fields to this row
and also updates the in-memory `settings` object for the current process, then reloads the
email service so the new values take effect immediately — no API restart is required.

`GET` reads from the `config` table first; if no row exists yet, it falls back to the
`.env`-sourced application settings (`app/config.py`) so the form has sensible defaults on a
fresh install.

This means configuration changes made through the Email tab survive an API restart — they are
not lost like a purely in-memory setting would be, and they do not require editing `.env`.

## Troubleshooting

The **Send Test Email** action is the primary way to validate a configuration change before
relying on it for real notifications. Failures generally fall into one of these categories:

- **Connection issues** — the SMTP host/port is unreachable (wrong host, wrong port, or
  outbound SMTP blocked by a firewall/network). The API distinguishes timeouts from generic
  connection failures where possible.
- **Authentication failures** — invalid SMTP username/password. Many providers (e.g. Gmail)
  require an app-specific password rather than the account password when 2FA is enabled.
- **TLS/encryption mismatches** — `smtp_tls` doesn't match what the port/provider expects
  (e.g. STARTTLS on port 587 vs. implicit SSL on port 465).

General checklist:

1. Confirm `enable_email` is `true` — while disabled, test emails are rejected outright.
2. Double-check `smtp_host`, `smtp_port`, and `smtp_tls` against your provider's documented
   settings.
3. Re-enter `smtp_user`/`smtp_password` — passwords are never echoed back by the API, so a
   save that didn't include a password leaves the previously stored one in place.
4. Check the API logs for the underlying SMTP error:
   ```bash
   docker compose logs api | grep -i "email\|smtp"
   ```
5. Try a different `test_type` — a `simple` failure points to a connectivity/auth problem;
   if `simple` succeeds but `daily_report` fails, the issue is more likely in report
   generation (e.g. the target user has no portfolios) than in SMTP itself.
