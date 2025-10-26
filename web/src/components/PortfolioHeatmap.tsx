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

  // Grid-based treemap layout algorithm
  const layoutTiles = useMemo(() => {
    if (positions.length === 0) return []
    
    const tiles = sortedPositions.map(p => ({
      ...p,
      value: Number(p.market_value) || 0,
      percentage: totalValue > 0 ? ((Number(p.market_value) || 0) / totalValue) * 100 : 0
    }))

    // Calculate grid spans based on percentage (12-column grid)
    return tiles.map(tile => {
      const pct = tile.percentage
      
      let colSpan: number
      let rowSpan: number
      let minHeight: string
      
      // Map percentage to grid spans (total 12 columns)
      if (pct >= 20) {
        colSpan = 6  // 50% width
        rowSpan = 2
        minHeight = '180px'
      } else if (pct >= 12) {
        colSpan = 4  // 33% width
        rowSpan = 2
        minHeight = '160px'
      } else if (pct >= 8) {
        colSpan = 3  // 25% width
        rowSpan = 2
        minHeight = '140px'
      } else if (pct >= 5) {
        colSpan = 3  // 25% width
        rowSpan = 1
        minHeight = '110px'
      } else if (pct >= 2.5) {
        colSpan = 2  // 16.6% width
        rowSpan = 1
        minHeight = '90px'
      } else {
        colSpan = 2  // 16.6% width
        rowSpan = 1
        minHeight = '80px'
      }

      return {
        ...tile,
        colSpan,
        rowSpan,
        minHeight
      }
    })
  }, [sortedPositions, totalValue, positions.length])

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
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="mb-4 space-y-2 animate-pulse">
          <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          <div className="h-4 w-72 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
        
        {/* Legend Skeleton */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2 animate-pulse">
            <div className="w-4 h-4 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          </div>
          <div className="flex items-center gap-2 animate-pulse">
            <div className="w-4 h-4 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          </div>
          <div className="flex items-center gap-2 animate-pulse">
            <div className="w-4 h-4 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          </div>
        </div>

        {/* Heatmap Grid Skeleton */}
        <div className="grid grid-cols-12 gap-2 auto-rows-auto">
          {[
            { colSpan: 6, rowSpan: 2, height: '180px' },
            { colSpan: 4, rowSpan: 2, height: '160px' },
            { colSpan: 3, rowSpan: 2, height: '140px' },
            { colSpan: 3, rowSpan: 1, height: '110px' },
            { colSpan: 3, rowSpan: 1, height: '110px' },
            { colSpan: 3, rowSpan: 1, height: '110px' },
            { colSpan: 2, rowSpan: 1, height: '90px' },
            { colSpan: 2, rowSpan: 1, height: '90px' },
            { colSpan: 2, rowSpan: 1, height: '90px' },
            { colSpan: 2, rowSpan: 1, height: '90px' },
            { colSpan: 2, rowSpan: 1, height: '90px' },
            { colSpan: 2, rowSpan: 1, height: '90px' },
          ].map((skeleton, i) => (
            <div
              key={i}
              style={{ 
                gridColumn: `span ${skeleton.colSpan}`,
                gridRow: `span ${skeleton.rowSpan}`,
                minHeight: skeleton.height 
              }}
              className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3 animate-pulse"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`${i === 0 ? 'w-12 h-12' : i <= 2 ? 'w-10 h-10' : i <= 5 ? 'w-8 h-8' : 'w-6 h-6'} bg-neutral-200 dark:bg-neutral-700 rounded`}></div>
                  <div className={`${i === 0 ? 'h-6 w-20' : i <= 2 ? 'h-5 w-16' : i <= 5 ? 'h-4 w-14' : 'h-3 w-12'} bg-neutral-200 dark:bg-neutral-700 rounded`}></div>
                </div>
                <div className={`${i === 0 ? 'h-4 w-32' : i <= 2 ? 'h-3 w-24' : 'h-3 w-20'} bg-neutral-200 dark:bg-neutral-700 rounded`}></div>
              </div>
            </div>
          ))}
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

      {/* Heatmap Grid Layout */}
      <div className="grid grid-cols-12 gap-2 auto-rows-auto">
        {layoutTiles.map((tile) => {
          const dailyPct = tile.daily_change_pct !== null ? Number(tile.daily_change_pct) : null
          
          // Scale text and logo based on span size
          const isXL = tile.colSpan >= 6 || tile.rowSpan >= 2
          const isLarge = tile.colSpan >= 4 || (tile.colSpan >= 3 && tile.rowSpan >= 2)
          const isMedium = tile.colSpan >= 3
          
          const logoSize = isXL ? 'w-12 h-12' : isLarge ? 'w-10 h-10' : isMedium ? 'w-8 h-8' : 'w-6 h-6'
          const symbolSize = isXL ? 'text-xl' : isLarge ? 'text-lg' : isMedium ? 'text-base' : 'text-sm'
          const nameSize = isXL ? 'text-sm' : isLarge ? 'text-xs' : isMedium ? 'text-[11px]' : 'text-[10px]'
          const valueSize = isXL ? 'text-base' : isLarge ? 'text-sm' : 'text-xs'
          const padding = isXL ? 'p-4' : isLarge ? 'p-3.5' : isMedium ? 'p-3' : 'p-2.5'

          return (
            <div
              key={tile.symbol}
              style={{
                gridColumn: `span ${tile.colSpan}`,
                gridRow: `span ${tile.rowSpan}`,
                minHeight: tile.minHeight,
              }}
              className={`${getColorByPerformance(dailyPct)} ${getTextColorByPerformance(dailyPct)} rounded-lg ${padding} transition-all duration-200 hover:shadow-lg hover:brightness-110 cursor-pointer flex flex-col justify-between`}
              title={`${tile.name || tile.symbol}: ${tile.percentage.toFixed(2)}% of portfolio, Daily: ${dailyPct !== null ? `${dailyPct >= 0 ? '+' : ''}${dailyPct.toFixed(2)}%` : 'N/A'}`}
            >
              <div className="flex items-center gap-2">
                <img 
                  src={getAssetLogoUrl(tile)}
                  alt={`${tile.symbol} logo`}
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
                      if (tile.name) params.set('name', tile.name)
                      if (tile.asset_type) params.set('asset_type', tile.asset_type)
                      fetch(`/api/assets/logo/${tile.symbol}?${params.toString()}`, { redirect: 'follow' })
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
                <div className={`font-bold ${symbolSize} truncate`}>{tile.symbol}</div>
              </div>
              {tile.name && (
                <div className={`${nameSize} opacity-75 truncate mt-1`}>{tile.name}</div>
              )}
              <div className="mt-auto">
                <div className={`${valueSize} opacity-90`}>
                  <span className="opacity-60">Weight: </span>{tile.percentage.toFixed(1)}%
                </div>
                {dailyPct !== null && (
                  <div className={`${valueSize} font-semibold`}>
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
