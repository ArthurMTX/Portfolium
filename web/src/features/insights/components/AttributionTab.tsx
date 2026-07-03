import type { ReactNode } from 'react'
import { Activity, Award, Coins, Globe2, Layers, PieChart, Target, TrendingDown, TrendingUp } from 'lucide-react'
import type { ContributionItemDTO } from '@/api'
import {
  BarsSkeleton,
  ContributionBars,
  ContributionIdentity,
  InsightBlock,
  type ContributionVisualKind,
  type InsightsTabProps,
  MiniTableSkeleton,
  formatCurrencyValue,
  formatNumber,
  formatPercent,
  valueColor,
} from '@/features/insights/components/InsightsShared'
import { useAttributionInsights } from '@/features/insights/components/useInsightQueries'

type AttributionQuery = ReturnType<typeof useAttributionInsights>

export default function AttributionTab({ portfolioId, currency }: InsightsTabProps) {
  const query = useAttributionInsights(portfolioId)

  return (
    <div className="space-y-6">
      <PortfolioMoveBlock query={query} currency={currency} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AssetContributionBlock query={query} currency={currency} title="Top Contributors" ascending={false} />
        <AssetContributionBlock query={query} currency={currency} title="Top Detractors" ascending />
      </div>

      <GroupContributionBlock query={query} currency={currency} group="assets" title="Contribution by Asset" icon={<Activity className="h-5 w-5 text-pink-600" />} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <GroupContributionBlock query={query} currency={currency} group="themes" title="Contribution by Theme" icon={<Layers className="h-5 w-5 text-pink-600" />} />
        <GroupContributionBlock query={query} currency={currency} group="sectors" title="Contribution by Sector" icon={<PieChart className="h-5 w-5 text-pink-600" />} />
        <GroupContributionBlock query={query} currency={currency} group="countries" title="Contribution by Country" icon={<Globe2 className="h-5 w-5 text-pink-600" />} />
        <GroupContributionBlock query={query} currency={currency} group="currencies" title="Contribution by Currency" icon={<Coins className="h-5 w-5 text-pink-600" />} />
      </div>

      <ConcentrationBlock query={query} />
    </div>
  )
}

function PortfolioMoveBlock({ query, currency }: { query: AttributionQuery; currency: string }) {
  const data = query.data?.move

  return (
    <InsightBlock
      title="Why Does My Portfolio Move?"
      icon={<TrendingUp className="h-5 w-5 text-pink-600" />}
      scope="Latest daily move"
      description="Shows which current holdings explain today's portfolio move using the latest available daily change for each asset."
      formula="position market value x daily change %, then summed and divided by total portfolio value."
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data || ((data.best_movers?.length || 0) === 0 && (data.worst_movers?.length || 0) === 0 && data.movers.length === 0)}
      emptyMessage="Daily change data is not available for the current holdings."
      onRetry={() => void query.refetch()}
      skeleton={<MiniTableSkeleton rows={4} />}
    >
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryStat
          label="Daily Change"
          value={data?.daily_change_pct === null ? 'N/A' : formatPercent(data?.daily_change_pct, 2, true)}
          tone={valueColor(data?.daily_change_pct)}
        />
        <SummaryStat label="Estimated Move" value={data?.daily_change_value === null ? 'N/A' : formatCurrencyValue(data?.daily_change_value, currency)} />
        <SummaryStat label="Explained By Holdings" value={formatCurrencyValue(data?.explained_value, currency)} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DailyMoverList
          title="Best 5 assets"
          items={data?.best_movers || []}
          currency={currency}
          emptyMessage="No positive daily movers."
        />
        <DailyMoverList
          title="Worst 5 assets"
          items={data?.worst_movers || []}
          currency={currency}
          emptyMessage="No negative daily movers."
        />
      </div>
    </InsightBlock>
  )
}

function AssetContributionBlock({
  query,
  currency,
  title,
  ascending = false,
}: {
  query: AttributionQuery
  currency: string
  title: string
  ascending?: boolean
}) {
  const items = ascending ? query.data?.top_detractors : query.data?.top_contributors

  return (
    <InsightBlock
      title={title}
      icon={ascending ? <TrendingDown className="h-5 w-5 text-red-600" /> : <Award className="h-5 w-5 text-green-600" />}
      scope="Current holdings"
      description="Ranks open positions by total unrealized P&L, not by today's move or the selected period."
      formula="market value minus cost basis for each open position."
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!items || items.length === 0}
      onRetry={() => void query.refetch()}
      skeleton={<MiniTableSkeleton rows={5} />}
    >
      <ContributionRows items={items || []} currency={currency} />
    </InsightBlock>
  )
}

