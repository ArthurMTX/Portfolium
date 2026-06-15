import { Line } from 'react-chartjs-2'
import { Chart, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } from 'chart.js'
import { useTranslation } from 'react-i18next'
import {
  ChartPeriodButtons,
  PortfolioChartSkeleton,
} from '@/features/charts/components/chartShared'
import {
  CHART_GRID_COLOR,
  CHART_TICK_COLOR,
  CHART_TOOLTIP_BASE,
  createCategoryXAxis,
  createChartHoverHandler,
  createTooltipTitleCallback,
  formatChartDateLabel,
  getCurrencySymbol,
} from '@/features/charts/components/chartUtils'
import { usePortfolioHistoryChart } from '@/features/charts/hooks/usePortfolioHistoryChart'

Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

interface Props {
  portfolioId: number
}

export default function PortfolioHistoryChart({ portfolioId }: Props) {
  const { t, i18n } = useTranslation()
  const { period, setPeriod, loading, history, hoveredIndex, setHoveredIndex, currentLocale, currency } =
    usePortfolioHistoryChart(portfolioId, i18n.language)
  const currencySymbol = getCurrencySymbol(currency)

  const chartData = {
    labels: history.map(h => {
      const date = new Date(h.date)
      return formatChartDateLabel(date, period, currentLocale)
    }),
    datasets: [
      {
        label: 'Portfolio Value',
        data: history.map(h => h.value),
        borderColor: 'rgb(236,72,153)',
        backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
          const chart = ctx.chart
          const {ctx: c, chartArea} = chart || {}
          if (!chartArea) return 'rgba(236,72,153,0.1)'
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, 'rgba(236,72,153,0.25)')
          gradient.addColorStop(1, 'rgba(236,72,153,0.02)')
          return gradient
        },
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        borderWidth: 2,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: 'rgb(236,72,153)',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...CHART_TOOLTIP_BASE,
        callbacks: {
          title: createTooltipTitleCallback(history, currentLocale),
          label: (context: { parsed: { y: number | null } }) => {
            const value = context.parsed.y
            if (value === null) return ''
            return `${t('fields.value')}: ${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
        }
      },
    },
    scales: {
      x: createCategoryXAxis(period),
      y: {
        title: { 
          display: true, 
          text: `${t('charts.portfolioValue')} (${currency})`,
          color: CHART_TICK_COLOR,
          font: { size: 12 }
        },
        grid: { color: CHART_GRID_COLOR },
        ticks: { 
          color: CHART_TICK_COLOR,
          font: { size: 11 },
          callback: (value: string | number) => {
            return `${currencySymbol}${Number(value).toLocaleString()}`
          }
        },
      },
    },
    interaction: { mode: 'nearest' as const, intersect: false },
    maintainAspectRatio: false,
    animation: {
      duration: 400,
      easing: 'easeInOutQuart' as const,
    },
    onHover: createChartHoverHandler(setHoveredIndex),
  }

  return (
    <div>
      <div style={{ minHeight: 320 }} className="p-4">
        {loading ? (
          <PortfolioChartSkeleton metricWidthClass="w-32">
            <path
              d="M 0,40 L 10,38 L 20,35 L 30,36 L 40,32 L 50,28 L 60,30 L 70,25 L 80,22 L 90,20 L 100,18"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-pink-400"
            />
            <path
              d="M 0,40 L 10,38 L 20,35 L 30,36 L 40,32 L 50,28 L 60,30 L 70,25 L 80,22 L 90,20 L 100,18 L 100,50 L 0,50 Z"
              fill="currentColor"
              className="text-pink-200 dark:text-pink-900 opacity-20"
            />
          </PortfolioChartSkeleton>
        ) : history.length === 0 ? (
          <div className="text-neutral-400 text-center py-12">
            <p className="font-semibold mb-2">{t('charts.noPortfolioHistory')}</p>
            <p className="text-sm">{t('charts.noPortfolioHistoryInfo')}</p>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">{t('charts.portfolioValueLabel')}</h3>
              {history.length > 0 && (() => {
                // Determine which point to display (hovered or last)
                const displayIndex = hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < history.length 
                  ? hoveredIndex 
                  : history.length - 1
                const displayPoint = history[displayIndex]
                
                const firstPoint = history[0]
                const hasZeroStartingPoint = firstPoint.value === 0 && firstPoint.invested === 0 && history.length > 1
                
                // For period gain calculations, skip zero starting point
                const effectiveFirstPoint = hasZeroStartingPoint ? history[1] : firstPoint
                
                // If hovering over the zero point, use the effective first point for display
                const isHoveringZeroPoint = displayIndex === 0 && hasZeroStartingPoint
                const effectiveDisplayPoint = isHoveringZeroPoint ? effectiveFirstPoint : displayPoint
                const displayValue = effectiveDisplayPoint.value
                
                // For "in period" change display:
                // - If there's a zero starting point: show change from 0 (total growth)
                // - Otherwise: show change from first point
                const changeFromValue = hasZeroStartingPoint ? 0 : firstPoint.value
                const absoluteChange = displayValue - changeFromValue
                const isPositive = absoluteChange >= 0
                
                // Calculate TRUE investment gain for the period
                // Gain = (End Value - End Invested) - (Start Value - Start Invested)
                // This excludes the effect of deposits/withdrawals during the period
                // Always use effective first point (skipping zero) for percentage calculations
                let periodGainPct = null
                if (effectiveFirstPoint.invested && effectiveDisplayPoint.invested && effectiveFirstPoint.invested > 0 && effectiveFirstPoint.value > 0) {
                  const startGain = effectiveFirstPoint.value - effectiveFirstPoint.invested
                  const endGain = displayValue - effectiveDisplayPoint.invested
                  const actualGain = endGain - startGain
                  // Calculate % based on the value at start of period
                  periodGainPct = (actualGain / effectiveFirstPoint.value) * 100
                }
                
                return (
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-bold text-neutral-800 dark:text-neutral-100">
                      {currencySymbol}{displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex flex-col items-end gap-0.5">
                      <p className={`text-sm font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isPositive ? '+' : ''}{currencySymbol}{Math.abs(absoluteChange).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('charts.inPeriod')}
                      </p>
                      {periodGainPct !== null && (
                        <p className={`text-xs font-semibold ${periodGainPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {periodGainPct >= 0 ? '+' : ''}{periodGainPct.toFixed(2)}% {t('charts.inPeriod')}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
            <div 
              style={{ height: '320px' }}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        )}
      </div>
      
      <ChartPeriodButtons period={period} onChange={setPeriod} t={t} />
    </div>
  )
}
