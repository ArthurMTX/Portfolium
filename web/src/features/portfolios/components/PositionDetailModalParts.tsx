import React from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpCircle,
  BarChart3,
  Clock,
  DollarSign,
  Info,
  LineChart,
  Mountain,
  Shield,
  Tags,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { AssetThemeDTO, PositionDTO } from '@/api'
import AssetLogo from '@/shared/components/AssetLogo'
import ThemeSubthemeBadges from '@/shared/components/ThemeSubthemeBadges'
import {
  InfoRowModel,
  MetricCardModel,
  MetricGridItem,
  MetricIcon,
} from '@/features/portfolios/lib/positionDetailMetricBuilders'
import { getThemeEvidenceTitle } from '@/shared/lib/themeUtils'

export type SectionIcon =
  | 'activity'
  | 'alertTriangle'
  | 'barChart3'
  | 'dollarSign'
  | 'info'
  | 'lineChart'
  | 'shield'
  | 'tags'
  | 'target'
  | 'users'

const metricIcons: Record<MetricIcon, React.ReactNode> = {
  activity: <Activity size={16} />,
  alertTriangle: <AlertTriangle size={16} />,
  arrowUpCircle: <ArrowUpCircle size={16} />,
  barChart3: <BarChart3 size={16} />,
  clock: <Clock size={16} />,
  dollarSign: <DollarSign size={16} />,
  mountain: <Mountain size={16} />,
  target: <Target size={16} />,
  trendingDown: <TrendingDown size={16} />,
  trendingUp: <TrendingUp size={16} />,
  users: <Users size={16} />,
  zap: <Zap size={16} />,
}

const sectionIcons: Record<SectionIcon, React.ReactNode> = {
  activity: <Activity size={20} className="text-blue-600 dark:text-blue-400" />,
  alertTriangle: <AlertTriangle size={20} className="text-orange-600 dark:text-orange-400" />,
  barChart3: <BarChart3 size={20} className="text-indigo-600 dark:text-indigo-400" />,
  dollarSign: <DollarSign size={20} className="text-emerald-600 dark:text-emerald-400" />,
  info: <Info size={20} className="text-neutral-600 dark:text-neutral-400" />,
  lineChart: <LineChart size={20} className="text-green-600 dark:text-green-400" />,
  shield: <Shield size={20} className="text-cyan-600 dark:text-cyan-400" />,
  tags: <Tags size={20} className="text-indigo-600 dark:text-indigo-400" />,
  target: <Target size={20} className="text-purple-600 dark:text-purple-400" />,
  users: <Users size={20} className="text-violet-600 dark:text-violet-400" />,
}

const sectionIconClasses: Record<SectionIcon, string> = {
  activity: 'bg-blue-100 dark:bg-blue-900/20',
  alertTriangle: 'bg-orange-100 dark:bg-orange-900/20',
  barChart3: 'bg-indigo-100 dark:bg-indigo-900/20',
  dollarSign: 'bg-emerald-100 dark:bg-emerald-900/20',
  info: 'bg-neutral-100 dark:bg-neutral-800/20',
  lineChart: 'bg-green-100 dark:bg-green-900/20',
  shield: 'bg-cyan-100 dark:bg-cyan-900/20',
  tags: 'bg-indigo-100 dark:bg-indigo-900/20',
  target: 'bg-purple-100 dark:bg-purple-900/20',
  users: 'bg-violet-100 dark:bg-violet-900/20',
}

interface PositionDetailHeaderProps {
  position: PositionDTO
  onClose: () => void
}

export function PositionDetailHeader({ position, onClose }: PositionDetailHeaderProps) {
  return (
    <div className="pf-modal-header sticky top-0 bg-neutral-950 z-10">
      <div className="flex items-center gap-3">
        <AssetLogo
          symbol={position.symbol}
          assetType={position.asset_type}
          assetName={position.name}
          alt={`${position.symbol} logo`}
          className="w-14 h-14 flex-shrink-0 object-cover rounded-lg"
          style={{ borderRadius: 0 }}
        />

        <div className="flex flex-col">
          <h2 className="pf-modal-title">
            {position.symbol}
          </h2>
          <p className="pf-modal-description">
            {position.name}
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="pf-modal-close"
        aria-label="Close"
      >
        <X size={20} className="text-neutral-500 dark:text-neutral-400" />
      </button>
    </div>
  )
}