type ContributionGroup = 'assets' | 'themes' | 'sectors' | 'countries' | 'currencies'

function GroupContributionBlock({
  query,
  currency,
  group,
  title,
  icon,
}: {
  query: AttributionQuery
  currency: string
  group: ContributionGroup
  title: string
  icon: ReactNode
}) {
  const items =
    group === 'assets'
      ? query.data?.asset_contribution
      : group === 'themes'
        ? query.data?.theme_contribution
        : group === 'sectors'
          ? query.data?.sector_contribution
          : group === 'countries'
            ? query.data?.country_contribution
            : query.data?.currency_contribution
  const visualKind: Record<ContributionGroup, ContributionVisualKind> = {
    assets: 'asset',
    themes: 'theme',
    sectors: 'sector',
    countries: 'country',
    currencies: 'currency',
  }

  return (
    <InsightBlock
      title={title}
      icon={icon}
      scope="Current holdings"
      description="Groups current open positions and shows how much each group contributes to total unrealized return."
      formula="sum unrealized P&L for the group / total portfolio cost basis."
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!items || items.length === 0}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={6} />}
    >
      <ContributionBars
        items={items || []}
        valueLabel={(item) => `${formatPercent(item.contribution_to_return, 2, true)} / ${formatCurrencyValue(item.unrealized_pnl, currency)}`}
        maxRows={8}
        kind={visualKind[group]}
        barTone="value"
      />
    </InsightBlock>
  )
}

function ConcentrationBlock({ query }: { query: AttributionQuery }) {
  const data = query.data?.concentration

  return (
    <InsightBlock
      title="Concentration Metrics"
      icon={<Target className="h-5 w-5 text-pink-600" />}
      scope="Current holdings"
      description="Measures whether portfolio value is concentrated in a few positions."
      formula="effective positions = 1 / Herfindahl index; diversification combines holding count and concentration spread."
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={!data}
      onRetry={() => void query.refetch()}
      skeleton={<BarsSkeleton rows={5} />}
    >
      <div className="grid grid-cols-2 gap-5 md:grid-cols-5">
        <SummaryStat label="Largest Position" value={formatPercent(data?.largest_position_weight, 1)} />
        <SummaryStat label="Top 3 Weight" value={formatPercent(data?.top_3_weight, 1)} />
        <SummaryStat label="Top 5 Weight" value={formatPercent(data?.top_5_weight, 1)} />
        <SummaryStat label="Effective Positions" value={formatNumber(data?.effective_positions, 1)} />
        <SummaryStat label="Diversification" value={formatNumber(data?.diversification_score, 0)} />
      </div>
      {data?.largest_position && (
        <div className="mt-5 rounded-lg bg-neutral-50 p-4 text-sm dark:bg-neutral-800/70">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Largest holding</p>
          <ContributionIdentity item={data.largest_position} kind="asset" />
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">
            {formatPercent(data.largest_position.portfolio_weight, 1)} of portfolio value.
          </p>
        </div>
      )}
    </InsightBlock>
  )
}

function ContributionRows({ items, currency }: { items: ContributionItemDTO[]; currency: string }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={`${item.symbol || item.name}-${item.unrealized_pnl}`} className="flex items-center justify-between gap-4 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/70">
          <ContributionIdentity item={item} kind="asset" />
          <div className="flex-shrink-0 text-right">
            <p className={`font-semibold ${valueColor(item.unrealized_pnl)}`}>{formatCurrencyValue(item.unrealized_pnl, currency)}</p>
            <p className={`text-sm ${valueColor(item.contribution_to_return)}`}>{formatPercent(item.contribution_to_return, 2, true)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function DailyMoverList({
  title,
  items,
  currency,
  emptyMessage,
}: {
  title: string
  items: ContributionItemDTO[]
  currency: string
  emptyMessage: string
}) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <div className="border-b border-neutral-200 px-3 py-2 text-sm font-semibold dark:border-neutral-800">{title}</div>
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500 dark:text-neutral-400">{emptyMessage}</p>
        ) : (
          items.map((item) => (
            <div key={`${title}-${item.symbol || item.name}`} className="flex items-center justify-between gap-3 p-3">
              <ContributionIdentity item={item} kind="asset" />
              <div className="flex-shrink-0 text-right">
                <p className={`font-semibold ${valueColor(item.unrealized_pnl)}`}>{formatCurrencyValue(item.unrealized_pnl, currency)}</p>
                <p className={`text-sm ${valueColor(item.unrealized_pnl_pct)}`}>{formatPercent(item.unrealized_pnl_pct, 2, true)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone ?? ''}`}>{value}</p>
    </div>
  )
}
