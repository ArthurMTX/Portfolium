
/**
 * API client for Portfolium backend
 */

import type {
  DashboardLayoutDTO,
  DashboardLayoutCreate,
  DashboardLayoutUpdate,
  DashboardLayoutExport
} from '../types/dashboard'

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
  preferred_language: string
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
  is_public: boolean
  share_token: string
  created_at: string
}

export interface PositionDTO {
  asset_id: number
  symbol: string
  name: string | null
  asset_type?: string | null
  quantity: number
  avg_cost: number
  current_price: number | null
  market_value: number | null
  cost_basis: number
  unrealized_pnl: number | null
  unrealized_pnl_pct: number | null
  daily_change_pct: number | null
  breakeven_gain_pct?: number | null
  breakeven_target_price?: number | null
  // Advanced metrics
  distance_to_ath_pct?: number | null
  avg_buy_zone_pct?: number | null
  personal_drawdown_pct?: number | null
  local_ath_price?: number | null
  local_ath_date?: string | null
  vol_contribution_pct?: number | null
  cost_to_average_down?: number | null
  ath_price?: number | null // ATH in portfolio currency
  ath_price_native?: number | null // ATH in native currency
  ath_currency?: string | null // Native currency of the ATH
  ath_date?: string | null
  // Relative performance vs sector
  relative_perf_30d?: number | null
  relative_perf_90d?: number | null
  relative_perf_ytd?: number | null
  relative_perf_1y?: number | null
  sector?: string | null
  sector_etf?: string | null
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
  gain_pct?: number  // Percentage gain/loss vs. total invested (includes sold positions)
  cost_basis?: number  // Cost basis of current holdings only
  unrealized_pnl_pct?: number  // Unrealized P&L % of current holdings (matches Dashboard)
}

// Batch Price Response
export interface BatchPriceDTO {
  symbol: string
  asset_id: number
  name: string
  current_price: number | null  // Price converted to portfolio base currency
  original_price: number  // Original price in asset's native currency
  original_currency: string  // Asset's native currency (e.g., "USD")
  daily_change_pct: number | null
  last_updated: string | null
  asset_type: string | null
}

export interface BatchPricesResponseDTO {
  portfolio_id: number
  base_currency: string  // Portfolio's base currency for all converted prices
  prices: BatchPriceDTO[]
  updated_at: string
  count: number
}

// Asset Distribution Types
export interface AssetPositionDTO {
  asset_id: number
  total_value: number
  unrealized_pnl: number
  percentage: number
}

export interface DistributionItemDTO {
  name: string
  count: number
  percentage: number
  total_value: number
  cost_basis: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  asset_ids: number[]
  asset_positions?: AssetPositionDTO[]
}

export interface IndustryItemDTO {
  name: string
  count: number
  asset_ids: number[]
}

// Insights Types
export interface TopPerformerDTO {
  symbol: string
  name: string | null
  return_pct: number
  value: number
  unrealized_pnl: number
  period: string
  logo_url?: string | null
  asset_type?: string | null
}

export interface PerformanceMetricsDTO {
  period: string
  total_return: number
  total_return_pct: number
  annualized_return: number
  start_value: number
  end_value: number
  total_invested: number
  total_withdrawn: number
  best_day: number | null
  best_day_date: string | null
  worst_day: number | null
  worst_day_date: string | null
  positive_days: number
  negative_days: number
  win_rate: number
}

export interface RiskMetricsDTO {
  period: string
  volatility: number
  sharpe_ratio: number | null
  max_drawdown: number
  max_drawdown_date: string | null
  beta: number | null
  var_95: number | null
  downside_deviation: number
}

export interface BenchmarkComparisonDTO {
  benchmark_symbol: string
  benchmark_name: string
  period: string
  portfolio_return: number
  benchmark_return: number
  alpha: number
  correlation: number | null
}

export interface AverageHoldingPeriodDTO {
  portfolio_id: number
  average_holding_period_days: number | null
}

// Price Quote
export interface PriceQuote {
  symbol: string
  current_price: number
  price: number
  asof: string
  currency: string
  daily_change_pct?: number
  percent_change?: number
}

// Market Status
export interface MarketStatusDTO {
  status: string
  timestamp: string
  database: string
  version: string
  market_status: string
  market_statuses?: {
    us: string
    europe: string
    asia: string
    oceania: string
  }
  email_enabled: boolean
  is_open?: boolean
  next_open?: string
  current_time?: string
}

