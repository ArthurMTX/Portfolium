# Admin Email Configuration UI

## Overview

The Admin panel now includes a comprehensive Email Configuration tab that allows administrators to configure SMTP settings, test email functionality, and view email-related statistics.

## Features

### 1. Email Configuration Form

Administrators can configure all email settings through an intuitive interface:

- **Enable/Disable Email System**: Toggle to enable or disable the entire email functionality
- **SMTP Settings**:
  - SMTP Host (e.g., smtp.gmail.com)
  - SMTP Port (default: 587)
  - SMTP Username
  - SMTP Password (securely hidden)
  - TLS Encryption toggle
- **From Settings**:
  - From Email address
  - From Name (display name)
- **Frontend URL**: Used in email links and templates

### 2. Test Email Functionality

Test the email configuration by sending test emails:

- **Recipient Email**: Enter any email address to receive the test
- **Email Type**: Choose from:
  - Simple Test
  - Verification Email
  - Password Reset
  - Daily Report

The system provides immediate feedback with success or error messages.

### 3. Email Statistics Dashboard

View comprehensive statistics about the email system:

- **Total Active Users**: Number of active users in the system
- **Verified Users**: Number of users with verified email addresses
- **Email System Status**: Whether email is enabled or disabled
- **SMTP Configuration Status**: Whether SMTP is properly configured
- **Notification Preferences**:
  - Users with daily reports enabled
  - Users with daily change notifications enabled
  - Users with transaction notifications enabled

## Accessing the Email Tab

1. Navigate to the Admin dashboard
2. Click on the **Email** tab (next to Users and Logs)
3. The email configuration will load automatically

## Usage Guide

### Configuring Email for the First Time

1. Click the **Enable Email System** toggle to turn it on
2. Fill in your SMTP server details:
   - For Gmail: `smtp.gmail.com`, port `587`, enable TLS
   - For other providers: consult your email provider's documentation
3. Enter your SMTP credentials (username and password)
4. Set the "From" email and name that will appear in sent emails
5. Configure the Frontend URL (your application's URL)
6. Click **Save Configuration**

### Testing Email Configuration

1. After saving your configuration, scroll to the **Test Email** section
2. Enter a test recipient email address
3. Select the type of email you want to test
4. Click **Send Test Email**
5. Check the recipient inbox and verify the email was received correctly

### Monitoring Email Activity

The **Email Statistics** section provides real-time insights:

- See how many users are actively using the system
- Track verified vs unverified users
- Monitor notification preference trends
- Verify SMTP configuration status

## Security Notes

- SMTP passwords are transmitted securely over HTTPS
- Passwords are never displayed in plain text after saving
- Only administrators can access email configuration
- All configuration changes are logged

## Troubleshooting

### Email Test Fails

1. Verify SMTP credentials are correct
2. Check that the SMTP port is not blocked by firewall
3. Ensure TLS is enabled if required by your provider
4. For Gmail, you may need to use an App Password instead of your account password

### Configuration Won't Save

1. Ensure all required fields are filled in
2. Check browser console for errors
3. Verify you have admin permissions
4. Try refreshing the page and attempting again

## Technical Implementation

### Frontend Components

- **Location**: `web/src/pages/Admin.tsx`
- **API Client**: `web/src/lib/api.ts`
- **Features**:
  - Real-time form validation
  - Loading states for async operations
  - Error handling with user-friendly messages
  - Responsive design for mobile and desktop

### Backend Endpoints

- `GET /api/admin/email/config` - Retrieve current email configuration
- `PATCH /api/admin/email/config` - Update email configuration
- `POST /api/admin/email/test` - Send a test email
- `GET /api/admin/email/stats` - Get email statistics

### State Management

The email tab uses React hooks for state management:
- Configuration state for form inputs
- Loading/saving states for UX feedback
- Test result state for displaying success/error messages
- Statistics state for dashboard metrics

## Future Enhancements

Potential improvements for future versions:

- Email template customization
- Email send history log
- Scheduled email queue management
- A/B testing for email templates
- Detailed delivery metrics (open rates, click rates)
- Bounce and complaint tracking
