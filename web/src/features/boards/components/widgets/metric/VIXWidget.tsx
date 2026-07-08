import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '@/features/boards/components/types'
import api from '@/api'
import { useWidgetVisibility } from '@/features/boards/context/BoardContext'
import MarketIndexCard from '@/features/boards/components/widgets/metric/MarketIndexCard'

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
    refetchIntervalInBackground: false,
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
    <MarketIndexCard
      icon={Activity}
      iconClass={iconColor}
      bgColor={bgColor}
      title={t(title)}
      subtitle={subtitle ? t(subtitle) : undefined}
      loading={loading}
      value={vixPrice !== null ? vixPrice.toFixed(2) : 'N/A'}
      valueClass={volatilityColor}
      change={vixChange}
      changePositiveClass="text-red-600 dark:text-red-400"
      changeNegativeClass="text-green-600 dark:text-green-400"
      level={volatilityLevel}
    />
  )
}
