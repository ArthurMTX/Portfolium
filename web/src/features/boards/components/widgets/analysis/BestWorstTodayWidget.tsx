import { TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { PositionDTO } from '@/api'
import AssetLogo from '@/shared/components/AssetLogo'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { useTranslation } from 'react-i18next'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetList } from '@/features/boards/components/widgets/base/WidgetList'
import { WidgetListItem } from '@/features/boards/components/widgets/base/WidgetListItem'

interface BestWorstTodayWidgetProps extends BaseWidgetProps {
  positions: PositionDTO[]
}

export default function BestWorstTodayWidget({ positions }: BestWorstTodayWidgetProps) {
  const { t } = useTranslation()

  // Filter positions with valid daily change
  const validPositions = positions.filter(
    (p) => p.daily_change_pct !== null && p.market_value !== null && p.market_value > 0
  )

  // Find best and worst by daily change %
  const best = validPositions.reduce((max, p) =>
    Number(p.daily_change_pct) > Number(max.daily_change_pct) ? p : max
  , validPositions[0])

  const worst = validPositions.reduce((min, p) =>
    Number(p.daily_change_pct) < Number(min.daily_change_pct) ? p : min
  , validPositions[0])

  return (
    <BaseWidget
      title="dashboard.widgets.bestWorstToday.name"
      icon={Zap}
      iconColor="text-amber-600 dark:text-amber-400"
      iconBgColor="bg-amber-50 dark:bg-amber-900/20"
      isEmpty={!best || !worst}
      emptyMessage="common.noData"
    >
      {best && worst && (
        <WidgetList variant="cards">
          <WidgetListItem
            leading={
              <AssetLogo
                symbol={best.symbol}
                assetType={best.asset_type}
                assetName={best.name}
                alt={`${best.symbol} logo`}
                className="w-10 h-10 object-contain bg-white dark:bg-neutral-900 flex-shrink-0"
              />
            }
            className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30"
            title={
              <span className="flex items-center gap-1">
                <TrendingUp className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" size={12} />
                {best.symbol}
              </span>
            }
            subtitle={best.name || t('common.unknown')}
            trailing={
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                +{Number(best.daily_change_pct).toFixed(2)}%
              </span>
            }
          />
          <WidgetListItem
            leading={
              <AssetLogo
                symbol={worst.symbol}
                assetType={worst.asset_type}
                assetName={worst.name}
                alt={`${worst.symbol} logo`}
                className="w-10 h-10 object-contain bg-white dark:bg-neutral-900 flex-shrink-0"
              />
            }
            className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30"
            title={
              <span className="flex items-center gap-1">
                <TrendingDown className="text-rose-600 dark:text-rose-400 flex-shrink-0" size={12} />
                {worst.symbol}
              </span>
            }
            subtitle={worst.name || t('common.unknown')}
            trailing={
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {Number(worst.daily_change_pct).toFixed(2)}%
              </span>
            }
          />
        </WidgetList>
      )}
    </BaseWidget>
  )
}
