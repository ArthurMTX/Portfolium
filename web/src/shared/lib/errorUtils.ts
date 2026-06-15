import { TFunction } from 'i18next'

/**
 * Maps API error messages to translation keys
 */
const errorMessageMap: Record<string, string> = {
  'Email already registered': 'apiErrors.emailAlreadyRegistered',
  'Username already taken': 'apiErrors.usernameAlreadyTaken',
  'Incorrect email or password': 'apiErrors.incorrectEmailOrPassword',
  'Account is inactive': 'apiErrors.accountInactive',
  'Email not verified. Please check your email and verify your account before logging in.': 'apiErrors.emailNotVerified',
  'Invalid or expired verification token': 'apiErrors.invalidOrExpiredVerificationToken',
  'Email already verified': 'apiErrors.emailAlreadyVerified',
  'Invalid or expired reset token': 'apiErrors.invalidOrExpiredResetToken',
  'Incorrect current password': 'apiErrors.incorrectCurrentPassword',
  'Invalid or missing reset token': 'apiErrors.invalidOrExpiredResetToken',
  'Passwords do not match': 'apiErrors.passwordsDoNotMatch',
  'Password must be at least 8 characters': 'apiErrors.passwordMinLength',
  'Invalid or missing verification token': 'apiErrors.invalidOrExpiredVerificationToken',
  'Failed to send reset email': 'apiErrors.failedToSendResetEmail',
  'Failed to reset password': 'apiErrors.failedToResetPassword',
  'Failed to verify email': 'apiErrors.failedToVerifyEmail',
}

/**
 * Translates an API error message to the user's language
 * @param error - The error message from the API
 * @param t - The translation function from i18next
 * @returns The translated error message
 */
export function translateApiError(error: string, t: TFunction): string {
  const translationKey = errorMessageMap[error]
  
  if (translationKey) {
    return t(translationKey)
  }
  
  // If no translation found, return the original error message
  return error
}
