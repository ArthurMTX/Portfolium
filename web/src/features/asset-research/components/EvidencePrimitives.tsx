import { useTranslation } from 'react-i18next'
import type { AssetResearchMetric } from '@/features/assets/lib/assetResearchMetricBuilders'
import { metricTone } from '@/features/asset-research/lib/assetResearchViewFormatting'

export function EvidenceQuestion({
  eyebrow,
  title,
  metrics,
  loading,
  confidence,
}: {
  eyebrow: string
  title: string
  metrics: AssetResearchMetric[]
  loading: boolean
  confidence?: string
}) {
  const { t } = useTranslation()
  return (
    <section className="asset-research__evidence-question">
      <div className="pf-section-header asset-research__section-heading">
        <div>
          <p className="pf-section-kicker asset-research__section-label">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {confidence && <span>{confidence}</span>}
      </div>
      {loading ? (
        <EvidenceSkeleton rows={4} />
      ) : metrics.length > 0 ? (
        <dl className="asset-research__metric-ledger">
          {metrics.map((metric) => (
            <div key={`${eyebrow}-${metric.label}`}>
              <dt>
                {metric.label}
                {metric.subtitle && <small>{metric.subtitle}</small>}
              </dt>
              <dd className={metricTone(metric)}>{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="asset-research__quiet-state">
          {t('assetResearchView.evidenceNotAvailable')}
        </div>
      )}
    </section>
  )
}

export function EvidenceValue({
  label,
  value,
  tone,
  confidence,
}: {
  label: string
  value: string
  tone?: string
  confidence?: string
}) {
  return (
    <div className="asset-research__evidence-value">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      {confidence && <small>{confidence}</small>}
    </div>
  )
}

export function EvidenceSkeleton({ rows }: { rows: number }) {
  const { t } = useTranslation()
  return (
    <div className="asset-research__skeleton-list" aria-label={t('assetResearchView.loadingEvidence')}>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  )
}
