import { useMemo } from 'react'
import { Activity, BarChart3, Shield, Target, TrendingUp } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import {
  BarsSkeleton,
  InsightBlock,
  type InsightsTabProps,
  MetricCard,
  MetricCardSkeleton,
  formatCurrencyValue,
  formatPercent,
  periodLabel,
  toNumber,
} from '@/features/insights/components/InsightsShared'
import { useBenchmarkInsights, usePerformanceInsights } from '@/features/insights/components/useInsightQueries'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

export default function PerformanceTab({ portfolioId, period, benchmark, currency, locale }: InsightsTabProps) {
  const performanceDomainQuery = usePerformanceInsights(portfolioId, period)
  const benchmarkQuery = useBenchmarkInsights(portfolioId, benchmark, period)

  const summaryData = performanceDomainQuery.data?.summary
  const performanceData = performanceDomainQuery.data?.performance
  const riskData = performanceDomainQuery.data?.risk
  const benchmarkData = benchmarkQuery.data
  const chartData = useMemo(() => {
    const portfolioSeries = benchmarkData?.portfolio_series || []
    const benchmarkSeries = benchmarkData?.benchmark_series || []

    return {
      labels: portfolioSeries.map((point) =>
        new Date(point.date).toLocaleDateString(locale, { month: 'short', year: 'numeric' }),
      ),
      datasets: [
        {
          label: 'Portfolio',
          data: portfolioSeries.map((point) => toNumber(point.value)),
          borderColor: 'rgb(236, 72, 153)',
          backgroundColor: 'rgba(236, 72, 153, 0.1)',
          fill: true,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
        {
          label: benchmarkData?.benchmark_name || benchmark,
          data: benchmarkSeries.map((point) => toNumber(point.value)),
          borderColor: 'rgb(37, 99, 235)',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
      ],
    }
  }, [benchmark, benchmarkData, locale])

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          callbacks: {
            label: (context: { dataset: { label?: string }; parsed: { y: number | null } }) => {
              const label = context.dataset.label ? `${context.dataset.label}: ` : ''
              return context.parsed.y === null ? label : `${label}${formatPercent(context.parsed.y, 2, true)}`
            },
          },
        },
      },
      scales: {
        y: {
          title: {
            display: true,
            text: 'Performance (%)',
          },
          ticks: {
            callback: (value: string | number) => formatPercent(value, 0, true),
          },
        },
      },
    }),
    [],
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {performanceDomainQuery.isLoading && <MetricCardSkeleton />}
        {!performanceDomainQuery.isLoading && summaryData && (
          <MetricCard
            label="Total Return"
            value={formatPercent(summaryData.total_return_pct, 2, true)}
            subtitle={formatCurrencyValue(summaryData.total_return, currency)}
            icon={<Activity size={22} />}
            tone={toNumber(summaryData.total_return) >= 0 ? 'positive' : 'negative'}
            tooltip="Total return is current portfolio value minus cost basis over the selected period."
          />
        )}
        {!performanceDomainQuery.isLoading && performanceDomainQuery.error && (
          <MetricCard label="Total Return" value="Error" subtitle="Failed to load" icon={<Activity size={22} />} tone="negative" />
        )}

        {performanceDomainQuery.isLoading && <MetricCardSkeleton />}
        {!performanceDomainQuery.isLoading && performanceData && (
          <MetricCard
            label="Annualized Return"
            value={formatPercent(performanceData.annualized_return, 2, true)}
            subtitle={`Period: ${period.toUpperCase()}`}
            icon={<TrendingUp size={22} />}
            tone={toNumber(performanceData.annualized_return) >= 0 ? 'positive' : 'negative'}
            tooltip="Annualized return converts the selected-period return into a yearly rate."
          />
        )}
        {!performanceDomainQuery.isLoading && performanceDomainQuery.error && (
          <MetricCard label="Annualized Return" value="Error" subtitle="Failed to load" icon={<TrendingUp size={22} />} tone="negative" />
        )}

        {performanceDomainQuery.isLoading && <MetricCardSkeleton />}
        {!performanceDomainQuery.isLoading && riskData && (
          <MetricCard
            label="Sharpe Ratio"
            value={riskData.sharpe_ratio === null ? 'N/A' : toNumber(riskData.sharpe_ratio).toFixed(2)}
            subtitle="Risk-adjusted return"
            icon={<Shield size={22} />}
            tone="accent"
            tooltip="Sharpe ratio compares excess return with volatility. Higher usually means better risk-adjusted performance."
          />
        )}
        {!performanceDomainQuery.isLoading && performanceDomainQuery.error && (
          <MetricCard label="Sharpe Ratio" value="Error" subtitle="Failed to load" icon={<Shield size={22} />} tone="negative" />
        )}

        {benchmarkQuery.isLoading && <MetricCardSkeleton />}
        {!benchmarkQuery.isLoading && benchmarkQuery.data && (
          <MetricCard
            label={`vs ${benchmarkQuery.data.benchmark_name}`}
            value={formatPercent(benchmarkQuery.data.alpha, 2, true)}
            subtitle="Alpha"
            icon={<Target size={22} />}
            tone={toNumber(benchmarkQuery.data.alpha) >= 0 ? 'positive' : 'negative'}
            tooltip="Alpha is portfolio return minus benchmark return for the selected period."
          />
        )}
        {!benchmarkQuery.isLoading && benchmarkQuery.error && (
          <MetricCard label="Alpha" value="Error" subtitle="Failed to load" icon={<Target size={22} />} tone="negative" />
        )}
      </div>

      <InsightBlock
        title="Performance vs Benchmark"
        icon={<BarChart3 className="h-5 w-5 text-pink-600" />}
        scope={`Selected period: ${periodLabel(period)}`}
        description="Compares cumulative portfolio performance against the selected benchmark."
        formula="alpha = portfolio return - benchmark return; correlation compares the shape of both return series."
        isLoading={benchmarkQuery.isLoading}
        error={benchmarkQuery.error}
        isEmpty={!benchmarkData || benchmarkData.portfolio_series.length === 0}
        emptyMessage="Benchmark history is not available for this period."
        onRetry={() => void benchmarkQuery.refetch()}
        skeleton={<div className="h-80 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />}
      >
        <div className="h-80">
          <Line key={`${period}-${benchmark}`} data={chartData} options={chartOptions} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Stat label="Portfolio Return" value={formatPercent(benchmarkData?.portfolio_return, 2, true)} />
          <Stat label="Benchmark Return" value={formatPercent(benchmarkData?.benchmark_return, 2, true)} />
          <Stat label="Alpha" value={formatPercent(benchmarkData?.alpha, 2, true)} />
          <Stat label="Correlation" value={benchmarkData?.correlation === null ? 'N/A' : toNumber(benchmarkData?.correlation).toFixed(2)} />
        </div>
      </InsightBlock>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InsightBlock
          title="Performance Statistics"
          icon={<Activity className="h-5 w-5 text-pink-600" />}
          scope={`Selected period: ${periodLabel(period)}`}
          description="Summarizes daily performance changes within the selected period."
          formula="best/worst day use day-to-day changes in portfolio performance percentage."
          isLoading={performanceDomainQuery.isLoading}
          error={performanceDomainQuery.error}
          isEmpty={!performanceData}
          onRetry={() => void performanceDomainQuery.refetch()}
          skeleton={<BarsSkeleton rows={4} />}
        >
          <div className="grid grid-cols-2 gap-5">
            <Stat
              label="Best Day"
              value={performanceData?.best_day === null ? 'N/A' : formatPercent(performanceData?.best_day, 2, true)}
              subtitle={formatDate(performanceData?.best_day_date, locale)}
            />
            <Stat
              label="Worst Day"
              value={performanceData?.worst_day === null ? 'N/A' : formatPercent(performanceData?.worst_day, 2, true)}
              subtitle={formatDate(performanceData?.worst_day_date, locale)}
            />
            <Stat label="Positive Days" value={String(performanceData?.positive_days ?? 0)} subtitle={`${performanceData?.negative_days ?? 0} negative days`} />
            <Stat label="Win Rate" value={formatPercent(performanceData?.win_rate, 1)} subtitle="Positive days / observed days" />
          </div>
        </InsightBlock>

        <InsightBlock
          title="Risk Summary"
          icon={<Shield className="h-5 w-5 text-pink-600" />}
          scope={`Selected period: ${periodLabel(period)}`}
          description="Shows volatility and downside metrics calculated from the selected-period return series."
          formula="volatility is annualized standard deviation; max drawdown is the largest peak-to-trough decline."
          isLoading={performanceDomainQuery.isLoading}
          error={performanceDomainQuery.error}
          isEmpty={!riskData}
          onRetry={() => void performanceDomainQuery.refetch()}
          skeleton={<BarsSkeleton rows={4} />}
        >
          <div className="grid grid-cols-2 gap-5">
            <Stat label="Volatility" value={formatPercent(riskData?.volatility)} />
            <Stat label="Beta" value={riskData?.beta === null ? 'N/A' : toNumber(riskData?.beta).toFixed(2)} />
            <Stat label="Max Drawdown" value={`-${formatPercent(riskData?.max_drawdown).replace('-', '')}`} />
            <Stat label="Value at Risk 95%" value={riskData?.var_95 === null ? 'N/A' : formatPercent(riskData?.var_95)} />
          </div>
        </InsightBlock>
      </div>
    </div>
  )
}

function Stat({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
    </div>
  )
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return 'No date available'
  return new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' })
}
