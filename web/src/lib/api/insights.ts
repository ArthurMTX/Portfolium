/* eslint-disable @typescript-eslint/no-explicit-any */
import { request } from './client'
import type { AttributionInsightsDTO, AverageHoldingPeriodDTO, BenchmarkComparisonDTO, ConcentrationMetricsDTO, ContributionItemDTO, DuplicateExposureItemDTO, ExposureInsightsDTO, HiddenConcentrationItemDTO, PerformanceInsightsDTO, PerformanceMetricsDTO, PortfolioDNADTO, PortfolioInsightsSummaryDTO, PortfolioMoveSummaryDTO, RiskInsightsDTO, RiskMetricsDTO, ScenarioResultDTO, ThemeEvolutionPointDTO, TopPerformerDTO, TransactionDTO } from './types'

// Insights
export async function getPortfolioInsights(portfolioId: number, period: string = '1y', benchmark: string = 'SPY', signal?: AbortSignal) {
  return request<any>(`/insights/${portfolioId}?period=${period}&benchmark=${benchmark}`, { signal })
}

export async function getPortfolioInsightsSummary(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
  return request<PortfolioInsightsSummaryDTO>(`/insights/${portfolioId}/summary?period=${period}`, { signal })
}

export async function getPerformanceInsights(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
  return request<PerformanceInsightsDTO>(`/insights/${portfolioId}/performance/overview?period=${period}`, { signal })
}

export async function getAttributionInsights(portfolioId: number, signal?: AbortSignal) {
  return request<AttributionInsightsDTO>(`/insights/${portfolioId}/attribution`, { signal })
}

export async function getExposureInsights(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
  return request<ExposureInsightsDTO>(`/insights/${portfolioId}/exposure?period=${period}`, { signal })
}

export async function getRiskInsights(portfolioId: number, benchmark: string = 'SPY', period: string = '1y', signal?: AbortSignal) {
  return request<RiskInsightsDTO>(`/insights/${portfolioId}/risk/overview?benchmark=${benchmark}&period=${period}`, { signal })
}

export async function getTopPerformers(portfolioId: number, period: string = '1y', limit: number = 5, signal?: AbortSignal) {
  return request<TopPerformerDTO[]>(`/insights/${portfolioId}/top-performers?period=${period}&limit=${limit}`, { signal })
}

export async function getPerformanceMetrics(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
  return request<PerformanceMetricsDTO>(`/insights/${portfolioId}/performance?period=${period}`, { signal })
}

export async function getRiskMetrics(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
  return request<RiskMetricsDTO>(`/insights/${portfolioId}/risk?period=${period}`, { signal })
}

export async function getBenchmarkComparison(portfolioId: number, benchmark: string = 'SPY', period: string = '1y', signal?: AbortSignal) {
  return request<BenchmarkComparisonDTO>(`/insights/${portfolioId}/benchmark?benchmark=${benchmark}&period=${period}`, { signal })
}

export async function getAverageHoldingPeriod(portfolioId: number, signal?: AbortSignal) {
  return request<AverageHoldingPeriodDTO>(`/insights/${portfolioId}/average-holding-period`, { signal })
}

export async function getPortfolioMoveSummary(portfolioId: number, limit: number = 8, signal?: AbortSignal) {
  return request<PortfolioMoveSummaryDTO>(`/insights/${portfolioId}/attribution/move?limit=${limit}`, { signal })
}

export async function getAssetContributions(portfolioId: number, limit: number = 10, ascending: boolean = false, signal?: AbortSignal) {
  return request<ContributionItemDTO[]>(
    `/insights/${portfolioId}/attribution/assets?limit=${limit}&ascending=${ascending}`,
    { signal }
  )
}

export async function getThemeContribution(portfolioId: number, signal?: AbortSignal) {
  return request<ContributionItemDTO[]>(`/insights/${portfolioId}/attribution/themes`, { signal })
}

export async function getSectorContribution(portfolioId: number, signal?: AbortSignal) {
  return request<ContributionItemDTO[]>(`/insights/${portfolioId}/attribution/sectors`, { signal })
}

export async function getCountryContribution(portfolioId: number, signal?: AbortSignal) {
  return request<ContributionItemDTO[]>(`/insights/${portfolioId}/attribution/countries`, { signal })
}

export async function getCurrencyContribution(portfolioId: number, signal?: AbortSignal) {
  return request<ContributionItemDTO[]>(`/insights/${portfolioId}/attribution/currencies`, { signal })
}

export async function getConcentrationMetrics(portfolioId: number, signal?: AbortSignal) {
  return request<ConcentrationMetricsDTO>(`/insights/${portfolioId}/attribution/concentration`, { signal })
}

export async function getThemeExposure(portfolioId: number, signal?: AbortSignal) {
  return request<ContributionItemDTO[]>(`/insights/${portfolioId}/exposure/themes`, { signal })
}

export async function getSectorExposure(portfolioId: number, signal?: AbortSignal) {
  return request<ContributionItemDTO[]>(`/insights/${portfolioId}/exposure/sectors`, { signal })
}

export async function getCountryExposure(portfolioId: number, signal?: AbortSignal) {
  return request<ContributionItemDTO[]>(`/insights/${portfolioId}/exposure/countries`, { signal })
}

export async function getCurrencyExposure(portfolioId: number, signal?: AbortSignal) {
  return request<ContributionItemDTO[]>(`/insights/${portfolioId}/exposure/currencies`, { signal })
}

export async function getMarketCapExposure(portfolioId: number, signal?: AbortSignal) {
  return request<ContributionItemDTO[]>(`/insights/${portfolioId}/exposure/market-caps`, { signal })
}

export async function getDuplicateExposure(portfolioId: number, signal?: AbortSignal) {
  return request<DuplicateExposureItemDTO[]>(`/insights/${portfolioId}/exposure/duplicates`, { signal })
}

export async function getHiddenConcentration(portfolioId: number, signal?: AbortSignal) {
  return request<HiddenConcentrationItemDTO[]>(`/insights/${portfolioId}/exposure/hidden-concentration`, { signal })
}

export async function getThemeEvolution(portfolioId: number, period: string = '1y', signal?: AbortSignal) {
  return request<ThemeEvolutionPointDTO[]>(`/insights/${portfolioId}/exposure/theme-evolution?period=${period}`, { signal })
}

export async function getPortfolioDNA(portfolioId: number, signal?: AbortSignal) {
  return request<PortfolioDNADTO>(`/insights/${portfolioId}/exposure/dna`, { signal })
}

export async function getScenarioAnalysis(portfolioId: number, signal?: AbortSignal) {
  return request<ScenarioResultDTO[]>(`/insights/${portfolioId}/risk/scenarios`, { signal })
}

export async function getStressTests(portfolioId: number, signal?: AbortSignal) {
  return request<ScenarioResultDTO[]>(`/insights/${portfolioId}/risk/stress-tests`, { signal })
}

export async function getRecentTransactions(portfolioId: number, limit: number = 5, signal?: AbortSignal) {
  return request<TransactionDTO[]>(`/portfolios/${portfolioId}/transactions?limit=${limit}`, { signal })
}
