import type { ReactNode } from 'react'
import { Activity, AlertTriangle, BarChart3, Gauge, Link2, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ScenarioResultDTO } from '@/api'
import {
  BarsSkeleton,
  InsightBlock,
  type InsightsTabProps,
  MiniTableSkeleton,
  formatCurrencyValue,
  formatPercent,
  periodLabel,
  toNumber,
  valueColor,
} from '@/features/insights/components/InsightsShared'
import { useRiskInsights } from '@/features/insights/components/useInsightQueries'

type RiskQuery = ReturnType<typeof useRiskInsights>

export default function RiskTab({ portfolioId, period, benchmark, currency }: InsightsTabProps) {
  const query = useRiskInsights(portfolioId, benchmark, period)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VolatilityBlock query={query} period={period} />
        <CorrelationBlock query={query} benchmark={benchmark} period={period} />
        <VarBlock query={query} period={period} />
        <DrawdownBlock query={query} period={period} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScenarioBlock query={query} currency={currency} period={period} />
        <StressBlock query={query} currency={currency} period={period} />
      </div>
    </div>
  )
}

function VolatilityBlock({ query, period }: { query: RiskQuery; period: string }) {
  const { t } = useTranslation()
  const data = query.data?.risk

  return (
    <InsightBlock
      title={t('insights.risk.volatility.title')}
      icon={<Activity className="h-5 w-5 text-pink-600" />}
      scope={t('insights.risk.scope', { period: periodLabel(period) })}
      description={t('insights.risk.volatility.description')}
      formula={t('insights.risk.volatility.formula')}
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={3} />}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <RiskStat label={t('insights.risk.volatility.annualizedVolatility')} value={formatPercent(data?.volatility)} tone={valueColor(data?.volatility)} />
        <RiskStat label={t('insights.risk.volatility.downsideDeviation')} value={formatPercent(data?.downside_deviation)} tone={valueColor(data?.downside_deviation)} />
        <RiskStat label={t('insights.risk.volatility.sharpeRatio')} value={data?.sharpe_ratio === null ? t('insights.risk.notAvailable') : toNumber(data?.sharpe_ratio).toFixed(2)} />
      </div>
    </InsightBlock>
  )
}

function CorrelationBlock({ query, benchmark, period }: { query: RiskQuery; benchmark: string; period: string }) {
  const { t } = useTranslation()
  const data = query.data?.risk
  const benchmarkData = query.data?.benchmark_comparison

  return (
    <InsightBlock
      title={t('insights.risk.correlation.title')}
      icon={<Link2 className="h-5 w-5 text-pink-600" />}
      scope={t('insights.risk.scope', { period: periodLabel(period) })}
      description={t('insights.risk.correlation.description')}
      formula={t('insights.risk.correlation.formula')}
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data && !benchmarkData}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={3} />}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <RiskStat label={t('insights.risk.correlation.beta')} value={data?.beta === null ? t('insights.risk.notAvailable') : toNumber(data?.beta).toFixed(2)} />
        <RiskStat label={t('insights.risk.correlation.correlationVs', { benchmark: benchmarkData?.benchmark_name || benchmark })} value={benchmarkData?.correlation === null ? t('insights.risk.notAvailable') : toNumber(benchmarkData?.correlation).toFixed(2)} />
        <RiskStat label={t('insights.risk.correlation.alpha')} value={formatPercent(benchmarkData?.alpha, 2, true)} tone={valueColor(benchmarkData?.alpha)} />
      </div>
    </InsightBlock>
  )
}

function VarBlock({ query, period }: { query: RiskQuery; period: string }) {
  const { t } = useTranslation()
  const data = query.data?.risk

  return (
    <InsightBlock
      title={t('insights.risk.var.title')}
      icon={<Gauge className="h-5 w-5 text-pink-600" />}
      scope={t('insights.risk.scope', { period: periodLabel(period) })}
      description={t('insights.risk.var.description')}
      formula={t('insights.risk.var.formula')}
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={4} />}
    >
      <div className="grid grid-cols-2 gap-5">
        <RiskStat label={t('insights.risk.var.var95_1d')} value={data?.var_95 === null ? t('insights.risk.notAvailable') : formatPercent(data?.var_95)} tone={valueColor(data?.var_95)} />
        <RiskStat label={t('insights.risk.var.var99_1d')} value={data?.var_99 === null ? t('insights.risk.notAvailable') : formatPercent(data?.var_99)} tone={valueColor(data?.var_99)} />
        <RiskStat label={t('insights.risk.var.cvar95')} value={data?.cvar_95 === null ? t('insights.risk.notAvailable') : formatPercent(data?.cvar_95)} tone={valueColor(data?.cvar_95)} />
        <RiskStat label={t('insights.risk.var.var95_1m')} value={data?.var_95_1m === null ? t('insights.risk.notAvailable') : formatPercent(data?.var_95_1m)} tone={valueColor(data?.var_95_1m)} />
      </div>
    </InsightBlock>
  )
}

