
/**
 * API client for Portfolium backend
 */

// Use /api prefix so requests go through proxy (both dev and production)
// Vite dev proxy and nginx will forward /api/* to the backend
const API_BASE_URL = '/api'

interface ApiError {
  detail: string | { errors: string[]; imported: number }
}

// Auth Types
export interface UserDTO {
  id: number
  email: string
  username: string
  full_name: string | null
  is_active: boolean
  is_verified: boolean
  is_superuser: boolean
  is_admin: boolean
  created_at: string
  last_login: string | null
  daily_change_notifications_enabled: boolean
  daily_change_threshold_pct: number
  transaction_notifications_enabled: boolean
  daily_report_enabled: boolean
}

export interface LoginResponseDTO {
  access_token: string
  token_type: string
  user: UserDTO
}

// Types aligning with store shapes
export interface PortfolioDTO {
  id: number
  name: string
  base_currency: string
  description: string | null
  created_at: string
}

export interface PositionDTO {
  asset_id: number
  symbol: string
  name: string | null
  quantity: number
  avg_cost: number
  current_price: number | null
  market_value: number | null
  cost_basis: number
  unrealized_pnl: number | null
  unrealized_pnl_pct: number | null
  daily_change_pct: number | null
  currency: string
  last_updated: string | null
}

export interface PortfolioMetricsDTO {
  portfolio_id: number
  portfolio_name: string
  total_value: number
  total_cost: number
  total_unrealized_pnl: number
  total_unrealized_pnl_pct: number
  total_realized_pnl: number
  total_dividends: number
  total_fees: number
  positions_count: number
  daily_change_value?: number | null
  daily_change_pct?: number | null
  last_updated: string
}

export interface PortfolioHistoryPointDTO {
  date: string
  value: number
  invested?: number  // Total amount invested (deposits - withdrawals)
  gain_pct?: number  // Percentage gain/loss (excluding deposits/withdrawals)
}

class ApiClient {
  // Admin
  async getAdminUsers() {
    return this.request<UserDTO[]>(`/admin/users`)
  }

