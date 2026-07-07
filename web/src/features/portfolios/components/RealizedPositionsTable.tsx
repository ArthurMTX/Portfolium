import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PositionDTO } from '@/api'
import AssetLogo from '@/shared/components/AssetLogo'
import SortIcon from '@/shared/components/SortIcon'
import { formatCurrency, formatNumber, formatQuantity } from '@/shared/lib/formatUtils'
import PositionDetailModal from '@/features/portfolios/components/PositionDetailModal'

interface RealizedPositionsTableProps {
  positions: PositionDTO[]
  portfolioId: number
}

type SortKey =
  | 'symbol'
  | 'realized_pnl'
  | 'realized_pnl_percent'
  | 'realized_quantity'
  | 'quantity'
  | 'lifetime_pnl'
type SortDir = 'asc' | 'desc'

export default function RealizedPositionsTable({ positions, portfolioId }: RealizedPositionsTableProps) {
  const { t } = useTranslation()
  const [selectedPosition, setSelectedPosition] = useState<PositionDTO | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('realized_pnl')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sortedPositions = useMemo(() => {
    const direction = sortDir === 'asc' ? 1 : -1
    return [...positions].sort((a, b) => {
      if (sortKey === 'symbol') return a.symbol.localeCompare(b.symbol) * direction
      return (Number(a[sortKey] ?? 0) - Number(b[sortKey] ?? 0)) * direction
    })
  }, [positions, sortDir, sortKey])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((current) => current === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortLabels: Record<SortKey, string> = {
    symbol: t('fields.symbol'),
    realized_pnl: t('dashboard.page.realizedPnL'),
    realized_pnl_percent: `${t('dashboard.page.realizedPnL')} %`,
    realized_quantity: t('portfolios.realizedPositions.soldQuantity'),
    quantity: t('portfolios.realizedPositions.remainingQuantity'),
    lifetime_pnl: t('portfolios.realizedPositions.lifetimePnL'),
  }

  const openPosition = (position: PositionDTO) => setSelectedPosition(position)

  return (
    <>
      <div className="lg:hidden">
        <div className="flex items-center gap-2 mb-3">
          <label htmlFor="realized-mobile-sort" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
            {t('common.sortBy')}:
          </label>
          <select
            id="realized-mobile-sort"
            value={sortKey}
            onChange={(event) => handleSort(event.target.value as SortKey)}
            className="flex-1 input text-sm py-2 px-3"
          >
            {Object.entries(sortLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            onClick={() => setSortDir((current) => current === 'asc' ? 'desc' : 'asc')}
            className="btn-secondary p-2 flex items-center gap-1"
            title={sortDir === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
          >
            {sortDir === 'asc' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        <div className="space-y-3">
          {sortedPositions.map((position) => {
            const realizedPositive = position.realized_pnl >= 0
            const realizedColor = realizedPositive
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
            const lifetimePositive = (position.lifetime_pnl ?? 0) >= 0
            const lifetimeColor = lifetimePositive
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'

            return (
              <div
                key={position.asset_id}
                className="card p-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                onClick={() => openPosition(position)}
              >
                <div className="flex items-start justify-between mb-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <AssetLogo
                      symbol={position.symbol}
                      assetType={position.asset_type}
                      assetName={position.name}
                      alt={`${position.symbol} logo`}
                      className="w-10 h-10 flex-shrink-0 object-cover"
                      style={{ borderRadius: 0 }}
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
                    <div className={`font-bold text-base flex items-center justify-end gap-1 ${realizedColor}`}>
                      {realizedPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {formatCurrency(position.realized_pnl, position.currency)}
                    </div>
                    <div className={`text-sm font-semibold ${realizedColor}`}>
                      {position.realized_pnl_percent === null
                        ? '-'
                        : `${position.realized_pnl_percent >= 0 ? '+' : ''}${formatNumber(position.realized_pnl_percent, 2)}%`}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('portfolios.realizedPositions.soldQuantity')}</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {formatQuantity(position.realized_quantity)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('portfolios.realizedPositions.remainingQuantity')}</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {formatQuantity(position.quantity)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('portfolios.realizedPositions.lifetimePnL')}</span>
                    <div className={`font-semibold flex items-center gap-1 ${position.lifetime_pnl === null ? 'text-neutral-500 dark:text-neutral-400' : lifetimeColor}`}>
                      {position.lifetime_pnl === null ? '-' : (
                        <>
                          {lifetimePositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {formatCurrency(position.lifetime_pnl, position.currency)}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {sortedPositions.length === 0 && (
            <div className="card text-center py-12 text-neutral-500 dark:text-neutral-400">
              <p>{t('portfolios.realizedPositions.noRealizedPositions')}</p>
              <p className="text-sm mt-2">{t('portfolios.realizedPositions.realizedPositionsInfo')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:block overflow-x-auto h-full -mt-px">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10 shadow-sm">
            <tr>
              {Object.entries(sortLabels).map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => handleSort(key as SortKey)}
                  aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`${key === 'symbol' ? 'text-left' : 'text-right'} px-3 py-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800`}
                >
                  {label}{' '}
                  <SortIcon
                    column={key}
                    activeColumn={sortKey}
                    direction={sortDir}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sortedPositions.map((position) => {
              const realizedPositive = position.realized_pnl >= 0
              const realizedColor = realizedPositive
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
              const lifetimePositive = (position.lifetime_pnl ?? 0) >= 0
              const lifetimeColor = lifetimePositive
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'

              return (
                <tr
                  key={position.asset_id}
                  className="hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors cursor-pointer"
                  onClick={() => openPosition(position)}
                >
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <AssetLogo
                        symbol={position.symbol}
                        assetType={position.asset_type}
                        assetName={position.name}
                        alt={`${position.symbol} logo`}
                        className="w-8 h-8 object-cover flex-shrink-0"
                        style={{ borderRadius: 0 }}
                      />
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">{position.symbol}</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">{position.name || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className={`px-3 py-3 whitespace-nowrap text-right text-sm font-semibold ${realizedColor}`}>
                    <span className="inline-flex items-center justify-end gap-1">
                      {realizedPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {formatCurrency(position.realized_pnl, position.currency)}
                    </span>
                  </td>
                  <td className={`px-3 py-3 whitespace-nowrap text-right text-sm font-semibold ${realizedColor}`}>
                    {position.realized_pnl_percent === null
                      ? '-'
                      : `${position.realized_pnl_percent >= 0 ? '+' : ''}${formatNumber(position.realized_pnl_percent, 2)}%`}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right font-medium text-neutral-900 dark:text-neutral-100">
                    {formatQuantity(position.realized_quantity)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right font-medium text-neutral-900 dark:text-neutral-100">
                    {formatQuantity(position.quantity)}
                  </td>
                  <td className={`px-3 py-3 whitespace-nowrap text-right text-sm font-semibold ${position.lifetime_pnl === null ? 'text-neutral-500 dark:text-neutral-400' : lifetimeColor}`}>
                    {position.lifetime_pnl === null ? '-' : (
                      <span className="inline-flex items-center justify-end gap-1">
                        {lifetimePositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {formatCurrency(position.lifetime_pnl, position.currency)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {sortedPositions.length === 0 && (
          <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
            <p>{t('portfolios.realizedPositions.noRealizedPositions')}</p>
            <p className="text-sm mt-2">{t('portfolios.realizedPositions.realizedPositionsInfo')}</p>
          </div>
        )}
      </div>

      <PositionDetailModal
        position={selectedPosition}
        portfolioId={portfolioId}
        isOpen={selectedPosition !== null}
        onClose={() => setSelectedPosition(null)}
      />
    </>
  )
}
