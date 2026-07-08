import type { LucideIcon } from 'lucide-react'
import { formatCurrency } from '@/shared/lib/formatUtils'
import AssetLogo from '@/shared/components/AssetLogo'

interface PerformerListItem {
  symbol: string
  name: string | null
  asset_type?: string | null
  return_pct: number
  value: number
}

interface PerformerListWidgetProps {
  icon: LucideIcon
  iconBgClass: string
  iconClass: string
  title: string
  emptyText: string
  performers: PerformerListItem[]
  portfolioCurrency: string
}

export default function PerformerListWidget({
  icon: Icon,
  iconBgClass,
  iconClass,
  title,
  emptyText,
  performers,
  portfolioCurrency,
}: PerformerListWidgetProps) {
  return (
    <div className="card h-full flex flex-col p-5 overflow-y-auto scrollbar-hide">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-9 h-9 ${iconBgClass} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className={iconClass} size={18} />
        </div>
        <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {title}
        </h3>
      </div>

      {performers.length === 0 ? (
        <p className="text-neutral-500 dark:text-neutral-400 text-sm text-center py-8">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-3">
          {performers.map((performer, idx) => {
            const name = performer.name || performer.symbol || 'Unknown'
            const returnPct = Number(performer.return_pct)
            const returnColor = returnPct > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : returnPct < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-neutral-600 dark:text-neutral-400'

            return (
              <div
                key={performer.symbol}
                className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs font-semibold text-neutral-400 w-4">
                    #{idx + 1}
                  </span>

                  <AssetLogo
                    symbol={performer.symbol || 'UNKNOWN'}
                    assetType={performer.asset_type || 'STOCK'}
                    assetName={name}
                    alt={performer.symbol || 'Unknown'}
                    className="w-10 h-10 object-contain bg-white dark:bg-neutral-900 flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {performer.symbol}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {name}
                    </p>
                  </div>
                </div>
                <div className="text-right ml-3">
                  <p className={`font-semibold ${returnColor}`}>
                    {returnPct > 0 ? '+' : returnPct < 0 ? '-' : ''}{Math.abs(returnPct).toFixed(2)}%
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {formatCurrency(performer.value, portfolioCurrency)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
