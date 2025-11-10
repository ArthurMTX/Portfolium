import { Target } from 'lucide-react'
import { PositionDTO } from '../../../../lib/api'
import { BaseWidgetProps } from '../../types'

interface WinRateWidgetProps extends BaseWidgetProps {
  positions: PositionDTO[]
}

export default function WinRateWidget({ positions, isPreview = false }: WinRateWidgetProps) {
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
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Target className="text-cyan-600 dark:text-cyan-400" size={18} />
        </div>
        <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Win Rate
        </h3>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-3">
        <div className="text-center">
          <p className={`text-3xl font-bold ${getColor()}`}>
            {winRate.toFixed(0)}%
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            positions in profit
          </p>
          <p className="text-xs text-neutral-600 dark:text-neutral-500 mt-0.5">
            ({positionsInProfit} out of {totalPositions} total)
          </p>
        </div>
      </div>
    </div>
  )
}
