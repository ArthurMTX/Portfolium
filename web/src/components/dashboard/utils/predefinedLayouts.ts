/**
 * Predefined Dashboard Layouts
 * Ready-to-use layout templates that users can import
 */

import { DashboardLayoutExport } from '@/types/dashboard'

export const PREDEFINED_LAYOUTS: DashboardLayoutExport[] = [
  {
    name: 'Quick Glancer',
    description: 'Simple, clean layout with only essential metrics for quick portfolio checks',
    version: '1.0',
    layout_config: {
      lg: [
        { i: 'total-value', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
        { i: 'daily-gain', x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
        { i: 'unrealized-pnl', x: 8, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
        { i: 'positions', x: 0, y: 2, w: 12, h: 12, minW: 8, minH: 6 },
      ],
      md: [
        { i: 'total-value', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
        { i: 'daily-gain', x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
        { i: 'unrealized-pnl', x: 0, y: 2, w: 4, h: 2, minW: 2, minH: 2 },
        { i: 'positions', x: 0, y: 4, w: 8, h: 12, minW: 6, minH: 6 },
      ],
      sm: [
        { i: 'total-value', x: 0, y: 0, w: 4, h: 2, minW: 4, minH: 2 },
        { i: 'daily-gain', x: 0, y: 2, w: 4, h: 2, minW: 4, minH: 2 },
        { i: 'unrealized-pnl', x: 0, y: 4, w: 4, h: 2, minW: 4, minH: 2 },
        { i: 'positions', x: 0, y: 6, w: 4, h: 10, minW: 4, minH: 4 },
      ],
    },
    exported_at: new Date().toISOString(),
  },
  {
    name: 'Day Trader',
    description: 'Perfect for active traders who need real-time market insights and quick position tracking',
    version: '1.0',
    layout_config: {
      lg: [
        // Top row - Key metrics
        { i: 'market-status', x: 0, y: 0, w: 2, h: 6, minW: 2, minH: 5 },
        { i: 'daily-gain', x: 2, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'total-value', x: 5, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'unrealized-pnl', x: 8, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
        { i: 'realized-pnl', x: 10, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
        
        // Second row - Market data and movers
        { i: 'market-indices', x: 2, y: 2, w: 5, h: 8, minW: 3, minH: 6 },
        { i: 'best-worst-today', x: 7, y: 2, w: 3, h: 5, minW: 3, minH: 4 },
        { i: 'watchlist', x: 10, y: 2, w: 2, h: 5, minW: 2, minH: 2 },
        
        // Third row - Portfolio visualization
        { i: 'portfolio-heatmap', x: 0, y: 6, w: 7, h: 9, minW: 4, minH: 6 },
        { i: 'recent-transactions', x: 7, y: 7, w: 5, h: 8, minW: 4, minH: 3 },
        
        // Bottom - Full positions table
        { i: 'positions', x: 0, y: 15, w: 12, h: 12, minW: 8, minH: 6 },
      ],
      md: [
        { i: 'market-status', x: 0, y: 0, w: 2, h: 6, minW: 2, minH: 5 },
        { i: 'daily-gain', x: 2, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'total-value', x: 5, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'best-worst-today', x: 2, y: 2, w: 3, h: 5, minW: 3, minH: 4 },
        { i: 'watchlist', x: 5, y: 2, w: 3, h: 4, minW: 2, minH: 2 },
        { i: 'positions', x: 0, y: 7, w: 8, h: 12, minW: 6, minH: 6 },
      ],
      sm: [
        { i: 'daily-gain', x: 0, y: 0, w: 4, h: 2, minW: 4, minH: 2 },
        { i: 'total-value', x: 0, y: 2, w: 4, h: 2, minW: 4, minH: 2 },
        { i: 'best-worst-today', x: 0, y: 4, w: 4, h: 4, minW: 3, minH: 4 },
        { i: 'watchlist', x: 0, y: 8, w: 4, h: 3, minW: 4, minH: 2 },
        { i: 'positions', x: 0, y: 11, w: 4, h: 10, minW: 4, minH: 4 },
      ],
    },
    exported_at: new Date().toISOString(),
  },
  {
    name: 'Long-Term Investor',
    description: 'Focus on total return, dividends, and proper diversification for buy-and-hold strategy',
    version: '1.0',
    layout_config: {
      lg: [
        // Top row - Key return metrics
        { i: 'total-return', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'dividends', x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'realized-pnl', x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'unrealized-pnl', x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        
        // Second row - Performance tracking
        { i: 'performance-metrics', x: 0, y: 2, w: 4, h: 5, minW: 3, minH: 4 },
        { i: 'goal-tracker', x: 4, y: 2, w: 4, h: 9, minW: 3, minH: 7 },
        { i: 'win-rate', x: 8, y: 2, w: 4, h: 4, minW: 2, minH: 3 },
        
        // Third row - Risk and diversification
        { i: 'concentration-risk', x: 0, y: 7, w: 4, h: 6, minW: 3, minH: 5 },
        { i: 'asset-allocation', x: 8, y: 6, w: 4, h: 7, minW: 3, minH: 6 },
        { i: 'largest-holdings', x: 4, y: 11, w: 4, h: 8, minW: 3, minH: 6 },
        
        // Fourth row - Portfolio visualization
        { i: 'portfolio-heatmap', x: 0, y: 13, w: 8, h: 9, minW: 4, minH: 6 },
        { i: 'top-performers', x: 8, y: 13, w: 4, h: 9, minW: 3, minH: 3 },
        
        // Bottom - Positions
        { i: 'positions', x: 0, y: 22, w: 12, h: 12, minW: 8, minH: 6 },
      ],
      md: [
        { i: 'total-return', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
        { i: 'dividends', x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
        { i: 'performance-metrics', x: 0, y: 2, w: 4, h: 5, minW: 3, minH: 4 },
        { i: 'concentration-risk', x: 4, y: 2, w: 4, h: 6, minW: 3, minH: 5 },
        { i: 'asset-allocation', x: 0, y: 7, w: 4, h: 8, minW: 3, minH: 6 },
        { i: 'largest-holdings', x: 4, y: 8, w: 4, h: 7, minW: 3, minH: 6 },
        { i: 'positions', x: 0, y: 15, w: 8, h: 12, minW: 6, minH: 6 },
      ],
      sm: [
        { i: 'total-return', x: 0, y: 0, w: 4, h: 2, minW: 4, minH: 2 },
        { i: 'dividends', x: 0, y: 2, w: 4, h: 2, minW: 4, minH: 2 },
        { i: 'performance-metrics', x: 0, y: 4, w: 4, h: 5, minW: 3, minH: 4 },
        { i: 'concentration-risk', x: 0, y: 9, w: 4, h: 6, minW: 3, minH: 5 },
        { i: 'positions', x: 0, y: 15, w: 4, h: 10, minW: 4, minH: 4 },
      ],
    },
    exported_at: new Date().toISOString(),
  },
  {
    name: 'Risk Manager',
    description: 'Focus on diversification, concentration risk, and portfolio balance monitoring',
    version: '1.0',
    layout_config: {
      lg: [
        // Top row - Key metrics
        { i: 'total-value', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'daily-gain', x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'unrealized-pnl', x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'realized-pnl', x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        
        // Second row - Risk metrics (prominent)
        { i: 'concentration-risk', x: 0, y: 2, w: 5, h: 6, minW: 3, minH: 5 },
        { i: 'asset-allocation', x: 5, y: 2, w: 4, h: 9, minW: 3, minH: 6 },
        { i: 'win-rate', x: 9, y: 2, w: 3, h: 4, minW: 2, minH: 3 },
        
        // Third row - Holdings analysis
        { i: 'largest-holdings', x: 0, y: 8, w: 5, h: 8, minW: 3, minH: 6 },
        { i: 'best-worst-today', x: 9, y: 6, w: 3, h: 5, minW: 3, minH: 4 },
        
        // Fourth row - Portfolio visualization
        { i: 'portfolio-heatmap', x: 5, y: 11, w: 7, h: 9, minW: 4, minH: 6 },
        { i: 'worst-performers', x: 0, y: 16, w: 5, h: 4, minW: 3, minH: 3 },
        
        // Bottom - Positions
        { i: 'positions', x: 0, y: 20, w: 12, h: 12, minW: 8, minH: 6 },
      ],
      md: [
        { i: 'total-value', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
        { i: 'daily-gain', x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
        { i: 'concentration-risk', x: 0, y: 2, w: 4, h: 6, minW: 3, minH: 5 },
        { i: 'asset-allocation', x: 4, y: 2, w: 4, h: 9, minW: 3, minH: 6 },
        { i: 'largest-holdings', x: 0, y: 8, w: 4, h: 8, minW: 3, minH: 6 },
        { i: 'win-rate', x: 4, y: 11, w: 4, h: 4, minW: 2, minH: 3 },
        { i: 'positions', x: 0, y: 16, w: 8, h: 12, minW: 6, minH: 6 },
      ],
      sm: [
        { i: 'total-value', x: 0, y: 0, w: 4, h: 2, minW: 4, minH: 2 },
        { i: 'concentration-risk', x: 0, y: 2, w: 4, h: 6, minW: 3, minH: 5 },
        { i: 'win-rate', x: 0, y: 8, w: 4, h: 4, minW: 2, minH: 3 },
        { i: 'positions', x: 0, y: 12, w: 4, h: 10, minW: 4, minH: 4 },
      ],
    },
    exported_at: new Date().toISOString(),
  },
  {
    name: 'Performance Analyst',
    description: 'Data-driven layout with multiple performance views and comprehensive analysis',
    version: '1.0',
    layout_config: {
      lg: [
        // Top row - Return metrics
        { i: 'total-return', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'daily-gain', x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'unrealized-pnl', x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        { i: 'realized-pnl', x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        
        // Second row - Performance analysis
        { i: 'performance-metrics', x: 0, y: 2, w: 4, h: 5, minW: 3, minH: 4 },
        { i: 'win-rate', x: 4, y: 2, w: 4, h: 4, minW: 2, minH: 3 },
        { i: 'asset-allocation', x: 8, y: 2, w: 4, h: 9, minW: 3, minH: 6 },
        
        // Third row - Top & Worst performers
        { i: 'top-performers', x: 0, y: 7, w: 4, h: 7, minW: 3, minH: 3 },
        { i: 'worst-performers', x: 4, y: 6, w: 4, h: 7, minW: 3, minH: 3 },
        
        // Fourth row - Holdings and heatmap
        { i: 'largest-holdings', x: 0, y: 14, w: 4, h: 8, minW: 3, minH: 6 },
        { i: 'portfolio-heatmap', x: 4, y: 13, w: 8, h: 9, minW: 4, minH: 6 },
        
        // Bottom - Positions
        { i: 'positions', x: 0, y: 22, w: 12, h: 12, minW: 8, minH: 6 },
      ],
      md: [
        { i: 'total-return', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
        { i: 'daily-gain', x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
        { i: 'performance-metrics', x: 0, y: 2, w: 4, h: 5, minW: 3, minH: 4 },
        { i: 'win-rate', x: 4, y: 2, w: 4, h: 4, minW: 2, minH: 3 },
        { i: 'top-performers', x: 0, y: 7, w: 4, h: 7, minW: 3, minH: 3 },
        { i: 'worst-performers', x: 4, y: 6, w: 4, h: 7, minW: 3, minH: 3 },
        { i: 'asset-allocation', x: 0, y: 14, w: 4, h: 8, minW: 3, minH: 6 },
        { i: 'largest-holdings', x: 4, y: 13, w: 4, h: 8, minW: 3, minH: 6 },
        { i: 'positions', x: 0, y: 22, w: 8, h: 12, minW: 6, minH: 6 },
      ],
      sm: [
        { i: 'total-return', x: 0, y: 0, w: 4, h: 2, minW: 4, minH: 2 },
        { i: 'performance-metrics', x: 0, y: 2, w: 4, h: 5, minW: 3, minH: 4 },
        { i: 'win-rate', x: 0, y: 7, w: 4, h: 4, minW: 2, minH: 3 },
        { i: 'top-performers', x: 0, y: 11, w: 4, h: 7, minW: 3, minH: 3 },
        { i: 'positions', x: 0, y: 18, w: 4, h: 10, minW: 4, minH: 4 },
      ],
    },
    exported_at: new Date().toISOString(),
  },
]

/**
 * Get a predefined layout by name
 */
export const getPredefinedLayout = (name: string): DashboardLayoutExport | undefined => {
  return PREDEFINED_LAYOUTS.find(layout => layout.name === name)
}

/**
 * Get all predefined layout names
 */
export const getPredefinedLayoutNames = (): string[] => {
  return PREDEFINED_LAYOUTS.map(layout => layout.name)
}
