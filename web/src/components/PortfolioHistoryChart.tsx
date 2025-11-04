import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } from 'chart.js'
import api, { PortfolioHistoryPointDTO } from '../lib/api'
import usePortfolioStore from '../store/usePortfolioStore'
import { useTranslation } from 'react-i18next'

Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

type PeriodOption = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL'

interface Props {
  portfolioId: number
}

// Get currency symbol helper
const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'HKD': 'HK$',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF',
    'SGD': 'S$',
    'INR': '₹',
    'KRW': '₩',
  }
  return symbols[currency] || currency + ' '
}

export default function PortfolioHistoryChart({ portfolioId }: Props) {
  const { portfolios } = usePortfolioStore()
  const [period, setPeriod] = useState<PeriodOption>('1M')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<PortfolioHistoryPointDTO[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { t, i18n } = useTranslation()
  
  // Get the current locale for date formatting
  const currentLocale = i18n.language || 'en-US'
  
  // Period labels translation mapping
  const getPeriodLabel = (period: PeriodOption): string => {
    const labelMap: Record<PeriodOption, string> = {
      '1W': t('charts.period1W'),
      '1M': t('charts.period1M'),
      '3M': t('charts.period3M'),
      '6M': t('charts.period6M'),
      'YTD': t('charts.periodYTD'),
      '1Y': t('charts.period1Y'),
      'ALL': t('charts.periodALL'),
    }
    return labelMap[period]
  }
  
  // Get portfolio currency
  const portfolio = portfolios.find(p => p.id === portfolioId)
  const currency = portfolio?.base_currency || 'USD'
  const currencySymbol = getCurrencySymbol(currency)

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

  const chartData = {
    labels: history.map(h => {
      const date = new Date(h.date)
      // Format date based on period using current locale
      if (period === '1W') {
        return date.toLocaleDateString(currentLocale, { weekday: 'short', month: 'short', day: 'numeric' })
      } else if (period === '1M') {
        return date.toLocaleDateString(currentLocale, { month: 'short', day: 'numeric' })
      } else if (period === '3M') {
        return date.toLocaleDateString(currentLocale, { month: 'short', day: 'numeric' })
      } else if (period === '6M' || period === 'YTD' || period === '1Y') {
        return date.toLocaleDateString(currentLocale, { month: 'short', year: '2-digit' })
      } else {
        return date.toLocaleDateString(currentLocale, { month: 'short', year: 'numeric' })
      }
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
            // Show full date in tooltip title using current locale
            if (context.length > 0) {
              const date = new Date(history[context[0].dataIndex].date)
              return date.toLocaleDateString(currentLocale, { 
                weekday: 'short',
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })
            }
            return ''
          },
          label: (context: { parsed: { y: number | null } }) => {
            const value = context.parsed.y
            if (value === null) return ''
            return `${t('charts.value')}: ${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
          text: `${t('charts.portfolioValue')} (${currency})`,
          color: '#64748b',
          font: { size: 12 }
        },
        grid: { color: 'rgba(100,116,139,0.08)' },
        ticks: { 
          color: '#64748b', 
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
    onHover: (_event: unknown, activeElements: { index: number }[]) => {
      if (activeElements && activeElements.length > 0) {
        setHoveredIndex(activeElements[0].index)
      } else {
        setHoveredIndex(null)
      }
    },
  }

  return (
    <div>
      <div style={{ minHeight: 320 }} className="p-4">
        {loading ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
              <div className="h-8 w-32 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"></div>
            </div>
            <div style={{ height: '320px' }} className="relative">
              <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse overflow-hidden">
                {/* Fake chart line */}
                <svg className="w-full h-full opacity-30" viewBox="0 0 100 50" preserveAspectRatio="none">
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
                </svg>
              </div>
            </div>
          </div>
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
            {getPeriodLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  )
}
