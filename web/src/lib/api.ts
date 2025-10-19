
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
  last_updated: string
}

export interface PortfolioHistoryPointDTO {
  date: string
  value: number
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
    return this.request<{ status: string; timestamp: string }>('/health')
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

  async updateCurrentUser(update: Partial<Pick<UserDTO, 'full_name' | 'email' | 'username'>>) {
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

  async getHeldAssets() {
    return this.request<any[]>('/assets/held/all')
  }

  async getSoldAssets() {
    return this.request<any[]>('/assets/sold/all')
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


  async getPortfolioHistory(portfolioId: number, interval: string = "daily") {
    return this.request<PortfolioHistoryPointDTO[]>(`/portfolios/${portfolioId}/history?interval=${interval}`)
  }


  async getPortfolioMetrics(portfolioId: number) {
    return this.request<PortfolioMetricsDTO>(`/portfolios/${portfolioId}/metrics`)
  }

  async backfillPortfolioHistory(portfolioId: number, days = 365) {
    return this.request<{ portfolio_id: number; assets: number; history_points_saved: Record<string, number> }>(
      `/portfolios/${portfolioId}/backfill_history`,
      { method: 'POST', body: JSON.stringify({ days }) }
    )
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
}

export const api = new ApiClient(API_BASE_URL)
export default api
