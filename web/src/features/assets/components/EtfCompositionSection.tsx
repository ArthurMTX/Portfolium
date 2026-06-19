import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Coins,
  PieChart,
  Shield,
  Wallet,
} from 'lucide-react'
import type { AssetEtfCompositionDTO } from '@/api'
import {
  clampAllocationPercent,
  formatAllocationPercent,
} from '@/features/assets/lib/assetResearchMetricBuilders'
import { formatNumber } from '@/shared/lib/formatUtils'
import { getAssetLogoUrl, validateLogoImage } from '@/shared/lib/logoUtils'
import { getSectorColor, getSectorIcon } from '@/shared/lib/sectorIndustryUtils'
import { getThemeColor, getThemeHexColor, getThemeIcon } from '@/shared/lib/themeUtils'

interface EtfCompositionQueryState {
  data?: AssetEtfCompositionDTO
  isLoading: boolean
  error: Error | null
}

export default function EtfCompositionSection({
  query,
  enabled,
  symbol,
}: {
  query: EtfCompositionQueryState
  enabled: boolean
  symbol: string
}) {
  if (!enabled && !query.data && !query.isLoading) return null

  if (query.isLoading) {
    return (
      <EtfSection>
        <div className="space-y-4">
          <div className="card p-5 sm:p-6">
            <div className="h-5 w-56 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="h-20 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
              <div className="h-20 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
            </div>
            <div className="mt-5 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                    <div className="h-3 w-24 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                  </div>
                  <div className="h-4 w-14 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((index) => (
              <div key={index} className="card p-5 sm:p-6 space-y-3">
                <div className="h-5 w-36 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                <div className="h-3 w-48 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                <div className="h-3 w-full rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </EtfSection>
    )
  }

  if (query.error) {
    return (
      <EtfSection>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {query.error.message || `Unable to load ETF composition for ${symbol}.`}
        </div>
      </EtfSection>
    )
  }

  const data = query.data
  if (!data || !data.available) return null

  const holdings = (data.holdings || []).slice(0, 10)
  const themeExposure = data.theme_exposure || []
  const portfolioOverlap = data.portfolio_overlap || null
  const sectorWeightings = data.sector_weightings || []
  const assetClasses = data.asset_classes || []
  const hasHoldings = Boolean(data.holdings_available && holdings.length > 0)
  const hasThemeExposure = Boolean(data.theme_exposure_available && themeExposure.length > 0)
  const hasPortfolioOverlap = Boolean(data.portfolio_overlap_available && portfolioOverlap)
  const hasSectorWeightings = Boolean(data.sector_weightings_available && sectorWeightings.length > 0)
  const hasAssetClasses = Boolean(data.asset_classes_available && assetClasses.length > 0)
  const hasLeftColumn = hasThemeExposure || hasHoldings || hasPortfolioOverlap
  const hasRightColumn = hasSectorWeightings || hasAssetClasses

  if (!hasHoldings && !hasThemeExposure && !hasPortfolioOverlap && !hasSectorWeightings && !hasAssetClasses) {
    return null
  }

  return (
    <EtfSection>
      <div className={`grid gap-4 items-start ${hasLeftColumn && hasRightColumn ? 'xl:grid-cols-2' : ''}`}>
        {hasLeftColumn && (
          <div className="space-y-4">
            {hasThemeExposure && (
              <EtfThemeExposureCard
                themeExposure={themeExposure}
                themeCoverage={data.theme_coverage || 0}
              />
            )}

            {(hasHoldings || (hasPortfolioOverlap && portfolioOverlap)) && (
              <EtfTopHoldingsCard
                holdings={holdings}
                totalTop10Weight={data.total_top10_weight || 0}
                overlap={portfolioOverlap}
              />
            )}
          </div>
        )}

        {hasRightColumn && (
          <div className="space-y-4">
            {hasSectorWeightings && (
              <div className="card p-5 sm:p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Sector Allocation</h3>
                </div>
                <div className="space-y-4">
                  {sectorWeightings.map((item) => {
                    const SectorIcon = getSectorIcon(item.sector)
                    return (
                      <AllocationRow
                        key={item.sector}
                        label={item.sector}
                        weight={item.weight}
                        icon={<SectorIcon size={15} className={getSectorColor(item.sector)} />}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {hasAssetClasses && (
              <div className="card p-5 sm:p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Asset Allocation</h3>
                </div>
                <div className="space-y-4">
                  {assetClasses.map((item) => {
                    const AssetClassIcon = getAssetAllocationIcon(item.name)
                    return (
                      <AllocationRow
                        key={item.name}
                        label={item.name}
                        weight={item.weight}
                        icon={<AssetClassIcon size={15} className="text-pink-600 dark:text-pink-400" />}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </EtfSection>
  )
}

function EtfSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center">
          <PieChart size={20} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">ETF Composition</h2>
      </div>
      {children}
    </section>
  )
}

function EtfTopHoldingsCard({
  holdings,
  totalTop10Weight,
  overlap,
}: {
  holdings: NonNullable<AssetEtfCompositionDTO['holdings']>
  totalTop10Weight: number
  overlap: AssetEtfCompositionDTO['portfolio_overlap'] | null
}) {
  const overlapHoldings = overlap?.holdings || []
  const overlapBySymbol = new Map(overlapHoldings.map((holding) => [holding.symbol, holding]))
  const hasOverlapData = Boolean(overlap)

  return (
    <div className="card p-5 sm:p-6 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Top Holdings</h3>
        {hasOverlapData && overlap && (
          <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
            <Wallet size={13} />
            {formatNumber(overlap.overlap_weight * 100, 1)}% overlap
          </div>
        )}
      </div>

      <div className={`grid gap-2 ${hasOverlapData ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-800/50">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Top 10 concentration</div>
          <div className="mt-0.5 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formatNumber(totalTop10Weight * 100, 1)}%</div>
        </div>
        {hasOverlapData && overlap && (
          <>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-800/50">
              <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Matching</div>
              <div className="mt-0.5 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {overlap.overlapping_holdings_count} {overlap.overlapping_holdings_count === 1 ? 'holding' : 'holdings'}
              </div>
            </div>
          </>
        )}
      </div>

      {holdings.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-400">
          No overlapping holdings were found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {holdings.map((holding) => {
              const isOwned = overlapBySymbol.has(holding.symbol)
              return (
                <Link
                  key={holding.symbol}
                  to={`/assets/${encodeURIComponent(holding.symbol)}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                >
                  <AssetHoldingAvatar symbol={holding.symbol} name={holding.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{holding.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      <span>{holding.symbol}</span>
                      {isOwned && (
                        <span className="rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Already owned
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    {formatNumber(holding.weight * 100, 2)}%
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function EtfThemeExposureCard({
  themeExposure,
  themeCoverage,
}: {
  themeExposure: NonNullable<AssetEtfCompositionDTO['theme_exposure']>
  themeCoverage: number
}) {
  const normalizedCoverage = Math.max(0, Math.min(1, themeCoverage || 0))
  const showPartialWarning = normalizedCoverage < 0.5

  return (
    <div className="card p-5 sm:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Theme Exposure</h3>
          <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Theme coverage {formatNumber(normalizedCoverage * 100, 0)}%
          </div>
        </div>
        {showPartialWarning && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertTriangle size={13} />
            Partial exposure
          </span>
        )}
      </div>

      {showPartialWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          Theme exposure is partial because some holdings are not yet classified.
        </div>
      )}

      <div className="space-y-4">
        {themeExposure.map((item) => {
          const ThemeIcon = getThemeIcon(item.theme)
          const themeColor = getThemeColor(item.theme)
          const themeHex = getThemeHexColor(item.theme)
          return (
            <AllocationRow
              key={item.theme}
              label={item.theme}
              weight={item.weight}
              icon={<ThemeIcon size={15} className={themeColor} />}
              barColor={themeHex}
              formattedValue={`${formatNumber(clampAllocationPercent(item.weight), 1)}%`}
            />
          )
        })}
      </div>
    </div>
  )
}

function AssetHoldingAvatar({ symbol, name }: { symbol: string; name: string }) {
  const [logoFailed, setLogoFailed] = useState(false)
  const initials = getAssetInitials(symbol, name)

  if (logoFailed) {
    return (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-indigo-100 text-sm font-semibold text-indigo-700 dark:border-neutral-700 dark:bg-indigo-900/40 dark:text-indigo-200">
        {initials}
      </div>
    )
  }

  return (
    <img
      src={getAssetLogoUrl(symbol, null, name)}
      alt={`${symbol} logo`}
      className="h-10 w-10 flex-shrink-0 border border-neutral-200 object-cover dark:border-neutral-700"
      onLoad={(event) => {
        const image = event.currentTarget as HTMLImageElement
        if (!validateLogoImage(image)) setLogoFailed(true)
      }}
      onError={() => setLogoFailed(true)}
    />
  )
}

function getAssetInitials(symbol: string, name: string): string {
  const text = (name || symbol || '').trim()
  if (!text) return symbol.slice(0, 2).toUpperCase()
  const parts = text.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function getAssetAllocationIcon(name: string) {
  switch (name) {
    case 'Stocks':
      return BarChart3
    case 'Cash':
      return Wallet
    case 'Bonds':
      return Shield
    case 'Other':
      return Coins
    default:
      return PieChart
  }
}

function AllocationRow({
  label,
  weight,
  icon,
  barColor,
  formattedValue,
}: {
  label: string
  weight: number
  icon: React.ReactNode
  barColor?: string
  formattedValue?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2 font-medium text-neutral-800 dark:text-neutral-200">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
          {formattedValue || formatAllocationPercent(weight)}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full ${barColor ? '' : 'bg-pink-500 dark:bg-pink-400'}`}
          style={{ width: `${clampAllocationPercent(weight)}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}
