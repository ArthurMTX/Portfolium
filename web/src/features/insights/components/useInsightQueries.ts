import { useQuery } from '@tanstack/react-query'
import api from '@/api'

const INSIGHTS_STALE_TIME = 5 * 60 * 1000
const INSIGHTS_GC_TIME = 15 * 60 * 1000

const insightQueryDefaults = {
  staleTime: INSIGHTS_STALE_TIME,
  gcTime: INSIGHTS_GC_TIME,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
}

const insightQueryKeys = {
  performance: (portfolioId: number, period: string) => ['insights', portfolioId, 'performance-overview', period] as const,
  benchmark: (portfolioId: number, benchmark: string, period: string) => ['insights', portfolioId, 'benchmark', benchmark, period] as const,
  attribution: (portfolioId: number) => ['insights', portfolioId, 'attribution-domain'] as const,
  exposure: (portfolioId: number, period: string) => ['insights', portfolioId, 'exposure-domain', period] as const,
  risk: (portfolioId: number, benchmark: string, period: string) => ['insights', portfolioId, 'risk-overview', benchmark, period] as const,
}

export function usePerformanceInsights(portfolioId: number, period: string) {
  return useQuery({
    ...insightQueryDefaults,
    queryKey: insightQueryKeys.performance(portfolioId, period),
    queryFn: ({ signal }) => api.getPerformanceInsights(portfolioId, period, signal),
  })
}

export function useBenchmarkInsights(portfolioId: number, benchmark: string, period: string) {
  return useQuery({
    ...insightQueryDefaults,
    queryKey: insightQueryKeys.benchmark(portfolioId, benchmark, period),
    queryFn: ({ signal }) => api.getBenchmarkComparison(portfolioId, benchmark, period, signal),
  })
}

export function useAttributionInsights(portfolioId: number) {
  return useQuery({
    ...insightQueryDefaults,
    queryKey: insightQueryKeys.attribution(portfolioId),
    queryFn: ({ signal }) => api.getAttributionInsights(portfolioId, signal),
  })
}

export function useExposureInsights(portfolioId: number, period: string) {
  return useQuery({
    ...insightQueryDefaults,
    queryKey: insightQueryKeys.exposure(portfolioId, period),
    queryFn: ({ signal }) => api.getExposureInsights(portfolioId, period, signal),
  })
}

export function useRiskInsights(portfolioId: number, benchmark: string, period: string) {
  return useQuery({
    ...insightQueryDefaults,
    queryKey: insightQueryKeys.risk(portfolioId, benchmark, period),
    queryFn: ({ signal }) => api.getRiskInsights(portfolioId, benchmark, period, signal),
  })
}
