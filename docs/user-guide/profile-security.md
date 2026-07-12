# Profile & Security

Manage your personal details, password, and account protection from one place.

## Overview

Your Profile page brings together everything related to your identity in Portfolium: the information other parts of the app use to address you, the credentials that protect your account, and the option to permanently close your account if you ever need to.

The page is organized into three tabs:

- **Profile** — your name, username, and email address
- **Security** — password changes and two-factor authentication
- **Danger Zone** — permanent account deletion

## Accessing Your Profile

1. Log in to Portfolium
2. Open your account menu
3. Select **Profile**
4. Choose a tab: **Profile**, **Security**, or **Danger Zone**

Your verification status (whether your email has been confirmed) is always visible at the top of the page.

## Editing Your Profile

On the **Profile** tab you can update:

- **Full name** — displayed across the app
- **Username** — your unique handle
- **Email address** — used for login and notifications

Update any field and click **Save**. If nothing has changed, Portfolium tells you there is nothing to update rather than submitting an empty request.

!!! note "Changing your email"
    If you change your email address, Portfolium treats the new address as unverified until you confirm it. You can trigger a new confirmation message from the same tab using **Resend verification**.

!!! tip "Unverified email"
    If your email is not yet verified, a status indicator appears next to the email field. Use the resend option if the original confirmation message expired or never arrived.

## Changing Your Password

Password changes live on the **Security** tab, alongside two-factor authentication.

1. Go to **Profile → Security**
2. Enter your **current password**
3. Enter a **new password** (minimum 8 characters)
4. Confirm the new password
5. Click **Save**

Portfolium checks that the new password meets the minimum length and that both new-password fields match before submitting the change. Your current password must be correct — Portfolium will not let you set a new password without verifying the old one first.

## Two-Factor Authentication (2FA)

Two-factor authentication adds a second, time-based check to your login, on top of your password. Portfolium implements this using **TOTP** (Time-based One-Time Password), the same standard used by apps like Google Authenticator, Authy, or 1Password.

### How It's Organized

The 2FA card on the **Security** tab shows:

- Whether 2FA is currently **enabled** or **disabled**
- The number of **backup codes remaining**, once enabled

!!! warning "Low backup codes"
    If you have fewer than $3$ backup codes left, Portfolium displays a warning so you can regenerate a fresh set before you run out.

### Enabling 2FA

1. On the **Security** tab, click **Enable** next to Two-Factor Authentication
2. Portfolium generates a unique secret and displays a **QR code**
3. Scan the QR code with your authenticator app, or copy the secret and enter it manually
4. Enter the current **6-digit code** shown in your authenticator app to confirm the setup
5. Portfolium shows you a set of **backup codes** — save or download them before continuing
6. Click **Done** to finish

!!! warning "Save your backup codes"
    You cannot finish setup without copying or downloading at least one backup code. These codes are your only way back into your account if you lose access to your authenticator app, so store them somewhere safe (a password manager or printed copy), not just in your inbox.

Backup codes are one-time use, formatted as three groups of four characters (for example `A1B2-C3D4-E5F6`). Portfolium generates $10$ of them each time a new set is issued.

### Logging In With 2FA

Once enabled, every login asks for your password first, then a second step:

- Enter the current 6-digit code from your authenticator app, **or**
- Click **Use backup code** and enter one of your saved backup codes instead

Each backup code can only be used once. After it's used, it's removed from your available set.

### Regenerating Backup Codes

If you're running low on backup codes, or you suspect an old set may have been exposed:

1. Go to **Profile → Security**
2. Click **Regenerate backup codes**
3. Confirm the action
4. A new set of $10$ codes downloads automatically as a text file

Regenerating immediately invalidates all previously issued backup codes — only the newest set will work going forward.

### Disabling 2FA

1. Go to **Profile → Security**
2. Click **Disable** next to Two-Factor Authentication
3. Enter your **current password** to confirm
4. Confirm the action

Disabling removes your TOTP secret and all backup codes. If you re-enable 2FA later, you'll go through setup again with a brand-new secret and a new set of backup codes.

## Danger Zone: Deleting Your Account

The **Danger Zone** tab lets you permanently delete your Portfolium account.

1. Go to **Profile → Danger Zone**
2. Type **delete account** into the confirmation field exactly as shown
3. Click **Delete Account**

!!! warning "This action is permanent"
    Deleting your account removes your account and all associated data. There is no recovery period and no way to undo this from within the app. Make sure you have exported anything you want to keep — see [Transactions](transactions.md) for CSV export — before proceeding.

After deletion completes, you are immediately logged out.

## Related Pages

- [Settings](settings.md) for general preferences, auto-refresh, and notification configuration
- [Transactions](transactions.md) for exporting your data before account deletion
- [Notifications](notifications.md) to understand what login and security alerts you may receive
