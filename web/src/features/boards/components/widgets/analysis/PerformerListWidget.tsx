import type { LucideIcon } from 'lucide-react'
import { formatCurrency } from '@/shared/lib/formatUtils'
import AssetLogo from '@/shared/components/AssetLogo'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetList } from '@/features/boards/components/widgets/base/WidgetList'
import { WidgetListItem } from '@/features/boards/components/widgets/base/WidgetListItem'

interface PerformerListItem {
  symbol: string
  name: string | null
  asset_type?: string | null
  return_pct: number
  value: number
}

interface PerformerListWidgetProps {
  icon: LucideIcon
  iconBgColor: string
  iconColor: string
  title: string
  emptyText: string
  performers: PerformerListItem[]
  portfolioCurrency: string
  isLoading?: boolean
}

export default function PerformerListWidget({
  icon,
  iconBgColor,
  iconColor,
  title,
  emptyText,
  performers,
  portfolioCurrency,
  isLoading = false,
}: PerformerListWidgetProps) {
  return (
    <BaseWidget
      title={title}
      icon={icon}
      iconColor={iconColor}
      iconBgColor={iconBgColor}
      isLoading={isLoading}
      isEmpty={performers.length === 0}
      emptyMessage={emptyText}
    >
      <WidgetList variant="cards">
        {performers.map((performer, idx) => {
          const name = performer.name || performer.symbol || 'Unknown'
          const returnPct = Number(performer.return_pct)
          const returnColor = returnPct > 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : returnPct < 0
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-neutral-600 dark:text-neutral-400'

          return (
            <WidgetListItem
              key={performer.symbol}
              leading={
                <>
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
                </>
              }
              title={performer.symbol}
              subtitle={name}
              trailing={
                <>
                  <p className={`font-semibold ${returnColor}`}>
                    {returnPct > 0 ? '+' : returnPct < 0 ? '-' : ''}{Math.abs(returnPct).toFixed(2)}%
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {formatCurrency(performer.value, portfolioCurrency)}
                  </p>
                </>
              }
            />
          )
        })}
      </WidgetList>
    </BaseWidget>
  )
}
