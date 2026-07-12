import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/shared/components/StatePrimitives'

export default function AIInsightsTab() {
  const { t } = useTranslation()
  return (
    <section className="pf-section pf-section--spacious insights-block">
      <StateBlock
        tone="info"
        eyebrow={t('insights.future')}
        title={t('insights.aiInsights')}
        description={t('insights.aiInsightsDescription')}
      />
    </section>
  )
}
