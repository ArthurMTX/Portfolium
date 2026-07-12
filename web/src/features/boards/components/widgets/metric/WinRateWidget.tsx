import { Target } from 'lucide-react'
import { PositionDTO } from '@/api'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { useTranslation } from 'react-i18next'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetMetric } from '@/features/boards/components/widgets/base/WidgetMetric'

interface WinRateWidgetProps extends BaseWidgetProps {
  positions: PositionDTO[]
}

export default function WinRateWidget({ positions }: WinRateWidgetProps) {
  const { t } = useTranslation()
  const positionsInProfit = positions.filter(
    (p) => p.unrealized_pnl !== null && p.unrealized_pnl > 0
  ).length
  const totalPositions = positions.filter(
    (p) => p.unrealized_pnl !== null
  ).length
  const winRate = totalPositions > 0 ? (positionsInProfit / totalPositions) * 100 : 0

  const getColor = () => {
    if (winRate >= 70) return 'text-emerald-600 dark:text-emerald-400'
    if (winRate >= 50) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <BaseWidget
      title="dashboard.widgets.winRate.name"
      icon={Target}
      iconColor="text-cyan-600 dark:text-cyan-400"
      iconBgColor="bg-cyan-50 dark:bg-cyan-900/20"
      contentClassName="pf-card--content"
    >
      <WidgetMetric
        value={`${winRate.toFixed(0)}%`}
        valueColor={getColor()}
        size="lg"
        align="center"
        centerText
        secondaryLine={
          <>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {t('dashboard.widgets.winRate.positionsInProfit')}
            </p>
            <p className="text-xs text-neutral-600 dark:text-neutral-500 mt-0.5">
              {t('dashboard.widgets.winRate.profitOutOfTotal', { profit: positionsInProfit, total: totalPositions })}
            </p>
          </>
        }
      />
    </BaseWidget>
  )
}
