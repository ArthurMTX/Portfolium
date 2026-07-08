import { AlertTriangle, Shield } from 'lucide-react'
import { PositionDTO } from '@/api'
import AssetLogo from '@/shared/components/AssetLogo'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { useTranslation } from 'react-i18next'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetList } from '@/features/boards/components/widgets/base/WidgetList'
import { WidgetListItem } from '@/features/boards/components/widgets/base/WidgetListItem'

interface ConcentrationRiskWidgetProps extends BaseWidgetProps {
  positions: PositionDTO[]
}

export default function ConcentrationRiskWidget({ positions }: ConcentrationRiskWidgetProps) {
  const { t } = useTranslation()

  // Calculate total portfolio value
  const totalValue = positions.reduce((sum, p) => {
    const value = p.market_value !== null ? Number(p.market_value) : 0
    return sum + value
  }, 0)

  // Get top 3 positions by value
  const sortedPositions = [...positions]
    .filter((p) => p.market_value !== null && p.market_value > 0)
    .sort((a, b) => Number(b.market_value) - Number(a.market_value))
    .slice(0, 3)

  const top3Value = sortedPositions.reduce(
    (sum, p) => sum + Number(p.market_value),
    0
  )

  const concentrationPct = totalValue > 0 ? (top3Value / totalValue) * 100 : 0
  const isHighRisk = concentrationPct > 60

  return (
    <BaseWidget
      title="dashboard.widgets.concentrationRisk.name"
      icon={isHighRisk ? AlertTriangle : Shield}
      iconColor={isHighRisk ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}
      iconBgColor={isHighRisk ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}
      actions={
        <p className={`text-2xl font-semibold ${isHighRisk ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {concentrationPct.toFixed(1)}%
        </p>
      }
      isEmpty={sortedPositions.length === 0}
      emptyMessage={t('common.noData')}
    >
      <WidgetList variant="cards">
        {sortedPositions.map((position, idx) => {
          const pct = totalValue > 0 ? (Number(position.market_value) / totalValue) * 100 : 0
          return (
            <WidgetListItem
              key={position.asset_id}
              leading={
                <>
                  <span className="text-xs font-semibold text-neutral-400 w-4">
                    #{idx + 1}
                  </span>
                  <AssetLogo
                    symbol={position.symbol || 'UNKNOWN'}
                    assetType={position.asset_type || 'STOCK'}
                    assetName={position.name}
                    alt={position.symbol || 'Unknown'}
                    className="w-10 h-10 object-contain flex-shrink-0"
                  />
                </>
              }
              title={position.symbol}
              subtitle={position.name}
              trailing={
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {pct.toFixed(1)}%
                </p>
              }
            />
          )
        })}
      </WidgetList>
    </BaseWidget>
  )
}
