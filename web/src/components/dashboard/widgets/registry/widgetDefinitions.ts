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
} from 'lucide-react'
import { WidgetConfig, WidgetContext } from '../../types'
import { mockPerformanceMetrics } from '../../utils/mockDataProvider'

// Import all widget components
import MetricWidget from '../metric/MetricWidget'
import TotalReturnWidget from '../metric/TotalReturnWidget'
import WinRateWidget from '../metric/WinRateWidget'
import GoalTrackerWidget from '../metric/GoalTrackerWidget'
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

/**
 * Complete widget registry
 * Centralized configuration for all dashboard widgets
 */
export const widgetDefinitions: WidgetConfig[] = [
  // ===== METRIC WIDGETS =====
  {
    id: 'total-value',
    name: 'dashboard.totalValue',
    description: 'Display your total portfolio value',
    category: 'metrics',
    icon: DollarSign,
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    iconBgColor: 'bg-fuchsia-50 dark:bg-fuchsia-900/20',
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
    allowMultiple: true,
    component: MetricWidget,
    getProps: (context: WidgetContext) => ({
      title: 'dashboard.totalValue',
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
    name: 'dashboard.dailyGain',
    description: 'Track daily portfolio changes',
    category: 'metrics',
    icon: TrendingDown,
    iconColor: 'text-red-600 dark:text-red-400',
    iconBgColor: 'bg-red-50 dark:bg-red-900/20',
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
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
        title: 'dashboard.dailyGain',
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
    name: 'dashboard.unrealizedPnL',
    description: 'Unrealized profit and loss',
    category: 'metrics',
    icon: TrendingUp,
    iconColor: 'text-green-600 dark:text-green-400',
    iconBgColor: 'bg-green-50 dark:bg-green-900/20',
    defaultSize: { w: 2, h: 2, minW: 2, minH: 2 },
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
        title: 'dashboard.unrealizedPnL',
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
    name: 'dashboard.realizedPnL',
    description: 'Realized profit and loss',
    category: 'metrics',
    icon: PiggyBank,
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBgColor: 'bg-sky-50 dark:bg-sky-900/20',
    defaultSize: { w: 2, h: 2, minW: 2, minH: 2 },
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
        title: 'dashboard.realizedPnL',
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
    name: 'dashboard.dividends',
    description: 'Total dividends and fees',
    category: 'metrics',
    icon: TrendingUp,
    iconColor: 'text-purple-600 dark:text-purple-400',
    iconBgColor: 'bg-purple-50 dark:bg-purple-900/20',
    defaultSize: { w: 2, h: 2, minW: 2, minH: 2 },
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
        title: 'dashboard.dividends',
        value: context.metrics
          ? `${symbol}${dividends.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : 'N/A',
        subtitle: `Fees: ${symbol}${fees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
    name: 'Recent Notifications',
    description: 'Latest 5 notifications',
    category: 'data',
    icon: Bell,
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBgColor: 'bg-sky-50 dark:bg-sky-900/20',
    defaultSize: { w: 4, h: 3, minW: 4, minH: 2 },
    allowMultiple: true,
    component: NotificationsWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'watchlist',
    name: 'Watchlist',
    description: 'Top 5 watchlist items',
    category: 'data',
    icon: Eye,
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    iconBgColor: 'bg-fuchsia-50 dark:bg-fuchsia-900/20',
    defaultSize: { w: 4, h: 3, minW: 4, minH: 2 },
    allowMultiple: true,
    component: WatchlistWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'positions',
    name: 'Positions Table',
    description: 'All your current and sold positions',
    category: 'data',
    icon: LayoutList,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    iconBgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    defaultSize: { w: 12, h: 12, minW: 8, minH: 6 },
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
    name: 'Total Return',
    description: 'Combined return calculation (unrealized + realized + dividends - fees)',
    category: 'insights',
    icon: Target,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2 },
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
    name: 'Win Rate',
    description: 'Percentage of positions currently in profit',
    category: 'insights',
    icon: Target,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    iconBgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    defaultSize: { w: 3, h: 3, minW: 2, minH: 3 },
    allowMultiple: true,
    component: WinRateWidget,
    getProps: (context: WidgetContext) => ({
      positions: context.positions,
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'concentration-risk',
    name: 'Concentration Risk',
    description: 'Shows allocation to top 3 positions with risk warning',
    category: 'insights',
    icon: Shield,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBgColor: 'bg-amber-50 dark:bg-amber-900/20',
    defaultSize: { w: 4, h: 5, minW: 3, minH: 5 },
    allowMultiple: true,
    component: ConcentrationRiskWidget,
    getProps: (context: WidgetContext) => ({
      positions: context.positions,
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'best-worst-today',
    name: 'Best/Worst Today',
    description: 'Top gainer and loser positions today',
    category: 'insights',
    icon: AlertTriangle,
    iconColor: 'text-violet-600 dark:text-violet-400',
    iconBgColor: 'bg-violet-50 dark:bg-violet-900/20',
    defaultSize: { w: 3, h: 4, minW: 3, minH: 4 },
    allowMultiple: true,
    component: BestWorstTodayWidget,
    getProps: (context: WidgetContext) => ({
      positions: context.positions,
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'performance-metrics',
    name: 'Week/Month/YTD Performance',
    description: 'Performance overview for different time periods',
    category: 'insights',
    icon: Calendar,
    iconColor: 'text-lime-600 dark:text-lime-400',
    iconBgColor: 'bg-lime-50 dark:bg-lime-900/20',
    defaultSize: { w: 3, h: 4, minW: 3, minH: 4 },
    allowMultiple: true,
    component: PerformanceMetricsWidget,
    getProps: (context: WidgetContext) => ({
      metrics: context.isPreview ? mockPerformanceMetrics : {
        weeklyReturn: undefined,
        monthlyReturn: undefined,
        ytdReturn: undefined,
      },
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'top-performers',
    name: 'Top Performers',
    description: 'Best 5 positions by return percentage',
    category: 'insights',
    icon: TrendingUp,
    iconColor: 'text-green-600 dark:text-green-400',
    iconBgColor: 'bg-green-50 dark:bg-green-900/20',
    defaultSize: { w: 4, h: 7, minW: 3, minH: 3 },
    allowMultiple: true,
    component: TopPerformersWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'worst-performers',
    name: 'Worst Performers',
    description: 'Worst 5 positions by return percentage',
    category: 'insights',
    icon: TrendingDown,
    iconColor: 'text-red-600 dark:text-red-400',
    iconBgColor: 'bg-red-50 dark:bg-red-900/20',
    defaultSize: { w: 4, h: 7, minW: 3, minH: 3 },
    allowMultiple: true,
    component: WorstPerformersWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'largest-holdings',
    name: 'Largest Holdings',
    description: 'Top 5 positions by market value with allocation',
    category: 'insights',
    icon: PieChart,
    iconColor: 'text-purple-600 dark:text-purple-400',
    iconBgColor: 'bg-purple-50 dark:bg-purple-900/20',
    defaultSize: { w: 4, h: 7, minW: 3, minH: 6 },
    allowMultiple: true,
    component: LargestHoldingsWidget,
    getProps: (context: WidgetContext) => ({
      positions: context.positions,
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'recent-transactions',
    name: 'Recent Transactions',
    description: 'Last 5 transactions timeline',
    category: 'insights',
    icon: Clock,
    iconColor: 'text-slate-600 dark:text-slate-400',
    iconBgColor: 'bg-slate-50 dark:bg-slate-900/20',
    defaultSize: { w: 4, h: 9, minW: 4, minH: 3 },
    allowMultiple: true,
    component: RecentTransactionsWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'market-status',
    name: 'Market Status',
    description: 'Current US market hours and status',
    category: 'insights',
    icon: Globe,
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBgColor: 'bg-sky-50 dark:bg-sky-900/20',
    defaultSize: { w: 3, h: 5, minW: 2, minH: 5 },
    allowMultiple: true,
    component: MarketStatusWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'market-indices',
    name: 'Market Indices',
    description: 'Major market indices by region (S&P 500, DAX, Nikkei, etc.)',
    category: 'insights',
    icon: TrendingUp,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    iconBgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    defaultSize: { w: 4, h: 7, minW: 3, minH: 6 },
    allowMultiple: true,
    component: MarketIndicesWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'asset-allocation',
    name: 'Asset Allocation',
    description: 'Visual breakdown of portfolio by sector, type, or country',
    category: 'insights',
    icon: PieChart,
    iconColor: 'text-purple-600 dark:text-purple-400',
    iconBgColor: 'bg-purple-50 dark:bg-purple-900/20',
    defaultSize: { w: 4, h: 8, minW: 3, minH: 6 },
    allowMultiple: true,
    component: AssetAllocationWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'portfolio-heatmap',
    name: 'Portfolio Heatmap',
    description: 'Visual treemap of all positions with color-coded daily performance',
    category: 'insights',
    icon: Layers,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    iconBgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    defaultSize: { w: 6, h: 8, minW: 4, minH: 6 },
    allowMultiple: true,
    component: PortfolioHeatmapWidget,
    getProps: (context: WidgetContext) => ({
      isPreview: context.isPreview,
    }),
  },
  {
    id: 'goal-tracker',
    name: 'Goal Tracker',
    description: 'Track progress toward your portfolio value goal',
    category: 'metrics',
    icon: Target,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    defaultSize: { w: 3, h: 8, minW: 3, minH: 7 },
    allowMultiple: false,
    component: GoalTrackerWidget,
    getProps: (context: WidgetContext) => ({
      metrics: context.metrics ? {
        total_value: context.metrics.total_value,
      } : null,
      isPreview: context.isPreview,
    }),
  },
]
