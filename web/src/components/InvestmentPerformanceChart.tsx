import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } from 'chart.js'
import api, { PortfolioHistoryPointDTO } from '../lib/api'
import usePortfolioStore from '../store/usePortfolioStore'

Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

type PeriodOption = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL'

interface Props {
  portfolioId: number
}

const periodLabels: Record<PeriodOption, string> = {
  '1W': '1W',
  '1M': '1M',
  '3M': '3M',
  '6M': '6M',
  'YTD': 'YTD',
  '1Y': '1Y',
  'ALL': 'ALL',
}

export default function InvestmentPerformanceChart({ portfolioId }: Props) {
  const { portfolios } = usePortfolioStore()
  const [period, setPeriod] = useState<PeriodOption>('1M')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<PortfolioHistoryPointDTO[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  
  // Get portfolio currency
  const portfolio = portfolios.find(p => p.id === portfolioId)
  const currency = portfolio?.base_currency || 'USD'

  useEffect(() => {
    let canceled = false
    const load = async () => {
      setLoading(true)
      setHoveredIndex(null) // Reset hover state when changing period
      try {
        const data = await api.getPortfolioHistory(portfolioId, period)
        if (!canceled) setHistory(data)
      } finally {
        if (!canceled) setLoading(false)
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [portfolioId, period])

  // Calculate performance percentages
  // For ALL: show unrealized P&L % (current holdings only, matches Dashboard)
  // For specific periods: show relative performance from the start of the period (normalized to 0%)
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
    
    // For specific periods, normalize to show change from start
    // Calculate baseline from first point
    if (index === 0 || history.length === 0) {
      return 0 // First point is always 0 for period views
    }
    
    const firstPoint = history[0]
    let baselinePerf = 0
    if (firstPoint.unrealized_pnl_pct !== undefined && firstPoint.unrealized_pnl_pct !== null) {
      baselinePerf = firstPoint.unrealized_pnl_pct
    } else if (firstPoint.gain_pct !== undefined && firstPoint.gain_pct !== null) {
      baselinePerf = firstPoint.gain_pct
    } else if (firstPoint.invested && firstPoint.invested > 0) {
      baselinePerf = ((firstPoint.value - firstPoint.invested) / firstPoint.invested) * 100
    }
    
    // Return the change from baseline
    return absolutePerf - baselinePerf
  })

  const chartData = {
    labels: history.map(h => {
      const date = new Date(h.date)
      // Format date based on period
      if (period === '1W') {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      } else if (period === '1M') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      } else if (period === '3M') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      } else if (period === '6M' || period === 'YTD' || period === '1Y') {
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      }
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
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(30,41,59,0.95)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgb(236,72,153)',
        borderWidth: 1,
        padding: 12,
        caretSize: 8,
        callbacks: {
          title: (context: { dataIndex: number }[]) => {
            // Show full date in tooltip title
            if (context.length > 0) {
              const date = new Date(history[context[0].dataIndex].date)
              return date.toLocaleDateString('en-US', { 
                weekday: 'short',
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })
            }
            return ''
          },
          label: (context: { parsed: { y: number | null }; dataIndex: number }) => {
            const value = context.parsed.y
            const point = history[context.dataIndex]
            if (value === null || !point) return ''
            
            const lines = []
            
            // For period views, show the relative change
            if (period === 'ALL') {
              lines.push(`Current Holdings: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`)
              
              // Also show total invested performance if different
              if (point.gain_pct !== undefined && point.gain_pct !== null && 
                  point.unrealized_pnl_pct !== undefined && point.unrealized_pnl_pct !== null &&
                  Math.abs(point.gain_pct - point.unrealized_pnl_pct) > 0.01) {
                lines.push(`Total Invested: ${point.gain_pct >= 0 ? '+' : ''}${point.gain_pct.toFixed(2)}%`)
              }
            } else {
              // Show period performance (relative to start)
              lines.push(`Period Performance: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`)
              
              // Also show absolute unrealized P&L performance
              let absolutePerf = 0
              if (point.unrealized_pnl_pct !== undefined && point.unrealized_pnl_pct !== null) {
                absolutePerf = point.unrealized_pnl_pct
              } else if (point.gain_pct !== undefined && point.gain_pct !== null) {
                absolutePerf = point.gain_pct
              } else if (point.invested && point.invested > 0) {
                absolutePerf = ((point.value - point.invested) / point.invested) * 100
              }
              lines.push(`All-Time: ${absolutePerf >= 0 ? '+' : ''}${absolutePerf.toFixed(2)}%`)
            }
            
            if (point.invested) {
              const gain = point.value - point.invested
              const currencySymbols: Record<string, string> = {
                'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥'
              }
              const symbol = currencySymbols[currency] || currency + ' '
              lines.push(`Total Gain: ${gain >= 0 ? '+' : ''}${symbol}${Math.abs(gain).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
            }
            return lines
          }
        }
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        title: { display: false },
        grid: { display: false },
        ticks: { 
          color: '#64748b', 
          font: { size: 11 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: period === 'ALL' ? 12 : period === '1Y' ? 10 : 8,
          autoSkipPadding: 10,
        },
      },
      y: {
        title: { 
          display: true, 
          text: 'Performance (%)',
          color: '#64748b',
          font: { size: 12 }
        },
        grid: { 
          color: (context: { tick: { value: number } }) => {
            // Highlight the zero line
            return context.tick.value === 0 
              ? 'rgba(100,116,139,0.3)' 
              : 'rgba(100,116,139,0.08)'
          },
          lineWidth: (context: { tick: { value: number } }) => {
            return context.tick.value === 0 ? 2 : 1
          }
        },
        ticks: { 
          color: '#64748b', 
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
    onHover: (_event: unknown, activeElements: { index: number }[]) => {
      if (activeElements && activeElements.length > 0) {
        setHoveredIndex(activeElements[0].index)
      } else {
        setHoveredIndex(null)
      }
    },
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
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
              <div className="h-8 w-24 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
            </div>
            <div style={{ height: '320px' }} className="relative">
              <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse overflow-hidden">
                {/* Fake performance chart with zero baseline */}
                <svg className="w-full h-full opacity-30" viewBox="0 0 100 50" preserveAspectRatio="none">
                  {/* Zero baseline */}
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
                  {/* Performance line crossing zero */}
                  <path
                    d="M 0,30 L 15,28 L 25,22 L 35,20 L 45,24 L 55,26 L 65,23 L 75,20 L 85,18 L 100,16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    className="text-green-400"
                  />
                  {/* Gradient fill */}
                  <path
                    d="M 0,30 L 15,28 L 25,22 L 35,20 L 45,24 L 55,26 L 65,23 L 75,20 L 85,18 L 100,16 L 100,25 L 0,25 Z"
                    fill="currentColor"
                    className="text-green-200 dark:text-green-900 opacity-20"
                  />
                </svg>
              </div>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="text-neutral-400 text-center py-12">
            <p className="font-semibold mb-2">No performance data available</p>
            <p className="text-sm">Historical data will be calculated from your saved price records and transactions.</p>
          </div>
        ) : (
          <div>
            {/* Title and performance display */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">Portfolio Performance</h3>
                </div>
              </div>
              {displayPoint && (() => {
                const isPositive = displayPerformance > 0
                const isZero = displayPerformance === 0
                
                const currencySymbols: Record<string, string> = {
                  'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥'
                }
                const symbol = currencySymbols[currency] || currency + ' '
                
                // Determine color class based on value
                const colorClass = isZero 
                  ? 'text-neutral-500 dark:text-neutral-400'
                  : isPositive 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
                
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
      <div className="flex gap-2 mb-4 flex-wrap justify-center">
        {(['1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as PeriodOption[]).map(opt => (
          <button
            key={opt}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition shadow-sm ${
              period === opt 
                ? 'bg-pink-600 text-white border-pink-600' 
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700 hover:bg-pink-50 dark:hover:bg-pink-900/30'
            }`}
            onClick={() => setPeriod(opt)}
          >
            {periodLabels[opt]}
          </button>
        ))}
      </div>
    </div>
  )
}
