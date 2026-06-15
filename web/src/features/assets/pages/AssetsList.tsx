import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Database, Search, ExternalLink, TrendingUp, Tag, Loader, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import api, { type AssetCleanupCandidateDTO, type AssetThemeDTO, type DeleteInvalidProviderAssetsResponseDTO } from '@/api'
import { getThemeHexColor, getThemeIcon } from '@/shared/lib/themeUtils'
import AssetLogo from '@/shared/components/AssetLogo'

interface Asset {
  id: number
  symbol: string
  name: string | null
  currency: string
  class: string | null
  asset_type: string | null
  sector: string | null
  industry: string | null
  country: string | null
  effective_sector: string | null
  effective_industry: string | null
  effective_country: string | null
  themes?: AssetThemeDTO[]
  created_at: string
  updated_at: string
  first_transaction_date: string | null
  logo_fetched_at: string | null
  logo_content_type: string | null
  transaction_count?: number
  watchlist_count?: number
  pending_dividend_count?: number
  investment_note_count?: number
  metadata_override_count?: number
}

type SortKey =
  | 'id'
  | 'symbol'
  | 'name'
  | 'asset_type'
  | 'currency'
  | 'sector'
  | 'industry'
  | 'country'
  | 'themes'
  | 'created_at'
  | 'first_transaction_date'

type SortDir = 'asc' | 'desc'
const CLEANUP_VALIDATE_BATCH_SIZE = 20
const CLEANUP_DELETE_BATCH_SIZE = 50

