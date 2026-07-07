import React from 'react'
import { AssetInvestmentNoteDTO, PositionDTO, api } from '@/api'
import { useTranslation } from 'react-i18next'
import AssetInvestmentNoteModal from '@/features/assets/components/AssetInvestmentNoteModal'
import AssetInvestmentNoteSummary from '@/features/assets/components/AssetInvestmentNoteSummary'
import {
  InfoGrid,
  MetricGrid,
  MetricSection,
  PositionDetailHeader,
  SectionHeader,
  ThemeExposureSection,
} from '@/features/portfolios/components/PositionDetailModalParts'
import {
  buildAnalystMetrics,
  buildBalanceSheetMetrics,
  buildBasicInfoRows,
  buildFundamentalMetrics,
  buildGrowthMetrics,
  buildPerformanceMetrics,
  buildRelativePerformanceMetrics,
  buildRiskMetrics,
  buildTradingZoneMetrics,
  DetailedMetrics,
  getVisibleThemes,
  hasAnalystMetrics,
  hasBalanceSheetMetrics,
  hasFundamentalMetrics,
  hasGrowthMetrics,
  hasRelativePerformanceMetrics,
  hasRiskMetrics,
} from '@/features/portfolios/lib/positionDetailMetricBuilders'

interface PositionDetailModalProps {
  position: PositionDTO | null
  portfolioId: number
  isOpen: boolean
  onClose: () => void
}

