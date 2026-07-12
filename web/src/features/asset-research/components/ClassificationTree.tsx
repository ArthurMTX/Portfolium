import { Landmark } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AssetThemeDTO } from '@/api'
import { getSectorIcon } from '@/shared/lib/sectorIndustryUtils'
import { getThemeHexColor, getThemeIcon } from '@/shared/lib/themeUtils'

export function ClassificationLine({
  kind,
  label,
}: {
  kind: 'sector' | 'industry' | 'theme' | 'marketCap'
  label: string
}) {
  const { t } = useTranslation()
  const Icon = kind === 'theme' ? getThemeIcon(label) : kind === 'marketCap' ? Landmark : getSectorIcon(label)
  return (
    <div className="asset-research__classification-line">
      <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
      <span>
        <small>{t(`assetResearchView.classificationKinds.${kind}`)}</small>
        <strong>{label}</strong>
      </span>
    </div>
  )
}

export function ThemeClassificationTree({ themes }: { themes: AssetThemeDTO[] }) {
  const { t } = useTranslation()
  return (
    <div className="asset-research__classification-themes">
      <p>{t('assetResearchView.themesAndSubthemes')}</p>
      <ol>
        {themes.map((theme) => {
          const ThemeIcon = getThemeIcon(theme.label)
          const themeColor = getThemeHexColor(theme.label)
          return (
            <li key={theme.label} className="asset-research__classification-theme">
              <div className="asset-research__classification-theme-main">
                <span
                  className="asset-research__classification-theme-icon"
                  style={{ color: themeColor, borderColor: themeColor }}
                >
                  <ThemeIcon size={16} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <span className="asset-research__classification-theme-copy">
                  <strong>{theme.label}</strong>
                  <small>
                    {theme.confidence
                      ? t('assetResearchView.confidencePercent', { percent: Math.round(theme.confidence * 100) })
                      : t('assetResearchView.confidenceUnavailable')}
                    {theme.weight !== null && theme.weight !== undefined
                      ? t('assetResearchView.classificationWeight', { percent: (theme.weight * 100).toFixed(1) })
                      : ''}
                  </small>
                </span>
              </div>

              {(theme.children ?? []).length > 0 && (
                <ol className="asset-research__classification-subthemes">
                  {(theme.children ?? []).map((subtheme) => {
                    const SubthemeIcon = getThemeIcon(subtheme.label)
                    const subthemeColor = getThemeHexColor(subtheme.label)
                    return (
                      <li key={`${theme.label}-${subtheme.label}`}>
                        <span
                          className="asset-research__classification-subtheme-icon"
                          style={{ color: subthemeColor }}
                        >
                          <SubthemeIcon size={14} strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <span>
                          <strong>{subtheme.label}</strong>
                          <small>
                            {subtheme.confidence
                              ? t('assetResearchView.confidencePercent', { percent: Math.round(subtheme.confidence * 100) })
                              : t('assetResearchView.confidenceUnavailable')}
                          </small>
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
