import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Bell,
  Eye,
  LayoutList,
  Target,
  Shield,
  AlertTriangle,
  Calendar,
  Clock,
  PieChart,
  Globe,
  Layers,
  Activity,
  BarChart3,
  ArrowDownCircle,
  GitCompare,
  Zap,
  ArrowDown,
  Crosshair,
  TrendingUpDown,
  Grid3x3,
  Timer,
  Network,
  Pizza,
} from 'lucide-react'
import { WidgetConfig, WidgetContext } from '../../types'
import { getWidgetSize } from '../../utils/widgetConstraints'

// Import all widget components
import MetricWidget from '../metric/MetricWidget'
import TotalReturnWidget from '../metric/TotalReturnWidget'
import WinRateWidget from '../metric/WinRateWidget'
import GoalTrackerWidget from '../metric/GoalTrackerWidget'
import RiskMetricWidget from '../metric/RiskMetricWidget'
import BenchmarkMetricWidget from '../metric/BenchmarkMetricWidget'
import HoldingPeriodWidget from '../metric/HoldingPeriodWidget'
import BitcoinPizzaWidget from '../metric/BitcoinPizzaWidget'
import SentimentWidget from '../metric/SentimentWidget'
import VIXWidget from '../metric/VIXWidget'
import TNXWidget from '../metric/TNXWidget'
import DXYWidget from '../metric/DXYWidget'
import NotificationsWidget from '../list/NotificationsWidget'
import WatchlistWidget from '../list/WatchlistWidget'
import PositionsTableWidget from '../list/PositionsTableWidget'
import RecentTransactionsWidget from '../list/RecentTransactionsWidget'
import ConcentrationRiskWidget from '../analysis/ConcentrationRiskWidget'
import BestWorstTodayWidget from '../analysis/BestWorstTodayWidget'
import TopPerformersWidget from '../analysis/TopPerformersWidget'
import WorstPerformersWidget from '../analysis/WorstPerformersWidget'
import LargestHoldingsWidget from '../analysis/LargestHoldingsWidget'
import PerformanceMetricsWidget from '../analysis/PerformanceMetricsWidget'
import AssetAllocationWidget from '../analysis/AssetAllocationWidget'
import PortfolioHeatmapWidget from '../analysis/PortfolioHeatmapWidget'
import MarketStatusWidget from '../market/MarketStatusWidget'
import MarketIndicesWidget from '../market/MarketIndicesWidget'
import { calculateHitRatio, calculateDiversificationScore } from '../utils/metricsCalculations'

/**
 * Complete widget registry
 * Centralized configuration for all dashboard widgets
 */
