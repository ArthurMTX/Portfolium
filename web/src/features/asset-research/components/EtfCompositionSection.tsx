import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CircleDollarSign } from 'lucide-react'
import type { AssetEtfCompositionDTO } from '@/api'
import AssetLogo from '@/shared/components/AssetLogo'
import { formatNumber } from '@/shared/lib/formatUtils'
import { getSectorHexColor, getSectorIcon } from '@/shared/lib/sectorIndustryUtils'
import { getThemeHexColor, getThemeIcon } from '@/shared/lib/themeUtils'
import { clampWeightPercent } from '@/features/asset-research/lib/assetResearchViewFormatting'
import { EvidenceSkeleton } from '@/features/asset-research/components/EvidencePrimitives'

export function EtfCompositionSection({
  data,
  loading,
  error,
  symbol,
}: {
  data: AssetEtfCompositionDTO | undefined
  loading: boolean
  error: Error | null
  symbol: string
}) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <section className="asset-research__etf">
        <div className="pf-section-header asset-research__section-heading">
          <div>
            <p className="pf-section-kicker asset-research__section-label">{t('etfCompositionSection.etfComposition')}</p>
            <h2>{t('etfCompositionSection.topHoldings')}</h2>
          </div>
        </div>
        <EvidenceSkeleton rows={5} />
      </section>
    )
  }

  if (error) {
    return (
      <section className="asset-research__etf">
        <div className="pf-section-header asset-research__section-heading">
          <div>
            <p className="pf-section-kicker asset-research__section-label">{t('etfCompositionSection.etfComposition')}</p>
          </div>
        </div>
        <div className="asset-research__quiet-state">
          {error.message || t('etfCompositionSection.unableToLoad', { symbol })}
        </div>
      </section>
    )
  }

  if (!data || !data.available) return null

  const holdings = (data.holdings || []).slice(0, 10)
  const themeExposure = data.theme_exposure || []
  const sectorWeightings = data.sector_weightings || []
  const assetClasses = data.asset_classes || []
  const hasHoldings = Boolean(data.holdings_available && holdings.length > 0)
  const hasThemeExposure = Boolean(data.theme_exposure_available && themeExposure.length > 0)
  const hasSectorWeightings = Boolean(data.sector_weightings_available && sectorWeightings.length > 0)
  const hasAssetClasses = Boolean(data.asset_classes_available && assetClasses.length > 0)

  if (!hasHoldings && !hasThemeExposure && !hasSectorWeightings && !hasAssetClasses) return null

  const normalizedCoverage = Math.max(0, Math.min(1, data.theme_coverage || 0))
  const showPartialWarning = hasThemeExposure && normalizedCoverage < 0.5
  const hasLeftColumn = hasHoldings || hasThemeExposure
  const hasRightColumn = hasSectorWeightings || hasAssetClasses
  const overlap = data.portfolio_overlap || null
  const overlapSymbols = new Set((overlap?.holdings || []).map((holding) => holding.symbol))

  const leftColumn = (
    <div>
      {hasHoldings && (
        <section>
          <div className="pf-section-header asset-research__section-heading">
            <div>
              <p className="pf-section-kicker asset-research__section-label">{t('etfCompositionSection.topHoldings')}</p>
            </div>
            <span>
              {typeof data.total_top10_weight === 'number' &&
                `${t('etfCompositionSection.top10Concentration')} ${formatNumber(data.total_top10_weight * 100, 1)}%`}
              {overlap && ` · ${t('etfCompositionSection.overlapPercent', { percent: formatNumber(overlap.overlap_weight * 100, 1) })}`}
            </span>
          </div>
          <div>
            {holdings.map((holding) => (
              <Link
                key={holding.symbol}
                to={`/assets/${encodeURIComponent(holding.symbol)}/research`}
                className="asset-research__holding-row"
              >
                <AssetLogo
                  symbol={holding.symbol}
                  assetName={holding.name}
                  alt=""
                  showInitialsFallback
                />
                <div>
                  <strong>{holding.name}</strong>
                  <small>
                    {holding.symbol}
                    {overlapSymbols.has(holding.symbol) && (
                      <span className="asset-research__holding-owned">{t('etfCompositionSection.alreadyOwned')}</span>
                    )}
                  </small>
                </div>
                <span>{formatNumber(holding.weight * 100, 2)}%</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {hasThemeExposure && (
        <div className="asset-research__theme-evidence">
          <p className="pf-section-kicker asset-research__section-label">
            {t('etfCompositionSection.themeExposure')} · {t('etfCompositionSection.themeCoverage', { percent: formatNumber(normalizedCoverage * 100, 0) })}
          </p>
          {showPartialWarning && (
            <div className="asset-research__partial-warning">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{t('etfCompositionSection.partialExposureNote')}</span>
            </div>
          )}
          <ol>
            {themeExposure.map((item) => {
              const ThemeIcon = getThemeIcon(item.theme)
              const color = getThemeHexColor(item.theme)
              const percent = clampWeightPercent(item.weight)
              return (
                <li key={item.theme}>
                  <ThemeIcon size={15} strokeWidth={1.8} color={color} aria-hidden="true" />
                  <span>{item.theme}</span>
                  <strong>{formatNumber(percent, 1)}%</strong>
                  <div className="asset-research__weight-bar">
                    <i style={{ width: `${percent}%`, backgroundColor: color }} />
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )

  const rightColumn = (
    <div>
      {hasSectorWeightings && (
        <div className="asset-research__theme-evidence">
          <p className="pf-section-kicker asset-research__section-label">{t('etfCompositionSection.sectorAllocation')}</p>
          <ol className="asset-research__allocation-list">
            {sectorWeightings.map((item) => {
              const SectorIcon = getSectorIcon(item.sector)
              const color = getSectorHexColor(item.sector)
              const percent = clampWeightPercent(item.weight)
              return (
                <li key={item.sector}>
                  <SectorIcon size={15} strokeWidth={1.8} color={color} aria-hidden="true" />
                  <span>{item.sector}</span>
                  <strong>{formatNumber(percent, 1)}%</strong>
                  <div className="asset-research__weight-bar">
                    <i style={{ width: `${percent}%`, backgroundColor: color }} />
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {hasAssetClasses && (
        <div className="asset-research__theme-evidence">
          <p className="pf-section-kicker asset-research__section-label">{t('etfCompositionSection.assetAllocation')}</p>
          <ol className="asset-research__allocation-list">
            {assetClasses.map((item) => {
              const percent = clampWeightPercent(item.weight)
              return (
                <li key={item.name}>
                  <CircleDollarSign size={15} strokeWidth={1.8} aria-hidden="true" />
                  <span>{item.name}</span>
                  <strong>{formatNumber(percent, 1)}%</strong>
                  <div className="asset-research__weight-bar">
                    <i style={{ width: `${percent}%` }} />
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )

  return (
    <section className="asset-research__etf">
      <div className="pf-section-header asset-research__section-heading">
        <div>
          <p className="pf-section-kicker asset-research__section-label">{t('etfCompositionSection.etfComposition')}</p>
          <h2>{t('assetResearchView.howIsThisAssetBuilt')}</h2>
        </div>
      </div>

      {!hasHoldings && !hasThemeExposure && !hasSectorWeightings && !hasAssetClasses ? (
        <div className="asset-research__quiet-state">
          {t('etfCompositionSection.noOverlappingHoldings')}
        </div>
      ) : (
        <div className={hasLeftColumn && hasRightColumn ? 'asset-research__etf-columns' : undefined}>
          {hasLeftColumn && leftColumn}
          {hasRightColumn && rightColumn}
        </div>
      )}
    </section>
  )
}
