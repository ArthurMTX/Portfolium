import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  AssetResearchBusinessDTO,
  AssetResearchFundamentalsDTO,
  AssetResearchSummaryDTO,
  AssetThemeDTO,
} from '@/api'
import {
  formatAssetType,
  formatCurrency,
  formatLargeNumber,
  formatNumber,
  formatWithSeparators,
} from '@/shared/lib/formatUtils'
import { formatResearchPercent } from '@/features/assets/lib/assetResearchMetricBuilders'
import { StateBlock } from '@/shared/components/StatePrimitives'
import { valueTone } from '@/features/asset-research/lib/assetResearchViewFormatting'
import { ClassificationLine, ThemeClassificationTree } from '@/features/asset-research/components/ClassificationTree'
import { EvidenceSkeleton, EvidenceValue } from '@/features/asset-research/components/EvidencePrimitives'
import { getMarketCapTier } from '@/features/assets/lib/conclusionUtils'

export function OverviewSection({
  asset,
  business,
  fundamentals,
  currency,
  themes,
  themesLoading,
  loading,
  children,
}: {
  asset: AssetResearchSummaryDTO['asset']
  business?: AssetResearchBusinessDTO
  fundamentals?: AssetResearchFundamentalsDTO
  currency: string
  themes: AssetThemeDTO[]
  themesLoading: boolean
  loading: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  const marketCapTier = fundamentals?.market_cap ? getMarketCapTier(fundamentals.market_cap) : null
  const hasClassification = Boolean(asset.sector || asset.industry || themes.length > 0 || marketCapTier)
  const showAside = themesLoading || hasClassification
  return (
    <div
      className={`pf-main-grid asset-research__overview-grid ${
        showAside ? '' : 'pf-main-grid--single'
      }`}
    >
      <div className="pf-main-col asset-research__overview-main">
        <section aria-labelledby="known-heading">
          <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.whatIsKnown')}</p>
          <h2 id="known-heading">{t('assetResearchView.whatIsThisAsset')}</h2>
          {loading && !business?.description ? (
            <EvidenceSkeleton rows={4} />
          ) : (
            <>
              <p className="asset-research__narrative">
                {business?.description ||
                  t('assetResearchView.classifiedAsDescription', {
                    name: asset.name || asset.symbol,
                    type: formatAssetType(asset.asset_type || asset.class),
                    sectorSuffix: asset.sector ? t('assetResearchView.inSector', { sector: asset.sector }) : '',
                  })}
              </p>
              <dl className="asset-research__asset-facts">
                {business?.founded && (
                  <div>
                    <dt>{t('assetResearchView.founded')}</dt>
                    <dd>{business.founded}</dd>
                  </div>
                )}
                {business?.employees && (
                  <div>
                    <dt>{t('assetResearchView.employees')}</dt>
                    <dd>{formatWithSeparators(business.employees)}</dd>
                  </div>
                )}
                {business?.headquarters && (
                  <div>
                    <dt>{t('assetResearchView.headquarters')}</dt>
                    <dd>{business.headquarters}</dd>
                  </div>
                )}
                {asset.isin && (
                  <div>
                    <dt>{t('assetResearchView.isin')}</dt>
                    <dd>{asset.isin}</dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </section>

        <div className="asset-research__evidence-grid">
          {fundamentals?.market_cap && (
            <EvidenceValue
              label={t('assetResearchView.marketCapitalisation')}
              value={`${formatLargeNumber(fundamentals.market_cap, 2)} ${currency}`}
            />
          )}
          {fundamentals?.revenue_growth !== null &&
            fundamentals?.revenue_growth !== undefined && (
              <EvidenceValue
                label={t('assetResearchView.revenueGrowth')}
                value={formatResearchPercent(fundamentals.revenue_growth * 100)}
                tone={valueTone(fundamentals?.revenue_growth)}
              />
            )}
          {fundamentals?.profit_margins !== null &&
            fundamentals?.profit_margins !== undefined && (
              <EvidenceValue
                label={t('assetResearchView.netMargin')}
                value={formatResearchPercent(fundamentals.profit_margins * 100)}
                tone={valueTone(fundamentals?.profit_margins)}
              />
            )}
          {fundamentals?.pe_ratio !== null && fundamentals?.pe_ratio !== undefined && (
            <EvidenceValue
              label={t('assetResearchView.peRatio')}
              value={`${formatNumber(fundamentals.pe_ratio, 1)}×`}
            />
          )}
          {fundamentals?.target_mean !== null && fundamentals?.target_mean !== undefined && (
            <EvidenceValue
              label={t('assetResearchView.analystTarget')}
              value={formatCurrency(fundamentals.target_mean, currency)}
            />
          )}
          {fundamentals?.implied_upside_pct !== null &&
            fundamentals?.implied_upside_pct !== undefined && (
              <EvidenceValue
                label={t('assetResearchView.impliedUpside')}
                value={formatResearchPercent(fundamentals.implied_upside_pct)}
                tone={valueTone(fundamentals?.implied_upside_pct)}
              />
            )}
        </div>

        {children}
      </div>

      {showAside && (
        <aside className="pf-aside-col asset-research__overview-context">
          <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.inferredClassification')}</p>
          <h2>{t('assetResearchView.howClassified')}</h2>
          {marketCapTier && (
            <ClassificationLine
              kind="marketCap"
              label={t(`assetResearchView.marketCapTiers.${marketCapTier}`)}
            />
          )}
          {asset.sector && (
            <ClassificationLine kind="sector" label={asset.sector} />
          )}
          {asset.industry && <ClassificationLine kind="industry" label={asset.industry} />}
          {themesLoading && themes.length === 0 && (
            <StateBlock
              tone="info"
              title={t('assetResearchView.classificationLoading')}
              description={t('assetResearchView.classificationLoadingDescription')}
              className="mt-3"
            />
          )}
          {themes.length > 0 && <ThemeClassificationTree themes={themes} />}
        </aside>
      )}
    </div>
  )
}
