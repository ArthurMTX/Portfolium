import { request, API_BASE_URL } from './client'
import type { LoginResponseDTO, TwoFactorSetupResponse, TwoFactorStatusResponse, UserDTO } from './types'

// Authentication
export async function login(email: string, password: string) {
  const formData = new URLSearchParams()
  formData.append('username', email) // API expects 'username' field but we use email
  formData.append('password', password)

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Login failed')
  }

  return response.json()
}

export async function register(email: string, username: string, password: string, fullName?: string, preferredLanguage?: string) {
  return request<UserDTO>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      username,
      password,
      full_name: fullName,
      preferred_language: preferredLanguage || 'en',
    }),
  })
}

export async function getCurrentUser() {
  return request<UserDTO>('/auth/me')
}

export async function updateCurrentUser(update: Partial<Pick<UserDTO, 'full_name' | 'email' | 'username' | 'preferred_language' | 'daily_change_notifications_enabled' | 'transaction_notifications_enabled' | 'daily_report_enabled' | 'ath_atl_notifications_enabled' | 'push_notifications_enabled'>>) {
  return request<UserDTO>('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(update),
  })
}

export async function verifyEmail(token: string) {
  return request<{ message: string }>(`/auth/verify-email?token=${token}`, {
    method: 'POST',
  })
}

export async function resendVerification(email: string) {
  return request<{ message: string }>(`/auth/resend-verification?email=${email}`, {
    method: 'POST',
  })
}

export async function forgotPassword(email: string) {
  return request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

// Two-Factor Authentication
export async function loginWith2FA(email: string, password: string, token: string) {
  return request<LoginResponseDTO>('/auth/2fa/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, token }),
  })
}

export async function get2FAStatus() {
  return request<TwoFactorStatusResponse>('/auth/2fa/status')
}

export async function setup2FA() {
  return request<TwoFactorSetupResponse>('/auth/2fa/setup', {
    method: 'POST',
  })
}

export async function verify2FA(token: string) {
  return request<{ message: string }>('/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function disable2FA(password: string, token?: string) {
  return request<{ message: string }>('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ password, token }),
  })
}

export async function regenerateBackupCodes() {
  return request<TwoFactorSetupResponse>('/auth/2fa/regenerate-backup-codes', {
    method: 'POST',
  })
}

export async function resetPassword(token: string, newPassword: string) {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token,
      new_password: newPassword,
    }),
  })
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return request<{ message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  })
}

export async function deleteAccount() {
  return request<{ message: string }>('/auth/account', {
    method: 'DELETE',
  })
}