  async createAdminUser(payload: { email: string; username: string; password: string; full_name?: string | null; is_admin?: boolean; is_active?: boolean; is_verified?: boolean }) {
    return this.request<UserDTO>(`/admin/users`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateAdminUser(userId: number, data: Partial<Pick<UserDTO, 'email' | 'username' | 'full_name' | 'is_admin' | 'is_active' | 'is_verified'>> & { password?: string }) {
    return this.request<UserDTO>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteAdminUser(userId: number) {
    return this.request<void>(`/admin/users/${userId}`, { method: 'DELETE' })
  }
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: 'An error occurred',
      }))
      throw new Error(
        typeof error.detail === 'string'
          ? error.detail
          : JSON.stringify(error.detail)
      )
    }

    // Handle 204 No Content responses (like DELETE operations)
    if (response.status === 204) {
      return undefined as T
    }

    return response.json()
  }

  // Health
  async healthCheck() {
    return this.request<{ 
      status: string
      timestamp: string
      database: string
      version: string
      market_status: string  // 'premarket', 'open', 'afterhours', or 'closed'
      email_enabled: boolean
    }>('/health')
  }

  // Version
  async getVersion() {
    return this.request<{
      version: string
      build_date: string
      git_commit: string
    }>('/version')
  }

  // Authentication
  async login(email: string, password: string) {
    const formData = new URLSearchParams()
    formData.append('username', email) // API expects 'username' field but we use email
    formData.append('password', password)

    const response = await fetch(`${this.baseUrl}/auth/login`, {
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

  async register(email: string, username: string, password: string, fullName?: string) {
    return this.request<UserDTO>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        username,
        password,
        full_name: fullName,
      }),
    })
  }

  async getCurrentUser() {
    return this.request<UserDTO>('/auth/me')
  }

  async updateCurrentUser(update: Partial<Pick<UserDTO, 'full_name' | 'email' | 'username' | 'daily_change_notifications_enabled' | 'daily_change_threshold_pct' | 'transaction_notifications_enabled' | 'daily_report_enabled'>>) {
    return this.request<UserDTO>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(update),
    })
  }

  async verifyEmail(token: string) {
    return this.request<{ message: string }>(`/auth/verify-email?token=${token}`, {
      method: 'POST',
    })
  }

  async resendVerification(email: string) {
    return this.request<{ message: string }>(`/auth/resend-verification?email=${email}`, {
      method: 'POST',
    })
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  async resetPassword(token: string, newPassword: string) {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token,
        new_password: newPassword,
      }),
    })
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    })
  }

  async deleteAccount() {
    return this.request<{ message: string }>('/auth/account', {
      method: 'DELETE',
    })
  }

  // Assets
  async getAssets(query?: string) {
    const params = query ? `?query=${encodeURIComponent(query)}` : ''
    return this.request<any[]>(`/assets${params}`)
  }

  async getHeldAssets(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<any[]>(`/assets/held/all${params}`)
  }

  async getSoldAssets(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<any[]>(`/assets/sold/all${params}`)
  }

  async enrichAsset(assetId: number) {
    return this.request<any>(`/assets/enrich/${assetId}`, {
      method: 'POST',
    })
  }

  async enrichAllAssets() {
    return this.request<any>('/assets/enrich/all', {
      method: 'POST',
    })
  }

  async searchTicker(query: string) {
    return this.request<Array<{ symbol: string; name: string; type?: string; exchange?: string }>>(`/assets/search_ticker?query=${encodeURIComponent(query)}`)
  }

  async createAsset(asset: {
    symbol: string
    name?: string
    currency?: string
    class?: string
  }) {
    return this.request<any>('/assets', {
      method: 'POST',
      body: JSON.stringify(asset),
    })
  }

  async getAssetSplitHistory(assetId: number, portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<Array<{
      id: number
      tx_date: string
      metadata: { split?: string; [key: string]: unknown }
      notes: string | null
    }>>(`/assets/${assetId}/splits${params}`)
  }

  async getAssetTransactionHistory(assetId: number, portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<Array<{
      id: number
      tx_date: string
      type: string
      quantity: number
      adjusted_quantity: number
      price: number | null
      fees: number | null
      portfolio_name: string
      notes: string | null
    }>>(`/assets/${assetId}/transactions${params}`)
  }

  async getAssetPriceHistory(assetId: number, period: string = '1M') {
    return this.request<{
      asset_id: number
      symbol: string
      name: string | null
      currency: string
      period: string
      start_date: string
      end_date: string
      data_points: number
      prices: Array<{
        date: string
        price: number
        volume: number | null
        source: string
      }>
    }>(`/assets/${assetId}/prices?period=${encodeURIComponent(period)}`)
  }

  async getAssetHealth(assetId: number) {
    return this.request<{
      asset_id: number
      symbol: string
      name: string | null
      status: string
      total_price_records: number
      first_transaction_date: string | null
      first_transaction_actual: string | null
      data_range: {
        start: string
        end: string
        days: number
      } | null
      coverage: {
        expected_trading_days: number
        actual_data_points: number
        coverage_pct: number
        missing_days: number
        gap_count: number
      }
      sources: Record<string, number>
      gaps: string[] | { total: number; sample: string[]; message: string }
      recommendations: string[]
    }>(`/assets/${assetId}/health`)
  }

  // Portfolios
  async getPortfolios() {
    return this.request<PortfolioDTO[]>('/portfolios')
  }

  async createPortfolio(portfolio: {
    name: string
    base_currency?: string
    description?: string
  }) {
    return this.request<PortfolioDTO>('/portfolios', {
      method: 'POST',
      body: JSON.stringify(portfolio),
    })
  }

  async updatePortfolio(portfolioId: number, portfolio: {
    name: string
    base_currency?: string
    description?: string
  }) {
    return this.request<PortfolioDTO>(`/portfolios/${portfolioId}`, {
      method: 'PUT',
      body: JSON.stringify(portfolio),
    })
  }

  async deletePortfolio(portfolioId: number) {
    return this.request<void>(`/portfolios/${portfolioId}`, {
      method: 'DELETE',
    })
  }

  async getPortfolioPositions(portfolioId: number) {
    return this.request<PositionDTO[]>(`/portfolios/${portfolioId}/positions`)
  }

  async getSoldPositions(portfolioId: number) {
    return this.request<PositionDTO[]>(`/portfolios/${portfolioId}/sold-positions`)
  }

  async getPortfolioHistory(portfolioId: number, period: string = "1M") {
    return this.request<PortfolioHistoryPointDTO[]>(`/portfolios/${portfolioId}/history?period=${period}`)
  }


  async getPortfolioMetrics(portfolioId: number) {
    return this.request<PortfolioMetricsDTO>(`/portfolios/${portfolioId}/metrics`)
  }

  // Transactions
  async getTransactions(
    portfolioId: number,
    filters?: {
      asset_id?: number
      tx_type?: string
      date_from?: string
      date_to?: string
    }
  ) {
    const params = new URLSearchParams()
    if (filters?.asset_id) params.append('asset_id', filters.asset_id.toString())
    if (filters?.tx_type) params.append('tx_type', filters.tx_type)
    if (filters?.date_from) params.append('date_from', filters.date_from)
    if (filters?.date_to) params.append('date_to', filters.date_to)

    const queryString = params.toString()
    return this.request<any[]>(
      `/portfolios/${portfolioId}/transactions${queryString ? `?${queryString}` : ''}`
    )
  }

  async addPositionTransaction(
    portfolioId: number,
    ticker: string,
    txDate: string,
    txType: string,
    quantity: number
  ) {
    const params = new URLSearchParams({
      ticker,
      tx_date: txDate,
      tx_type: txType,
      quantity: quantity.toString(),
    })
    return this.request<any>(
      `/portfolios/${portfolioId}/add_position_transaction?${params.toString()}`,
      { method: 'POST' }
    )
  }

  async createTransaction(portfolioId: number, transaction: any) {
    return this.request<any>(`/portfolios/${portfolioId}/transactions`, {
      method: 'POST',
      body: JSON.stringify(transaction),
    })
  }

  async updateTransaction(portfolioId: number, transactionId: number, transaction: any) {
    return this.request<any>(`/portfolios/${portfolioId}/transactions/${transactionId}`, {
      method: 'PUT',
      body: JSON.stringify(transaction),
    })
  }

  async deleteTransaction(portfolioId: number, transactionId: number) {
    return this.request<void>(`/portfolios/${portfolioId}/transactions/${transactionId}`, {
      method: 'DELETE',
    })
  }

  async importCsv(portfolioId: number, file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(
      `${this.baseUrl}/portfolios/import/csv?portfolio_id=${portfolioId}`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
        },
        body: formData,
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(JSON.stringify(error))
    }

    return response.json()
  }

  // Prices
  async getPrices(symbols: string[]) {
    const symbolsParam = symbols.join(',')
    return this.request<Record<string, unknown>>(`/prices?symbols=${symbolsParam}`)
  }

  async refreshPrices(portfolioId: number) {
    return this.request<{ refreshed_count: number }>(
      `/prices/refresh?portfolio_id=${portfolioId}`,
      { method: 'POST' }
    )
  }

  // Admin
  async deleteAllData() {
    return this.request<{ success: boolean; deleted: Record<string, number>; message: string }>(
      `/admin/data`,
      { method: 'DELETE' }
    )
  }

  // Settings
  async getSettings() {
    return this.request<{
      validate_sell_quantity: boolean
      price_cache_ttl_seconds: number
    }>('/settings')
  }

  async updateSettings(settings: { validate_sell_quantity: boolean }) {
    return this.request<{
      validate_sell_quantity: boolean
      price_cache_ttl_seconds: number
    }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  }

  // Watchlist
  async getWatchlist() {
    return this.request<Array<{
      id: number
      user_id: number
      asset_id: number
      symbol: string
      name: string | null
      notes: string | null
      alert_target_price: number | string | null
      alert_enabled: boolean
      current_price: number | string | null
      daily_change_pct: number | string | null
      currency: string
      last_updated: string | null
      created_at: string
    }>>('/watchlist')
  }

  async addToWatchlist(data: {
    symbol: string
    notes?: string
    alert_target_price?: number
    alert_enabled?: boolean
  }) {
    const { symbol, ...rest } = data;
    const params = new URLSearchParams({ symbol });
    return this.request<any>(`/watchlist/by-symbol?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify(rest),
    });
  }

  async updateWatchlistItem(itemId: number, data: {
    notes?: string
    alert_target_price?: number
    alert_enabled?: boolean
  }) {
    return this.request<any>(`/watchlist/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteWatchlistItem(itemId: number) {
    return this.request<void>(`/watchlist/${itemId}`, {
      method: 'DELETE',
    })
  }

  async convertWatchlistToBuy(itemId: number, data: {
    portfolio_id: number
    quantity: number
    price: number
    fees?: number
    tx_date?: string
  }) {
    return this.request<{ success: boolean; transaction_id: number; message: string }>(
      `/watchlist/${itemId}/convert-to-buy`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async importWatchlistCSV(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseUrl}/watchlist/import/csv`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(JSON.stringify(error))
    }

    return response.json()
  }

  async exportWatchlistCSV() {
    const response = await fetch(`${this.baseUrl}/watchlist/export/csv`, {
      headers: {
        ...this.getAuthHeaders(),
      },
    })

    if (!response.ok) {
      throw new Error('Export failed')
    }

    return response.blob()
  }

  async refreshWatchlistPrices() {
    return this.request<{ refreshed_count: number }>(
      '/watchlist/refresh-prices',
      { method: 'POST' }
    )
  }

  // Notifications
  async getNotifications(skip: number = 0, limit: number = 50, unreadOnly: boolean = false) {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
      unread_only: unreadOnly.toString()
    })
    return this.request<Array<{
      id: number
      user_id: number
      type: string
      title: string
      message: string
      metadata: Record<string, any>
      is_read: boolean
      created_at: string
    }>>(`/notifications?${params.toString()}`)
  }

  async getUnreadCount() {
    return this.request<{ unread_count: number }>('/notifications/unread-count')
  }

  async markNotificationAsRead(notificationId: number) {
    return this.request<any>(`/notifications/${notificationId}/read`, {
      method: 'PUT'
    })
  }

  async markAllNotificationsAsRead() {
    return this.request<{ marked_read: number }>('/notifications/mark-all-read', {
      method: 'PUT'
    })
  }

  async deleteNotification(notificationId: number) {
    return this.request<void>(`/notifications/${notificationId}`, {
      method: 'DELETE'
    })
  }

  // Insights
  async getPortfolioInsights(portfolioId: number, period: string = '1y', benchmark: string = 'SPY', signal?: AbortSignal) {
    return this.request<any>(`/insights/${portfolioId}?period=${period}&benchmark=${benchmark}`, { signal })
  }

  // Admin Email Configuration
  async getEmailConfig() {
    return this.request<{
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

  async updateEmailConfig(config: {
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
    return this.request<{
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

  async testEmail(toEmail: string, testType: 'simple' | 'verification' | 'password_reset' | 'daily_report') {
    return this.request<{
      success: boolean
      message: string
      test_type: string
      smtp_host: string
      smtp_port: number
      from_email: string
    }>('/admin/email/test', {
      method: 'POST',
      body: JSON.stringify({ to_email: toEmail, test_type: testType })
    })
  }

  async getEmailStats() {
    return this.request<{
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
}

export const api = new ApiClient(API_BASE_URL)
export default api
