import { AlertTriangle, Shield } from 'lucide-react'
import { PositionDTO } from '../../../../lib/api'
import { getAssetLogoUrl, handleLogoError } from '@/lib/logoUtils'
import { BaseWidgetProps } from '../../types'

interface ConcentrationRiskWidgetProps extends BaseWidgetProps {
  positions: PositionDTO[]
}

export default function ConcentrationRiskWidget({ positions, isPreview = false }: ConcentrationRiskWidgetProps) {
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
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-start justify-between gap-2.5 mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 ${
              isHighRisk
                ? 'bg-orange-50 dark:bg-orange-900/20'
                : 'bg-emerald-50 dark:bg-emerald-900/20'
            } rounded-lg flex items-center justify-center flex-shrink-0`}
          >
            {isHighRisk ? (
              <AlertTriangle className="text-orange-600 dark:text-orange-400" size={18} />
            ) : (
              <Shield className="text-emerald-600 dark:text-emerald-400" size={18} />
            )}
          </div>
          <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Concentration Risk
          </h3>
        </div>
        
        <div className="text-right">
          <p
            className={`text-2xl font-semibold ${
              isHighRisk
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {concentrationPct.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {sortedPositions.length > 0 && (
          <div className="space-y-3">
            {sortedPositions.map((position, idx) => {
              const pct = totalValue > 0 ? (Number(position.market_value) / totalValue) * 100 : 0
              return (
                <div
                  key={position.asset_id}
                  className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xs font-semibold text-neutral-400 w-4">
                      #{idx + 1}
                    </span>

                    {/* Asset Logo */}
                    <img
                      src={getAssetLogoUrl(
                        position.symbol || 'UNKNOWN',
                        position.asset_type || 'STOCK',
                        position.name
                      )}
                      alt={position.symbol || 'Unknown'}
                      className="w-10 h-10 object-contain bg-white dark:bg-neutral-900 flex-shrink-0"
                      onError={(e) => handleLogoError(
                        e,
                        position.symbol || 'UNKNOWN',
                        position.name,
                        position.asset_type
                      )}
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
                      {pct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
