import { request } from '@/api/client'
import type { AssetThemeDTO, BatchPricesResponseDTO, GoalProjectionsDTO, PortfolioDTO, PortfolioGoalCreate, PortfolioGoalDTO, PortfolioGoalUpdate, PortfolioHistoryPointDTO, PortfolioMetricsDTO, PositionDTO, PublicPortfolioInsights, TodayBriefResponseDTO } from '@/api/types'

// Portfolios
export async function getPortfolios() {
  return request<PortfolioDTO[]>('/portfolios')
}

export async function createPortfolio(portfolio: {
  name: string
  base_currency?: string
  description?: string
  is_public?: boolean
}) {
  return request<PortfolioDTO>('/portfolios', {
    method: 'POST',
    body: JSON.stringify(portfolio),
  })
}

export async function updatePortfolio(portfolioId: number, portfolio: {
  name: string
  base_currency?: string
  description?: string
  is_public?: boolean
}) {
  return request<PortfolioDTO>(`/portfolios/${portfolioId}`, {
    method: 'PUT',
    body: JSON.stringify(portfolio),
  })
}

export async function deletePortfolio(portfolioId: number) {
  return request<void>(`/portfolios/${portfolioId}`, {
    method: 'DELETE',
  })
}

export async function getPortfolioPositions(portfolioId: number) {
  return request<PositionDTO[]>(`/portfolios/${portfolioId}/positions`)
}

export async function getSoldPositions(portfolioId: number) {
  return request<PositionDTO[]>(`/portfolios/${portfolioId}/sold-positions`)
}

export async function getPortfolioHistory(portfolioId: number, period: string = "1M") {
  return request<PortfolioHistoryPointDTO[]>(`/portfolios/${portfolioId}/history?period=${period}`)
}


export async function getPortfolioMetrics(portfolioId: number) {
  return request<PortfolioMetricsDTO>(`/portfolios/${portfolioId}/metrics`)
}

export async function getTodayBrief(portfolioId: number) {
  return request<TodayBriefResponseDTO>(`/portfolios/${portfolioId}/today-brief`)
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
export async function getBatchPrices(portfolioId: number, forceRefresh: boolean = false) {
  const params = forceRefresh ? '?force_refresh=true' : ''
  return request<BatchPricesResponseDTO>(`/portfolios/${portfolioId}/prices/batch${params}`)
}

// Portfolio Goals
export async function getPortfolioGoals(portfolioId: number, activeOnly: boolean = false) {
  const params = activeOnly ? '?active_only=true' : ''
  return request<PortfolioGoalDTO[]>(`/portfolios/${portfolioId}/goals${params}`)
}

export async function getPortfolioGoal(portfolioId: number, goalId: number) {
  return request<PortfolioGoalDTO>(`/portfolios/${portfolioId}/goals/${goalId}`)
}

export async function createPortfolioGoal(portfolioId: number, goal: PortfolioGoalCreate) {
  return request<PortfolioGoalDTO>(`/portfolios/${portfolioId}/goals`, {
    method: 'POST',
    body: JSON.stringify(goal),
  })
}

export async function updatePortfolioGoal(portfolioId: number, goalId: number, goal: PortfolioGoalUpdate) {
  return request<PortfolioGoalDTO>(`/portfolios/${portfolioId}/goals/${goalId}`, {
    method: 'PUT',
    body: JSON.stringify(goal),
  })
}

export async function deletePortfolioGoal(portfolioId: number, goalId: number) {
  return request<void>(`/portfolios/${portfolioId}/goals/${goalId}`, {
    method: 'DELETE',
  })
}

export async function getGoalProjections(portfolioId: number, goalId: number) {
  return request<GoalProjectionsDTO>(`/portfolios/${portfolioId}/goals/${goalId}/projections`, {
    method: 'POST',
  })
}

export async function getPositionDetailedMetrics(portfolioId: number, assetId: number) {
  return request<{
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
    themes: AssetThemeDTO[]
  }>(`/portfolios/${portfolioId}/positions/${assetId}/detailed-metrics`)
}

export async function getPublicPortfolio(shareToken: string) {
  return request<PublicPortfolioInsights>(`/public/portfolio/${shareToken}`)
}