export default function PositionDetailModal({ position, portfolioId, isOpen, onClose }: PositionDetailModalProps) {
  const { t } = useTranslation()
  const [detailedMetrics, setDetailedMetrics] = React.useState<DetailedMetrics | null>(null)
  const [investmentNote, setInvestmentNote] = React.useState<AssetInvestmentNoteDTO | null>(null)
  const [investmentNoteLoading, setInvestmentNoteLoading] = React.useState(false)
  const [investmentNoteOpen, setInvestmentNoteOpen] = React.useState(false)
  const [loadingMetrics, setLoadingMetrics] = React.useState(false)

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Fetch detailed metrics when modal opens
  React.useEffect(() => {
    if (isOpen && position) {
      setLoadingMetrics(true)
      api.getPositionDetailedMetrics(portfolioId, position.asset_id)
        .then(data => {
          setDetailedMetrics(data as DetailedMetrics)
          setLoadingMetrics(false)
        })
        .catch(err => {
          console.error('Failed to load detailed metrics:', err)
          setLoadingMetrics(false)
        })
    } else {
      setDetailedMetrics(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, position?.asset_id, portfolioId])

  React.useEffect(() => {
    if (isOpen && position) {
      setInvestmentNoteLoading(true)
      api.getAssetInvestmentNote(position.asset_id)
        .then(setInvestmentNote)
        .catch(() => setInvestmentNote(null))
        .finally(() => setInvestmentNoteLoading(false))
    } else {
      setInvestmentNote(null)
      setInvestmentNoteOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, position?.asset_id])

  if (!isOpen || !position) return null

  const themes = getVisibleThemes(detailedMetrics, position.themes)
  const showFundamentals = loadingMetrics || (detailedMetrics && hasFundamentalMetrics(detailedMetrics))
  const showGrowth = loadingMetrics || (detailedMetrics && hasGrowthMetrics(detailedMetrics))
  const showBalanceSheet = loadingMetrics || (detailedMetrics && hasBalanceSheetMetrics(detailedMetrics))
  const showAnalyst = loadingMetrics || (detailedMetrics && hasAnalystMetrics(detailedMetrics))
  const showRelativePerformance = loadingMetrics || (detailedMetrics && hasRelativePerformanceMetrics(detailedMetrics, position))
  const showRisk = loadingMetrics || hasRiskMetrics(detailedMetrics, position)

  return (
    <>
      {/* Backdrop */}
      <div className="pf-modal-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pf-modal-panel max-w-5xl pointer-events-auto"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <PositionDetailHeader position={position} onClose={onClose} />

          {/* Content */}
          <div className="pf-modal-body space-y-8">
            <AssetInvestmentNoteSummary
              note={investmentNote}
              currency={position.currency}
              loading={investmentNoteLoading}
              onEdit={() => setInvestmentNoteOpen(true)}
            />

            <ThemeExposureSection themes={themes} />

            {/* Fundamentals & Liquidity */}
            {showFundamentals && (
              <MetricSection
                title={t('portfolios.positionDetail.fundamentalsLiquidity')}
                icon="dollarSign"
                loading={loadingMetrics}
                skeletonCount={5}
              >
                {detailedMetrics ? <MetricGrid items={buildFundamentalMetrics(detailedMetrics, t)} /> : null}
              </MetricSection>
            )}

            {/* Growth & Profitability */}
            {showGrowth && (
              <MetricSection
                title={t('portfolios.positionDetail.growthProfitability')}
                icon="lineChart"
                loading={loadingMetrics}
                skeletonCount={5}
              >
                {detailedMetrics ? <MetricGrid items={buildGrowthMetrics(detailedMetrics, t)} /> : null}
              </MetricSection>
            )}

            {/* Balance Sheet Health */}
            {showBalanceSheet && (
              <MetricSection
                title={t('portfolios.positionDetail.balanceSheetHealth')}
                icon="shield"
                loading={loadingMetrics}
                skeletonCount={4}
              >
                {detailedMetrics ? <MetricGrid items={buildBalanceSheetMetrics(detailedMetrics, t)} /> : null}
              </MetricSection>
            )}

            {/* Analyst View & Valuation */}
            {showAnalyst && (
              <MetricSection
                title={t('portfolios.positionDetail.analystViewValuation')}
                icon="users"
                loading={loadingMetrics}
                skeletonCount={4}
              >
                {detailedMetrics ? <MetricGrid items={buildAnalystMetrics(detailedMetrics, t)} /> : null}
              </MetricSection>
            )}

            {/* Performance Metrics */}
            <MetricSection
              title={t('portfolios.positionDetail.performance')}
              icon="activity"
              loading={loadingMetrics}
              skeletonCount={4}
              skeletonSubtitle
            >
              <MetricGrid items={buildPerformanceMetrics(position, detailedMetrics, t)} />
            </MetricSection>

            {/* Trading Zones */}
            <MetricSection
              title={t('portfolios.positionDetail.tradingZones')}
              icon="target"
              loading={loadingMetrics}
              skeletonCount={4}
              skeletonSubtitle
            >
              <MetricGrid items={buildTradingZoneMetrics(position, detailedMetrics, t)} />
            </MetricSection>

            {/* Relative Performance vs Sector */}
            {showRelativePerformance && (
              <MetricSection
                title={`Relative Performance vs ${detailedMetrics?.sector_etf || position.sector || 'Sector'}`}
                icon="barChart3"
                loading={loadingMetrics}
                skeletonCount={4}
                skeletonSubtitle
                skeletonSubtitleWidthClass="w-40"
              >
                {detailedMetrics ? <MetricGrid items={buildRelativePerformanceMetrics(position, detailedMetrics, t)} /> : null}
              </MetricSection>
            )}

            {/* Risk Metrics */}
            {showRisk ? (
              <MetricSection
                title={t('portfolios.positionDetail.riskMetrics')}
                icon="alertTriangle"
                loading={loadingMetrics}
                skeletonCount={4}
                skeletonSubtitle
                skeletonSubtitleWidthClass="w-36"
              >
                <MetricGrid items={buildRiskMetrics(position, detailedMetrics, t)} />
              </MetricSection>
            ) : null}

            {/* Position Details */}
            <section>
              <SectionHeader icon="info" title={t('portfolios.positionDetail.basicInfo')} />
              <InfoGrid rows={buildBasicInfoRows(position, t)} />
            </section>
          </div>
        </div>
      </div>

      <AssetInvestmentNoteModal
        assetId={position.asset_id}
        symbol={position.symbol}
        note={investmentNote}
        isOpen={investmentNoteOpen}
        onClose={() => setInvestmentNoteOpen(false)}
        onSaved={setInvestmentNote}
      />
    </>
  )
}
