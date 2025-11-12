import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { PositionDTO } from '@/lib/api'

/**
 * Centralized mock data for all widget previews
 */

// Mock positions for widgets that need position data
export const mockPositions: PositionDTO[] = [
  {
    asset_id: 1,
    symbol: 'AAPL',
    name: 'Apple Inc.',
    asset_type: 'STOCK',
    quantity: 10,
    avg_cost: 150.00,
    current_price: 175.50,
    market_value: 1755.00,
    cost_basis: 1500.00,
    unrealized_pnl: 255.00,
    unrealized_pnl_pct: 17.00,
    daily_change_pct: 3.24,
    currency: 'EUR',
    last_updated: '2025-11-10T12:00:00Z',
  },
  {
    asset_id: 2,
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    asset_type: 'STOCK',
    quantity: 8,
    avg_cost: 320.00,
    current_price: 380.25,
    market_value: 3042.00,
    cost_basis: 2560.00,
    unrealized_pnl: 482.00,
    unrealized_pnl_pct: 18.83,
    daily_change_pct: 2.22,
    currency: 'EUR',
    last_updated: '2025-11-10T12:00:00Z',
  },
  {
    asset_id: 3,
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    asset_type: 'STOCK',
    quantity: 15,
    avg_cost: 135.00,
    current_price: 142.80,
    market_value: 2142.00,
    cost_basis: 2025.00,
    unrealized_pnl: 117.00,
    unrealized_pnl_pct: 5.78,
    daily_change_pct: -1.52,
    currency: 'EUR',
    last_updated: '2025-11-10T12:00:00Z',
  },
  {
    asset_id: 4,
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    asset_type: 'STOCK',
    quantity: 5,
    avg_cost: 220.00,
    current_price: 195.30,
    market_value: 976.50,
    cost_basis: 1100.00,
    unrealized_pnl: -123.50,
    unrealized_pnl_pct: -11.23,
    daily_change_pct: -2.85,
    currency: 'EUR',
    last_updated: '2025-11-10T12:00:00Z',
  },
  {
    asset_id: 5,
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    asset_type: 'STOCK',
    quantity: 12,
    avg_cost: 380.00,
    current_price: 485.60,
    market_value: 5827.20,
    cost_basis: 4560.00,
    unrealized_pnl: 1267.20,
    unrealized_pnl_pct: 27.79,
    daily_change_pct: 5.12,
    currency: 'EUR',
    last_updated: '2025-11-10T12:00:00Z',
  },
]

// Mock metrics for metric widgets
export const mockMetrics = {
  total_value: 11174.56,
  daily_change_value: 373.98,
  daily_change_pct: 3.46,
  total_unrealized_pnl: 1637.07,
  total_unrealized_pnl_pct: 17.16,
  total_realized_pnl: 181.84,
  total_dividends: 0,
  total_fees: 122.00,
}

// Mock performance metrics for PerformanceMetricsWidget
export const mockPerformanceMetrics = {
  weeklyReturn: 2.34,
  monthlyReturn: 5.67,
  ytdReturn: 17.16,
}

// Mock notifications for NotificationsWidget
const mockNotifications = [
  {
    id: 1,
    type: 'price_alert',
    title: 'AAPL Price Alert',
    message: 'Apple reached your target price of $175',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
    read: false,
  },
  {
    id: 2,
    type: 'daily_change',
    title: 'Portfolio Up 3.46%',
    message: 'Your portfolio gained €373.98 today',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    read: false,
  },
  {
    id: 3,
    type: 'transaction',
    title: 'Dividend Received',
    message: 'MSFT paid dividend of €15.50',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    read: true,
  },
]

const mockWatchlist = [
  {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    price: 145.80,
    change_pct: 2.34,
    asset_type: 'STOCK',
  },
  {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    price: 325.60,
    change_pct: -1.22,
    asset_type: 'STOCK',
  },
  {
    symbol: 'NFLX',
    name: 'Netflix Inc.',
    price: 465.90,
    change_pct: 3.78,
    asset_type: 'STOCK',
  },
]

const mockTopPerformers = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    return_pct: 27.79,
    value: 5827.20,
    market_value: 5827.20,
    asset_type: 'STOCK',
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    return_pct: 18.83,
    value: 3042.00,
    market_value: 3042.00,
    asset_type: 'STOCK',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    return_pct: 17.00,
    value: 1755.00,
    market_value: 1755.00,
    asset_type: 'STOCK',
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    return_pct: 5.78,
    value: 2142.00,
    market_value: 2142.00,
    asset_type: 'STOCK',
  },
]

const mockWorstPerformers = [
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    return_pct: -11.23,
    value: 976.50,
    market_value: 976.50,
    asset_type: 'STOCK',
  },
]

