import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import api from '@/api'
import { useTranslation } from 'react-i18next'
import { getAssetLogoUrl, handleLogoError } from '@/shared/lib/logoUtils'
import { ChartPeriodButtons } from '@/features/charts/components/chartShared'
import {
  CHART_ACCENT_COLOR,
  CHART_GRID_COLOR,
  CHART_TICK_COLOR,
  CHART_TOOLTIP_BASE,
  createCategoryXAxis,
  createChartHoverHandler,
  formatChartDateLabel,
  getCurrencySymbol,
} from '@/features/charts/components/chartUtils'
import type { ChartPeriodOption } from '@/features/charts/components/chartUtils'

Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler, annotationPlugin)

interface Props {
  assetId: number
  symbol: string
  currency?: string
  portfolioId?: number
  assetType?: string | null
  assetName?: string | null
  initialPeriod?: ChartPeriodOption
  ensureAllTimeHistory?: boolean
}

interface PricePoint {
  date: string
  price: number
  volume?: number | null
  source: string
}

interface PriceHistoryResponse {
  asset_id: number
  symbol: string
  name: string | null
  currency: string
  period: string
  start_date: string
  end_date: string
  data_points: number
  prices: PricePoint[]
}

interface Transaction {
  id: number
  tx_date: string
  type: 'BUY' | 'SELL' | 'CONVERSION_IN' | 'CONVERSION_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT'
  quantity: number
  adjusted_quantity: number
  price: number | null
  fees: number | null
  portfolio_name: string
  notes: string | null
}

interface SplitTransaction {
  id: number
  tx_date: string
  metadata: { split?: string; [key: string]: unknown }
  notes: string | null
}

