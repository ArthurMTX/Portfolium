import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '../../types'
import api from '@/lib/api'
import { useWidgetVisibility } from '@/contexts/DashboardContext'

interface VIXWidgetProps extends BaseWidgetProps {
  title: string
  subtitle?: string
  batchData?: { market_vix?: unknown }
}

export default function VIXWidget({
  title,
  subtitle,
  isPreview = false,
  batchData,
}: VIXWidgetProps) {
  const { t } = useTranslation()
  const shouldLoad = useWidgetVisibility('vix-index')

  // Get data from batch if available
  const hasBatchData = !!batchData?.market_vix

  // React Query with caching and deduplication (only if no batch data)
  const { data: queryData, isLoading: queryLoading } = useQuery({
    queryKey: ['market-index', 'vix'],
    queryFn: () => api.getVIXIndex(),
    enabled: !isPreview && shouldLoad && !hasBatchData,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 2,
  })

  // Use batch data if available, otherwise use query data
  const data = (hasBatchData ? batchData.market_vix : queryData) as { price?: number; change_pct?: number } | undefined

  // Use mock data for preview, real data otherwise
  const vixPrice = isPreview ? 17.28 : data?.price ?? null
  const vixChange = isPreview ? -0.5 : data?.change_pct ?? null
  const loading = queryLoading && !isPreview && !hasBatchData

  const { volatilityLevel, volatilityColor, bgColor, iconColor } = useMemo(() => {
    if (vixPrice === null) {
      return {
        volatilityLevel: t('common.unknown'),
        volatilityColor: 'text-neutral-600 dark:text-neutral-400',
        bgColor: 'bg-neutral-50 dark:bg-neutral-900/20',
        iconColor: 'text-neutral-600 dark:text-neutral-400',
      }
    }

    // VIX interpretation:
    // < 12: Low volatility
    // 12-20: Normal volatility
    // 20-30: Elevated volatility
    // > 30: High volatility
    let volatilityLevel = ''
    let volatilityColor = ''
    let bgColor = ''
    let iconColor = ''

    if (vixPrice < 12) {
      volatilityLevel = t('dashboard.widgets.vixIndex.volatilityLevels.low')
      volatilityColor = 'text-green-600 dark:text-green-400'
      bgColor = 'bg-green-50 dark:bg-green-900/20'
      iconColor = 'text-green-600 dark:text-green-400'
    } else if (vixPrice < 20) {
      volatilityLevel = t('dashboard.widgets.vixIndex.volatilityLevels.normal')
      volatilityColor = 'text-blue-600 dark:text-blue-400'
      bgColor = 'bg-blue-50 dark:bg-blue-900/20'
      iconColor = 'text-blue-600 dark:text-blue-400'
    } else if (vixPrice < 30) {
      volatilityLevel = t('dashboard.widgets.vixIndex.volatilityLevels.elevated')
      volatilityColor = 'text-orange-600 dark:text-orange-400'
      bgColor = 'bg-orange-50 dark:bg-orange-900/20'
      iconColor = 'text-orange-600 dark:text-orange-400'
    } else {
      volatilityLevel = t('dashboard.widgets.vixIndex.volatilityLevels.high')
      volatilityColor = 'text-red-600 dark:text-red-400'
      bgColor = 'bg-red-50 dark:bg-red-900/20'
      iconColor = 'text-red-600 dark:text-red-400'
    }

    return { volatilityLevel, volatilityColor, bgColor, iconColor }
  }, [vixPrice, t])

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-start gap-2.5 mb-4">
        <div className={`w-9 h-9 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Activity className={iconColor} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t(title)}
          </h3>
          {subtitle && (
            <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 truncate">
              {t(subtitle)}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center -mt-2">
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <p className={`text-3xl font-bold ${volatilityColor}`}>
                {vixPrice !== null ? vixPrice.toFixed(2) : 'N/A'}
              </p>
              {vixChange !== null && (
                <span
                  className={`text-xs font-medium ${
                    vixChange >= 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {vixChange >= 0 ? '+' : ''}{vixChange.toFixed(2)}%
                </span>
              )}
            </div>
            <p className={`text-sm font-semibold mt-1 ${volatilityColor}`}>
              {volatilityLevel}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
