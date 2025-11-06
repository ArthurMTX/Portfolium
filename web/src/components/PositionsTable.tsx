import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react'
import { getAssetLogoUrl, handleLogoError, validateLogoImage } from '../lib/logoUtils'
import { formatCurrency, formatNumber, formatQuantity } from '../lib/formatUtils'
import SortIcon from './SortIcon'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
  }, [positions, sortKey, sortDir])

  // Get human-readable label for sort key
  const getSortLabel = (key: SortKey): string => {
    const labels: Record<SortKey, string> = {
      symbol: t('fields.symbol'),
      name: t('fields.name'),
      quantity: t('fields.quantity'),
      avg_cost: t('dashboard.avgCost'),
      current_price: t('dashboard.currentPrice'),
      daily_change_pct: t('dashboard.dailyChange'),
      market_value: t('dashboard.marketValue'),
      wallet_pct: t('dashboard.percentOfWallet'),
      unrealized_pnl: isSold ? t('dashboard.realizedPnL') : 'P&L',
      unrealized_pnl_pct: isSold ? t('dashboard.realizedPnL') : 'P&L %',
    }
    return labels[key]
  }

  // Get available sort options based on isSold
  const availableSortOptions = isSold 
    ? ['symbol', 'name', 'avg_cost', 'current_price', 'unrealized_pnl', 'unrealized_pnl_pct'] as SortKey[]
    : sortableColumns

  return (
    <>
      {/* Mobile Sort Controls & Card Layout */}
      <div className="lg:hidden">
        {/* Sort Controls */}
        <div className="flex items-center gap-2 mb-3">
          <label htmlFor="mobile-sort" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
            {t('common.sortBy')}:
          </label>
          <select
            id="mobile-sort"
            value={sortKey}
            onChange={(e) => handleSort(e.target.value as SortKey)}
            className="flex-1 input text-sm py-2 px-3"
          >
            {availableSortOptions.map((option) => (
              <option key={option} value={option}>
                {getSortLabel(option)}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            className="btn-secondary p-2 flex items-center gap-1"
            title={sortDir === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
          >
            {sortDir === 'asc' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {/* Cards */}
        <div className="space-y-3">
        {sortedPositions.map((position) => {
          const pnlValue = position.unrealized_pnl !== null && position.unrealized_pnl !== undefined 
            ? Number(position.unrealized_pnl) 
            : 0
          const isPositive = pnlValue >= 0
          const pnlColor = isPositive
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400'
          const walletPct = position.market_value !== null && position.market_value !== undefined && totalPortfolioValue > 0
            ? `${((Number(position.market_value) / totalPortfolioValue) * 100).toFixed(2)}%`
            : '-'

          return (
            <div key={position.asset_id} className="card p-4">
              {/* Header: Logo, Symbol, Name */}
              <div className="flex items-start justify-between mb-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img 
                    src={getAssetLogoUrl(position.symbol, position.asset_type, position.name)}
                    alt={`${position.symbol} logo`}
                    className="w-10 h-10 flex-shrink-0 object-cover"
                    style={{ borderRadius: 0 }}
                    onLoad={(e) => {
                      const img = e.currentTarget as HTMLImageElement
                      if (!validateLogoImage(img)) {
                        img.dispatchEvent(new Event('error'))
                      }
                    }}
                    onError={(e) => handleLogoError(e, position.symbol, position.name, position.asset_type)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                      {position.symbol}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {position.name || '-'}
                    </div>
                  </div>
                </div>
                <div className="text-right ml-3">
                  <div className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                    {isSold 
                      ? formatCurrency(position.unrealized_pnl, position.currency)
                      : formatCurrency(position.market_value, position.currency)
                    }
                  </div>
                  <div className={`text-sm font-semibold ${pnlColor}`}>
                    {position.unrealized_pnl_pct !== null
                      ? `${isPositive ? '+' : ''}${formatNumber(position.unrealized_pnl_pct, 2)}%`
                      : '-'}
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              {isSold ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('dashboard.avgCostBasis')}</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(position.avg_cost, position.currency)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('dashboard.avgProceeds')}</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(position.current_price, position.currency)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('fields.quantity')}</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {formatQuantity(position.quantity)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">% {t('common.wallet')}</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {walletPct}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('dashboard.avgCost')}</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(position.avg_cost, position.currency)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('dashboard.currentPrice')}</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(position.current_price, position.currency)}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('dashboard.dailyChange')}</span>
                    <div className={`font-medium ${
                      position.daily_change_pct !== null && position.daily_change_pct !== undefined
                        ? (Number(position.daily_change_pct) > 0
                          ? 'text-green-600 dark:text-green-400'
                          : Number(position.daily_change_pct) < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-neutral-600 dark:text-neutral-400')
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}>
                      {position.daily_change_pct !== null && position.daily_change_pct !== undefined
                        ? `${Number(position.daily_change_pct) > 0 ? '+' : Number(position.daily_change_pct) < 0 ? '' : '+'}${formatNumber(position.daily_change_pct, 2)}%`
                        : '-'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">P&L</span>
                    <div className={`font-semibold flex items-center justify-end gap-1 ${pnlColor}`}>
                      {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {formatCurrency(position.unrealized_pnl, position.currency)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {sortedPositions.length === 0 && (
          <div className="card text-center py-12 text-neutral-500 dark:text-neutral-400">
            <p>{t('dashboard.noPositions')}</p>
            <p className="text-sm mt-2">{t('dashboard.noPositionsInfo')}</p>
          </div>
        )}
        </div>
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden lg:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th
                  onClick={() => handleSort('symbol')}
                  aria-sort={sortKey === 'symbol' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-3 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {t('fields.symbol')} <SortIcon column="symbol" activeColumn={sortKey} direction={sortDir} />
                </th>
                <th
                  onClick={() => handleSort('name')}
                  aria-sort={isActive('name') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-3 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 hidden xl:table-cell"
                >
                  {t('fields.name')} <SortIcon column="name" activeColumn={sortKey} direction={sortDir} />
                </th>
              {isSold ? (
                <>
                  <th
                    onClick={() => handleSort('avg_cost')}
                    aria-sort={isActive('avg_cost') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    title="Average cost per share including fees"
                  >
                    {t('dashboard.avgCostBasis')} <SortIcon column="avg_cost" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('current_price')}
                    aria-sort={isActive('current_price') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    title="Average proceeds per share after fees"
                  >
                    {t('dashboard.avgProceeds')} <SortIcon column="current_price" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('unrealized_pnl')}
                    aria-sort={sortKey === 'unrealized_pnl' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('dashboard.realizedPnL')} <SortIcon column="unrealized_pnl" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('unrealized_pnl_pct')}
                    aria-sort={sortKey === 'unrealized_pnl_pct' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('dashboard.realizedPnL')} % <SortIcon column="unrealized_pnl_pct" activeColumn={sortKey} direction={sortDir} />
                  </th>
                </>
              ) : (
                <>
                  <th
                    onClick={() => handleSort('quantity')}
                    aria-sort={sortKey === 'quantity' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('fields.quantity')} <SortIcon column="quantity" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('avg_cost')}
                    aria-sort={isActive('avg_cost') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('dashboard.avgCost')} <SortIcon column="avg_cost" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('current_price')}
                    aria-sort={isActive('current_price') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('dashboard.currentPrice')} <SortIcon column="current_price" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('daily_change_pct')}
                    aria-sort={isActive('daily_change_pct') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 hidden xl:table-cell"
                  >
                    {t('dashboard.dailyChange')} % <SortIcon column="daily_change_pct" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('market_value')}
                    aria-sort={sortKey === 'market_value' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t('dashboard.marketValue')} <SortIcon column="market_value" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('wallet_pct')}
                    aria-sort={sortKey === 'wallet_pct' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 hidden xl:table-cell"
                  >
                    % {t('common.wallet')} <SortIcon column="wallet_pct" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('unrealized_pnl')}
                    aria-sort={sortKey === 'unrealized_pnl' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    P&L <SortIcon column="unrealized_pnl" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('unrealized_pnl_pct')}
                    aria-sort={sortKey === 'unrealized_pnl_pct' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-3 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    P&L % <SortIcon column="unrealized_pnl_pct" activeColumn={sortKey} direction={sortDir} />
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
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <img 
                        src={getAssetLogoUrl(position.symbol, position.asset_type, position.name)}
                        alt={`${position.symbol} logo`}
                        className="w-8 h-8 object-cover flex-shrink-0"
                        style={{ borderRadius: 0 }}
                        onLoad={(e) => {
                          const img = e.currentTarget as HTMLImageElement
                          if (!validateLogoImage(img)) {
                            img.dispatchEvent(new Event('error'))
                          }
                        }}
                        onError={(e) => handleLogoError(e, position.symbol, position.name, position.asset_type)}
                      />
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {position.symbol}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap hidden xl:table-cell">
                    <div className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs truncate">
                      {position.name || '-'}
                    </div>
                  </td>
                  {isSold ? (
                    <>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(position.avg_cost, position.currency)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(position.current_price, position.currency)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <div className={`text-sm font-semibold flex items-center justify-end gap-1 ${pnlColor}`}>
                          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {formatCurrency(position.unrealized_pnl, position.currency)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <div className={`text-sm font-semibold ${pnlColor}`}>
                          {position.unrealized_pnl_pct !== null
                            ? `${isPositive ? '+' : ''}${formatNumber(position.unrealized_pnl_pct, 2)}%`
                            : '-'}
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {formatQuantity(position.quantity)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(position.avg_cost, position.currency)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(position.current_price, position.currency)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right hidden xl:table-cell">
                        <div className={`text-sm font-medium ${
                          position.daily_change_pct !== null && position.daily_change_pct !== undefined
                            ? (Number(position.daily_change_pct) > 0
                              ? 'text-green-600 dark:text-green-400'
                              : Number(position.daily_change_pct) < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-neutral-600 dark:text-neutral-400')
                            : 'text-neutral-500 dark:text-neutral-400'
                        }`}>
                          {position.daily_change_pct !== null && position.daily_change_pct !== undefined
                            ? `${Number(position.daily_change_pct) > 0 ? '+' : Number(position.daily_change_pct) < 0 ? '' : '+'}${formatNumber(position.daily_change_pct, 2)}%`
                            : '-'}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(position.market_value, position.currency)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right hidden xl:table-cell">
                        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {position.market_value !== null && position.market_value !== undefined && totalPortfolioValue > 0
                            ? `${((Number(position.market_value) / totalPortfolioValue) * 100).toFixed(2)}%`
                            : '-'}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <div className={`text-sm font-semibold flex items-center justify-end gap-1 ${pnlColor}`}>
                          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {formatCurrency(position.unrealized_pnl, position.currency)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
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
            <p>{t('dashboard.noPositions')}</p>
            <p className="text-sm mt-2">{t('dashboard.noPositionsInfo')}</p>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
