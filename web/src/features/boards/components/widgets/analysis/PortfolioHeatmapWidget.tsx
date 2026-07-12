import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { BaseWidgetProps } from '@/features/boards/components/types'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import api, { PositionDTO } from '@/api'
import { mockPositions } from '@/features/boards/components/utils/mockDataProvider'
import AssetLogo from '@/shared/components/AssetLogo'
import { useTranslation } from 'react-i18next'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetChartFrame } from '@/features/boards/components/widgets/base/WidgetChartFrame'

interface PortfolioHeatmapWidgetProps extends BaseWidgetProps {}

export default function PortfolioHeatmapWidget({ isPreview = false }: PortfolioHeatmapWidgetProps) {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const dataVersion = usePortfolioStore((state) => state.dataVersion)
  const [positions, setPositions] = useState<PositionDTO[]>([])
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    // Use mock data in preview mode
    if (isPreview) {
      setPositions(mockPositions)
      setLoading(false)
      return
    }

    if (!activePortfolioId) return

    let canceled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await api.getPortfolioPositions(activePortfolioId)
        if (!canceled) {
          setPositions(data.filter((p: PositionDTO) => p.market_value && p.market_value > 0))
        }
      } finally {
        if (!canceled) setLoading(false)
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [activePortfolioId, isPreview, dataVersion])

  const totalValue = useMemo(() => {
    return positions.reduce((sum, p) => sum + (Number(p.market_value) || 0), 0)
  }, [positions])

  const sortedPositions = useMemo(() => {
    return [...positions]
      .sort((a, b) => Number(b.market_value) - Number(a.market_value))
  }, [positions])

  // Get color based on daily change
  const getColor = (dailyPct: number | null) => {
    if (dailyPct === null) return 'bg-neutral-300 dark:bg-neutral-700'
    if (dailyPct > 3) return 'bg-emerald-600 dark:bg-emerald-500'
    if (dailyPct > 1) return 'bg-emerald-500 dark:bg-emerald-600'
    if (dailyPct > 0) return 'bg-emerald-400 dark:bg-emerald-700'
    if (dailyPct > -1) return 'bg-red-400 dark:bg-red-700'
    if (dailyPct > -3) return 'bg-red-500 dark:bg-red-600'
    return 'bg-red-600 dark:bg-red-500'
  }

  // Calculate grid spans based on weight
  const getGridSize = (percentage: number) => {
    if (percentage >= 20) return 'col-span-3 row-span-2'
    if (percentage >= 10) return 'col-span-2 row-span-2'
    if (percentage >= 5) return 'col-span-2 row-span-1'
    return 'col-span-1 row-span-1'
  }

  return (
    <BaseWidget
      title="dashboard.widgets.portfolioHeatmap.name"
      icon={TrendingUp}
      iconColor="text-cyan-600 dark:text-cyan-400"
      iconBgColor="bg-cyan-50 dark:bg-cyan-900/20"
      contentClassName="pf-card--content"
    >
      <WidgetChartFrame
        isLoading={loading}
        isEmpty={positions.length === 0}
        emptyMessage={t('common.positionFields.noPositions')}
      >
        <div className="grid grid-cols-4 gap-2 auto-rows-[minmax(80px,auto)] h-full overflow-y-auto scrollbar-hide">
          {sortedPositions.map((position) => {
            const percentage = totalValue > 0 ? ((Number(position.market_value) || 0) / totalValue) * 100 : 0
            const dailyPct = position.daily_change_pct !== null ? Number(position.daily_change_pct) : null
            const gridSize = getGridSize(percentage)
            const isLarge = percentage >= 10

            return (
              <div
                key={position.symbol}
                className={`${gridSize} ${getColor(dailyPct)} rounded-lg p-3 flex flex-col justify-between text-white min-h-[80px] hover:opacity-90 transition-opacity`}
                title={`${position.symbol}: ${dailyPct !== null ? `${dailyPct >= 0 ? '+' : ''}${dailyPct.toFixed(2)}%` : 'N/A'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Logo - size varies by cell size */}
                    <AssetLogo
                      symbol={position.symbol}
                      assetType={position.asset_type}
                      assetName={position.name}
                      alt={`${position.symbol} logo`}
                      className={`${isLarge ? 'w-8 h-8' : percentage >= 5 ? 'w-6 h-6' : 'w-5 h-5'} object-contain flex-shrink-0`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold ${isLarge ? 'text-base' : 'text-xs'} truncate`}>
                        {position.symbol}
                      </div>
                      {position.name && isLarge && (
                        <div className="text-xs opacity-75 truncate mt-0.5">{position.name}</div>
                      )}
                    </div>
                  </div>
                  {dailyPct !== null && (
                    <div className="flex-shrink-0">
                      {dailyPct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    </div>
                  )}
                </div>
                <div className="mt-auto">
                  <div className={`${isLarge ? 'text-sm' : 'text-xs'} opacity-90`}>
                    <span className="opacity-70">{t('charts.weight')}: </span>{percentage.toFixed(1)}%
                  </div>
                  {dailyPct !== null && (
                    <div className={`${isLarge ? 'text-sm' : 'text-xs'} font-semibold`}>
                      {dailyPct >= 0 ? '+' : ''}{dailyPct.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </WidgetChartFrame>
    </BaseWidget>
  )
}
