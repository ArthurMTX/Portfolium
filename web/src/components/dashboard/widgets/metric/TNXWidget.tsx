import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '../../types'
import api from '@/lib/api'
import { useWidgetVisibility } from '@/contexts/DashboardContext'

interface TNXWidgetProps extends BaseWidgetProps {
  title: string
  subtitle?: string
  batchData?: { market_tnx?: unknown }
}

export default function TNXWidget({
  title,
  subtitle,
  isPreview = false,
  batchData,
}: TNXWidgetProps) {
  const { t } = useTranslation()
  const shouldLoad = useWidgetVisibility('tnx-index')

  // Get data from batch if available
  const hasBatchData = !!batchData?.market_tnx

  // React Query with caching and deduplication (only if no batch data)
  const { data: queryData, isLoading: queryLoading } = useQuery({
    queryKey: ['market-index', 'tnx'],
    queryFn: () => api.getTNXIndex(),
    enabled: !isPreview && shouldLoad && !hasBatchData,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 2,
  })

  // Use batch data if available, otherwise use query data
  const data = (hasBatchData ? batchData.market_tnx : queryData) as { price?: number; change_pct?: number } | undefined

  // Use mock data for preview, real data otherwise
  const tnxPrice = isPreview ? 4.25 : data?.price ?? null
  const tnxChange = isPreview ? 0.3 : data?.change_pct ?? null
  const loading = queryLoading && !isPreview && !hasBatchData

  const { yieldLevel, yieldColor, bgColor, iconColor } = useMemo(() => {
    if (tnxPrice === null) {
      return {
        yieldLevel: t('common.unknown'),
        yieldColor: 'text-neutral-600 dark:text-neutral-400',
        bgColor: 'bg-neutral-50 dark:bg-neutral-900/20',
        iconColor: 'text-neutral-600 dark:text-neutral-400',
      }
    }

    // TNX (10-Year Treasury) interpretation:
    // < 2%: Very Low
    // 2-3%: Low
    // 3-4%: Normal
    // 4-5%: Elevated
    // > 5%: High
    let yieldLevel = ''
    let yieldColor = ''
    let bgColor = ''
    let iconColor = ''

    if (tnxPrice < 2) {
      yieldLevel = t('dashboard.widgets.tnxIndex.yieldLevels.veryLow')
      yieldColor = 'text-blue-600 dark:text-blue-400'
      bgColor = 'bg-blue-50 dark:bg-blue-900/20'
      iconColor = 'text-blue-600 dark:text-blue-400'
    } else if (tnxPrice < 3) {
      yieldLevel = t('dashboard.widgets.tnxIndex.yieldLevels.low')
      yieldColor = 'text-green-600 dark:text-green-400'
      bgColor = 'bg-green-50 dark:bg-green-900/20'
      iconColor = 'text-green-600 dark:text-green-400'
    } else if (tnxPrice < 4) {
      yieldLevel = t('dashboard.widgets.tnxIndex.yieldLevels.normal')
      yieldColor = 'text-neutral-600 dark:text-neutral-400'
      bgColor = 'bg-neutral-50 dark:bg-neutral-900/20'
      iconColor = 'text-neutral-600 dark:text-neutral-400'
    } else if (tnxPrice < 5) {
      yieldLevel = t('dashboard.widgets.tnxIndex.yieldLevels.elevated')
      yieldColor = 'text-orange-600 dark:text-orange-400'
      bgColor = 'bg-orange-50 dark:bg-orange-900/20'
      iconColor = 'text-orange-600 dark:text-orange-400'
    } else {
      yieldLevel = t('dashboard.widgets.tnxIndex.yieldLevels.high')
      yieldColor = 'text-red-600 dark:text-red-400'
      bgColor = 'bg-red-50 dark:bg-red-900/20'
      iconColor = 'text-red-600 dark:text-red-400'
    }

    return { yieldLevel, yieldColor, bgColor, iconColor }
  }, [tnxPrice, t])

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-start gap-2.5 mb-4">
        <div className={`w-9 h-9 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <TrendingUp className={iconColor} size={18} />
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
              <p className={`text-3xl font-bold ${yieldColor}`}>
                {tnxPrice !== null ? `${tnxPrice.toFixed(2)}%` : 'N/A'}
              </p>
              {tnxChange !== null && (
                <span
                  className={`text-xs font-medium ${
                    tnxChange >= 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {tnxChange >= 0 ? '+' : ''}{tnxChange.toFixed(2)}%
                </span>
              )}
            </div>
            <p className={`text-sm font-semibold mt-1 ${yieldColor}`}>
              {yieldLevel}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
