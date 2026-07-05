# Authentication

Portfolium uses JWT bearer authentication for API access. Most product routes require an active authenticated user, and admin routes additionally require admin privileges.

## Login Flow

The login endpoint uses OAuth2 password form data, not a JSON body.

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@example.com" \
  -d "password=your-password"
```

Successful response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "username": "admin",
    "is_active": true,
    "is_admin": true
  }
}
```

Use the token on protected requests:

```bash
curl http://localhost:8000/portfolios \
  -H "Authorization: Bearer $PORTFOLIUM_TOKEN"
```

## Registration

If `ALLOW_REGISTRATION=true`, users can register through:

```http
POST /auth/register
```

When email is enabled, new users must verify their email address before full access. When email is disabled, verification emails are not sent.

## Current User

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/auth/me` | Read the current user profile |
| `PUT` | `/auth/me` | Update username, email, full name, or preferred language |
| `POST` | `/auth/change-password` | Change password while authenticated |
| `DELETE` | `/auth/account` | Delete the current account |

Changing the email marks the account as unverified and generates a new verification token when email verification is active.

## Password Recovery

Password recovery depends on email configuration:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/forgot-password` | Create a reset token and send a reset email |
| `POST` | `/auth/reset-password` | Set a new password using the reset token |

Configure SMTP settings in [Configuration](../getting-started/configuration.md) before relying on password recovery in production.

## Two-Factor Authentication

Portfolium supports TOTP-based two-factor authentication.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/auth/2fa/status` | Check whether 2FA is enabled |
| `POST` | `/auth/2fa/setup` | Generate the TOTP secret, QR payload, and backup codes |
| `POST` | `/auth/2fa/verify` | Confirm setup with a valid TOTP code |
| `POST` | `/auth/2fa/login` | Complete login when 2FA is required |
| `POST` | `/auth/2fa/disable` | Disable 2FA after password and token confirmation |
| `POST` | `/auth/2fa/regenerate-backup-codes` | Replace backup codes |

If a user with 2FA enabled submits valid email/password credentials to `/auth/login`, the API rejects the login with a 2FA-required error. The client must then call `/auth/2fa/login` with the email, password, and TOTP or backup code.

## Rate Limits

Authentication-sensitive routes are rate-limited by scope. These settings live in `api/app/config.py`:

| Variable | Default | Applies to |
| --- | --- | --- |
| `AUTH_LOGIN_RATE_LIMIT` | `10` | Login attempts |
| `AUTH_REGISTER_RATE_LIMIT` | `5` | Registration attempts |
| `AUTH_RECOVERY_RATE_LIMIT` | `5` | Password recovery and reset |
| `AUTH_TOKEN_RATE_LIMIT` | `20` | Token-sensitive actions |
| `AUTH_2FA_RATE_LIMIT` | `10` | 2FA verification/login |

Each limit has a matching `*_RATE_WINDOW_SECONDS` setting.

## Production Requirements

- Set `SECRET_KEY` to a random value of at least 32 characters.
- Keep `ACCESS_TOKEN_EXPIRE_MINUTES` within an acceptable risk window for your deployment.
- Configure `TRUSTED_PROXY_IPS` when serving behind a reverse proxy and relying on real client IP detection.
- Disable public registration with `ALLOW_REGISTRATION=false` if the instance is private.
- Configure SMTP before depending on email verification or password recovery.
