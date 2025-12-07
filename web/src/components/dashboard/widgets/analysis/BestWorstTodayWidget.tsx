import { TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { PositionDTO } from '../../../../lib/api'
import { getAssetLogoUrl, handleLogoError } from '../../../../lib/logoUtils'
import { BaseWidgetProps } from '../../types'
import { useTranslation } from 'react-i18next'

interface BestWorstTodayWidgetProps extends BaseWidgetProps {
  positions: PositionDTO[]
}

export default function BestWorstTodayWidget({ positions, isPreview: _isPreview = false }: BestWorstTodayWidgetProps) {
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

  if (!best || !worst) {
    return (
      <div className="card h-full flex items-center justify-center p-5">
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">No data available</p>
      </div>
    )
  }

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap className="text-amber-600 dark:text-amber-400" size={18} />
        </div>
        <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t('dashboard.widgets.bestWorstToday.name')}
        </h3>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto scrollbar-hide">
        {/* Best Performer */}
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
          <img
            src={getAssetLogoUrl(best.symbol, best.asset_type, best.name)}
            alt={`${best.symbol} logo`}
            className="w-10 h-10 object-contain bg-white dark:bg-neutral-900 flex-shrink-0"
            onError={(e) => handleLogoError(e, best.symbol, best.name, best.asset_type)}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <TrendingUp className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" size={12} />
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {best.symbol}
                </span>
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                +{Number(best.daily_change_pct).toFixed(2)}%
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {best.name || t('common.unknown')}
            </p>
          </div>
        </div>

        {/* Worst Performer */}
        <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-900/10 rounded-lg border border-rose-100 dark:border-rose-900/30">
          <img
            src={getAssetLogoUrl(worst.symbol, worst.asset_type, worst.name)}
            alt={`${worst.symbol} logo`}
            className="w-10 h-10 object-contain bg-white dark:bg-neutral-900 flex-shrink-0"
            onError={(e) => handleLogoError(e, worst.symbol, worst.name, worst.asset_type)}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <TrendingDown className="text-rose-600 dark:text-rose-400 flex-shrink-0" size={12} />
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {worst.symbol}
                </span>
              </div>
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex-shrink-0">
                {Number(worst.daily_change_pct).toFixed(2)}%
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {worst.name || t('common.unknown')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
