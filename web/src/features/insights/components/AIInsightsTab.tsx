import { Sparkles } from 'lucide-react'

export default function AIInsightsTab() {
  return (
    <div className="card p-8">
      <div className="flex min-h-64 flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          <Sparkles size={24} />
        </div>
        <h2 className="text-lg font-semibold">AI Insights</h2>
        <p className="mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
          Reserved for future AI-powered portfolio review, hidden risk detection, diversification gaps, opportunity analysis, and narrative explanations.
        </p>
      </div>
    </div>
  )
}
