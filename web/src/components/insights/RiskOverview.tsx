import { Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface RiskMetrics {
  period?: string
  volatility?: number
  sharpe_ratio?: number | null
  max_drawdown?: number
  max_drawdown_date?: string | null
  beta?: number | null
  var_95?: number | null
  downside_deviation?: number
  // other risk fields may exist but are optional
  [key: string]: any
}

interface PortfolioInsights {
  portfolio_id?: number
  portfolio_name?: string
  as_of_date?: string
  period?: string
  risk: RiskMetrics
}

export default function RiskOverview({ insights }: { insights: PortfolioInsights }) {
  const { t } = useTranslation()
  const risk = insights?.risk || {}

  // Helper to format percentage values
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? 'N/A' : `${Number(v).toFixed(2)}%`)

  return (
    <div>
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-pink-600" />
          {t('insights.riskOverviewTitle') || 'Risk Overview'}
        </h2>

        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          {t('insights.riskOverviewDescription') || 'Basic portfolio-level risk metrics and tail risk indicators.'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">VaR (95%) - 1D</p>
            <p className="text-xl font-bold text-red-600">{fmt(risk.var_95)}</p>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">VaR (99%) - 1D</p>
            <p className="text-xl font-bold">{fmt(risk.var_99 ?? null)}</p>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">CVaR / ES (95%)</p>
            <p className="text-xl font-bold">{fmt(risk.cvar_95 ?? risk.es_95 ?? null)}</p>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">CVaR / ES (99%)</p>
            <p className="text-xl font-bold">{fmt(risk.cvar_99 ?? risk.es_99 ?? null)}</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">VaR (95%) - 1W</p>
            <p className="text-xl font-bold">{fmt(risk.var_95_1w ?? null)}</p>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">VaR (95%) - 1M</p>
            <p className="text-xl font-bold">{fmt(risk.var_95_1m ?? null)}</p>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">Annualized Volatility</p>
            <p className="text-xl font-bold text-orange-600">{fmt(risk.volatility)}</p>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">Max Drawdown</p>
            <p className="text-xl font-bold text-red-600">{risk.max_drawdown !== undefined && risk.max_drawdown !== null ? `-${risk.max_drawdown.toFixed(2)}%` : 'N/A'}</p>
            {risk.max_drawdown_date && (
              <p className="text-xs text-neutral-500">{new Date(risk.max_drawdown_date).toLocaleDateString()}</p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Tail Exposure</p>
            <p className="text-xl font-bold">{fmt(risk.tail_exposure ?? risk.tail_exposure_pct ?? null)}</p>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">Downside Deviation</p>
            <p className="text-xl font-bold text-amber-600">{fmt(risk.downside_deviation)}</p>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">Notes</p>
            <p className="text-sm text-neutral-500">Some VaR/CVaR fields may be computed server-side. Missing values are shown as N/A.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