export default function AssetPriceChart({
  assetId,
  symbol,
  currency = 'USD',
  portfolioId,
  assetType,
  assetName,
  initialPeriod = '1M',
  ensureAllTimeHistory = false
}: Props) {
  const [period, setPeriod] = useState<ChartPeriodOption>(initialPeriod)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<PriceHistoryResponse | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [splits, setSplits] = useState<SplitTransaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [allTimeBackfillAttempted, setAllTimeBackfillAttempted] = useState(false)
  const { t, i18n } = useTranslation()

  // Get the current locale for date formatting
  const currentLocale = i18n.language || 'en-US'

  useEffect(() => {
    setAllTimeBackfillAttempted(false)
  }, [assetId])

  // Determine optimal decimal places based on price range
  const getDecimalPlaces = (prices: number[]): number => {
    if (!prices || prices.length === 0) return 2
    
    const maxPrice = Math.max(...prices)
    const minPrice = Math.min(...prices.filter(p => p > 0))
    
    // For very small prices (< 0.01), use more decimal places
    if (maxPrice < 0.01) return 6
    if (maxPrice < 0.1) return 4
    if (maxPrice < 1) return 3
    
    // For larger prices but with small variations, increase precision
    const range = maxPrice - minPrice
    if (range < 0.01 && maxPrice < 10) return 4
    if (range < 0.1 && maxPrice < 100) return 3
    
    // Default to 2 decimal places
    return 2
  }

  // Format price with appropriate decimal places
  const formatPrice = (value: number, decimalPlaces?: number): string => {
    const places = decimalPlaces ?? getDecimalPlaces(history?.prices.map(p => p.price) || [])
    return value.toFixed(places)
  }

  // Parse split ratio from string like "2:1" to multiplier (2.0)
  const parseSplitRatio = (splitStr: string): number => {
    const parts = splitStr.split(':')
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0])
      const denominator = parseFloat(parts[1])
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return numerator / denominator
      }
    }
    return 1.0
  }

  useEffect(() => {
    let canceled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [priceData, txData, splitData] = await Promise.all([
          api.getAssetPriceHistory(assetId, period),
          portfolioId ? api.getAssetTransactionHistory(assetId, portfolioId) : Promise.resolve([]),
          portfolioId ? api.getAssetSplitHistory(assetId, portfolioId) : Promise.resolve([])
        ])
        let resolvedPriceData = priceData
        if (
          ensureAllTimeHistory &&
          period === 'ALL' &&
          (priceData.data_points < 30 || !priceData.prices.some((point) => point.source === 'yfinance_history')) &&
          !allTimeBackfillAttempted
        ) {
          setAllTimeBackfillAttempted(true)
          await api.backfillAssetPrices(assetId, { allTime: true })
          resolvedPriceData = await api.getAssetPriceHistory(assetId, period)
        }
        if (!canceled) {
          setHistory(resolvedPriceData)
          setTransactions(txData as Transaction[])
          setSplits(splitData as SplitTransaction[])
        }
      } catch (err) {
        if (!canceled) {
          setError((err as Error).message || 'Failed to load price history')
        }
      } finally {
        if (!canceled) setLoading(false)
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [assetId, period, portfolioId, ensureAllTimeHistory, allTimeBackfillAttempted])

  const chartData = {
    labels: history?.prices.map(p => {
      const date = new Date(p.date)
      return formatChartDateLabel(date, period, currentLocale)
    }) || [],
    datasets: [
      {
        label: `${symbol} Price`,
        data: history?.prices.map(p => p.price) || [],
        borderColor: CHART_ACCENT_COLOR,
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
        tension: 0.1, // Slight curve for smoother lines
        pointRadius: 0, // Hide points for cleaner chart with lots of data
        borderWidth: 2,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: CHART_ACCENT_COLOR,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        // Reduce line segments for better performance with large datasets
        segment: {
          borderWidth: (ctx: { p0DataIndex: number }) => {
            // Make line thinner for distant past data, thicker for recent
            const totalPoints = history?.prices.length || 1
            const position = ctx.p0DataIndex / totalPoints
            return position > 0.8 ? 2.5 : 2 // Emphasize recent data
          }
        }
      },
    ],
  }

  // Create annotations for transactions and splits
  const transactionAnnotations = history?.prices ? transactions
    .filter(tx => {
      // Only show transactions that fall within the current period
      const txDate = new Date(tx.tx_date)
      const startDate = new Date(history.start_date)
      const endDate = new Date(history.end_date)
      return txDate >= startDate && txDate <= endDate
    })
    .reduce((acc, tx) => {
      const txDate = new Date(tx.tx_date).toISOString().split('T')[0]
      // Find the closest price point for this transaction
      const priceIndex = history.prices.findIndex(p => p.date.startsWith(txDate))
      
      if (priceIndex !== -1) {
        // Determine transaction type and color
        const isPositive = ['BUY', 'CONVERSION_IN', 'TRANSFER_IN'].includes(tx.type)
        const isConversion = ['CONVERSION_IN', 'CONVERSION_OUT'].includes(tx.type)
        const isTransfer = ['TRANSFER_IN', 'TRANSFER_OUT'].includes(tx.type)
        
        let color: string
        if (isConversion) {
          color = 'rgb(99,102,241)' // indigo for conversions
        } else if (isTransfer) {
          color = 'rgb(6,182,212)' // cyan for transfers
        } else {
          color = isPositive ? 'rgb(34,197,94)' : 'rgb(239,68,68)' // green/red for buy/sell
        }
        
        const priceValue = history.prices[priceIndex].price
        
        // Add vertical line from bottom to the transaction point (in background, very subtle)
        let lineColor: string
        if (isConversion) {
          lineColor = 'rgba(99,102,241,0.15)'
        } else if (isTransfer) {
          lineColor = 'rgba(6,182,212,0.15)'
        } else {
          lineColor = isPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'
        }
        
        acc[`tx-line-${tx.id}`] = {
          type: 'line' as const,
          xMin: priceIndex,
          xMax: priceIndex,
          yMin: 'min' as const,
          yMax: priceValue,
          borderColor: lineColor,
          borderWidth: 1,
          borderDash: [4, 4],
          drawTime: 'beforeDatasetsDraw' as const,
        }
        
        // Add circle point at the transaction
        acc[`tx-point-${tx.id}`] = {
          type: 'point' as const,
          xValue: priceIndex,
          yValue: priceValue,
          backgroundColor: 'white',
          borderColor: color,
          borderWidth: 2.5,
          radius: 4.5,
          drawTime: 'afterDatasetsDraw' as const,
        }
      }
      return acc
    }, {} as Record<string, {
      type: 'line' | 'point';
      xMin?: number;
      xMax?: number;
      yMin?: number | 'min';
      yMax?: number;
      xValue?: number;
      yValue?: number;
      borderColor?: string;
      backgroundColor?: string;
      borderWidth?: number;
      borderDash?: number[];
      radius?: number;
      drawTime?: 'beforeDatasetsDraw' | 'afterDatasetsDraw';
    }>) : {}

  // Add split annotations
  const splitAnnotations = history?.prices ? splits
    .filter(split => {
      // Only show splits that fall within the current period
      const splitDate = new Date(split.tx_date)
      const startDate = new Date(history.start_date)
      const endDate = new Date(history.end_date)
      return splitDate >= startDate && splitDate <= endDate
    })
    .reduce((acc, split) => {
      const splitDate = new Date(split.tx_date).toISOString().split('T')[0]
      // Find the closest price point for this split
      const priceIndex = history.prices.findIndex(p => p.date.startsWith(splitDate))
      
      if (priceIndex !== -1) {
        const priceValue = history.prices[priceIndex].price
        
        // Purple color for splits
        const color = 'rgb(168,85,247)' // purple-500
        
        // Add vertical line from bottom to the split point (in background)
        acc[`split-line-${split.id}`] = {
          type: 'line' as const,
          xMin: priceIndex,
          xMax: priceIndex,
          yMin: 'min' as const,
          yMax: priceValue,
          borderColor: 'rgba(168,85,247,0.2)',
          borderWidth: 2,
          borderDash: [6, 3],
          drawTime: 'beforeDatasetsDraw' as const,
        }
        
        // Add diamond/square point at the split
        acc[`split-point-${split.id}`] = {
          type: 'point' as const,
          xValue: priceIndex,
          yValue: priceValue,
          backgroundColor: 'white',
          borderColor: color,
          borderWidth: 2.5,
          radius: 5,
          drawTime: 'afterDatasetsDraw' as const,
        }
      }
      return acc
    }, {} as Record<string, {
      type: 'line' | 'point';
      xMin?: number;
      xMax?: number;
      yMin?: number | 'min';
      yMax?: number;
      xValue?: number;
      yValue?: number;
      borderColor?: string;
      backgroundColor?: string;
      borderWidth?: number;
      borderDash?: number[];
      radius?: number;
      drawTime?: 'beforeDatasetsDraw' | 'afterDatasetsDraw';
    }>) : {}

  // Combine all annotations
  const allAnnotations = { ...transactionAnnotations, ...splitAnnotations }

  const chartOptions = {
    responsive: true,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    onHover: createChartHoverHandler(setHoveredIndex),
    plugins: {
      legend: { display: false },
      tooltip: {
        ...CHART_TOOLTIP_BASE,
        callbacks: {
          label: (context: { parsed: { y: number | null } }) => {
            const value = context.parsed.y
            if (value === null) return ''
            const currSymbol = getCurrencySymbol(currency)
            const decimalPlaces = getDecimalPlaces(history?.prices.map(p => p.price) || [])
            return `${t('fields.price')}: ${currSymbol}${formatPrice(value, decimalPlaces)}`
          },
          afterLabel: (context: { dataIndex: number }) => {
            const labels: string[] = []
            const dateLabel = chartData.labels[context.dataIndex]
            
            // Show transaction info if there's one at this date
            const txsOnThisDate = transactions.filter(tx => {
              const txDate = new Date(tx.tx_date)
              const formattedTxDate = formatChartDateLabel(txDate, period, currentLocale)
              return formattedTxDate === dateLabel
            })
            
            if (txsOnThisDate.length > 0) {
              const decimalPlaces = getDecimalPlaces(history?.prices.map(p => p.price) || [])
              txsOnThisDate.forEach(tx => {
                let txType: string
                switch (tx.type) {
                  case 'BUY':
                    txType = t('transaction.types.buy')
                    break
                  case 'SELL':
                    txType = t('transaction.types.sell')
                    break
                  case 'CONVERSION_IN':
                    txType = t('transaction.types.conversionIn')
                    break
                  case 'CONVERSION_OUT':
                    txType = t('transaction.types.conversionOut')
                    break
                  case 'TRANSFER_IN':
                    txType = t('transaction.types.transferIn')
                    break
                  case 'TRANSFER_OUT':
                    txType = t('transaction.types.transferOut')
                    break
                  default:
                    txType = tx.type
                }
                labels.push(`\n${txType}: ${tx.quantity.toFixed(2)} @ ${tx.price ? getCurrencySymbol(currency) + formatPrice(tx.price, decimalPlaces) : 'N/A'}`)
              })
            }
            
            // Show split info if there's one at this date
            const splitsOnThisDate = splits.filter(split => {
              const splitDate = new Date(split.tx_date)
              const formattedSplitDate = formatChartDateLabel(splitDate, period, currentLocale)
              return formattedSplitDate === dateLabel
            })
            
            if (splitsOnThisDate.length > 0) {
              splitsOnThisDate.forEach(split => {
                const splitRatio = split.metadata?.split || '1:1'
                const ratio = parseSplitRatio(splitRatio)
                const splitType = ratio >= 1 ? t('splitHistory.forward') : t('splitHistory.reverse')
                labels.push(`\n${splitType} ${t('transaction.types.split').toUpperCase()}: ${splitRatio}`)
              })
            }
            
            return labels
          }
        }
      },
      annotation: {
        annotations: allAnnotations
      }
    },
    scales: {
      x: createCategoryXAxis(period),
      y: {
        title: { 
          display: true, 
          text: `${t('fields.price')} (${currency})`,
          color: CHART_TICK_COLOR,
          font: { size: 12 }
        },
        grid: { color: CHART_GRID_COLOR },
        ticks: { 
          color: CHART_TICK_COLOR,
          font: { size: 11 },
          callback: (value: string | number) => {
            const currSymbol = getCurrencySymbol(currency)
            const decimalPlaces = getDecimalPlaces(history?.prices.map(p => p.price) || [])
            return `${currSymbol}${formatPrice(Number(value), decimalPlaces)}`
          }
        },
      },
    },
    maintainAspectRatio: false,
    animation: {
      duration: 400, // Smooth but quick animation
      easing: 'easeInOutQuart' as const,
    },
    transitions: {
      active: {
        animation: {
          duration: 0, // No animation on hover/interaction
        }
      }
    }
  }

  return (
    <div>
      <ChartPeriodButtons period={period} onChange={setPeriod} t={t} />
      
      <div style={{ minHeight: 320 }} className="bg-white dark:bg-neutral-900 rounded-xl shadow border border-neutral-200 dark:border-neutral-800 p-4">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            <div className="h-64 bg-neutral-100 dark:bg-neutral-800 rounded"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 dark:text-red-400 text-center py-12">
            <p className="font-semibold mb-2">{t('assetPriceChart.empty.error')}</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : !history || history.data_points === 0 ? (
          <div className="text-neutral-400 text-center py-12">
            <p className="font-semibold mb-2">{t('assetPriceChart.empty.noPriceData')}</p>
            <p className="text-sm">{t('assetPriceChart.empty.noPriceDataInfo')}</p>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                  <img
                    src={getAssetLogoUrl(symbol, assetType, assetName || history.name)}
                    alt={symbol}
                    className="w-10 h-10 object-contain"
                    onError={(e) => handleLogoError(e, symbol, assetName || history.name, assetType)}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">{symbol}</h3>
                  {history.name && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">{history.name}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                {history.prices.length > 0 && (() => {
                  const displayIndex = hoveredIndex !== null ? hoveredIndex : history.prices.length - 1
                  const firstPrice = history.prices[0].price
                  const displayPrice = history.prices[displayIndex].price
                  const percentChange = ((displayPrice - firstPrice) / firstPrice) * 100
                  const decimalPlaces = getDecimalPlaces(history.prices.map(p => p.price))
                  
                  const colorClass = percentChange > 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : percentChange < 0 
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-neutral-600 dark:text-neutral-400'
                  
                  return (
                    <div className="flex items-center justify-end gap-2">
                      <p className="text-xl font-bold text-neutral-800 dark:text-neutral-100">
                        {getCurrencySymbol(currency)}{formatPrice(displayPrice, decimalPlaces)}
                      </p>
                      <p className={`text-sm font-semibold ${colorClass}`}>
                        {percentChange > 0 ? '+' : percentChange < 0 ? '' : '+'}{percentChange.toFixed(2)}%
                      </p>
                    </div>
                  )
                })()}
              </div>
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
      
      {history && history.data_points > 0 && (
        <div className="mt-4 space-y-3">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
            {t('assetPriceChart.dataFrom', {
              date1: new Date(history.prices[0].date).toLocaleDateString(currentLocale),
              date2: new Date(history.prices[history.prices.length - 1].date).toLocaleDateString(currentLocale)
            })}
          </div>
          {period === 'ALL' && history.data_points < 30 && (
            <div className="text-xs text-amber-600 dark:text-amber-400 text-center">
              {t('assetPriceChart.limitedAllTimeData')}
            </div>
          )}
          {(transactions.length > 0 || splits.length > 0) && (
            <div className="flex items-center justify-center gap-8 flex-wrap">
              {transactions.length > 0 && (
                <>
                  {transactions.some(tx => tx.type === 'BUY') && (
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <div className="w-3 h-3 rounded-full bg-white border-2 border-green-500"></div>
                      <span className="text-xs font-medium text-green-700 dark:text-green-400">{t('transaction.types.buy')}</span>
                    </div>
                  )}
                  {transactions.some(tx => tx.type === 'SELL') && (
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <div className="w-3 h-3 rounded-full bg-white border-2 border-red-500"></div>
                      <span className="text-xs font-medium text-red-700 dark:text-red-400">{t('transaction.types.sell')}</span>
                    </div>
                  )}
                  {transactions.some(tx => tx.type === 'CONVERSION_IN' || tx.type === 'CONVERSION_OUT') && (
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                      <div className="w-3 h-3 rounded-full bg-white border-2 border-indigo-500"></div>
                      <span className="text-xs font-medium text-indigo-700 dark:text-indigo-400">{t('transaction.types.conversion')}</span>
                    </div>
                  )}
                  {transactions.some(tx => tx.type === 'TRANSFER_IN' || tx.type === 'TRANSFER_OUT') && (
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                      <div className="w-3 h-3 rounded-full bg-white border-2 border-cyan-500"></div>
                      <span className="text-xs font-medium text-cyan-700 dark:text-cyan-400">{t('transaction.types.transferIn')}</span>
                    </div>
                  )}
                </>
              )}
              {splits.length > 0 && (
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                  <div className="w-3 h-3 rounded-full bg-white border-2 border-purple-500"></div>
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-400">{t('transaction.types.split')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