export const widgetDefinitions: WidgetConfig[] = [
  // ===== METRIC WIDGETS =====
  {
    id: 'total-value',
    name: 'dashboard.widgets.totalValue.name',
    description: 'dashboard.widgets.totalValue.description',
    category: 'metrics',
    icon: DollarSign,
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    iconBgColor: 'bg-fuchsia-50 dark:bg-fuchsia-900/20',
    defaultSize: getWidgetSize('total-value')!,
    allowMultiple: true,
    component: MetricWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.totalValue.name',
      value: context.metrics
        ? `${context.portfolioCurrency === 'EUR' ? '€' : '$'}${Number(context.metrics.total_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'N/A',
      icon: DollarSign,
      iconBgColor: 'bg-fuchsia-50 dark:bg-fuchsia-900/20',
      iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'daily-gain',
    name: 'dashboard.widgets.dailyGain.name',
    description: 'dashboard.widgets.dailyGain.description',
    category: 'metrics',
    icon: TrendingDown,
    iconColor: 'text-red-600 dark:text-red-400',
    iconBgColor: 'bg-red-50 dark:bg-red-900/20',
    defaultSize: getWidgetSize('daily-gain')!,
    allowMultiple: true,
    component: MetricWidget,
    getProps: (context: WidgetContext) => {
      const dailyValue = context.metrics?.daily_change_value !== null && context.metrics?.daily_change_value !== undefined 
        ? Number(context.metrics.daily_change_value) 
        : null
      const dailyPct = context.metrics?.daily_change_pct !== null && context.metrics?.daily_change_pct !== undefined
        ? Number(context.metrics.daily_change_pct)
        : null
      const isPositive = dailyValue !== null && dailyValue > 0
      const isNegative = dailyValue !== null && dailyValue < 0
      
      const symbol = context.portfolioCurrency === 'EUR' ? '€' : '$'
      const formattedValue = dailyValue !== null
        ? `${dailyValue >= 0 ? '+' : ''}${symbol}${Math.abs(dailyValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'N/A'

      return {
        title: 'dashboard.widgets.dailyGain.name',
        value: formattedValue,
        subtitle: dailyPct !== null
          ? `${dailyPct > 0 ? '+' : ''}${dailyPct.toFixed(2)}%`
          : 'No data',
        icon: isPositive ? TrendingUp : TrendingDown,
        iconBgColor: isPositive ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20',
        iconColor: isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
        valueColor: isPositive ? 'text-emerald-600 dark:text-emerald-400' : isNegative ? 'text-red-600 dark:text-red-400' : 'text-neutral-600 dark:text-neutral-400',
        isPreview: context.isPreview,
      }
    },
  },
  {
    id: 'unrealized-pnl',
    name: 'dashboard.widgets.unrealizedPnL.name',
    description: 'dashboard.widgets.unrealizedPnL.description',
    category: 'metrics',
    icon: TrendingUp,
    iconColor: 'text-green-600 dark:text-green-400',
    iconBgColor: 'bg-green-50 dark:bg-green-900/20',
    defaultSize: getWidgetSize('unrealized-pnl')!,
    allowMultiple: true,
    component: MetricWidget,
    getProps: (context: WidgetContext) => {
      const unrealizedPnl = context.metrics?.total_unrealized_pnl !== null && context.metrics?.total_unrealized_pnl !== undefined
        ? Number(context.metrics.total_unrealized_pnl)
        : 0
      const unrealizedPct = context.metrics?.total_unrealized_pnl_pct !== null && context.metrics?.total_unrealized_pnl_pct !== undefined
        ? Number(context.metrics.total_unrealized_pnl_pct)
        : 0
      const isPositive = unrealizedPnl >= 0
      
      const symbol = context.portfolioCurrency === 'EUR' ? '€' : '$'
      const formattedValue = context.metrics
        ? `${unrealizedPnl >= 0 ? '+' : ''}${symbol}${Math.abs(unrealizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'N/A'

      return {
        title: 'dashboard.widgets.unrealizedPnL.name',
        value: formattedValue,
        subtitle: `${unrealizedPct >= 0 ? '+' : ''}${unrealizedPct.toFixed(2)}%`,
        icon: isPositive ? TrendingUp : TrendingDown,
        iconBgColor: isPositive ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20',
        iconColor: isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
        valueColor: isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
        isPreview: context.isPreview,
      }
    },
  },
  {
    id: 'realized-pnl',
    name: 'dashboard.widgets.realizedPnL.name',
    description: 'dashboard.widgets.realizedPnL.description',
    category: 'metrics',
    icon: PiggyBank,
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBgColor: 'bg-sky-50 dark:bg-sky-900/20',
    defaultSize: getWidgetSize('realized-pnl')!,
    allowMultiple: true,
    component: MetricWidget,
    getProps: (context: WidgetContext) => {
      const realizedPnl = context.metrics?.total_realized_pnl !== null && context.metrics?.total_realized_pnl !== undefined
        ? Number(context.metrics.total_realized_pnl)
        : 0
      const symbol = context.portfolioCurrency === 'EUR' ? '€' : '$'
      const formattedValue = context.metrics
        ? `${symbol}${Math.abs(realizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'N/A'

      return {
        title: 'dashboard.widgets.realizedPnL.name',
        value: formattedValue,
        icon: PiggyBank,
        iconBgColor: 'bg-sky-50 dark:bg-sky-900/20',
        iconColor: 'text-sky-600 dark:text-sky-400',
        valueColor: realizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
        isPreview: context.isPreview,
      }
    },
  },
  {
    id: 'dividends',
    name: 'dashboard.widgets.dividends.name',
    description: 'dashboard.widgets.dividends.description',
    category: 'metrics',
    icon: TrendingUp,
    iconColor: 'text-purple-600 dark:text-purple-400',
    iconBgColor: 'bg-purple-50 dark:bg-purple-900/20',
    defaultSize: getWidgetSize('dividends')!,
    allowMultiple: true,
    component: MetricWidget,
    getProps: (context: WidgetContext) => {
      const symbol = context.portfolioCurrency === 'EUR' ? '€' : '$'
      const dividends = context.metrics?.total_dividends !== null && context.metrics?.total_dividends !== undefined
        ? Number(context.metrics.total_dividends)
        : 0
      const fees = context.metrics?.total_fees !== null && context.metrics?.total_fees !== undefined
        ? Number(context.metrics.total_fees)
        : 0

      return {
        title: 'dashboard.widgets.dividends.name',
        value: context.metrics
          ? `${symbol}${dividends.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : 'N/A',
        subtitleKey: 'fields.fees',
        subtitleValue: `${symbol}${fees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        icon: TrendingUp,
        iconBgColor: 'bg-purple-50 dark:bg-purple-900/20',
        iconColor: 'text-purple-600 dark:text-purple-400',
        isPreview: context.isPreview,
      }
    },
  },

  // ===== DATA WIDGETS =====
  {
    id: 'notifications',
    name: 'dashboard.widgets.notifications.name',
    description: 'dashboard.widgets.notifications.description',
    category: 'data',
    icon: Bell,
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBgColor: 'bg-sky-50 dark:bg-sky-900/20',
    defaultSize: getWidgetSize('notifications')!,
    allowMultiple: true,
    component: NotificationsWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'watchlist',
    name: 'dashboard.widgets.watchlist.name',
    description: 'dashboard.widgets.watchlist.description',
    category: 'data',
    icon: Eye,
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    iconBgColor: 'bg-fuchsia-50 dark:bg-fuchsia-900/20',
    defaultSize: getWidgetSize('watchlist')!,
    allowMultiple: true,
    component: WatchlistWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'positions',
    name: 'dashboard.widgets.positions.name',
    description: 'dashboard.widgets.positions.description',
    category: 'data',
    icon: LayoutList,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    iconBgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    defaultSize: getWidgetSize('positions')!,
    allowMultiple: true,
    component: PositionsTableWidget,
    getProps: (context: WidgetContext) => ({
      positions: context.positions,
      soldPositions: context.soldPositions,
      soldPositionsLoading: context.soldPositionsLoading,
      isPreview: context.isPreview,
    }),
  },

  // ===== INSIGHT WIDGETS =====
  {
    id: 'total-return',
    name: 'dashboard.widgets.totalReturn.name',
    description: 'dashboard.widgets.totalReturn.description',
    category: 'insights',
    icon: Target,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    defaultSize: getWidgetSize('total-return')!,
    allowMultiple: true,
    component: TotalReturnWidget,
    getProps: (context: WidgetContext) => ({
      metrics: context.metrics ? {
        total_unrealized_pnl: context.metrics.total_unrealized_pnl,
        total_realized_pnl: context.metrics.total_realized_pnl,
        total_dividends: context.metrics.total_dividends,
        total_fees: context.metrics.total_fees,
      } : null,
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'win-rate',
    name: 'dashboard.widgets.winRate.name',
    description: 'dashboard.widgets.winRate.description',
    category: 'insights',
    icon: Target,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    iconBgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    defaultSize: getWidgetSize('win-rate')!,
    allowMultiple: true,
    component: WinRateWidget,
    getProps: (context: WidgetContext) => ({
      positions: context.positions,
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'concentration-risk',
    name: 'dashboard.widgets.concentrationRisk.name',
    description: 'dashboard.widgets.concentrationRisk.description',
    category: 'insights',
    icon: Shield,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBgColor: 'bg-amber-50 dark:bg-amber-900/20',
    defaultSize: getWidgetSize('concentration-risk')!,
    allowMultiple: true,
    component: ConcentrationRiskWidget,
    getProps: (context: WidgetContext) => ({
      positions: context.positions,
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'best-worst-today',
    name: 'dashboard.widgets.bestWorstToday.name',
    description: 'dashboard.widgets.bestWorstToday.description',
    category: 'insights',
    icon: AlertTriangle,
    iconColor: 'text-violet-600 dark:text-violet-400',
    iconBgColor: 'bg-violet-50 dark:bg-violet-900/20',
    defaultSize: getWidgetSize('best-worst-today')!,
    allowMultiple: true,
    component: BestWorstTodayWidget,
    getProps: (context: WidgetContext) => ({
      positions: context.positions,
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'performance-metrics',
    name: 'dashboard.widgets.performanceMetrics.name',
    description: 'dashboard.widgets.performanceMetrics.description',
    category: 'insights',
    icon: Calendar,
    iconColor: 'text-lime-600 dark:text-lime-400',
    iconBgColor: 'bg-lime-50 dark:bg-lime-900/20',
    defaultSize: getWidgetSize('performance-metrics')!,
    allowMultiple: true,
    component: PerformanceMetricsWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'top-performers',
    name: 'dashboard.widgets.topPerformers.name',
    description: 'dashboard.widgets.topPerformers.description',
    category: 'insights',
    icon: TrendingUp,
    iconColor: 'text-green-600 dark:text-green-400',
    iconBgColor: 'bg-green-50 dark:bg-green-900/20',
    defaultSize: getWidgetSize('top-performers')!,
    allowMultiple: true,
    component: TopPerformersWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'worst-performers',
    name: 'dashboard.widgets.worstPerformers.name',
    description: 'dashboard.widgets.worstPerformers.description',
    category: 'insights',
    icon: TrendingDown,
    iconColor: 'text-red-600 dark:text-red-400',
    iconBgColor: 'bg-red-50 dark:bg-red-900/20',
    defaultSize: getWidgetSize('worst-performers')!,
    allowMultiple: true,
    component: WorstPerformersWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'largest-holdings',
    name: 'dashboard.widgets.largestHoldings.name',
    description: 'dashboard.widgets.largestHoldings.description',
    category: 'insights',
    icon: PieChart,
    iconColor: 'text-purple-600 dark:text-purple-400',
    iconBgColor: 'bg-purple-50 dark:bg-purple-900/20',
    defaultSize: getWidgetSize('largest-holdings')!,
    allowMultiple: true,
    component: LargestHoldingsWidget,
    getProps: (context: WidgetContext) => ({
      positions: context.positions,
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'recent-transactions',
    name: 'dashboard.widgets.recentTransactions.name',
    description: 'dashboard.widgets.recentTransactions.description',
    category: 'insights',
    icon: Clock,
    iconColor: 'text-slate-600 dark:text-slate-400',
    iconBgColor: 'bg-slate-50 dark:bg-slate-900/20',
    defaultSize: getWidgetSize('recent-transactions')!,
    allowMultiple: true,
    component: RecentTransactionsWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'market-status',
    name: 'dashboard.widgets.marketStatus.name',
    description: 'dashboard.widgets.marketStatus.description',
    category: 'insights',
    icon: Globe,
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBgColor: 'bg-sky-50 dark:bg-sky-900/20',
    defaultSize: getWidgetSize('market-status')!,
    allowMultiple: true,
    component: MarketStatusWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'market-indices',
    name: 'dashboard.widgets.marketIndices.name',
    description: 'dashboard.widgets.marketIndices.description',
    category: 'insights',
    icon: TrendingUp,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    iconBgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    defaultSize: getWidgetSize('market-indices')!,
    allowMultiple: true,
    component: MarketIndicesWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'asset-allocation',
    name: 'dashboard.widgets.assetAllocation.name',
    description: 'dashboard.widgets.assetAllocation.description',
    category: 'insights',
    icon: PieChart,
    iconColor: 'text-purple-600 dark:text-purple-400',
    iconBgColor: 'bg-purple-50 dark:bg-purple-900/20',
    defaultSize: getWidgetSize('asset-allocation')!,
    allowMultiple: true,
    component: AssetAllocationWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'portfolio-heatmap',
    name: 'dashboard.widgets.portfolioHeatmap.name',
    description: 'dashboard.widgets.portfolioHeatmap.description',
    category: 'insights',
    icon: Layers,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    iconBgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    defaultSize: getWidgetSize('portfolio-heatmap')!,
    allowMultiple: true,
    component: PortfolioHeatmapWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'goal-tracker',
    name: 'dashboard.widgets.goalTracker.name',
    description: 'dashboard.widgets.goalTracker.description',
    category: 'metrics',
    icon: Target,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    defaultSize: getWidgetSize('goal-tracker')!,
    allowMultiple: true,
    component: GoalTrackerWidget,
    getProps: (context: WidgetContext) => ({
      metrics: context.metrics ? {
        total_value: context.metrics.total_value,
      } : null,
      isPreview: context.isPreview,
    }),
  },

  // ===== ADVANCED METRIC WIDGETS =====
  {
    id: 'sharpe-ratio',
    name: 'dashboard.widgets.sharpeRatio.name',
    description: 'dashboard.widgets.sharpeRatio.description',
    category: 'insights',
    icon: Activity,
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBgColor: 'bg-blue-50 dark:bg-blue-900/20',
    defaultSize: getWidgetSize('sharpe-ratio')!,
    allowMultiple: true,
    component: RiskMetricWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.sharpeRatio.name',
      metricKey: 'sharpe_ratio' as const,
      subtitle: 'dashboard.widgets.sharpeRatio.subtitle',
      icon: Activity,
      iconBgColor: 'bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
      period: '1y',
      formatter: (val: number) => val.toFixed(2),
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'volatility',
    name: 'dashboard.widgets.volatility.name',
    description: 'dashboard.widgets.volatility.description',
    category: 'insights',
    icon: BarChart3,
    iconColor: 'text-orange-600 dark:text-orange-400',
    iconBgColor: 'bg-orange-50 dark:bg-orange-900/20',
    defaultSize: getWidgetSize('volatility')!,
    allowMultiple: true,
    component: RiskMetricWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.volatility.name',
      metricKey: 'volatility' as const,
      subtitle: 'dashboard.widgets.volatility.subtitle',
      icon: BarChart3,
      iconBgColor: 'bg-orange-50 dark:bg-orange-900/20',
      iconColor: 'text-orange-600 dark:text-orange-400',
      period: '1y',
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'max-drawdown',
    name: 'dashboard.widgets.maxDrawdown.name',
    description: 'dashboard.widgets.maxDrawdown.description',
    category: 'insights',
    icon: ArrowDownCircle,
    iconColor: 'text-red-600 dark:text-red-400',
    iconBgColor: 'bg-red-50 dark:bg-red-900/20',
    defaultSize: getWidgetSize('max-drawdown')!,
    allowMultiple: true,
    component: RiskMetricWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.maxDrawdown.name',
      metricKey: 'max_drawdown' as const,
      subtitle: 'dashboard.widgets.maxDrawdown.subtitle',
      icon: ArrowDownCircle,
      iconBgColor: 'bg-red-50 dark:bg-red-900/20',
      iconColor: 'text-red-600 dark:text-red-400',
      valueColor: 'text-red-600 dark:text-red-400',
      period: '1y',
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'beta-correlation',
    name: 'dashboard.widgets.betaCorrelation.name',
    description: 'dashboard.widgets.betaCorrelation.description',
    category: 'insights',
    icon: GitCompare,
    iconColor: 'text-teal-600 dark:text-teal-400',
    iconBgColor: 'bg-teal-50 dark:bg-teal-900/20',
    defaultSize: getWidgetSize('beta-correlation')!,
    allowMultiple: true,
    component: RiskMetricWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.betaCorrelation.name',
      metricKey: 'beta' as const,
      subtitle: 'dashboard.widgets.betaCorrelation.subtitle',
      icon: GitCompare,
      iconBgColor: 'bg-teal-50 dark:bg-teal-900/20',
      iconColor: 'text-teal-600 dark:text-teal-400',
      period: '1y',
      formatter: (val: number) => val.toFixed(2),
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'value-at-risk',
    name: 'dashboard.widgets.valueAtRisk.name',
    description: 'dashboard.widgets.valueAtRisk.description',
    category: 'insights',
    icon: Zap,
    iconColor: 'text-rose-600 dark:text-rose-400',
    iconBgColor: 'bg-rose-50 dark:bg-rose-900/20',
    defaultSize: getWidgetSize('value-at-risk')!,
    allowMultiple: true,
    component: RiskMetricWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.valueAtRisk.name',
      metricKey: 'var_95' as const,
      subtitle: 'dashboard.widgets.valueAtRisk.subtitle',
      icon: Zap,
      iconBgColor: 'bg-rose-50 dark:bg-rose-900/20',
      iconColor: 'text-rose-600 dark:text-rose-400',
      valueColor: 'text-rose-600 dark:text-rose-400',
      period: '1y',
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'downside-deviation',
    name: 'dashboard.widgets.downsideDeviation.name',
    description: 'dashboard.widgets.downsideDeviation.description',
    category: 'insights',
    icon: ArrowDown,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBgColor: 'bg-amber-50 dark:bg-amber-900/20',
    defaultSize: getWidgetSize('downside-deviation')!,
    allowMultiple: true,
    component: RiskMetricWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.downsideDeviation.name',
      metricKey: 'downside_deviation' as const,
      subtitle: 'dashboard.widgets.downsideDeviation.subtitle',
      icon: ArrowDown,
      iconBgColor: 'bg-amber-50 dark:bg-amber-900/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      period: '1y',
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'hit-ratio',
    name: 'dashboard.widgets.hitRatio.name',
    description: 'dashboard.widgets.hitRatio.description',
    category: 'insights',
    icon: Crosshair,
    iconColor: 'text-green-600 dark:text-green-400',
    iconBgColor: 'bg-green-50 dark:bg-green-900/20',
    defaultSize: getWidgetSize('hit-ratio')!,
    allowMultiple: true,
    component: MetricWidget,
    getProps: (context: WidgetContext) => {
      const hitRatio = calculateHitRatio(context.positions)
      const profitableCount = context.positions.filter(pos => {
        const unrealizedPnl = pos.unrealized_pnl !== null && pos.unrealized_pnl !== undefined
          ? Number(pos.unrealized_pnl)
          : 0
        return unrealizedPnl > 0
      }).length
      
      return {
        title: 'dashboard.widgets.hitRatio.name',
        value: hitRatio !== null ? `${hitRatio.toFixed(1)}%` : 'N/A',
        subtitleKey: hitRatio !== null 
          ? 'dashboard.widgets.hitRatio.subtitle'
          : 'dashboard.widgets.hitRatio.noTrades',
        subtitleParams: hitRatio !== null
          ? { profit: profitableCount, total: context.positions.length }
          : undefined,
        icon: Crosshair,
        iconBgColor: 'bg-green-50 dark:bg-green-900/20',
        iconColor: 'text-green-600 dark:text-green-400',
        valueColor: hitRatio !== null && hitRatio >= 50 
          ? 'text-green-600 dark:text-green-400' 
          : 'text-amber-600 dark:text-amber-400',
        isPreview: context.isPreview,
      }
    },
  },
  {
    id: 'alpha',
    name: 'dashboard.widgets.alpha.name',
    description: 'dashboard.widgets.alpha.description',
    category: 'insights',
    icon: TrendingUpDown,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    iconBgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    defaultSize: getWidgetSize('alpha')!,
    allowMultiple: true,
    component: BenchmarkMetricWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.alpha.name',
      metricKey: 'alpha' as const,
      subtitle: 'dashboard.widgets.alpha.subtitle',
      icon: TrendingUpDown,
      iconBgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      benchmark: 'SPY',
      period: '1y',
      formatter: (val: number) => {
        const numVal = typeof val === 'number' ? val : Number(val)
        return isNaN(numVal) ? 'N/A' : `${numVal >= 0 ? '+' : ''}${numVal.toFixed(2)}%`
      },
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'r-squared',
    name: 'dashboard.widgets.rSquared.name',
    description: 'dashboard.widgets.rSquared.description',
    category: 'insights',
    icon: Grid3x3,
    iconColor: 'text-violet-600 dark:text-violet-400',
    iconBgColor: 'bg-violet-50 dark:bg-violet-900/20',
    defaultSize: getWidgetSize('r-squared')!,
    allowMultiple: true,
    component: BenchmarkMetricWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.rSquared.name',
      metricKey: 'r_squared' as const,
      subtitle: 'dashboard.widgets.rSquared.subtitle',
      icon: Grid3x3,
      iconBgColor: 'bg-violet-50 dark:bg-violet-900/20',
      iconColor: 'text-violet-600 dark:text-violet-400',
      benchmark: 'SPY',
      period: '1y',
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'avg-holding-period',
    name: 'dashboard.widgets.avgHoldingPeriod.name',
    description: 'dashboard.widgets.avgHoldingPeriod.description',
    category: 'insights',
    icon: Timer,
    iconColor: 'text-slate-600 dark:text-slate-400',
    iconBgColor: 'bg-slate-50 dark:bg-slate-900/20',
    defaultSize: getWidgetSize('avg-holding-period')!,
    allowMultiple: true,
    component: HoldingPeriodWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.avgHoldingPeriod.name',
      subtitle: 'dashboard.widgets.avgHoldingPeriod.subtitle',
      icon: Timer,
      iconBgColor: 'bg-slate-50 dark:bg-slate-900/20',
      iconColor: 'text-slate-600 dark:text-slate-400',
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'diversification-score',
    name: 'dashboard.widgets.diversificationScore.name',
    description: 'dashboard.widgets.diversificationScore.description',
    category: 'insights',
    icon: Network,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    iconBgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    defaultSize: getWidgetSize('diversification-score')!,
    allowMultiple: true,
    component: MetricWidget,
    getProps: (context: WidgetContext) => {
      const score = calculateDiversificationScore(context.positions)
      const positionCount = context.positions.length
      
      return {
        title: 'dashboard.widgets.diversificationScore.name',
        value: score !== null ? `${score.toFixed(0)}/100` : 'N/A',
        subtitleKey: score !== null 
          ? 'dashboard.widgets.diversificationScore.subtitle'
          : 'dashboard.widgets.diversificationScore.noPositions',
        subtitleParams: score !== null
          ? { count: positionCount, suffix: positionCount !== 1 ? 's' : '' }
          : undefined,
        icon: Network,
        iconBgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
        iconColor: 'text-cyan-600 dark:text-cyan-400',
        valueColor: score !== null 
          ? (score >= 70 ? 'text-green-600 dark:text-green-400' 
            : score >= 40 ? 'text-amber-600 dark:text-amber-400'
            : 'text-red-600 dark:text-red-400')
          : 'text-neutral-600 dark:text-neutral-400',
        isPreview: context.isPreview,
      }
    },
  },

  // ===== FUN WIDGETS =====
  {
    id: 'bitcoin-pizza-index',
    name: 'dashboard.widgets.bitcoinPizzaIndex.name',
    description: 'dashboard.widgets.bitcoinPizzaIndex.description',
    category: 'metrics',
    icon: Pizza,
    iconColor: 'text-orange-600 dark:text-orange-400',
    iconBgColor: 'bg-orange-50 dark:bg-orange-900/20',
    defaultSize: getWidgetSize('bitcoin-pizza-index')!,
    allowMultiple: true,
    component: BitcoinPizzaWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.bitcoinPizzaIndex.name',
      subtitle: 'dashboard.widgets.bitcoinPizzaIndex.subtitle',
      isPreview: context.isPreview,
    }),
  },

  // ===== MARKET SENTIMENT WIDGETS =====
  {
    id: 'market-sentiment',
    name: 'dashboard.widgets.marketSentiment.name',
    description: 'dashboard.widgets.marketSentiment.description',
    category: 'metrics',
    icon: TrendingUpDown,
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBgColor: 'bg-blue-50 dark:bg-blue-900/20',
    defaultSize: getWidgetSize('market-sentiment')!,
    allowMultiple: true,
    component: SentimentWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.marketSentiment.name',
      market: 'stock',
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'crypto-sentiment',
    name: 'dashboard.widgets.cryptoSentiment.name',
    description: 'dashboard.widgets.cryptoSentiment.description',
    category: 'metrics',
    icon: TrendingUpDown,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBgColor: 'bg-amber-50 dark:bg-amber-900/20',
    defaultSize: getWidgetSize('crypto-sentiment')!,
    allowMultiple: true,
    component: SentimentWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.cryptoSentiment.name',
      market: 'crypto',
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },

  // ===== VOLATILITY WIDGETS =====
  {
    id: 'vix-index',
    name: 'dashboard.widgets.vixIndex.name',
    description: 'dashboard.widgets.vixIndex.description',
    category: 'metrics',
    icon: Activity,
    iconColor: 'text-purple-600 dark:text-purple-400',
    iconBgColor: 'bg-purple-50 dark:bg-purple-900/20',
    defaultSize: getWidgetSize('vix-index')!,
    allowMultiple: true,
    component: VIXWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.vixIndex.name',
      subtitle: 'dashboard.widgets.vixIndex.subtitle',
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'tnx-index',
    name: 'dashboard.widgets.tnxIndex.name',
    description: 'dashboard.widgets.tnxIndex.description',
    category: 'metrics',
    icon: TrendingUp,
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBgColor: 'bg-blue-50 dark:bg-blue-900/20',
    defaultSize: getWidgetSize('tnx-index')!,
    allowMultiple: true,
    component: TNXWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.tnxIndex.name',
      subtitle: 'dashboard.widgets.tnxIndex.subtitle',
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
  {
    id: 'dxy-index',
    name: 'dashboard.widgets.dxyIndex.name',
    description: 'dashboard.widgets.dxyIndex.description',
    category: 'metrics',
    icon: DollarSign,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    defaultSize: getWidgetSize('dxy-index')!,
    allowMultiple: true,
    component: DXYWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.widgets.dxyIndex.name',
      subtitle: 'dashboard.widgets.dxyIndex.subtitle',
      isPreview: context.isPreview,
      batchData: context.batchData,
    }),
  },
]
