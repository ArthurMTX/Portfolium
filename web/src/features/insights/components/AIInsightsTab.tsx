import { StateBlock } from '@/shared/components/StatePrimitives'

export default function AIInsightsTab() {
  return (
    <section className="pf-section pf-section--spacious insights-block">
      <StateBlock
        tone="info"
        eyebrow="Future"
        title="AI Insights"
        description="Reserved for future AI-powered portfolio review, hidden risk detection, diversification gaps, opportunity analysis, and narrative explanations."
      />
    </section>
  )
}