export interface TransactionDTO {
  id: number
  portfolio_id: number
  asset_id: number
  transaction_type: string
  transaction_date: string
  quantity: number
  price: number
  fees: number
  notes: string | null
  symbol: string
  asset_name: string | null
  created_at: string
}

export interface PortfolioGoalDTO {
  id: number
  portfolio_id: number
  title: string
  target_amount: number
  target_date: string | null
  monthly_contribution: number
  category: 'retirement' | 'house' | 'education' | 'vacation' | 'emergency' | 'other'
  description: string | null
  color: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PortfolioGoalCreate {
  title: string
  target_amount: number
  target_date?: string | null
  monthly_contribution?: number
  category?: 'retirement' | 'house' | 'education' | 'vacation' | 'emergency' | 'other'
  description?: string | null
  color?: string | null
  is_active?: boolean
}

export interface PortfolioGoalUpdate {
  title?: string
  target_amount?: number
  target_date?: string | null
  monthly_contribution?: number
  category?: 'retirement' | 'house' | 'education' | 'vacation' | 'emergency' | 'other'
  description?: string | null
  color?: string | null
  is_active?: boolean
}

export interface GoalScenario {
  label: 'Pessimistic' | 'Median' | 'Optimistic'
  return_rate: number
  projected_months: number
  projected_amount: number
  quantile: number
  color: string
}

export interface GoalMilestone {
  percentage: number
  amount: number
  achieved: boolean
  label: string
}

export interface GoalProjectionsDTO {
  scenarios: GoalScenario[]
  milestones: GoalMilestone[]
  probability: number
  historical_performance: {
    annual_return: number
    annual_volatility: number
  }
  is_past_target_date?: boolean
  warning?: string
}

export interface PublicTimeSeriesPoint {
  date: string
  value: number
}

export interface PublicPerformanceMetrics {
  period: string
  total_return_pct: number
  annualized_return: number
  best_day_date: string | null
  worst_day_date: string | null
  positive_days: number
  negative_days: number
  win_rate: number
}

export interface PublicRiskMetrics {
  period: string
  volatility: number
  sharpe_ratio: number | null
  max_drawdown: number
  max_drawdown_date: string | null
  beta: number | null
}


export interface PublicSectorAllocation {
  sector: string
  percentage: number
}

export interface PublicGeographicAllocation {
  country: string
  percentage: number
}

export interface PublicHolding {
  symbol: string
  name: string | null
  sector: string | null
  industry: string | null
  country: string | null
  weight_pct: number
  asset_type: string | null
}

export interface PublicPortfolioInsights {
  portfolio_id: number
  portfolio_name: string
  owner_username: string
  as_of_date: string
  period: string
  sector_allocation: PublicSectorAllocation[]
  geographic_allocation: PublicGeographicAllocation[]
  holdings: PublicHolding[]
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

