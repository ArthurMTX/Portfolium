import { request } from './client'
import type { UserDTO } from './types'

// Admin
export async function getAdminUsers() {
  return request<UserDTO[]>(`/admin/users`)
}

export async function createAdminUser(payload: { email: string; username: string; password: string; full_name?: string | null; is_admin?: boolean; is_active?: boolean; is_verified?: boolean }) {
  return request<UserDTO>(`/admin/users`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminUser(userId: number, data: Partial<Pick<UserDTO, 'email' | 'username' | 'full_name' | 'is_admin' | 'is_active' | 'is_verified'>> & { password?: string }) {
  return request<UserDTO>(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteAdminUser(userId: number) {
  return request<void>(`/admin/users/${userId}`, { method: 'DELETE' })
}

export async function createTestNotifications(payload: { notification_types?: string[] }) {
  return request<{
    success: boolean
    message: string
    notifications: Array<{
      id: number
      type: string
      title: string
    }>
  }>(`/admin/notifications/test`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// Admin
export async function deleteAllData() {
  return request<{ success: boolean; deleted: Record<string, number>; message: string }>(
    `/admin/data`,
    { method: 'DELETE' }
  )
}

export async function checkAllAssetsHealth(minCoveragePct: number = 90) {
  return request<{
    total_assets: number
    assets_needing_backfill: number
    min_coverage_threshold: number
    assets: Array<{
      asset_id: number
      symbol: string
      name: string | null
      currency: string
      asset_type: string | null
      first_transaction_date: string | null
      price_count: number
      expected_trading_days: number
      coverage_pct: number
      missing_days: number
      needs_backfill: boolean
    }>
    summary: {
      excellent: number
      good: number
      fair: number
      poor: number
    }
  }>(`/admin/assets/health-check?min_coverage_pct=${minCoveragePct}`)
}

export async function backfillAllAssets(minCoveragePct: number = 90, days: number = 365) {
  return request<{
    success: boolean
    message: string
    backfilled: Array<{
      asset_id: number
      symbol: string
      prices_added: number
      previous_coverage: number
    }>
    skipped_count: number
    errors: Array<{
      symbol: string
      error: string
    }>
    total_prices_added: number
  }>(`/admin/assets/backfill-all?min_coverage_pct=${minCoveragePct}&days=${days}`, {
    method: 'POST'
  })
}


// Admin Email Configuration
export async function getEmailConfig() {
  return request<{
    enable_email: boolean
    smtp_host: string
    smtp_port: number
    smtp_user: string
    smtp_password: string | null
    smtp_tls: boolean
    from_email: string
    from_name: string
    frontend_url: string
  }>('/admin/email/config')
}

export async function updateEmailConfig(config: {
  enable_email?: boolean
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  smtp_password?: string | null
  smtp_tls?: boolean
  from_email?: string
  from_name?: string
  frontend_url?: string
}) {
  return request<{
    enable_email: boolean
    smtp_host: string
    smtp_port: number
    smtp_user: string
    smtp_password: string | null
    smtp_tls: boolean
    from_email: string
    from_name: string
    frontend_url: string
  }>('/admin/email/config', {
    method: 'PATCH',
    body: JSON.stringify(config)
  })
}

export async function testEmail(toEmail: string, testType: 'simple' | 'verification' | 'password_reset' | 'daily_report' | 'welcome') {
  // Daily reports can take longer to generate with many portfolios/transactions
  const timeout = testType === 'daily_report' ? 300000 : 30000 // 5 minutes for daily report, 30s for others
  return request<{
    success: boolean
    message: string
    test_type: string
    smtp_host: string
    smtp_port: number
    from_email: string
  }>('/admin/email/test', {
    method: 'POST',
    body: JSON.stringify({ to_email: toEmail, test_type: testType }),
    timeout
  })
}

export async function getEmailStats() {
  return request<{
    total_active_users: number
    verified_users: number
    email_enabled: boolean
    notifications: {
      daily_reports_enabled: number
      daily_changes_enabled: number
      transaction_notifications_enabled: number
    }
    smtp_configured: boolean
  }>('/admin/email/stats')
}