export function SectionHeader({ icon, title }: { icon: SectionIcon; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-10 h-10 ${sectionIconClasses[icon]} rounded-lg flex items-center justify-center`}>
        {sectionIcons[icon]}
      </div>
      <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </h3>
    </div>
  )
}

function MetricSkeletonGrid({
  count,
  showSubtitle = false,
  subtitleWidthClass = 'w-28',
}: {
  count: number
  showSubtitle?: boolean
  subtitleWidthClass?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-5">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="p-5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 animate-pulse">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-2"></div>
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-32 mb-1"></div>
          {showSubtitle && <div className={`h-4 bg-neutral-200 dark:bg-neutral-700 rounded ${subtitleWidthClass}`}></div>}
        </div>
      ))}
    </div>
  )
}

export function MetricSection({
  title,
  icon,
  loading,
  skeletonCount,
  skeletonSubtitle = false,
  skeletonSubtitleWidthClass,
  children,
}: {
  title: string
  icon: SectionIcon
  loading?: boolean
  skeletonCount: number
  skeletonSubtitle?: boolean
  skeletonSubtitleWidthClass?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <SectionHeader icon={icon} title={title} />
      {loading ? (
        <MetricSkeletonGrid
          count={skeletonCount}
          showSubtitle={skeletonSubtitle}
          subtitleWidthClass={skeletonSubtitleWidthClass}
        />
      ) : children}
    </section>
  )
}

export function MetricGrid({ items }: { items: MetricGridItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-5">
      {items.map((item) => item.kind === 'metric' ? (
        <MetricCard key={item.key} metric={item} />
      ) : (
        <EmptyMetricCard key={item.key} label={item.label} message={item.message} />
      ))}
    </div>
  )
}

function MetricCard({ metric }: { metric: MetricCardModel }) {
  return (
    <div className="card p-5 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors">
      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">{metric.label}</div>
      <div className={`text-2xl font-bold ${metric.color || 'text-neutral-900 dark:text-neutral-100'} flex items-center gap-2`}>
        {metric.icon ? metricIcons[metric.icon] : null}
        {metric.value}
      </div>
      {metric.percentage && (
        <div className={`text-base font-medium mt-1 ${metric.color}`}>{metric.percentage}</div>
      )}
      {metric.subtitle && (
        <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">{metric.subtitle}</div>
      )}
      {metric.conclusion && (
        <div className="text-sm text-neutral-600 dark:text-neutral-300 mt-3 italic border-t border-neutral-200 dark:border-neutral-700 pt-3">
          {metric.conclusion}
        </div>
      )}
    </div>
  )
}

function EmptyMetricCard({ label, message }: { label: string; message: string }) {
  return (
    <div className="p-5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 opacity-60">
      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">{label}</div>
      <div className="text-base text-neutral-400 dark:text-neutral-500 italic">{message}</div>
    </div>
  )
}

export function InfoGrid({ rows }: { rows: InfoRowModel[] }) {
  return (
    <div className="grid grid-cols-2 gap-5">
      {rows.map((row) => (
        <InfoRow key={row.key} label={row.label} value={row.value} />
      ))}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">{label}</div>
      <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{value}</div>
    </div>
  )
}

export function ThemeExposureSection({ themes }: { themes: AssetThemeDTO[] }) {
  if (themes.length === 0) return null

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center">
          <Tags size={20} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Themes & Exposures
        </h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {themes.map((theme) => (
          <div
            key={theme.label}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
            title={getThemeEvidenceTitle(theme)}
          >
            <div className="flex items-center gap-2">
              <span>{theme.label}</span>
              <span className="ml-auto text-xs font-semibold text-indigo-500 dark:text-indigo-400">
                {Math.round(theme.confidence * 100)}%
              </span>
            </div>
            <ThemeSubthemeBadges parentLabel={theme.label} subthemes={theme.children} />
          </div>
        ))}
      </div>
    </section>
  )
}
