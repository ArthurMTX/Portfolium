import { Line } from 'react-chartjs-2'
import { Chart, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } from 'chart.js'
import { useTranslation } from 'react-i18next'
import {
  ChartPeriodButtons,
  PortfolioChartSkeleton,
} from './chartShared'
import {
  CHART_GRID_COLOR,
  CHART_TICK_COLOR,
  CHART_TOOLTIP_BASE,
  CHART_ZERO_GRID_COLOR,
  createCategoryXAxis,
  createChartHoverHandler,
  createTooltipTitleCallback,
  formatChartDateLabel,
  getCurrencySymbol,
  getSignedColorClass,
} from './chartUtils'
import { usePortfolioHistoryChart } from './usePortfolioHistoryChart'

Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

interface Props {
  portfolioId: number
}

export default function InvestmentPerformanceChart({ portfolioId }: Props) {
  const { t, i18n } = useTranslation()
  const { period, setPeriod, loading, history, hoveredIndex, setHoveredIndex, currentLocale, currency } =
    usePortfolioHistoryChart(portfolioId, i18n.language)

  // Calculate performance percentages
  // For ALL: show unrealized P&L % (current holdings only, matches Dashboard)
  // For specific periods: show money-weighted returns accounting for cash flows
  const performanceData = history.map((point, index) => {
    // Get absolute performance at this point
    let absolutePerf = 0
    
    // Use unrealized_pnl_pct if available (current holdings performance, matches Dashboard)
    // Otherwise fall back to gain_pct (total invested performance)
    if (point.unrealized_pnl_pct !== undefined && point.unrealized_pnl_pct !== null) {
      absolutePerf = point.unrealized_pnl_pct
    } else if (point.gain_pct !== undefined && point.gain_pct !== null) {
      absolutePerf = point.gain_pct
    } else if (point.invested && point.invested > 0) {
      absolutePerf = ((point.value - point.invested) / point.invested) * 100
    }
    
    // For ALL period, show absolute performance
    if (period === 'ALL') {
      return absolutePerf
    }
    
    // For specific periods, calculate money-weighted return from starting value
    // This accounts for deposits/withdrawals during the period
    if (index === 0 || history.length === 0) {
      return 0 // First point is always 0 for period views
    }
    
    const firstPoint = history[0]
    const startValue = firstPoint.value
    const startInvested = firstPoint.invested || firstPoint.value
    const currentValue = point.value
    const currentInvested = point.invested || point.value
    
    // Calculate net capital change (deposits - withdrawals)
    const capitalChange = currentInvested - startInvested
    
    // Calculate value change accounting for capital flows
    // Period return = (End Value - Start Value - Net Deposits) / Start Value * 100
    if (startValue > 0) {
      const valueChange = currentValue - startValue - capitalChange
      return (valueChange / startValue) * 100
    }
    
    return 0
  })

  const chartData = {
    labels: history.map(h => {
      const date = new Date(h.date)
      return formatChartDateLabel(date, period, currentLocale)
    }),
    datasets: [
      {
        label: 'Performance',
        data: performanceData,
        borderColor: 'rgb(148,163,184)', // Default color, will be overridden by segment
        backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
          const {ctx: c, chartArea} = ctx.chart || {}
          if (!chartArea) return 'rgba(34,197,94,0.1)'
          
          // Check if any values are negative
          const hasNegative = performanceData.some(val => val < 0)
          const hasPositive = performanceData.some(val => val > 0)
          
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          
          if (hasNegative && hasPositive) {
            // Mixed: green at top, red at bottom
            gradient.addColorStop(0, 'rgba(34,197,94,0.25)')
            gradient.addColorStop(0.5, 'rgba(148,163,184,0.05)')
            gradient.addColorStop(1, 'rgba(239,68,68,0.25)')
          } else if (hasNegative) {
            // All negative: red gradient
            gradient.addColorStop(0, 'rgba(239,68,68,0.05)')
            gradient.addColorStop(1, 'rgba(239,68,68,0.25)')
          } else {
            // All positive: green gradient
            gradient.addColorStop(0, 'rgba(34,197,94,0.25)')
            gradient.addColorStop(1, 'rgba(34,197,94,0.05)')
          }
          
          return gradient
        },
        segment: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          borderColor: (ctx: any) => {
            // Different color for positive vs negative segments
            return ctx.p0.parsed.y >= 0 && ctx.p1.parsed.y >= 0 
              ? 'rgb(34,197,94)' 
              : ctx.p0.parsed.y < 0 && ctx.p1.parsed.y < 0
              ? 'rgb(239,68,68)'
              : 'rgb(148,163,184)' // neutral for crossing zero
          }
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
          label: (context: { parsed: { y: number | null }; dataIndex: number }) => {
            const value = context.parsed.y
            const point = history[context.dataIndex]
            if (value === null || !point) return ''
            
            const lines = []
            
            // For period views, show the relative change
            if (period === 'ALL') {
              lines.push(`${t('charts.currentHoldings')} ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`)
              
              // Also show total invested performance if different
              if (point.gain_pct !== undefined && point.gain_pct !== null && 
                  point.unrealized_pnl_pct !== undefined && point.unrealized_pnl_pct !== null &&
                  Math.abs(point.gain_pct - point.unrealized_pnl_pct) > 0.01) {
                lines.push(`${t('charts.totalInvested')}: ${point.gain_pct >= 0 ? '+' : ''}${point.gain_pct.toFixed(2)}%`)
              }
            } else {
              // Show period performance (relative to start)
              lines.push(`${t('charts.periodPerformance')}: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`)

              // Also show absolute unrealized P&L performance
              let absolutePerf = 0
              if (point.unrealized_pnl_pct !== undefined && point.unrealized_pnl_pct !== null) {
                absolutePerf = point.unrealized_pnl_pct
              } else if (point.gain_pct !== undefined && point.gain_pct !== null) {
                absolutePerf = point.gain_pct
              } else if (point.invested && point.invested > 0) {
                absolutePerf = ((point.value - point.invested) / point.invested) * 100
              }
              lines.push(`${t('charts.allTimePerformance')}: ${absolutePerf >= 0 ? '+' : ''}${absolutePerf.toFixed(2)}%`)
            }
            
            if (point.invested) {
              const gain = point.value - point.invested
              const symbol = getCurrencySymbol(currency)
              lines.push(`${t('charts.totalGainLoss')}: ${gain >= 0 ? '+' : ''}${symbol}${Math.abs(gain).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
            }
            return lines
          }
        }
      },
    },
    scales: {
      x: createCategoryXAxis(period),
      y: {
        title: { 
          display: true, 
          text: `${t('charts.performanceLabel')} (%)`,
          color: CHART_TICK_COLOR,
          font: { size: 12 }
        },
        grid: { 
          color: (context: { tick: { value: number } }) => {
            // Highlight the zero line
            return context.tick.value === 0 
              ? CHART_ZERO_GRID_COLOR
              : CHART_GRID_COLOR
          },
          lineWidth: (context: { tick: { value: number } }) => {
            return context.tick.value === 0 ? 2 : 1
          }
        },
        ticks: { 
          color: CHART_TICK_COLOR,
          font: { size: 11 },
          callback: (value: string | number) => {
            return `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(0)}%`
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

  // Determine which data point to display (hovered or last)
  const displayIndex = hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < history.length 
    ? hoveredIndex 
    : history.length - 1
  const displayPoint = history[displayIndex]
  const displayPerformance = displayIndex >= 0 && displayIndex < performanceData.length 
    ? performanceData[displayIndex] 
    : 0

  // Calculate gain amount for display
  let displayGainAmount = 0
  if (displayPoint) {
    if (period === 'ALL') {
      // For ALL period, show unrealized gain of current holdings (matches Dashboard)
      if (displayPoint.cost_basis !== undefined && displayPoint.cost_basis !== null) {
        displayGainAmount = displayPoint.value - displayPoint.cost_basis
      } else {
        displayGainAmount = displayPoint.value - (displayPoint.invested || 0)
      }
    } else if (history.length > 0) {
      const firstPoint = history[0]
      const startGain = firstPoint.value - (firstPoint.invested || 0)
      const currentGain = displayPoint.value - (displayPoint.invested || 0)
      displayGainAmount = currentGain - startGain
    }
  }

  return (
    <div>
      <div style={{ minHeight: 320 }} className="p-4">
        {loading ? (
          <PortfolioChartSkeleton metricWidthClass="w-24">
            <line
              x1="0"
              y1="25"
              x2="100"
              y2="25"
              stroke="currentColor"
              strokeWidth="0.3"
              strokeDasharray="2,2"
              className="text-neutral-400"
            />
            <path
              d="M 0,30 L 15,28 L 25,22 L 35,20 L 45,24 L 55,26 L 65,23 L 75,20 L 85,18 L 100,16"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-green-400"
            />
            <path
              d="M 0,30 L 15,28 L 25,22 L 35,20 L 45,24 L 55,26 L 65,23 L 75,20 L 85,18 L 100,16 L 100,25 L 0,25 Z"
              fill="currentColor"
              className="text-green-200 dark:text-green-900 opacity-20"
            />
          </PortfolioChartSkeleton>
        ) : history.length === 0 ? (
          <div className="text-neutral-400 text-center py-12">
            <p className="font-semibold mb-2">{t('charts.noPortfolioPerformance')}</p>
            <p className="text-sm">{t('charts.noPortfolioPerformanceInfo')}</p>
          </div>
        ) : (
          <div>
            {/* Title and performance display */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">{t('charts.portfolioPerformanceLabel')}</h3>
                </div>
              </div>
              {displayPoint && (() => {
                const isPositive = displayPerformance > 0
                const symbol = getCurrencySymbol(currency)
                const colorClass = getSignedColorClass(displayPerformance)
                
                return (
                  <div className="flex items-center gap-3">
                    <p className={`text-2xl font-bold ${colorClass}`}>
                      {isPositive ? '+' : ''}{displayPerformance.toFixed(2)}%
                    </p>
                    <div className="flex flex-col items-end gap-0.5">
                      <p className={`text-sm font-medium ${colorClass}`}>
                        {displayGainAmount > 0 ? '+' : ''}{symbol}{Math.abs(displayGainAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
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
      
      {/* Time period buttons */}
      <ChartPeriodButtons period={period} onChange={setPeriod} t={t} />
    </div>
  )
}
