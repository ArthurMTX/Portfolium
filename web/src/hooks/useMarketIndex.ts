import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useWidgetVisibility } from '@/contexts/DashboardContext'

interface MarketIndexData {
  price: number
  change_pct: number
}

/**
 * Custom hook for fetching market index data with React Query
 * Provides automatic caching, deduplication, and background refetching
 * 
 * @param indexType - Type of market index ('tnx' | 'dxy' | 'vix')
 * @param widgetId - Widget ID for visibility tracking
 * @param isPreview - Whether in preview mode (disables fetching)
 * @returns Query result with data, loading state, and error
 * 
 * @example
 * const { data, isLoading, error } = useMarketIndex('tnx', 'tnx-index', false)
 */
export function useMarketIndex(
  indexType: 'tnx' | 'dxy' | 'vix',
  widgetId: string,
  isPreview = false
) {
  const shouldLoad = useWidgetVisibility(widgetId)

  return useQuery<MarketIndexData>({
    queryKey: ['market-index', indexType],
    queryFn: async () => {
      switch (indexType) {
        case 'tnx':
          return await api.getTNXIndex()
        case 'dxy':
          return await api.getDXYIndex()
        case 'vix':
          return await api.getVIXIndex()
        default:
          throw new Error(`Unknown index type: ${indexType}`)
      }
    },
    enabled: !isPreview && shouldLoad, // Only fetch when not preview and visible
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds
    retry: 2, // Retry failed requests twice
  })
}
