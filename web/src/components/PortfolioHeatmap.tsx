import { useEffect, useState, useMemo } from 'react'
import api from '../lib/api'

interface Position {
  symbol: string
  name: string | null
  asset_type?: string
  market_value: number | null
  unrealized_pnl_pct: number | null
  daily_change_pct: number | null
}

interface Props {
  portfolioId: number
}

export default function PortfolioHeatmap({ portfolioId }: Props) {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let canceled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await api.getPortfolioPositions(portfolioId)
        if (!canceled) {
          // Filter out positions without market value
          setPositions(data.filter((p: Position) => p.market_value && p.market_value > 0))
        }
      } finally {
        if (!canceled) setLoading(false)
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [portfolioId])

  // Calculate total portfolio value
  const totalValue = useMemo(() => {
    return positions.reduce((sum, p) => sum + (Number(p.market_value) || 0), 0)
  }, [positions])

  // Sort positions by market value descending
  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const aVal = Number(a.market_value) || 0
      const bVal = Number(b.market_value) || 0
      return bVal - aVal
    })
  }, [positions])

  const getColorByPerformance = (pnlPct: number | null): string => {
    if (pnlPct === null || pnlPct === undefined) return 'bg-neutral-200 dark:bg-neutral-700'
    
    // Color scale from red (worst) to green (best)
    if (pnlPct <= -20) return 'bg-red-900 dark:bg-red-950'
    if (pnlPct <= -15) return 'bg-red-800 dark:bg-red-900'
    if (pnlPct <= -10) return 'bg-red-700 dark:bg-red-800'
    if (pnlPct <= -5) return 'bg-red-600 dark:bg-red-700'
    if (pnlPct < 0) return 'bg-red-500 dark:bg-red-600'
    if (pnlPct === 0) return 'bg-neutral-300 dark:bg-neutral-600'
    if (pnlPct < 5) return 'bg-green-500 dark:bg-green-600'
    if (pnlPct < 10) return 'bg-green-600 dark:bg-green-700'
    if (pnlPct < 15) return 'bg-green-700 dark:bg-green-800'
    if (pnlPct < 20) return 'bg-green-800 dark:bg-green-900'
    return 'bg-green-900 dark:bg-green-950'
  }

  const getTextColorByPerformance = (pnlPct: number | null): string => {
    if (pnlPct === null || pnlPct === undefined) return 'text-neutral-700 dark:text-neutral-300'
    return 'text-white'
  }

  // Normalize ticker by removing currency suffixes like -USD, -EUR, -USDT
  const normalizeTickerForLogo = (symbol: string): string => {
    return symbol.replace(/-(USD|EUR|GBP|USDT|BUSD|JPY|CAD|AUD|CHF|CNY)$/i, '')
  }

  const getAssetLogoUrl = (position: Position) => {
    const normalizedSymbol = normalizeTickerForLogo(position.symbol)
    const params = position.asset_type?.toUpperCase() === 'ETF' ? '?asset_type=ETF' : ''
    return `/logos/${normalizedSymbol}${params}`
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow border border-neutral-200 dark:border-neutral-800 p-8">
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
        </div>
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow border border-neutral-200 dark:border-neutral-800 p-8">
        <p className="text-center text-neutral-500 dark:text-neutral-400">No positions to display</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow border border-neutral-200 dark:border-neutral-800 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Portfolio Heatmap
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          Asset allocation by market value, colored by daily performance
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-700 rounded"></div>
          <span className="text-xs text-neutral-600 dark:text-neutral-400">Daily Loss</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-neutral-300 dark:bg-neutral-600 rounded"></div>
          <span className="text-xs text-neutral-600 dark:text-neutral-400">Unchanged</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-700 rounded"></div>
          <span className="text-xs text-neutral-600 dark:text-neutral-400">Daily Gain</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {sortedPositions.map((position) => {
          const marketValue = Number(position.market_value) || 0
          const percentage = totalValue > 0 ? (marketValue / totalValue) * 100 : 0
          const dailyPct = position.daily_change_pct !== null ? Number(position.daily_change_pct) : null
          
          // Calculate relative size for the cell (min size + proportional)
          const isLarge = percentage > 15
          const isMedium = percentage > 8 && percentage <= 15
          const sizeClass = isLarge ? 'col-span-2 row-span-2' : 
                           isMedium ? 'col-span-2' : ''
          
          // Scale text and logo based on cell size
          const logoSize = isLarge ? 'w-10 h-10' : isMedium ? 'w-8 h-8' : 'w-6 h-6'
          const symbolSize = isLarge ? 'text-lg' : isMedium ? 'text-base' : 'text-sm'
          const nameSize = isLarge ? 'text-xs' : isMedium ? 'text-[11px]' : 'text-[10px]'
          const percentageSize = isLarge ? 'text-sm' : isMedium ? 'text-xs' : 'text-xs'
          const dailySize = isLarge ? 'text-sm' : isMedium ? 'text-xs' : 'text-xs'
          const minHeight = isLarge ? 'min-h-[160px]' : isMedium ? 'min-h-[100px]' : 'min-h-[80px]'
          const padding = isLarge ? 'p-4' : isMedium ? 'p-3' : 'p-3'

          return (
            <div
              key={position.symbol}
              className={`${sizeClass} ${getColorByPerformance(dailyPct)} ${getTextColorByPerformance(dailyPct)} rounded-lg ${padding} transition-all duration-200 hover:shadow-lg hover:brightness-110 cursor-pointer flex flex-col justify-between ${minHeight}`}
              title={`${position.name || position.symbol}: ${percentage.toFixed(2)}% of portfolio, Daily: ${dailyPct !== null ? `${dailyPct >= 0 ? '+' : ''}${dailyPct.toFixed(2)}%` : 'N/A'}`}
            >
              <div className="flex items-center gap-2">
                <img 
                  src={getAssetLogoUrl(position)}
                  alt={`${position.symbol} logo`}
                  className={`${logoSize} object-contain flex-shrink-0`}
                  onLoad={(e) => {
                    const img = e.currentTarget as HTMLImageElement
                    if (img.dataset.validated) return
                    img.dataset.validated = 'true'
                    try {
                      const canvas = document.createElement('canvas')
                      const ctx = canvas.getContext('2d')
                      if (!ctx) return
                      const w = Math.min(img.naturalWidth || 0, 64) || 32
                      const h = Math.min(img.naturalHeight || 0, 64) || 32
                      if (w === 0 || h === 0) return
                      canvas.width = w
                      canvas.height = h
                      ctx.drawImage(img, 0, 0, w, h)
                      const data = ctx.getImageData(0, 0, w, h).data
                      let opaque = 0
                      for (let i = 0; i < data.length; i += 4) {
                        const a = data[i + 3]
                        if (a > 8) opaque++
                      }
                      const total = (data.length / 4) || 1
                      if (opaque / total < 0.01) {
                        img.dispatchEvent(new Event('error'))
                      }
                    } catch {
                      // Ignore canvas/security errors
                    }
                  }}
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement
                    if (!img.dataset.resolverTried) {
                      img.dataset.resolverTried = 'true'
                      const params = new URLSearchParams()
                      if (position.name) params.set('name', position.name)
                      if (position.asset_type) params.set('asset_type', position.asset_type)
                      fetch(`/api/assets/logo/${position.symbol}?${params.toString()}`, { redirect: 'follow' })
                        .then((res) => {
                          if (res.redirected) {
                            img.src = res.url
                          } else if (res.ok) {
                            return res.blob().then((blob) => {
                              img.src = URL.createObjectURL(blob)
                            })
                          } else {
                            img.style.display = 'none'
                          }
                        })
                        .catch(() => {
                          img.style.display = 'none'
                        })
                    } else {
                      img.style.display = 'none'
                    }
                  }}
                />
                <div className={`font-bold ${symbolSize} truncate`}>{position.symbol}</div>
              </div>
              {position.name && (
                <div className={`${nameSize} opacity-75 truncate mt-1`}>{position.name}</div>
              )}
              <div className="mt-auto">
                <div className={`${percentageSize} opacity-90`}>
                  <span className="opacity-60">Weight: </span>{percentage.toFixed(1)}%
                </div>
                {dailyPct !== null && (
                  <div className={`${dailySize} font-semibold`}>
                    <span className="opacity-60">Daily: </span>{dailyPct >= 0 ? '+' : ''}{dailyPct.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