function DrawdownBlock({ query, period }: { query: RiskQuery; period: string }) {
  const { t } = useTranslation()
  const data = query.data?.risk

  return (
    <InsightBlock
      title={t('insights.risk.drawdown.title')}
      icon={<ShieldAlert className="h-5 w-5 text-pink-600" />}
      scope={t('insights.risk.scope', { period: periodLabel(period) })}
      description={t('insights.risk.drawdown.description')}
      formula={t('insights.risk.drawdown.formula')}
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={3} />}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <RiskStat label={t('insights.risk.drawdown.maxDrawdown')} value={`-${formatPercent(data?.max_drawdown).replace('-', '')}`} tone={valueColor(-Math.abs(toNumber(data?.max_drawdown)))} />
        <RiskStat label={t('insights.risk.drawdown.drawdownDate')} value={data?.max_drawdown_date ? new Date(data.max_drawdown_date).toLocaleDateString() : t('insights.risk.notAvailable')} />
        <RiskStat label={t('insights.risk.drawdown.tailExposure')} value={data?.tail_exposure === null ? t('insights.risk.notAvailable') : formatPercent(data?.tail_exposure)} tone={valueColor(data?.tail_exposure)} />
      </div>
    </InsightBlock>
  )
}

function ScenarioBlock({ query, currency, period }: { query: RiskQuery; currency: string; period: string }) {
  const { t } = useTranslation()
  return (
    <ScenarioResultBlock
      title={t('insights.risk.scenario.title')}
      icon={<BarChart3 className="h-5 w-5 text-pink-600" />}
      data={query.data?.scenarios}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      currency={currency}
      emptyMessage={t('insights.risk.scenario.empty')}
      period={period}
      description={t('insights.risk.scenario.description')}
      formula={t('insights.risk.scenario.formula')}
    />
  )
}

function StressBlock({ query, currency, period }: { query: RiskQuery; currency: string; period: string }) {
  const { t } = useTranslation()
  return (
    <ScenarioResultBlock
      title={t('insights.risk.stress.title')}
      icon={<AlertTriangle className="h-5 w-5 text-pink-600" />}
      data={query.data?.stress_tests}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      currency={currency}
      emptyMessage={t('insights.risk.stress.empty')}
      period={period}
      description={t('insights.risk.stress.description')}
      formula={t('insights.risk.stress.formula')}
    />
  )
}

function ScenarioResultBlock({
  title,
  icon,
  data,
  isLoading,
  error,
  onRetry,
  currency,
  emptyMessage,
  period,
  description,
  formula,
}: {
  title: string
  icon: ReactNode
  data: ScenarioResultDTO[] | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
  currency: string
  emptyMessage: string
  period: string
  description: string
  formula: string
}) {
  const { t } = useTranslation()
  return (
    <InsightBlock
      title={title}
      icon={icon}
      scope={`${t('insights.shared.currentHoldings')} / ${t('insights.shared.selectedPeriod', { period: periodLabel(period) })}`}
      description={description}
      formula={formula}
      isLoading={isLoading}
      error={error}
      isEmpty={!data || data.length === 0}
      emptyMessage={emptyMessage}
      onRetry={onRetry}
      skeleton={<MiniTableSkeleton rows={4} />}
    >
      <div className="space-y-3">
        {(data || []).map((scenario) => (
          <div key={scenario.name} className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800/70">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium">{scenario.name}</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{scenario.description}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className={`font-semibold ${valueColor(scenario.estimated_impact_pct)}`}>{formatPercent(scenario.estimated_impact_pct, 2, true)}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{formatCurrencyValue(scenario.estimated_impact_value, currency)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </InsightBlock>
  )
}

function RiskStat({ label, value, tone = 'text-neutral-900 dark:text-neutral-100' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  )
}
