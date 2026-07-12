import { useQuery } from '@tanstack/react-query'
import { Globe } from 'lucide-react'
import { getMarketStatus } from '@/api'
import { useWidgetVisibility } from '@/features/boards/context/BoardContext'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { useTranslation } from 'react-i18next'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetList } from '@/features/boards/components/widgets/base/WidgetList'
import { WidgetListItem } from '@/features/boards/components/widgets/base/WidgetListItem'

interface MarketRegion {
  name: string
  key: 'us' | 'europe' | 'asia' | 'oceania'
}

const regions: MarketRegion[] = [
  { name: 'USA', key: 'us' },
  { name: 'Europe', key: 'europe' },
  { name: 'Asia', key: 'asia' },
  { name: 'Oceania', key: 'oceania' },
]

interface MarketStatusWidgetProps extends BaseWidgetProps {}

export default function MarketStatusWidget({ isPreview = false }: MarketStatusWidgetProps) {
  const shouldLoad = useWidgetVisibility('market-status')
  const { t } = useTranslation()

  const { data: health, isLoading } = useQuery({
    queryKey: ['market-status'],
    queryFn: () => getMarketStatus(),
    refetchInterval: isPreview ? false : 60000, // Refetch every minute (disabled in preview)
    enabled: isPreview || shouldLoad, // In preview mode, MockDataProvider intercepts
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-emerald-500'
      case 'premarket':
      case 'afterhours':
        return 'bg-amber-500'
      case 'closed':
        return 'bg-rose-500'
      default:
        return 'bg-neutral-400'
    }
  }

  const getStatusLabel = (status: string, isUS: boolean = false) => {
    // For US markets, show detailed status
    if (isUS) {
      switch (status) {
        case 'open':
          return t('market.status.open')
        case 'premarket':
          return t('market.status.premarket')
        case 'afterhours':
          return t('market.status.afterhours')
        case 'closed':
          return t('market.status.closed')
        default:
          return t('market.status.unknown')
      }
    }

    // For other regions, simple open/closed
    switch (status) {
      case 'open':
        return t('market.status.open')
      case 'closed':
        return t('market.status.closed')
      default:
        return t('market.status.unknown')
    }
  }

  const getRegionStatus = (regionKey: 'us' | 'europe' | 'asia' | 'oceania') => {
    if (regionKey === 'us') {
      return health?.market_status || t('market.status.unknown')
    }
    return health?.market_statuses?.[regionKey] || t('market.status.unknown')
  }

  return (
    <BaseWidget
      title="common.marketStatus"
      icon={Globe}
      iconColor="text-sky-600 dark:text-sky-400"
      iconBgColor="bg-sky-50 dark:bg-sky-900/20"
      isLoading={isLoading}
    >
      <WidgetList variant="cards">
        {regions.map((region) => {
          const status = getRegionStatus(region.key)
          const isUS = region.key === 'us'

          return (
            <WidgetListItem
              key={region.key}
              leading={<div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />}
              title={t(`market.regions.${region.key}`)}
              trailing={<span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{getStatusLabel(status, isUS)}</span>}
            />
          )
        })}
      </WidgetList>
    </BaseWidget>
  )
}
