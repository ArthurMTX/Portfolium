import type { ReactNode } from 'react'
import { Activity, AlertTriangle, BarChart3, Gauge, Link2, ShieldAlert } from 'lucide-react'
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
  const data = query.data?.risk

  return (
    <InsightBlock
      title="Volatility"
      icon={<Activity className="h-5 w-5 text-pink-600" />}
      scope={`Selected period: ${periodLabel(period)}`}
      description="Measures how much portfolio returns fluctuate over the selected period."
      formula="annualized volatility is the standard deviation of daily returns scaled to a year; downside deviation uses only negative returns."
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={3} />}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <RiskStat label="Annualized Volatility" value={formatPercent(data?.volatility)} tone={valueColor(data?.volatility)} />
        <RiskStat label="Downside Deviation" value={formatPercent(data?.downside_deviation)} tone={valueColor(data?.downside_deviation)} />
        <RiskStat label="Sharpe Ratio" value={data?.sharpe_ratio === null ? 'N/A' : toNumber(data?.sharpe_ratio).toFixed(2)} />
      </div>
    </InsightBlock>
  )
}

function CorrelationBlock({ query, benchmark, period }: { query: RiskQuery; benchmark: string; period: string }) {
  const data = query.data?.risk
  const benchmarkData = query.data?.benchmark_comparison

  return (
    <InsightBlock
      title="Beta & Correlation"
      icon={<Link2 className="h-5 w-5 text-pink-600" />}
      scope={`Selected period: ${periodLabel(period)}`}
      description="Compares portfolio behavior with the selected benchmark."
      formula="beta estimates sensitivity to benchmark moves; correlation ranges from -1 to +1 based on aligned return series."
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data && !benchmarkData}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={3} />}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <RiskStat label="Beta" value={data?.beta === null ? 'N/A' : toNumber(data?.beta).toFixed(2)} />
        <RiskStat label={`Correlation vs ${benchmarkData?.benchmark_name || benchmark}`} value={benchmarkData?.correlation === null ? 'N/A' : toNumber(benchmarkData?.correlation).toFixed(2)} />
        <RiskStat label="Alpha" value={formatPercent(benchmarkData?.alpha, 2, true)} tone={valueColor(benchmarkData?.alpha)} />
      </div>
    </InsightBlock>
  )
}

function VarBlock({ query, period }: { query: RiskQuery; period: string }) {
  const data = query.data?.risk

  return (
    <InsightBlock
      title="Value at Risk"
      icon={<Gauge className="h-5 w-5 text-pink-600" />}
      scope={`Selected period: ${periodLabel(period)}`}
      description="Estimates downside loss thresholds from the selected-period return distribution."
      formula="VaR is the loss threshold at a confidence level; CVaR is the average loss beyond that threshold."
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={4} />}
    >
      <div className="grid grid-cols-2 gap-5">
        <RiskStat label="VaR 95% 1D" value={data?.var_95 === null ? 'N/A' : formatPercent(data?.var_95)} tone={valueColor(data?.var_95)} />
        <RiskStat label="VaR 99% 1D" value={data?.var_99 === null ? 'N/A' : formatPercent(data?.var_99)} tone={valueColor(data?.var_99)} />
        <RiskStat label="CVaR 95%" value={data?.cvar_95 === null ? 'N/A' : formatPercent(data?.cvar_95)} tone={valueColor(data?.cvar_95)} />
        <RiskStat label="VaR 95% 1M" value={data?.var_95_1m === null ? 'N/A' : formatPercent(data?.var_95_1m)} tone={valueColor(data?.var_95_1m)} />
      </div>
    </InsightBlock>
  )
}

function DrawdownBlock({ query, period }: { query: RiskQuery; period: string }) {
  const data = query.data?.risk

  return (
    <InsightBlock
      title="Drawdown"
      icon={<ShieldAlert className="h-5 w-5 text-pink-600" />}
      scope={`Selected period: ${periodLabel(period)}`}
      description="Shows peak-to-trough losses and tail-event frequency for the selected period."
      formula="maximum drawdown is the largest percentage decline from a prior high to a later low."
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={3} />}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <RiskStat label="Maximum Drawdown" value={`-${formatPercent(data?.max_drawdown).replace('-', '')}`} tone={valueColor(-Math.abs(toNumber(data?.max_drawdown)))} />
        <RiskStat label="Drawdown Date" value={data?.max_drawdown_date ? new Date(data.max_drawdown_date).toLocaleDateString() : 'N/A'} />
        <RiskStat label="Tail Exposure" value={data?.tail_exposure === null ? 'N/A' : formatPercent(data?.tail_exposure)} tone={valueColor(data?.tail_exposure)} />
      </div>
    </InsightBlock>
  )
}

function ScenarioBlock({ query, currency, period }: { query: RiskQuery; currency: string; period: string }) {
  return (
    <ScenarioResultBlock
      title="Scenario Analysis"
      icon={<BarChart3 className="h-5 w-5 text-pink-600" />}
      data={query.data?.scenarios}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      currency={currency}
      emptyMessage="No scenario results are available."
      period={period}
      description="Applies predefined market scenarios to current exposure weights."
      formula="estimated impact = exposure weight x scenario shock, summed across matched groups."
    />
  )
}

function StressBlock({ query, currency, period }: { query: RiskQuery; currency: string; period: string }) {
  return (
    <ScenarioResultBlock
      title="Stress Testing"
      icon={<AlertTriangle className="h-5 w-5 text-pink-600" />}
      data={query.data?.stress_tests}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      currency={currency}
      emptyMessage="No stress test results are available."
      period={period}
      description="Highlights severe current-exposure shocks that would have a large portfolio impact."
      formula="impact value = current exposed market value x stress shock percentage."
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
  return (
    <InsightBlock
      title={title}
      icon={icon}
      scope={`Current holdings / selected period: ${periodLabel(period)}`}
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
