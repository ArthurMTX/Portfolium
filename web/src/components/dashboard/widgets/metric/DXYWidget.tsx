import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '../../types'
import api from '@/lib/api'
import { useWidgetVisibility } from '@/contexts/DashboardContext'

interface DXYWidgetProps extends BaseWidgetProps {
  title: string
  subtitle?: string
  batchData?: { market_dxy?: unknown }
}

export default function DXYWidget({
  title,
  subtitle,
  isPreview = false,
  batchData,
}: DXYWidgetProps) {
  const { t } = useTranslation()
  const shouldLoad = useWidgetVisibility('dxy-index')

  // Get data from batch if available
  const hasBatchData = !!batchData?.market_dxy

  // React Query with caching and deduplication (only if no batch data)
  const { data: queryData, isLoading: queryLoading } = useQuery({
    queryKey: ['market-index', 'dxy'],
    queryFn: () => api.getDXYIndex(),
    enabled: !isPreview && shouldLoad && !hasBatchData,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 2,
  })

  // Use batch data if available, otherwise use query data
  const data = (hasBatchData ? batchData.market_dxy : queryData) as { price?: number; change_pct?: number } | undefined

  // Use mock data for preview, real data otherwise
  const dxyPrice = isPreview ? 106.25 : data?.price ?? null
  const dxyChange = isPreview ? 0.15 : data?.change_pct ?? null
  const loading = queryLoading && !isPreview && !hasBatchData

  const { strengthLevel, strengthColor, bgColor, iconColor } = useMemo(() => {
    if (dxyPrice === null) {
      return {
        strengthLevel: t('common.unknown'),
        strengthColor: 'text-neutral-600 dark:text-neutral-400',
        bgColor: 'bg-neutral-50 dark:bg-neutral-900/20',
        iconColor: 'text-neutral-600 dark:text-neutral-400',
      }
    }

    // DXY (U.S. Dollar Index) interpretation:
    // < 90: Very Weak
    // 90-95: Weak
    // 95-105: Normal
    // 105-115: Strong
    // > 115: Very Strong
    let strengthLevel = ''
    let strengthColor = ''
    let bgColor = ''
    let iconColor = ''

    if (dxyPrice < 90) {
      strengthLevel = t('dashboard.widgets.dxyIndex.strengthLevels.veryWeak')
      strengthColor = 'text-red-600 dark:text-red-400'
      bgColor = 'bg-red-50 dark:bg-red-900/20'
      iconColor = 'text-red-600 dark:text-red-400'
    } else if (dxyPrice < 95) {
      strengthLevel = t('dashboard.widgets.dxyIndex.strengthLevels.weak')
      strengthColor = 'text-orange-600 dark:text-orange-400'
      bgColor = 'bg-orange-50 dark:bg-orange-900/20'
      iconColor = 'text-orange-600 dark:text-orange-400'
    } else if (dxyPrice < 105) {
      strengthLevel = t('dashboard.widgets.dxyIndex.strengthLevels.normal')
      strengthColor = 'text-neutral-600 dark:text-neutral-400'
      bgColor = 'bg-neutral-50 dark:bg-neutral-900/20'
      iconColor = 'text-neutral-600 dark:text-neutral-400'
    } else if (dxyPrice < 115) {
      strengthLevel = t('dashboard.widgets.dxyIndex.strengthLevels.strong')
      strengthColor = 'text-blue-600 dark:text-blue-400'
      bgColor = 'bg-blue-50 dark:bg-blue-900/20'
      iconColor = 'text-blue-600 dark:text-blue-400'
    } else {
      strengthLevel = t('dashboard.widgets.dxyIndex.strengthLevels.veryStrong')
      strengthColor = 'text-green-600 dark:text-green-400'
      bgColor = 'bg-green-50 dark:bg-green-900/20'
      iconColor = 'text-green-600 dark:text-green-400'
    }

    return { strengthLevel, strengthColor, bgColor, iconColor }
  }, [dxyPrice, t])

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-start gap-2.5 mb-4">
        <div className={`w-9 h-9 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <DollarSign className={iconColor} size={18} />
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
              <p className={`text-3xl font-bold ${strengthColor}`}>
                {dxyPrice !== null ? dxyPrice.toFixed(2) : 'N/A'}
              </p>
              {dxyChange !== null && (
                <span
                  className={`text-xs font-medium ${
                    dxyChange >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {dxyChange >= 0 ? '+' : ''}{dxyChange.toFixed(2)}%
                </span>
              )}
            </div>
            <p className={`text-sm font-semibold mt-1 ${strengthColor}`}>
              {strengthLevel}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
