import type { LucideIcon } from 'lucide-react'

interface MarketIndexCardProps {
  icon: LucideIcon
  iconClass: string
  bgColor: string
  title: string
  subtitle?: string
  loading: boolean
  value: string
  valueClass: string
  change: number | null
  changePositiveClass: string
  changeNegativeClass: string
  level: string
}

export default function MarketIndexCard({
  icon: Icon,
  iconClass,
  bgColor,
  title,
  subtitle,
  loading,
  value,
  valueClass,
  change,
  changePositiveClass,
  changeNegativeClass,
  level,
}: MarketIndexCardProps) {
  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-start gap-2.5 mb-4">
        <div className={`w-9 h-9 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className={iconClass} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {title}
          </h3>
          {subtitle && (
            <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center -mt-2">
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <p className={`text-3xl font-bold ${valueClass}`}>
                {value}
              </p>
              {change !== null && (
                <span
                  className={`text-xs font-medium ${
                    change >= 0 ? changePositiveClass : changeNegativeClass
                  }`}
                >
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </span>
              )}
            </div>
            <p className={`text-sm font-semibold mt-1 ${valueClass}`}>
              {level}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
