import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExposureDimension, ExposureResult } from '@/features/dashboard-overview/types'
import { formatCurrency } from '@/shared/lib/formatUtils'
import { getSectorIcon } from '@/shared/lib/sectorIndustryUtils'
import { getThemeIcon } from '@/shared/lib/themeUtils'
import { getFlagUrl } from '@/shared/lib/countryUtils'

interface ExposureFingerprintProps {
  exposure: ExposureResult
  dimension: ExposureDimension
  currency: string
  locale: string
}

const SEGMENT_COLORS = [
  '#414a58',
  '#8b5f74',
  '#526b86',
  '#8a704c',
  '#64765f',
  '#6d5f7d',
  '#8b6257',
  '#4f7777',
  '#7b6c50',
  '#59647c',
  '#786172',
  '#68705a',
]

interface ExposureIdentityIconProps {
  dimension: ExposureDimension
  label: string
  className?: string
}

function ExposureIdentityIcon({
  dimension,
  label,
  className = 'dashboard-overview__exposure-icon',
}: ExposureIdentityIconProps) {
  if (dimension === 'sector') {
    const Icon = getSectorIcon(label)
    return <Icon className={className} size={16} strokeWidth={1.8} aria-hidden="true" />
  }

  if (dimension === 'theme') {
    const Icon = getThemeIcon(label)
    return <Icon className={className} size={16} strokeWidth={1.8} aria-hidden="true" />
  }

  if (dimension === 'country') {
    const flagUrl = getFlagUrl(label, 'w40')
    return flagUrl ? (
      <img
        src={flagUrl}
        className="dashboard-overview__exposure-flag"
        alt=""
        aria-hidden="true"
      />
    ) : null
  }

  return null
}

export default function ExposureFingerprint({
  exposure,
  dimension,
  currency,
  locale,
}: ExposureFingerprintProps) {
  const { t } = useTranslation()
  const [activeSegmentKey, setActiveSegmentKey] = useState<string | null>(null)

  if (exposure.items.length === 0) {
    return (
      <div className="dashboard-overview__quiet-state">
        {t('dashboardOverview.exposure.notAvailable')}
      </div>
    )
  }

  const activeIndex = exposure.items.findIndex((item) => item.key === activeSegmentKey)
  const activeItem = activeIndex >= 0 ? exposure.items[activeIndex] : null
  const activeCenter = activeItem
    ? exposure.items
        .slice(0, activeIndex)
        .reduce((sum, item) => sum + item.percentage, 0) +
      activeItem.percentage / 2
    : 50
  const tooltipLeft = Math.min(94, Math.max(6, activeCenter))

  return (
    <>
      {exposure.isCompleteWhole ? (
        <div className="dashboard-overview__fingerprint-shell">
          {activeItem && (
            <div
              id="dashboard-overview-exposure-tooltip"
              className="dashboard-overview__fingerprint-tooltip"
              style={{ left: `${tooltipLeft}%` }}
              role="tooltip"
            >
              <span
                className="dashboard-overview__fingerprint-tooltip-swatch"
                style={{
                  backgroundColor: SEGMENT_COLORS[activeIndex % SEGMENT_COLORS.length],
                }}
                aria-hidden="true"
              />
              <span className="dashboard-overview__fingerprint-tooltip-copy">
                <strong>
                  <ExposureIdentityIcon dimension={dimension} label={activeItem.label} />
                  {activeItem.label}
                </strong>
                <span>
                  {formatCurrency(activeItem.value, currency, locale)} ·{' '}
                  {activeItem.percentage.toFixed(1)}%
                </span>
              </span>
            </div>
          )}
          <div
            className="dashboard-overview__fingerprint"
            aria-label={t('dashboardOverview.exposure.completeExposureLabel')}
          >
            {exposure.items.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className="dashboard-overview__fingerprint-segment"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
                }}
                aria-label={t('dashboardOverview.exposure.segmentAriaLabel', {
                  label: item.label,
                  value: formatCurrency(item.value, currency, locale),
                  percent: item.percentage.toFixed(1),
                })}
                aria-describedby={
                  activeSegmentKey === item.key ? 'dashboard-overview-exposure-tooltip' : undefined
                }
                onMouseEnter={() => setActiveSegmentKey(item.key)}
                onMouseLeave={() => setActiveSegmentKey(null)}
                onFocus={() => setActiveSegmentKey(item.key)}
                onBlur={() => setActiveSegmentKey(null)}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="dashboard-overview__confidence-note">
          {t('dashboardOverview.exposure.rankedOnlyNote')}
        </p>
      )}

      <ol className="dashboard-overview__exposure-list">
        {exposure.items.map((item, index) => {
          return (
            <li key={item.key}>
              <span
                className="dashboard-overview__exposure-swatch"
                style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                aria-hidden="true"
              />
              <span className="dashboard-overview__exposure-identity">
                <ExposureIdentityIcon dimension={dimension} label={item.label} />
                <span className="dashboard-overview__exposure-name">{item.label}</span>
              </span>
              <span className="dashboard-overview__exposure-value">
                {formatCurrency(item.value, currency, locale)}
              </span>
              <strong>{item.percentage.toFixed(1)}%</strong>
            </li>
          )
        })}
      </ol>
    </>
  )
}
