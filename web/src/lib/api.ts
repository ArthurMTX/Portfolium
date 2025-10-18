
/**
 * API client for Portfolium backend
 */

// Use /api prefix so requests go through proxy (both dev and production)
// Vite dev proxy and nginx will forward /api/* to the backend
const API_BASE_URL = '/api'

interface ApiError {
  detail: string | { errors: string[]; imported: number }
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
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
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

    return response.json()
  }

  // Health
  async healthCheck() {
    return this.request<{ status: string; timestamp: string }>('/health')
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

  async createTransaction(portfolioId: number, transaction: any) {
    return this.request<any>(`/portfolios/${portfolioId}/transactions`, {
      method: 'POST',
      body: JSON.stringify(transaction),
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
