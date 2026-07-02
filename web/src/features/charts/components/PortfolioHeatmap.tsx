import { useEffect, useState, useMemo } from 'react'
import api from '@/api'
import { useTranslation } from 'react-i18next'
import AssetLogo from '@/shared/components/AssetLogo'
import { ChartSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
import { useNavigate } from 'react-router-dom'

interface Position {
  asset_id?: number
  symbol: string
  name: string | null
  asset_type?: string | null
  market_value: number | null
  unrealized_pnl_pct: number | null
  daily_change_pct: number | null
  portfolio_weight?: number | null
  unrealized_pnl?: number | null
  sector?: string | null
  country?: string | null
  effective_sector?: string | null
  effective_country?: string | null
  themes?: Array<{ label?: string; name?: string }> | null
}

interface Props {
  portfolioId: number
}

function normaliseNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function performanceClass(value: number | string | null | undefined): string | undefined {
  const number = normaliseNumber(value)
  if (number === null || number === 0) return undefined
  return number > 0 ? 'is-positive' : 'is-negative'
}

function formatSignedPercent(value: number | string | null | undefined, decimals = 2): string {
  const number = normaliseNumber(value)
  if (number === null) return '—'
  const prefix = number > 0 ? '+' : number < 0 ? '−' : ''
  return `${prefix}${Math.abs(number).toFixed(decimals)}%`
}

export default function PortfolioHeatmap({ portfolioId }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)

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

  const selectedPosition = useMemo(() => {
    if (positions.length === 0) return null
    if (selectedSymbol) return positions.find((position) => position.symbol === selectedSymbol) || null
    return sortedPositions[0] || null
  }, [positions, selectedSymbol, sortedPositions])

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
    return <ChartSkeleton label="Loading position heatmap" />
  }

  if (positions.length === 0) {
    return (
      <StateBlock
        eyebrow="No chart data"
        title={t('dashboard.noPositions')}
        description="Add holdings before using the portfolio heatmap."
      />
    )
  }

  return (
    <section className="pf-section pf-section--spacious charts-section">
      <div className="pf-section-header pf-section-header--grid pf-section-header--spacious charts-section__header">
        <div>
          <p className="pf-section-kicker">POSITION MAP</p>
          <h2 className="pf-section-title">{t('charts.heatmap')}</h2>
        </div>
        <span className="pf-section-description">{t('charts.heatmapDescription')}</span>
      </div>

      <div className="pf-main-grid">
        <div>
          <div className="charts-legend">
            <span><i className="is-negative" />{t('charts.dailyLoss')}</span>
            <span><i />{t('charts.unchanged')}</span>
            <span><i className="is-positive" />{t('charts.dailyGain')}</span>
          </div>
          {/* Heatmap Grid Layout */}

          {/* Mobile: Simplified 2-Column Grid */}
          <div className="lg:hidden grid grid-cols-2 gap-2 auto-rows-auto">
            {sortedPositions.map((position) => {
              const dailyPct = normaliseNumber(position.daily_change_pct)
              const percentage = totalValue > 0 ? ((Number(position.market_value) || 0) / totalValue) * 100 : 0

              // Determine size based on portfolio weight
              const isLarge = percentage >= 15
              const isMedium = percentage >= 8

              return (
                <button
                  key={position.symbol}
                  type="button"
                  onClick={() => setSelectedSymbol(position.symbol)}
                  style={{
                    gridColumn: isLarge ? 'span 2' : 'span 1',
                    minHeight: isLarge ? '140px' : isMedium ? '120px' : '100px',
                  }}
                  className={`${getColorByPerformance(dailyPct)} ${getTextColorByPerformance(dailyPct)} charts-heatmap-tile ${selectedSymbol === position.symbol ? 'is-selected' : ''}`}
                  title={`${position.name || position.symbol}: ${percentage.toFixed(2)}% ${t('charts.ofPortfolio')}`}
                >
                  <div className="flex items-center gap-2">
                    <AssetLogo
                      symbol={position.symbol}
                      assetType={position.asset_type}
                      assetName={position.name}
                      alt={`${position.symbol} logo`}
                      className={`${isLarge ? 'w-10 h-10' : isMedium ? 'w-8 h-8' : 'w-7 h-7'} object-contain flex-shrink-0`}
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
                        <span className="opacity-60">{t('charts.daily')}: </span>{formatSignedPercent(dailyPct, 1)}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Desktop: Treemap Grid */}
          <div className="hidden lg:grid grid-cols-12 gap-2 auto-rows-auto">
            {layoutTiles.map((tile) => {
              const dailyPct = normaliseNumber(tile.daily_change_pct)

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
                <button
                  key={tile.symbol}
                  type="button"
                  onClick={() => setSelectedSymbol(tile.symbol)}
                  style={{
                    gridColumn: `span ${tile.colSpan}`,
                    gridRow: `span ${tile.rowSpan}`,
                    minHeight: tile.minHeight,
                  }}
                  className={`${getColorByPerformance(dailyPct)} ${getTextColorByPerformance(dailyPct)} rounded-lg ${padding} charts-heatmap-tile ${selectedSymbol === tile.symbol ? 'is-selected' : ''}`}
                  title={`${tile.name || tile.symbol}: ${tile.percentage.toFixed(2)}% ${t('charts.ofPortfolio')}, ${t('charts.daily')}: ${formatSignedPercent(dailyPct)}`}
                >
                  <div className="flex items-center gap-2">
                    <AssetLogo
                      symbol={tile.symbol}
                      assetType={tile.asset_type}
                      assetName={tile.name}
                      alt={`${tile.symbol} logo`}
                      className={`${logoSize} object-contain flex-shrink-0`}
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
                        <span className="opacity-60">{t('charts.daily')}: </span>{formatSignedPercent(dailyPct, 1)}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {selectedPosition && (
          <aside className="charts-analysis-panel">
            <p>Selected position</p>
            <div className="charts-analysis-panel__identity">
                <AssetLogo
                symbol={selectedPosition.symbol}
                assetType={selectedPosition.asset_type}
                assetName={selectedPosition.name}
                alt={`${selectedPosition.symbol} logo`}
                className="w-10 h-10 object-contain"
                />
              <div>
                <strong>{selectedPosition.symbol}</strong>
                <span>{selectedPosition.name || selectedPosition.symbol}</span>
              </div>
            </div>
            <dl>
              <div>
                <dt>Current weight</dt>
                <dd>{totalValue > 0 ? `${(((Number(selectedPosition.market_value) || 0) / totalValue) * 100).toFixed(2)}%` : '—'}</dd>
              </div>
              <div>
                <dt>Daily move</dt>
                <dd className={performanceClass(selectedPosition.daily_change_pct)}>{formatSignedPercent(selectedPosition.daily_change_pct)}</dd>
              </div>
              <div>
                <dt>Total return</dt>
                <dd className={performanceClass(selectedPosition.unrealized_pnl_pct)}>{formatSignedPercent(selectedPosition.unrealized_pnl_pct)}</dd>
              </div>
              <div>
                <dt>Portfolio contribution</dt>
                <dd>{selectedPosition.unrealized_pnl !== null && selectedPosition.unrealized_pnl !== undefined ? Number(selectedPosition.unrealized_pnl).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</dd>
              </div>
              <div>
                <dt>Sector</dt>
                <dd>{selectedPosition.effective_sector || selectedPosition.sector || 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Country</dt>
                <dd>{selectedPosition.effective_country || selectedPosition.country || 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Theme</dt>
                <dd>{selectedPosition.themes?.[0]?.label || selectedPosition.themes?.[0]?.name || 'Unavailable'}</dd>
              </div>
            </dl>
            <button type="button" onClick={() => navigate(`/assets/${encodeURIComponent(selectedPosition.symbol)}/research`)}>
              Open Asset Research →
            </button>
          </aside>
        )}
      </div>
    </section>
  )
}