export default function AssetsList() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCurrency, setFilterCurrency] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('symbol')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [cleanupRunning, setCleanupRunning] = useState(false)
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null)
  const [cleanupError, setCleanupError] = useState<string | null>(null)
  const [cleanupProgress, setCleanupProgress] = useState<string | null>(null)

  useEffect(() => {
    loadAssets()
  }, [])

  useEffect(() => {
    let filtered = assets

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (asset) =>
          asset.symbol.toLowerCase().includes(query) ||
          asset.name?.toLowerCase().includes(query) ||
          asset.sector?.toLowerCase().includes(query) ||
          asset.industry?.toLowerCase().includes(query) ||
          getThemeSortValue(asset.themes).toLowerCase().includes(query)
      )
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((asset) => asset.asset_type === filterType)
    }

    // Currency filter
    if (filterCurrency !== 'all') {
      filtered = filtered.filter((asset) => asset.currency === filterCurrency)
    }

    setFilteredAssets(filtered)
  }, [searchQuery, filterType, filterCurrency, assets])

  const loadAssets = async () => {
    try {
      setLoading(true)
      const data = await api.getAssetDatabaseList()

      setAssets(data)
      setFilteredAssets(data)
    } catch (err) {
      console.error('Failed to load assets:', err)
    } finally {
      setLoading(false)
    }
  }

  const uniqueTypes = Array.from(new Set(assets.map((a) => a.asset_type).filter(Boolean)))
  const uniqueCurrencies = Array.from(new Set(assets.map((a) => a.currency)))

  const sortedAssets = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1

    return [...filteredAssets].sort((a, b) => {
      const aVal = getSortValue(a, sortKey)
      const bVal = getSortValue(b, sortKey)
      const aEmpty = aVal === null || aVal === undefined || aVal === ''
      const bEmpty = bVal === null || bVal === undefined || bVal === ''

      if (aEmpty && bEmpty) return 0
      if (aEmpty) return 1
      if (bEmpty) return -1

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dir
      }

      return String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
        sensitivity: 'base',
      }) * dir
    })
  }, [filteredAssets, sortKey, sortDir])

  const handleDeleteInvalidProviderAssets = async () => {
    const symbols = sortedAssets.map((asset) => asset.symbol)
    if (symbols.length === 0) return

    try {
      setCleanupRunning(true)
      setCleanupMessage(null)
      setCleanupError(null)
      setCleanupProgress(`Validating 0/${symbols.length}`)

      const preview = await runInvalidProviderCleanupBatches({
        symbols,
        dryRun: true,
        batchSize: CLEANUP_VALIDATE_BATCH_SIZE,
        onProgress: (processed, total) => setCleanupProgress(`Validating ${processed}/${total}`),
      })
      const deletableSymbols = preview.candidates.map((asset) => asset.symbol)
      const blockedSymbols = preview.blocked.map((asset) => asset.symbol)
      const unresolvedSymbols = preview.unresolved.map((asset) => asset.symbol)

      if (deletableSymbols.length === 0) {
        const blockedText = blockedSymbols.length > 0
          ? ` ${blockedSymbols.length} not-found rows are blocked because they have user references: ${formatSymbolList(blockedSymbols)}.`
          : ''
        const unresolvedText = unresolvedSymbols.length > 0
          ? ` ${unresolvedSymbols.length} rows had non-404 provider issues and were left untouched: ${formatSymbolList(unresolvedSymbols)}.`
          : ''
        setCleanupMessage(`Checked ${preview.scanned} visible assets. No safe not-found rows to delete.${blockedText}${unresolvedText}`)
        return
      }

      const confirmationLines = [
        `Yahoo returned not-found or no identity metadata for ${preview.invalid} of ${preview.scanned} checked assets.`,
        `Delete ${deletableSymbols.length} safe not-found rows?`,
        formatSymbolList(deletableSymbols),
      ]
      if (blockedSymbols.length > 0) {
        confirmationLines.push(`${blockedSymbols.length} not-found rows are blocked: ${formatSymbolList(blockedSymbols)}`)
      }
      if (unresolvedSymbols.length > 0) {
        confirmationLines.push(`${unresolvedSymbols.length} non-404 provider failures will be left untouched: ${formatSymbolList(unresolvedSymbols)}`)
      }

      if (!window.confirm(confirmationLines.join('\n\n'))) {
        setCleanupMessage(`Found ${deletableSymbols.length} deletable not-found rows. No changes made.`)
        return
      }

      setCleanupProgress(`Deleting 0/${deletableSymbols.length}`)
      const result = await runInvalidProviderCleanupBatches({
        symbols: deletableSymbols,
        dryRun: false,
        batchSize: CLEANUP_DELETE_BATCH_SIZE,
        onProgress: (processed, total) => setCleanupProgress(`Deleting ${processed}/${total}`),
      })
      const blockedText = result.blocked.length > 0 ? ` ${result.blocked.length} not-found rows were blocked.` : ''
      setCleanupMessage(`Deleted ${result.deleted} not-found asset${result.deleted === 1 ? '' : 's'}.${blockedText}`)
      await loadAssets()
    } catch (err) {
      setCleanupError(err instanceof Error ? err.message : 'Failed to delete provider-invalid assets')
    } finally {
      setCleanupRunning(false)
      setCleanupProgress(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDir('asc')
  }

  const SortButton = ({ column, children }: { column: SortKey; children: ReactNode }) => (
    <button
      type="button"
      onClick={() => handleSort(column)}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium uppercase transition-colors ${
        sortKey === column
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
      }`}
    >
      {children}
      {sortKey === column ? (
        sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
      ) : (
        <ChevronUp size={14} className="opacity-20" />
      )}
    </button>
  )

  const renderThemes = (themes?: AssetThemeDTO[]) => {
    if (!themes || themes.length === 0) {
      return <span className="text-neutral-400 dark:text-neutral-500">-</span>
    }

    return (
      <div className="flex max-w-full flex-wrap gap-1.5">
        {themes.map((theme) => {
          const Icon = getThemeIcon(theme.label)
          const color = getThemeHexColor(theme.label)
          const subthemes = theme.children || []

          return (
            <div
              key={theme.label}
              className="inline-flex max-w-full items-center gap-1 rounded border px-2 py-1 text-xs font-medium"
              style={{ color, borderColor: `${color}66`, backgroundColor: `${color}14` }}
              title={getThemeTitle(theme)}
            >
              <Icon size={13} className="shrink-0" />
              <span className="truncate">{theme.label}</span>
              {subthemes.map((subtheme) => {
                const SubthemeIcon = getThemeIcon(subtheme.label)
                const subthemeColor = getThemeHexColor(subtheme.label)

                return (
                  <span
                    key={subtheme.label}
                    className="ml-1 inline-flex max-w-32 items-center gap-1 rounded px-1.5 py-0.5 text-[11px]"
                    style={{
                      color: subthemeColor,
                      backgroundColor: `${subthemeColor}18`,
                    }}
                  >
                    <SubthemeIcon size={11} className="shrink-0" />
                    <span className="truncate">{subtheme.label}</span>
                  </span>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Database className="text-blue-600" size={28} />
            Assets Database
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {filteredAssets.length} of {assets.length} assets
          </p>
        </div>
        <button
          type="button"
          onClick={handleDeleteInvalidProviderAssets}
          disabled={cleanupRunning || sortedAssets.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          title="Validate visible assets with Yahoo Finance and delete not-found rows that have no user references"
        >
          {cleanupRunning ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}
          {cleanupRunning ? cleanupProgress || 'Working...' : 'Delete Not-Found Tickers'}
        </button>
      </div>

      {(cleanupMessage || cleanupError) && (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
          cleanupError
            ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200'
            : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200'
        }`}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{cleanupError || cleanupMessage}</span>
        </div>
      )}

      {/* Filters */}
      <div className="card p-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by symbol, name, sector, industry, or theme..."
            className="w-full pl-12 pr-4 py-3 border-2 border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Asset Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 border-2 border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map((type) => (
                <option key={type || 'unknown'} value={type || ''}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Currency
            </label>
            <select
              value={filterCurrency}
              onChange={(e) => setFilterCurrency(e.target.value)}
              className="w-full px-4 py-2 border-2 border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Currencies</option>
              {uniqueCurrencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card p-12 text-center">
          <Loader className="animate-spin mx-auto mb-4 text-blue-600" size={48} />
          <p className="text-neutral-600 dark:text-neutral-400">Loading assets...</p>
        </div>
      )}

      {/* Assets List */}
      {!loading && (
        <div className="space-y-3">
          <div className="card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">Sort</span>
              <SortButton column="id">ID</SortButton>
              <SortButton column="symbol">Symbol</SortButton>
              <SortButton column="name">Name</SortButton>
              <SortButton column="asset_type">Type</SortButton>
              <SortButton column="currency">Currency</SortButton>
              <SortButton column="sector">Sector</SortButton>
              <SortButton column="industry">Industry</SortButton>
              <SortButton column="country">Country</SortButton>
              <SortButton column="themes">Themes</SortButton>
              <SortButton column="created_at">Created</SortButton>
              <SortButton column="first_transaction_date">First Tx</SortButton>
            </div>
          </div>

          {filteredAssets.length === 0 ? (
            <div className="card px-4 py-8 text-center text-neutral-600 dark:text-neutral-400">
              No assets found matching your filters
            </div>
          ) : (
            sortedAssets.map((asset) => (
              <article
                key={asset.id}
                className="card p-4 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(240px,1.2fr)_minmax(220px,1fr)_minmax(260px,1.4fr)_minmax(160px,auto)] lg:items-start">
                  <div className="flex min-w-0 items-start gap-3">
                    <AssetLogo
                      symbol={asset.symbol}
                      assetType={asset.asset_type}
                      assetName={asset.name}
                      alt={`${asset.symbol} logo`}
                      className="h-12 w-12 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">#{asset.id}</span>
                        <span className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
                          <TrendingUp size={14} />
                          {asset.symbol}
                        </span>
                      </div>
                      <div className="mt-1 break-words text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {asset.name || '-'}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                          {asset.asset_type || '-'}
                        </span>
                        <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          {asset.currency}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-neutral-900 dark:text-neutral-100">
                    <MetadataLine
                      label="Sector"
                      overridden={asset.effective_sector !== asset.sector && Boolean(asset.effective_sector)}
                      value={asset.effective_sector || asset.sector}
                    />
                    <MetadataLine
                      label="Industry"
                      overridden={asset.effective_industry !== asset.industry && Boolean(asset.effective_industry)}
                      value={asset.effective_industry || asset.industry}
                    />
                    <div className="flex gap-2">
                      <span className="w-16 shrink-0 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">Country</span>
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <span className="break-words">{asset.effective_country || asset.country || '-'}</span>
                      </span>
                    </div>
                  </div>

                  <div>{renderThemes(asset.themes)}</div>

                  <div className="space-y-3 text-sm text-neutral-900 dark:text-neutral-100">
                    <DateLine label="Created" value={formatDate(asset.created_at)} />
                    <DateLine label="First Tx" value={formatDate(asset.first_transaction_date)} />
                    <Link
                      to={`/dev/assets?symbol=${asset.symbol}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      <ExternalLink size={12} />
                      Debug
                    </Link>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function getSortValue(asset: Asset, key: SortKey): string | number | null {
  switch (key) {
    case 'id':
      return asset.id
    case 'sector':
      return asset.effective_sector || asset.sector
    case 'industry':
      return asset.effective_industry || asset.industry
    case 'country':
      return asset.effective_country || asset.country
    case 'themes':
      return getThemeSortValue(asset.themes)
    default:
      return asset[key] ?? null
  }
}

function MetadataLine({ label, value, overridden }: { label: string; value: string | null | undefined; overridden?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className={`inline-flex min-w-0 items-center gap-1 ${overridden ? 'font-semibold' : ''}`}>
        {overridden && (
          <span title="User override">
            <Tag size={12} className="text-yellow-600 dark:text-yellow-400" />
          </span>
        )}
        <span className="break-words">{value || '-'}</span>
      </span>
    </div>
  )
}

function DateLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-1 inline-flex items-center gap-1 whitespace-nowrap">
        {value}
      </div>
    </div>
  )
}

function getThemeSortValue(themes?: AssetThemeDTO[]): string {
  return (themes || [])
    .map((theme) => [
      theme.label,
      ...(theme.children || []).map((subtheme) => subtheme.label),
    ].join(' '))
    .join(' ')
}

function getThemeTitle(theme: AssetThemeDTO): string {
  const subthemes = theme.children?.map((child) => child.label).join(', ')
  return subthemes ? `${theme.label}: ${subthemes}` : theme.label
}

function formatSymbolList(symbols: string[]): string {
  if (symbols.length <= 20) {
    return symbols.join(', ')
  }
  return `${symbols.slice(0, 20).join(', ')} and ${symbols.length - 20} more`
}

async function runInvalidProviderCleanupBatches({
  symbols,
  dryRun,
  batchSize,
  onProgress,
}: {
  symbols: string[]
  dryRun: boolean
  batchSize: number
  onProgress: (processed: number, total: number) => void
}): Promise<DeleteInvalidProviderAssetsResponseDTO> {
  const batches = chunk(symbols, batchSize)
  let processed = 0
  let merged = emptyCleanupResponse(dryRun)

  for (const batch of batches) {
    const result = await api.deleteInvalidProviderAssets({ dryRun, symbols: batch })
    merged = mergeCleanupResponses(merged, result)
    processed += batch.length
    onProgress(Math.min(processed, symbols.length), symbols.length)
  }

  return merged
}

function emptyCleanupResponse(dryRun: boolean): DeleteInvalidProviderAssetsResponseDTO {
  return {
    dry_run: dryRun,
    scanned: 0,
    valid: 0,
    invalid: 0,
    deleted: 0,
    candidates: [],
    blocked: [],
    unresolved: [],
  }
}

function mergeCleanupResponses(
  current: DeleteInvalidProviderAssetsResponseDTO,
  next: DeleteInvalidProviderAssetsResponseDTO
): DeleteInvalidProviderAssetsResponseDTO {
  return {
    dry_run: next.dry_run,
    scanned: current.scanned + next.scanned,
    valid: current.valid + next.valid,
    invalid: current.invalid + next.invalid,
    deleted: current.deleted + next.deleted,
    candidates: mergeCandidates(current.candidates, next.candidates),
    blocked: mergeCandidates(current.blocked, next.blocked),
    unresolved: mergeCandidates(current.unresolved, next.unresolved),
  }
}

function mergeCandidates(
  current: AssetCleanupCandidateDTO[],
  next: AssetCleanupCandidateDTO[]
): AssetCleanupCandidateDTO[] {
  const bySymbol = new Map(current.map((candidate) => [candidate.symbol, candidate]))
  for (const candidate of next) {
    bySymbol.set(candidate.symbol, candidate)
  }
  return Array.from(bySymbol.values())
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
