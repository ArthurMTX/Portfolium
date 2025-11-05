import { useEffect, useState, useMemo } from 'react'
import api from '../lib/api'
import { getAssetLogoUrl, handleLogoError, validateLogoImage } from '../lib/logoUtils'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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

  // Improved treemap layout with better bin-packing
  const layoutTiles = useMemo(() => {
    if (positions.length === 0) return []
    
    const tiles = sortedPositions.map(p => ({
      ...p,
      value: Number(p.market_value) || 0,
      percentage: totalValue > 0 ? ((Number(p.market_value) || 0) / totalValue) * 100 : 0
    }))

    // Calculate base spans based on percentage
    type TileWithSpan = typeof tiles[0] & {
      colSpan: number
      rowSpan: number
      minHeight: string
      originalColSpan: number
      placed: boolean
    }

    const tilesWithSpans: TileWithSpan[] = tiles.map(tile => {
      const pct = tile.percentage
      
      let colSpan: number
      let rowSpan: number
      let minHeight: string
      
      // Stricter size mapping to prevent oversizing
      if (pct >= 25) {
        colSpan = 6  // 50% width
        rowSpan = 2
        minHeight = '180px'
      } else if (pct >= 15) {
        colSpan = 4  // 33% width
        rowSpan = 2
        minHeight = '160px'
      } else if (pct >= 10) {
        colSpan = 4  // 33% width
        rowSpan = 1
        minHeight = '120px'
      } else if (pct >= 6) {
        colSpan = 3  // 25% width
        rowSpan = 1
        minHeight = '110px'
      } else if (pct >= 3) {
        colSpan = 2  // 16.6% width
        rowSpan = 1
        minHeight = '90px'
      } else if (pct >= 1.5) {
        colSpan = 2  // 16.6% width
        rowSpan = 1
        minHeight = '80px'
      } else {
        colSpan = 1  // 8.3% width - very small positions
        rowSpan = 1
        minHeight = '70px'
      }

      return {
        ...tile,
        colSpan,
        rowSpan,
        minHeight,
        originalColSpan: colSpan,
        placed: false
      }
    })

    // Bin-packing algorithm to fill rows
    const GRID_COLS = 12
    const rows: TileWithSpan[][] = []
    let currentRow: TileWithSpan[] = []
    let currentRowCols = 0

    // Sort by colSpan descending for better packing
    const sortedForPacking = [...tilesWithSpans].sort((a, b) => b.colSpan - a.colSpan)

    for (const tile of sortedForPacking) {
      if (tile.placed) continue

      const space = GRID_COLS - currentRowCols

      if (tile.colSpan <= space) {
        // Fits in current row
        currentRow.push(tile)
        currentRowCols += tile.colSpan
        tile.placed = true

        // Row is complete
        if (currentRowCols === GRID_COLS) {
          rows.push(currentRow)
          currentRow = []
          currentRowCols = 0
        }
      } else if (space > 0) {
        // Try to find smaller tile that fits
        const smallerTile = sortedForPacking.find(t => !t.placed && t.colSpan <= space)
        if (smallerTile) {
          currentRow.push(smallerTile)
          currentRowCols += smallerTile.colSpan
          smallerTile.placed = true

          if (currentRowCols === GRID_COLS) {
            rows.push(currentRow)
            currentRow = []
            currentRowCols = 0
          }
        } else {
          // Expand last tile in row to fill gap, but only if it's not too small
          if (currentRow.length > 0 && space <= 3) {
            const lastTile = currentRow[currentRow.length - 1]
            // Don't expand tiles that started very small (< 2% weight)
            if (lastTile.percentage >= 2) {
              lastTile.colSpan += space
            }
          }
          rows.push(currentRow)
          currentRow = []
          currentRowCols = 0
        }
      } else {
        // Start new row
        if (currentRow.length > 0) {
          rows.push(currentRow)
        }
        currentRow = [tile]
        currentRowCols = tile.colSpan
        tile.placed = true
      }
    }

    // Add any remaining tiles
    if (currentRow.length > 0) {
      const remainingSpace = GRID_COLS - currentRowCols
      if (remainingSpace > 0 && remainingSpace <= 4 && currentRow.length > 0) {
        const lastTile = currentRow[currentRow.length - 1]
        // Only expand if the tile has significant weight (>= 2%)
        if (lastTile.percentage >= 2) {
          lastTile.colSpan += remainingSpace
        }
      }
      rows.push(currentRow)
    }

    // Flatten rows into final layout with row tracking
    const layoutedTiles = rows.flatMap((row, rowIndex) =>
      row.map(tile => ({ ...tile, row: rowIndex }))
    )

    return layoutedTiles
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

  if (loading) {
    return (
      <div>
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
            { colSpan: 6, height: '180px' },
            { colSpan: 4, height: '160px' },
            { colSpan: 2, height: '90px' },
            { colSpan: 3, height: '110px' },
            { colSpan: 3, height: '110px' },
            { colSpan: 3, height: '110px' },
            { colSpan: 3, height: '110px' },
            { colSpan: 2, height: '90px' },
            { colSpan: 2, height: '90px' },
            { colSpan: 2, height: '90px' },
            { colSpan: 2, height: '90px' },
            { colSpan: 2, height: '90px' },
            { colSpan: 2, height: '90px' },
            { colSpan: 2, height: '90px' },
            { colSpan: 2, height: '90px' },
            { colSpan: 2, height: '90px' },
            { colSpan: 2, height: '90px' },
            { colSpan: 1, height: '70px' },
            { colSpan: 1, height: '70px' },
          ].map((skeleton, i) => (
            <div
              key={i}
              style={{ 
                gridColumn: `span ${skeleton.colSpan}`,
                minHeight: skeleton.height 
              }}
              className="bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse overflow-hidden"
            >
              <div className={`${skeleton.colSpan >= 6 ? 'p-4' : skeleton.colSpan >= 4 ? 'p-3.5' : skeleton.colSpan >= 3 ? 'p-3' : skeleton.colSpan >= 2 ? 'p-2' : 'p-1.5'} h-full flex flex-col justify-between`}>
                <div className="flex items-center gap-2">
                  <div className={`${skeleton.colSpan >= 6 ? 'w-12 h-12' : skeleton.colSpan >= 4 ? 'w-10 h-10' : skeleton.colSpan >= 3 ? 'w-7 h-7' : skeleton.colSpan >= 2 ? 'w-5 h-5' : 'w-4 h-4'} bg-neutral-200 dark:bg-neutral-700 rounded flex-shrink-0`}></div>
                  <div className={`${skeleton.colSpan >= 6 ? 'h-6 w-20' : skeleton.colSpan >= 4 ? 'h-5 w-16' : skeleton.colSpan >= 3 ? 'h-4 w-14' : skeleton.colSpan >= 2 ? 'h-3 w-12' : 'h-3 w-10'} bg-neutral-200 dark:bg-neutral-700 rounded`}></div>
                </div>
                {skeleton.colSpan >= 3 && (
                  <div className={`${skeleton.colSpan >= 6 ? 'h-4 w-32' : skeleton.colSpan >= 4 ? 'h-3 w-24' : 'h-3 w-20'} bg-neutral-200 dark:bg-neutral-700 rounded mt-1`}></div>
                )}
                <div className="mt-auto space-y-1">
                  <div className={`${skeleton.colSpan >= 4 ? 'h-3 w-20' : skeleton.colSpan >= 2 ? 'h-2 w-16' : 'h-2 w-12'} bg-neutral-200 dark:bg-neutral-700 rounded`}></div>
                  <div className={`${skeleton.colSpan >= 4 ? 'h-3 w-24' : skeleton.colSpan >= 2 ? 'h-2 w-18' : 'h-2 w-14'} bg-neutral-200 dark:bg-neutral-700 rounded`}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div className="p-8">
        <p className="text-center text-neutral-500 dark:text-neutral-400">No positions to display</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {t('charts.heatmap')}
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          {t('charts.heatmapDescription')}
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-700 rounded"></div>
          <span className="text-xs text-neutral-600 dark:text-neutral-400">{t('charts.dailyLoss')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-neutral-300 dark:bg-neutral-600 rounded"></div>
          <span className="text-xs text-neutral-600 dark:text-neutral-400">{t('charts.unchanged')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-700 rounded"></div>
          <span className="text-xs text-neutral-600 dark:text-neutral-400">{t('charts.dailyGain')}</span>
        </div>
      </div>

      {/* Heatmap Grid Layout */}
      
      {/* Mobile: Simplified 2-Column Grid */}
      <div className="lg:hidden grid grid-cols-2 gap-2 auto-rows-auto">
        {sortedPositions.map((position) => {
          const dailyPct = position.daily_change_pct !== null ? Number(position.daily_change_pct) : null
          const percentage = totalValue > 0 ? ((Number(position.market_value) || 0) / totalValue) * 100 : 0
          
          // Determine size based on portfolio weight
          const isLarge = percentage >= 15
          const isMedium = percentage >= 8

          return (
            <div
              key={position.symbol}
              style={{
                gridColumn: isLarge ? 'span 2' : 'span 1',
                minHeight: isLarge ? '140px' : isMedium ? '120px' : '100px',
              }}
              className={`${getColorByPerformance(dailyPct)} ${getTextColorByPerformance(dailyPct)} rounded-lg p-3 transition-all duration-200 hover:shadow-lg hover:brightness-110 cursor-pointer flex flex-col justify-between`}
              title={`${position.name || position.symbol}: ${percentage.toFixed(2)}% ${t('charts.ofPortfolio')}`}
            >
              <div className="flex items-center gap-2">
                <img 
                  src={getAssetLogoUrl(position.symbol, position.asset_type, position.name)}
                  alt={`${position.symbol} logo`}
                  className={`${isLarge ? 'w-10 h-10' : isMedium ? 'w-8 h-8' : 'w-7 h-7'} object-contain flex-shrink-0`}
                  onLoad={(e) => {
                    const img = e.currentTarget as HTMLImageElement
                    if (!validateLogoImage(img)) {
                      img.dispatchEvent(new Event('error'))
                    }
                  }}
                  onError={(e) => handleLogoError(e, position.symbol, position.name, position.asset_type)}
                />
                <div className={`font-bold ${isLarge ? 'text-base' : 'text-sm'} truncate`}>{position.symbol}</div>
              </div>
              {position.name && isLarge && (
                <div className="text-xs opacity-75 truncate mt-1">{position.name}</div>
              )}
              <div className="mt-auto">
                <div className={`${isLarge ? 'text-sm' : 'text-xs'} opacity-90`}>
                  <span className="opacity-60">{t('charts.weight')}: </span>{percentage.toFixed(1)}%
                </div>
                {dailyPct !== null && (
                  <div className={`${isLarge ? 'text-sm' : 'text-xs'} font-semibold`}>
                    <span className="opacity-60">{t('charts.daily')}: </span>{dailyPct >= 0 ? '+' : ''}{dailyPct.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop: Treemap Grid */}
      <div className="hidden lg:grid grid-cols-12 gap-2 auto-rows-auto">
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
              title={`${tile.name || tile.symbol}: ${tile.percentage.toFixed(2)}% ${t('charts.ofPortfolio')}, ${t('charts.daily')}: ${dailyPct !== null ? `${dailyPct >= 0 ? '+' : ''}${dailyPct.toFixed(2)}%` : 'N/A'}`}
            >
              <div className="flex items-center gap-2">
                <img 
                  src={getAssetLogoUrl(tile.symbol, tile.asset_type, tile.name)}
                  alt={`${tile.symbol} logo`}
                  className={`${logoSize} object-contain flex-shrink-0`}
                  onLoad={(e) => {
                    const img = e.currentTarget as HTMLImageElement
                    if (!validateLogoImage(img)) {
                      img.dispatchEvent(new Event('error'))
                    }
                  }}
                  onError={(e) => handleLogoError(e, tile.symbol, tile.name, tile.asset_type)}
                />
                <div className={`font-bold ${symbolSize} truncate`}>{tile.symbol}</div>
              </div>
              {tile.name && (
                <div className={`${nameSize} opacity-75 truncate mt-1`}>{tile.name}</div>
              )}
              <div className="mt-auto">
                <div className={`${valueSize} opacity-90`}>
                  <span className="opacity-60">{t('charts.weight')}: </span>{tile.percentage.toFixed(1)}%
                </div>
                {dailyPct !== null && (
                  <div className={`${valueSize} font-semibold`}>
                    <span className="opacity-60">{t('charts.daily')}: </span>{dailyPct >= 0 ? '+' : ''}{dailyPct.toFixed(1)}%
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
