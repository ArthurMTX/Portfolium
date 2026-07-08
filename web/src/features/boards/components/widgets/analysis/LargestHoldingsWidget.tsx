import { PieChart } from 'lucide-react'
import { PositionDTO } from '@/api'
import { formatCurrency } from '@/shared/lib/formatUtils'
import AssetLogo from '@/shared/components/AssetLogo'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'

interface LargestHoldingsWidgetProps extends BaseWidgetProps {
  positions: PositionDTO[]
}

export default function LargestHoldingsWidget({ positions }: LargestHoldingsWidgetProps) {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'USD'

  // Calculate total portfolio value
  const totalValue = positions.reduce((sum, p) => {
    const value = p.market_value !== null ? Number(p.market_value) : 0
    return sum + value
  }, 0)

  // Get top 5 positions by value
  const topHoldings = [...positions]
    .filter((p) => p.market_value !== null && p.market_value > 0)
    .sort((a, b) => Number(b.market_value) - Number(a.market_value))
    .slice(0, 5)

  return (
    <BaseWidget
      title="dashboard.widgets.largestHoldings.name"
      icon={PieChart}
      iconColor="text-purple-600 dark:text-purple-400"
      iconBgColor="bg-purple-50 dark:bg-purple-900/20"
      isEmpty={topHoldings.length === 0}
      emptyMessage="dashboard.widgets.largestHoldings.noHoldingsData"
    >
      <div className="space-y-3">
        {topHoldings.map((position, idx) => {
          const allocation = totalValue > 0 ? (Number(position.market_value) / totalValue) * 100 : 0
          return (
            <div key={position.asset_id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-semibold text-neutral-400 w-4">
                    #{idx + 1}
                  </span>
                  <AssetLogo
                    symbol={position.symbol || 'UNKNOWN'}
                    assetType={position.asset_type || 'STOCK'}
                    assetName={position.name}
                    alt={position.symbol || 'Unknown'}
                    className="w-10 h-10 object-contain bg-white dark:bg-neutral-900 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {position.symbol}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {position.name}
                    </p>
                  </div>
                </div>
                <div className="text-right ml-3">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {allocation.toFixed(1)}%
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {formatCurrency(Number(position.market_value), portfolioCurrency)}
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 dark:bg-purple-400 rounded-full transition-all"
                  style={{ width: `${allocation}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </BaseWidget>
  )
}