const mockTransactions = [
  {
    id: 1,
    portfolio_id: 1,
    asset_id: 1,
    type: 'BUY',
    tx_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    quantity: 5,
    price: 175.50,
    fees: 2.50,
    notes: null,
    asset: {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      asset_type: 'STOCK',
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: 2,
    portfolio_id: 1,
    asset_id: 2,
    type: 'DIVIDEND',
    tx_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    quantity: 8,
    price: 1.94,
    fees: 0,
    notes: 'Quarterly dividend',
    asset: {
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      asset_type: 'STOCK',
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: 3,
    portfolio_id: 1,
    asset_id: 5,
    type: 'BUY',
    tx_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    quantity: 12,
    price: 380.00,
    fees: 5.00,
    notes: null,
    asset: {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      asset_type: 'STOCK',
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
]

const mockMarketStatus = {
  market_status: 'open', // or 'closed', 'premarket', 'afterhours'
  market_statuses: {
    us: 'open',
    europe: 'closed',
    asia: 'closed',
    oceania: 'closed',
  },
}

const mockMarketIndices = {
  '^GSPC': {
    symbol: '^GSPC',
    name: 'S&P 500',
    current_price: 4558.32,
    percent_change: 0.85,
  },
  '^DJI': {
    symbol: '^DJI',
    name: 'Dow Jones',
    current_price: 35428.67,
    percent_change: -0.23,
  },
  '^IXIC': {
    symbol: '^IXIC',
    name: 'Nasdaq',
    current_price: 14258.49,
    percent_change: 1.34,
  },
  '^FTSE': {
    symbol: '^FTSE',
    name: 'FTSE 100',
    current_price: 7456.78,
    percent_change: -0.15,
  },
  '^GDAXI': {
    symbol: '^GDAXI',
    name: 'DAX',
    current_price: 15678.23,
    percent_change: 0.42,
  },
}

export const mockSectorsDistribution = [
  { 
    name: 'Technology', 
    percentage: 35.5, 
    total_value: 3967.07,
    count: 3,
    cost_basis: 3200.00,
    unrealized_pnl: 767.07,
    unrealized_pnl_pct: 23.97,
    asset_ids: [2, 5],
  },
  { 
    name: 'Communication Services', 
    percentage: 19.2, 
    total_value: 2142.00,
    count: 1,
    cost_basis: 2025.00,
    unrealized_pnl: 117.00,
    unrealized_pnl_pct: 5.78,
    asset_ids: [3],
  },
  { 
    name: 'Consumer Cyclical', 
    percentage: 26.1, 
    total_value: 2919.50,
    count: 2,
    cost_basis: 3355.00,
    unrealized_pnl: -435.50,
    unrealized_pnl_pct: -12.98,
    asset_ids: [4],
  },
  { 
    name: 'Consumer Defensive', 
    percentage: 15.7, 
    total_value: 1755.00,
    count: 1,
    cost_basis: 1500.00,
    unrealized_pnl: 255.00,
    unrealized_pnl_pct: 17.00,
    asset_ids: [1],
  },
  { 
    name: 'Financial Services', 
    percentage: 3.5, 
    total_value: 390.99,
    count: 1,
    cost_basis: 375.00,
    unrealized_pnl: 15.99,
    unrealized_pnl_pct: 4.26,
    asset_ids: [6],
  },
]

export const mockTypesDistribution = [
  { 
    name: 'STOCK', 
    percentage: 85.3, 
    total_value: 9531.70,
    count: 5,
    cost_basis: 8080.00,
    unrealized_pnl: 1451.70,
    unrealized_pnl_pct: 17.97,
    asset_ids: [1, 2, 3, 4, 5],
  },
  { 
    name: 'ETF', 
    percentage: 10.5, 
    total_value: 1173.29,
    count: 2,
    cost_basis: 1100.00,
    unrealized_pnl: 73.29,
    unrealized_pnl_pct: 6.66,
    asset_ids: [6, 7],
  },
  { 
    name: 'CRYPTO', 
    percentage: 4.2, 
    total_value: 469.57,
    count: 1,
    cost_basis: 500.00,
    unrealized_pnl: -30.43,
    unrealized_pnl_pct: -6.09,
    asset_ids: [8],
  },
]

export const mockCountriesDistribution = [
  { 
    name: 'United States', 
    percentage: 78.5, 
    total_value: 8772.03,
    count: 4,
    cost_basis: 7480.00,
    unrealized_pnl: 1292.03,
    unrealized_pnl_pct: 17.27,
    asset_ids: [1, 2, 4, 5],
  },
  { 
    name: 'Germany', 
    percentage: 12.3, 
    total_value: 1374.47,
    count: 2,
    cost_basis: 1275.00,
    unrealized_pnl: 99.47,
    unrealized_pnl_pct: 7.80,
    asset_ids: [6],
  },
  { 
    name: 'United Kingdom', 
    percentage: 5.8, 
    total_value: 648.12,
    count: 1,
    cost_basis: 625.00,
    unrealized_pnl: 23.12,
    unrealized_pnl_pct: 3.70,
    asset_ids: [7],
  },
  { 
    name: 'France', 
    percentage: 3.4, 
    total_value: 379.94,
    count: 1,
    cost_basis: 400.00,
    unrealized_pnl: -20.06,
    unrealized_pnl_pct: -5.02,
    asset_ids: [3],
  },
]

// Mock market indicator data
export const mockVIXData = {
  price: 17.28,
  change_pct: -0.5,
}

export const mockTNXData = {
  price: 4.32,
  change_pct: 0.15,
}

export const mockDXYData = {
  price: 103.45,
  change_pct: -0.23,
}

export const mockBitcoinPizzaData = {
  btc_price: 43250.80,
  pizza_value: 432508000, // 10,000 BTC value
}

export const mockSentimentData = {
  stock: {
    sentiment: 'bullish',
    score: 72,
    fear_greed_index: 68,
  },
  crypto: {
    sentiment: 'neutral',
    score: 54,
    fear_greed_index: 52,
  },
}

// Mock risk metrics data
export const mockRiskMetrics = {
  volatility: 18.5,
  sharpe_ratio: 1.42,
  max_drawdown: -12.3,
  var_95: -2.5,
  downside_deviation: 12.1,
  beta: 0.95,
}

// Mock benchmark comparison data
export const mockBenchmarkData = {
  alpha: 2.3,
  r_squared: 85.4,
}

// Mock goal tracker data
export const mockGoalData = {
  target: 15000.00,
  current: 11174.56,
  percentage: 74.5,
}

// Mock holding period data
export const mockHoldingPeriod = {
  average_days: 127,
  median_days: 95,
  longest_days: 387,
  shortest_days: 12,
}



/**
 * Create a mock QueryClient that returns fake data for preview mode
 */
export function createMockQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: async ({ queryKey }) => {
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 100))
          
          const key = queryKey[0] as string
          
          // Return mock data based on query key
          if (key === 'notifications' || key.includes('notifications')) {
            return mockNotifications
          }
          if (key === 'watchlist' || key.includes('watchlist')) {
            return mockWatchlist
          }
          if (key === 'top-performers' || key.includes('top-performers')) {
            return mockTopPerformers
          }
          if (key === 'worst-performers' || key.includes('worst-performers')) {
            return mockWorstPerformers
          }
          if (key === 'recent-transactions' || key.includes('recent-transactions')) {
            return mockTransactions
          }
          if (key === 'market-status' || key.includes('market-status')) {
            return mockMarketStatus
          }
          if (key === 'market-indices' || key.includes('market-indices')) {
            return mockMarketIndices
          }
          if (key === 'performance-metrics' || key.includes('performance')) {
            return mockPerformanceMetrics
          }
          if (key === 'sectors-distribution' || key.includes('sectors')) {
            return mockSectorsDistribution
          }
          if (key === 'types-distribution' || key.includes('types')) {
            return mockTypesDistribution
          }
          if (key === 'countries-distribution' || key.includes('countries')) {
            return mockCountriesDistribution
          }
          if (key === 'vix' || key.includes('vix')) {
            return mockVIXData
          }
          if (key === 'tnx' || key.includes('tnx')) {
            return mockTNXData
          }
          if (key === 'dxy' || key.includes('dxy')) {
            return mockDXYData
          }
          if (key === 'bitcoin-pizza' || key.includes('bitcoin')) {
            return mockBitcoinPizzaData
          }
          if (key === 'sentiment' || key.includes('sentiment')) {
            return mockSentimentData
          }
          if (key === 'risk-metrics' || key.includes('risk')) {
            return mockRiskMetrics
          }
          if (key === 'benchmark' || key.includes('benchmark')) {
            return mockBenchmarkData
          }
          if (key === 'goal' || key.includes('goal')) {
            return mockGoalData
          }
          if (key === 'holding-period' || key.includes('holding')) {
            return mockHoldingPeriod
          }
          
          // Default empty response
          return null
        },
        retry: false,
        staleTime: Infinity,
      },
    },
  })
}

/**
 * Wrapper component that provides mock QueryClient for previews
 */
export function MockDataProvider({ children }: { children: ReactNode }) {
  const mockQueryClient = createMockQueryClient()
  
  return (
    <QueryClientProvider client={mockQueryClient}>
      {children}
    </QueryClientProvider>
  )
}