  async createTestNotifications(payload: { notification_types?: string[] }) {
    return this.request<{
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

  async register(email: string, username: string, password: string, fullName?: string, preferredLanguage?: string) {
    return this.request<UserDTO>('/auth/register', {
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

  async getCurrentUser() {
    return this.request<UserDTO>('/auth/me')
  }

  async updateCurrentUser(update: Partial<Pick<UserDTO, 'full_name' | 'email' | 'username' | 'preferred_language' | 'daily_change_notifications_enabled' | 'daily_change_threshold_pct' | 'transaction_notifications_enabled' | 'daily_report_enabled'>>) {
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

  async setAssetMetadataOverrides(assetId: number, overrides: {
    sector_override?: string | null
    industry_override?: string | null
    country_override?: string | null
  }) {
    return this.request<any>(`/assets/${assetId}/metadata-overrides`, {
      method: 'PATCH',
      body: JSON.stringify(overrides),
    })
  }

  async searchTicker(query: string) {
    return this.request<Array<{ symbol: string; name: string; type?: string; exchange?: string }>>(`/assets/search_ticker?query=${encodeURIComponent(query)}`)
  }

  async searchAssets(query: string, cryptoOnly: boolean = false) {
    const params = new URLSearchParams({ query })
    if (cryptoOnly) params.append('crypto_only', 'true')
    return this.request<Array<{ symbol: string; name: string; type?: string }>>(`/assets/search?${params.toString()}`)
  }

  async getAssetBySymbol(symbol: string) {
    return this.request<{ id: number; symbol: string; name: string; currency: string }>(`/assets/by-symbol/${encodeURIComponent(symbol)}`)
  }

  async getPriceQuote(symbol: string) {
    return this.request<{ symbol: string; price: number; currency: string }>(`/prices/quote/${encodeURIComponent(symbol)}`)
  }

  async createAsset(asset: {
    symbol: string
    name?: string
    currency?: string
    class?: string
    asset_type?: string
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
      metadata: { split?: string;[key: string]: unknown }
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

  // Asset Distribution endpoints
  async getSectorsDistribution(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<DistributionItemDTO[]>(`/assets/distribution/sectors${params}`)
  }

  async getCountriesDistribution(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<DistributionItemDTO[]>(`/assets/distribution/countries${params}`)
  }

  async getTypesDistribution(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<DistributionItemDTO[]>(`/assets/distribution/types${params}`)
  }

  async getSectorIndustriesDistribution(sectorName: string, portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<DistributionItemDTO[]>(`/assets/distribution/sectors/${encodeURIComponent(sectorName)}/industries${params}`)
  }

  async getIndustriesList(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
    return this.request<IndustryItemDTO[]>(`/assets/distribution/industries${params}`)
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

  async getYFinanceData(assetId: number) {
    return this.request<{
      asset_id: number
      symbol: string
      name: string | null
      fetched_at: string
      info: Record<string, unknown>
      recent_history: unknown
      calendar: unknown
      recommendations: unknown
      institutional_holders: unknown
      major_holders: unknown
      dividends: unknown
      splits: unknown
      actions: unknown
    }>(`/assets/${assetId}/yfinance`)
  }

  async getYFinanceDataBySymbol(symbol: string) {
    return this.request<{
      asset_id: number | null
      symbol: string
      name: string | null
      in_database: boolean
      fetched_at: string
      info: Record<string, unknown>
      recent_history: unknown
      calendar: unknown
      recommendations: unknown
      institutional_holders: unknown
      major_holders: unknown
      dividends: unknown
      splits: unknown
      actions: unknown
    }>(`/assets/0/yfinance?symbol=${encodeURIComponent(symbol)}`)
  }

  // Portfolios
  async getPortfolios() {
    return this.request<PortfolioDTO[]>('/portfolios')
  }

  async createPortfolio(portfolio: {
    name: string
    base_currency?: string
    description?: string
    is_public?: boolean
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
    is_public?: boolean
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

  /**
   * Get batch prices for all assets in a portfolio (ultra-fast, price-only updates)
   * 
   * This endpoint is optimized for auto-refresh scenarios where you need to update
   * prices without recalculating full positions. Returns only current prices and
   * daily changes, skipping heavy P&L calculations.
   * 
   * **Performance:** ~10x faster than getPortfolioPositions()
   * 
   * @param portfolioId Portfolio ID
   * @returns Batch price data for all portfolio assets
   */
  async getBatchPrices(portfolioId: number) {
    return this.request<BatchPricesResponseDTO>(`/portfolios/${portfolioId}/prices/batch`)
  }

  // Portfolio Goals
  async getPortfolioGoals(portfolioId: number, activeOnly: boolean = false) {
    const params = activeOnly ? '?active_only=true' : ''
    return this.request<PortfolioGoalDTO[]>(`/portfolios/${portfolioId}/goals${params}`)
  }

  async getPortfolioGoal(portfolioId: number, goalId: number) {
    return this.request<PortfolioGoalDTO>(`/portfolios/${portfolioId}/goals/${goalId}`)
  }

  async createPortfolioGoal(portfolioId: number, goal: PortfolioGoalCreate) {
    return this.request<PortfolioGoalDTO>(`/portfolios/${portfolioId}/goals`, {
      method: 'POST',
      body: JSON.stringify(goal),
    })
  }

  async updatePortfolioGoal(portfolioId: number, goalId: number, goal: PortfolioGoalUpdate) {
    return this.request<PortfolioGoalDTO>(`/portfolios/${portfolioId}/goals/${goalId}`, {
      method: 'PUT',
      body: JSON.stringify(goal),
    })
  }

  async deletePortfolioGoal(portfolioId: number, goalId: number) {
    return this.request<void>(`/portfolios/${portfolioId}/goals/${goalId}`, {
      method: 'DELETE',
    })
  }

  async getGoalProjections(portfolioId: number, goalId: number) {
    return this.request<GoalProjectionsDTO>(`/portfolios/${portfolioId}/goals/${goalId}/projections`, {
      method: 'POST',
    })
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

  async fetchPriceForDate(
    portfolioId: number,
    ticker: string,
    txDate: string
  ): Promise<{
    price: number
    original_price: number
    asset_currency: string
    portfolio_currency: string
    converted: boolean
  }> {
    const params = new URLSearchParams({
      ticker,
      tx_date: txDate,
    })
    return this.request(
      `/portfolios/${portfolioId}/fetch_price?${params.toString()}`
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

  async createConversion(portfolioId: number, conversion: {
    tx_date: string
    from_asset_id: number
    from_quantity: number
    from_price: number
    to_asset_id: number
    to_quantity: number
    to_price: number
    fees?: number
    currency?: string
    notes?: string | null
  }) {
    return this.request<{
      conversion_id: string
      conversion_rate: string
      from_transaction: any
      to_transaction: any
    }>(`/portfolios/${portfolioId}/conversions`, {
      method: 'POST',
      body: JSON.stringify(conversion),
    })
  }

  async getTransactionMetrics(portfolioId: number, grouping: 'monthly' | 'yearly' = 'monthly') {
    return this.request<{
      grouping: string
      currency: string
      metrics: Array<{
        month?: number
        year: number
        buy_sum_total_price: number
        buy_count: number
        buy_max_total_price: number
        buy_min_total_price: number
        buy_avg_total_price: number
        buy_sum_fees: number
        sell_sum_total_price: number
        sell_count: number
        sell_max_total_price: number
        sell_min_total_price: number
        sell_avg_total_price: number
        sell_sum_fees: number
        diff_buy_sell: number
      }>
    }>(`/portfolios/${portfolioId}/transactions/metrics?grouping=${grouping}`)
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
    notes?: string | null
    alert_target_price?: number | null
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
    currency?: string
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

  async getTopPerformers(portfolioId: number, period: string = '1y', limit: number = 5, signal?: AbortSignal) {
    return this.request<TopPerformerDTO[]>(`/insights/${portfolioId}/top-performers?period=${period}&limit=${limit}`, { signal })
  }

  async getPerformanceMetrics(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
    return this.request<PerformanceMetricsDTO>(`/insights/${portfolioId}/performance?period=${period}`, { signal })
  }

  async getRiskMetrics(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
    return this.request<RiskMetricsDTO>(`/insights/${portfolioId}/risk?period=${period}`, { signal })
  }

  async getBenchmarkComparison(portfolioId: number, benchmark: string = 'SPY', period: string = '1y', signal?: AbortSignal) {
    return this.request<BenchmarkComparisonDTO>(`/insights/${portfolioId}/benchmark?benchmark=${benchmark}&period=${period}`, { signal })
  }

  async getAverageHoldingPeriod(portfolioId: number, signal?: AbortSignal) {
    return this.request<AverageHoldingPeriodDTO>(`/insights/${portfolioId}/average-holding-period`, { signal })
  }

  async getRecentTransactions(portfolioId: number, limit: number = 5, signal?: AbortSignal) {
    return this.request<TransactionDTO[]>(`/portfolios/${portfolioId}/transactions?limit=${limit}`, { signal })
  }

  // Market Status
  async getMarketStatus(signal?: AbortSignal) {
    return this.request<MarketStatusDTO>('/health', { signal })
  }

  // Market Indices
  async getMarketIndices(signal?: AbortSignal) {
    const symbols = [
      '^GSPC', '^DJI', '^IXIC', '^GSPTSE',
      '^FTSE', '^GDAXI', '^FCHI', 'FTSEMIB.MI',
      '^N225', '^HSI', '000001.SS', '^AXJO'
    ].join(',')

    const response = await this.request<Record<string, PriceQuote>>(`/prices/indices?symbols=${symbols}`, { signal })

    // Normalize the response to include percent_change
    const normalized: Record<string, PriceQuote> = {}
    for (const [symbol, data] of Object.entries(response)) {
      normalized[symbol] = {
        ...data,
        current_price: data.price,
        percent_change: data.daily_change_pct
      }
    }

    return normalized
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

  // ============================================================================
  // Market Data
  // ============================================================================

  async getStockMarketSentiment() {
    return this.request<{
      score: number
      rating: string
      previous_close: number
      timestamp: string
    }>('/market/sentiment/stock')
  }

  async getCryptoMarketSentiment() {
    return this.request<{
      score: number
      rating: string
      previous_value: number | null
      timestamp: string
    }>('/market/sentiment/crypto')
  }

  async getMarketSentiment(marketType: 'stock' | 'crypto') {
    return this.request<{
      score: number
      rating: string
      previous_close?: number
      previous_value?: number | null
      timestamp: string
    }>(`/market/sentiment/${marketType}`)
  }

  async getVIXIndex() {
    return this.request<{
      price: number
      change: number | null
      change_pct: number | null
      previous_close: number | null
      timestamp: string
    }>('/market/vix')
  }

  async getTNXIndex() {
    return this.request<{
      price: number
      change: number | null
      change_pct: number | null
      previous_close: number | null
      timestamp: string
    }>('/market/tnx')
  }

  async getDXYIndex() {
    return this.request<{
      price: number
      change: number | null
      change_pct: number | null
      previous_close: number | null
      timestamp: string
    }>('/market/dxy')
  }

  // ============================================================================
  // Dashboard Layouts
  // ============================================================================

  async getDashboardLayouts(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    return this.request<DashboardLayoutDTO[]>(`/dashboard-layouts/${params}`)
  }

  async getDefaultDashboardLayout(portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    try {
      return await this.request<DashboardLayoutDTO>(`/dashboard-layouts/default${params}`)
    } catch (error) {
      // Return null if no default layout exists (404)
      return null
    }
  }

  async getDashboardLayout(layoutId: number) {
    return this.request<DashboardLayoutDTO>(`/dashboard-layouts/${layoutId}`)
  }

  async createDashboardLayout(layout: DashboardLayoutCreate) {
    return this.request<DashboardLayoutDTO>('/dashboard-layouts/', {
      method: 'POST',
      body: JSON.stringify(layout),
    })
  }

  async updateDashboardLayout(layoutId: number, update: DashboardLayoutUpdate) {
    return this.request<DashboardLayoutDTO>(`/dashboard-layouts/${layoutId}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    })
  }

  async deleteDashboardLayout(layoutId: number) {
    return this.request<void>(`/dashboard-layouts/${layoutId}`, {
      method: 'DELETE',
    })
  }

  async duplicateDashboardLayout(layoutId: number, newName: string) {
    return this.request<DashboardLayoutDTO>(
      `/dashboard-layouts/${layoutId}/duplicate?new_name=${encodeURIComponent(newName)}`,
      { method: 'POST' }
    )
  }

  async exportDashboardLayout(layoutId: number) {
    return this.request<DashboardLayoutExport>(`/dashboard-layouts/${layoutId}/export`)
  }

  async importDashboardLayout(layout: DashboardLayoutExport, portfolioId?: number) {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    return this.request<DashboardLayoutDTO>(`/dashboard-layouts/import${params}`, {
      method: 'POST',
      body: JSON.stringify(layout),
    })
  }

  async getPositionDetailedMetrics(portfolioId: number, assetId: number) {
    return this.request<{
      relative_perf_30d: number | null
      relative_perf_90d: number | null
      relative_perf_ytd: number | null
      relative_perf_1y: number | null
      sector_etf: string | null
      market_cap: number | null
      volume: number | null
      avg_volume: number | null
      pe_ratio: number | null
      eps: number | null
      asset_currency: string | null
      revenue_growth: number | null
      earnings_growth: number | null
      profit_margins: number | null
      operating_margins: number | null
      return_on_equity: number | null
      net_cash: number | null
      debt_to_equity: number | null
      current_ratio: number | null
      quick_ratio: number | null
      recommendation_key: string | null
      recommendation_mean: number | null
      num_analysts: number | null
      target_mean: number | null
      target_high: number | null
      target_low: number | null
      implied_upside_pct: number | null
    }>(`/portfolios/${portfolioId}/positions/${assetId}/detailed-metrics`)
  }
  
  async getPublicPortfolio(shareToken: string) {
    return this.request<PublicPortfolioInsights>(`/public/portfolio/${shareToken}`)
  }
}

export const api = new ApiClient(API_BASE_URL)
export default api

// Export convenience functions
export const getTopPerformers = (portfolioId: number, period?: string, limit?: number, signal?: AbortSignal) =>
  api.getTopPerformers(portfolioId, period, limit, signal)

export const getRecentTransactions = (portfolioId: number, limit?: number, signal?: AbortSignal) =>
  api.getRecentTransactions(portfolioId, limit, signal)

export const getMarketStatus = (signal?: AbortSignal) =>
  api.getMarketStatus(signal)

export const getMarketIndices = (signal?: AbortSignal) =>
  api.getMarketIndices(signal)
