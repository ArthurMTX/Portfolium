import { useState, useMemo } from 'react'
import { ArrowUpDown, TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react'

interface Position {
  asset_id: number
  symbol: string
  name: string | null
  quantity: number | string
  avg_cost: number | string
  current_price: number | string | null
  market_value: number | string | null
  cost_basis: number | string
  unrealized_pnl: number | string | null
  unrealized_pnl_pct: number | string | null
  daily_change_pct: number | string | null
  currency: string
  asset_type?: string // from backend/yfinance
}

interface PositionsTableProps {
  positions: Position[]
  isSold?: boolean  // If true, shows realized P&L and hides market data
}

const sortableColumns = [
  'symbol',
  'name',
  'quantity',
  'avg_cost',
  'current_price',
  'daily_change_pct',
  'market_value',
  'wallet_pct',
  'unrealized_pnl',
  'unrealized_pnl_pct',
] as const
type SortKey = typeof sortableColumns[number]
type SortDir = 'asc' | 'desc'

export default function PositionsTable({ positions, isSold = false }: PositionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(isSold ? 'unrealized_pnl' : 'market_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Calculate total portfolio value for % of wallet
  const totalPortfolioValue = useMemo(() => {
    return positions.reduce((sum, pos) => {
      const value = pos.market_value !== null && pos.market_value !== undefined 
        ? Number(pos.market_value) 
        : 0
      return sum + value
    }, 0)
  }, [positions])

  const isActive = (key: SortKey) => sortKey === key

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedPositions = useMemo(() => {
    // Map of sort key types to ensure correct comparisons
    const keyTypes = {
      symbol: 'string',
      name: 'string',
      quantity: 'number',
      avg_cost: 'number',
      current_price: 'number',
      daily_change_pct: 'number',
      market_value: 'number',
      wallet_pct: 'number',
      unrealized_pnl: 'number',
      unrealized_pnl_pct: 'number',
    } satisfies Record<SortKey, 'string' | 'number'>

    const dir = sortDir === 'asc' ? 1 : -1

    return [...positions].sort((a, b) => {
      // Special handling for wallet_pct since it's calculated
      if (sortKey === 'wallet_pct') {
        const aMarketValue = a.market_value !== null && a.market_value !== undefined ? Number(a.market_value) : 0
        const bMarketValue = b.market_value !== null && b.market_value !== undefined ? Number(b.market_value) : 0
        const aWalletPct = totalPortfolioValue > 0 ? (aMarketValue / totalPortfolioValue) * 100 : 0
        const bWalletPct = totalPortfolioValue > 0 ? (bMarketValue / totalPortfolioValue) * 100 : 0
        return (aWalletPct - bWalletPct) * dir
      }

      const aVal = a[sortKey as keyof Position] as string | number | null | undefined
      const bVal = b[sortKey as keyof Position] as string | number | null | undefined

      // Null/undefined handling: always sort nulls last
      const aNull = aVal === null || aVal === undefined
      const bNull = bVal === null || bVal === undefined
      if (aNull && bNull) return 0
      if (aNull) return 1
      if (bNull) return -1

      if (keyTypes[sortKey] === 'string') {
        const sa = String(aVal).toLowerCase()
        const sb = String(bVal).toLowerCase()
        return sa.localeCompare(sb) * dir
      }

      const na = Number(aVal)
      const nb = Number(bVal)
      if (isNaN(na) && isNaN(nb)) return 0
      if (isNaN(na)) return 1
      if (isNaN(nb)) return -1
      return (na - nb) * dir
    })
  }, [positions, sortKey, sortDir, totalPortfolioValue])

  const formatCurrency = (value: number | string | null, currency: string = 'EUR') => {
    if (value === null || value === undefined) return '-'
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    
    // Format with up to 2 decimals, removing trailing zeros
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numValue)
    
    return formatted
  }

  const formatNumber = (value: number | string | null, decimals: number = 2) => {
    if (value === null || value === undefined) return '-'
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    return numValue.toFixed(decimals)
  }

  const formatQuantity = (value: number | string | null) => {
    if (value === null || value === undefined) return '-'
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    // Format with up to 8 decimals, then remove trailing zeros
    const formatted = numValue.toFixed(8)
    return formatted.replace(/\.?0+$/, '')
  }

  // Normalize ticker by removing currency suffixes like -USD, -EUR, -USDT
  const normalizeTickerForLogo = (symbol: string): string => {
    return symbol.replace(/-(USD|EUR|GBP|USDT|BUSD|JPY|CAD|AUD|CHF|CNY)$/i, '')
  }


  const SortIcon = ({ col }: { col: SortKey }) => {
    const active = sortKey === col
    if (!active) return <ArrowUpDown size={14} className="inline ml-1 opacity-40" />
    return sortDir === 'asc' ? (
      <ChevronUp size={14} className="inline ml-1 opacity-80" />
    ) : (
      <ChevronDown size={14} className="inline ml-1 opacity-80" />
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
            <tr>
              <th
                onClick={() => handleSort('symbol')}
                aria-sort={sortKey === 'symbol' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Symbol <SortIcon col="symbol" />
              </th>
              <th
                onClick={() => handleSort('name')}
                aria-sort={isActive('name') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Name <SortIcon col={"name"} />
              </th>
              {isSold ? (
                <>
                  <th
                    onClick={() => handleSort('avg_cost')}
                    aria-sort={isActive('avg_cost') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Avg Buy Price <SortIcon col={"avg_cost"} />
                  </th>
                  <th
                    onClick={() => handleSort('current_price')}
                    aria-sort={isActive('current_price') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Avg Sell Price <SortIcon col={"current_price"} />
                  </th>
                  <th
                    onClick={() => handleSort('unrealized_pnl')}
                    aria-sort={sortKey === 'unrealized_pnl' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Realized P&L <SortIcon col="unrealized_pnl" />
                  </th>
                  <th
                    onClick={() => handleSort('unrealized_pnl_pct')}
                    aria-sort={sortKey === 'unrealized_pnl_pct' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Realized P&L % <SortIcon col="unrealized_pnl_pct" />
                  </th>
                </>
              ) : (
                <>
                  <th
                    onClick={() => handleSort('quantity')}
                    aria-sort={sortKey === 'quantity' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Quantity <SortIcon col="quantity" />
                  </th>
                  <th
                    onClick={() => handleSort('avg_cost')}
                    aria-sort={isActive('avg_cost') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Avg Cost <SortIcon col={"avg_cost"} />
                  </th>
                  <th
                    onClick={() => handleSort('current_price')}
                    aria-sort={isActive('current_price') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Current Price <SortIcon col={"current_price"} />
                  </th>
                  <th
                    onClick={() => handleSort('daily_change_pct')}
                    aria-sort={isActive('daily_change_pct') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Daily Change % <SortIcon col={"daily_change_pct"} />
                  </th>
                  <th
                    onClick={() => handleSort('market_value')}
                    aria-sort={sortKey === 'market_value' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Market Value <SortIcon col="market_value" />
                  </th>
                  <th
                    onClick={() => handleSort('wallet_pct')}
                    aria-sort={sortKey === 'wallet_pct' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    % of Wallet <SortIcon col="wallet_pct" />
                  </th>
                  <th
                    onClick={() => handleSort('unrealized_pnl')}
                    aria-sort={sortKey === 'unrealized_pnl' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    P&L <SortIcon col="unrealized_pnl" />
                  </th>
                  <th
                    onClick={() => handleSort('unrealized_pnl_pct')}
                    aria-sort={sortKey === 'unrealized_pnl_pct' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    P&L % <SortIcon col="unrealized_pnl_pct" />
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sortedPositions.map((position) => {
              const pnlValue = position.unrealized_pnl !== null && position.unrealized_pnl !== undefined 
                ? Number(position.unrealized_pnl) 
                : 0
              const isPositive = pnlValue >= 0
              const pnlColor = isPositive
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'

              return (
                <tr
                  key={position.asset_id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <img 
                        src={`/logos/${normalizeTickerForLogo(position.symbol)}${position.asset_type?.toUpperCase() === 'ETF' ? '?asset_type=ETF' : ''}`}
                        alt={`${position.symbol} logo`}
                        className="w-8 h-8 object-cover"
                        style={{ borderRadius: 0 }}
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
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {position.symbol}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs truncate">
                      {position.name || '-'}
                    </div>
                  </td>
                  {isSold ? (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(position.avg_cost, position.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(position.current_price, position.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-semibold flex items-center justify-end gap-1 ${pnlColor}`}>
                          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {formatCurrency(position.unrealized_pnl, position.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-semibold ${pnlColor}`}>
                          {position.unrealized_pnl_pct !== null
                            ? `${isPositive ? '+' : ''}${formatNumber(position.unrealized_pnl_pct, 2)}%`
                            : '-'}
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {formatQuantity(position.quantity)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(position.avg_cost, position.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(position.current_price, position.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-medium ${
                          position.daily_change_pct !== null && position.daily_change_pct !== undefined
                            ? (Number(position.daily_change_pct) >= 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400')
                            : 'text-neutral-500 dark:text-neutral-400'
                        }`}>
                          {position.daily_change_pct !== null && position.daily_change_pct !== undefined
                            ? `${Number(position.daily_change_pct) >= 0 ? '+' : ''}${formatNumber(position.daily_change_pct, 2)}%`
                            : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(position.market_value, position.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {position.market_value !== null && position.market_value !== undefined && totalPortfolioValue > 0
                            ? `${((Number(position.market_value) / totalPortfolioValue) * 100).toFixed(2)}%`
                            : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-semibold flex items-center justify-end gap-1 ${pnlColor}`}>
                          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {formatCurrency(position.unrealized_pnl, position.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-semibold ${pnlColor}`}>
                          {position.unrealized_pnl_pct !== null
                            ? `${isPositive ? '+' : ''}${formatNumber(position.unrealized_pnl_pct, 2)}%`
                            : '-'}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        {sortedPositions.length === 0 && (
          <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
            <p>No positions yet</p>
            <p className="text-sm mt-2">Start by adding transactions to your portfolio</p>
          </div>
        )}
      </div>
    </div>
  )
}
