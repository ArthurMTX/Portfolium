import { request } from './client'

// Health
export async function healthCheck() {
  return request<{
    status: string
    timestamp: string
    database: string
    version: string
    market_status: string  // 'premarket', 'open', 'afterhours', or 'closed'
    email_enabled: boolean
  }>('/health')
}

// Version
export async function getVersion() {
  return request<{
    version: string
    build_date: string
    git_commit: string
  }>('/version')
}

// Settings
export async function getSettings() {
  return request<{
    validate_sell_quantity: boolean
    price_cache_ttl_seconds: number
  }>('/settings')
}

export async function updateSettings(settings: { validate_sell_quantity: boolean }) {
  return request<{
    validate_sell_quantity: boolean
    price_cache_ttl_seconds: number
  }>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}
