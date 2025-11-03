import React, { useMemo, useState, useEffect } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js';
import {
  BarChart3,
  PieChart as PieChartIcon,
  Globe,
  Building2,
  Layers,
  TrendingUp,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { getSectorIcon, getSectorColor, getIndustryIcon, getIndustryColor } from '../lib/sectorIcons';
import { getCountryCode } from '../lib/countryUtils';
import { getAssetLogoUrl, handleLogoError } from '../lib/logoUtils';
import { formatAssetType } from '../lib/formatUtils';
import api, { DistributionItemDTO } from '../lib/api';

Chart.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export interface HeldAsset {
  id: number;
  symbol: string;
  name: string;
  currency: string;
  class: string;
  sector: string | null;
  industry: string | null;
  asset_type: string | null;
  total_quantity: number;
  portfolio_count: number;
  country?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Position {
  asset_id: number;
  symbol: string;
  name: string | null;
  quantity: number;
  avg_cost: number;
  current_price: number | null;
  market_value: number | null;
  cost_basis: number;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  daily_change_pct: number | null;
  currency: string;
  last_updated: string | null;
}

interface AssetDistributionProps {
  assets: HeldAsset[];
  portfolioId?: number;
  currency?: string;
}

type DistributionType = 'sector' | 'type' | 'country';
type ChartType = 'pie' | 'bar';
type DetailedSortField = 'name' | 'count' | 'totalValue' | 'unrealizedPnl' | 'percentage';
type SortDirection = 'asc' | 'desc';

export default function AssetDistribution({ assets, portfolioId, currency = 'USD' }: AssetDistributionProps) {
  const [activeTab, setActiveTab] = useState<DistributionType>('sector');
  const [chartType, setChartType] = useState<ChartType>('pie');
  const [detailedSortField, setDetailedSortField] = useState<DetailedSortField>('percentage');
  const [detailedSortDirection, setDetailedSortDirection] = useState<SortDirection>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedIndustries, setExpandedIndustries] = useState<Set<string>>(new Set());
  const [industrySortField, setIndustrySortField] = useState<DetailedSortField>('percentage');
  const [industrySortDirection, setIndustrySortDirection] = useState<SortDirection>('desc');
  const [sectorIndustriesData, setSectorIndustriesData] = useState<Map<string, DistributionItemDTO[]>>(new Map());
  const [loadingIndustries, setLoadingIndustries] = useState<Set<string>>(new Set());
  const [assetSortField, setAssetSortField] = useState<'symbol' | 'name' | 'percentage' | 'totalValue' | 'unrealizedPnl'>('percentage');
  const [assetSortDirection, setAssetSortDirection] = useState<SortDirection>('desc');
  const [apiDistributionData, setApiDistributionData] = useState<DistributionItemDTO[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if we have performance data (requires portfolioId)
  const hasPerformanceData = portfolioId !== undefined;

  // Fetch distribution data from API
  useEffect(() => {
    const fetchDistribution = async () => {
      setLoading(true);
      try {
        let data: DistributionItemDTO[];
        switch (activeTab) {
          case 'sector':
            data = await api.getSectorsDistribution(portfolioId);
            break;
          case 'type':
            data = await api.getTypesDistribution(portfolioId);
            break;
          case 'country':
            data = await api.getCountriesDistribution(portfolioId);
            break;
          default:
            data = [];
        }
        setApiDistributionData(data);
      } catch (error) {
        console.error('Error fetching distribution data:', error);
        setApiDistributionData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDistribution();
  }, [activeTab, portfolioId]);

  // Fetch industry data when sector is expanded
  useEffect(() => {
    const fetchSectorIndustries = async () => {
      if (activeTab !== 'sector') return;
      
      for (const sectorName of expandedRows) {
        // Skip if we already have data for this sector
        if (sectorIndustriesData.has(sectorName)) continue;
        
        // Mark as loading
        setLoadingIndustries(prev => new Set(prev).add(sectorName));
        
        try {
          const data = await api.getSectorIndustriesDistribution(sectorName, portfolioId);
          setSectorIndustriesData(prev => new Map(prev).set(sectorName, data));
        } catch (error) {
          console.error(`Failed to fetch industries for sector ${sectorName}:`, error);
        } finally {
          setLoadingIndustries(prev => {
            const next = new Set(prev);
            next.delete(sectorName);
            return next;
          });
        }
      }
    };
    
    fetchSectorIndustries();
  }, [expandedRows, activeTab, portfolioId, sectorIndustriesData]);

  // Convert API data to DistributionItem format with asset details
  const distributionData = useMemo(() => {
    // Create a map of asset IDs for quick lookup
    const assetMap = new Map(assets.map(asset => [asset.id, asset]));

    return apiDistributionData.map(item => {
      // Get the actual asset objects for this distribution item
      const itemAssets = item.asset_ids
        .map(id => assetMap.get(id))
        .filter((asset): asset is HeldAsset => asset !== undefined);

      return {
        name: item.name,
        count: item.count,
        percentage: item.percentage,
        assets: itemAssets,
        totalValue: item.total_value,
        costBasis: item.cost_basis,
        unrealizedPnl: item.unrealized_pnl,
        unrealizedPnlPct: item.unrealized_pnl_pct,
        assetPositions: item.asset_positions, // Preserve asset positions for nested tables
      };
    });
  }, [apiDistributionData, assets]);

  // Sort data for chart (always by percentage descending)
  const chartSortedData = useMemo(() => {
    const sorted = [...distributionData];
    sorted.sort((a, b) => b.percentage - a.percentage);
    return sorted;
  }, [distributionData]);

  // Sort distribution data for table
  const detailedSortedData = useMemo(() => {
    const sorted = [...distributionData];
    sorted.sort((a, b) => {
      let compareValue = 0;
      switch (detailedSortField) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'count':
          compareValue = a.count - b.count;
          break;
        case 'totalValue':
          compareValue = (a.totalValue || 0) - (b.totalValue || 0);
          break;
        case 'unrealizedPnl':
          compareValue = (a.unrealizedPnl || 0) - (b.unrealizedPnl || 0);
          break;
        case 'percentage':
          compareValue = a.percentage - b.percentage;
          break;
      }
      return detailedSortDirection === 'asc' ? compareValue : -compareValue;
    });
    return sorted;
  }, [distributionData, detailedSortField, detailedSortDirection]);

  // Generate colors for charts
  const generateColors = (count: number) => {
    // If we're showing sectors, use sector-specific colors
    if (activeTab === 'sector') {
      return chartSortedData.map(item => {
        const sectorColorMap: Record<string, string> = {
          'Technology': '#3b82f6', // blue-500
          'Communication Services': '#a855f7', // purple-500
          'Telecommunications': '#8b5cf6', // violet-500
          'Healthcare': '#ef4444', // red-500
          'Health Care': '#ef4444', // red-500
          'Financial Services': '#10b981', // green-500
          'Financial': '#10b981', // green-500
          'Financials': '#10b981', // green-500
          'Energy': '#eab308', // yellow-500
          'Utilities': '#f59e0b', // amber-500
          'Consumer Cyclical': '#ec4899', // pink-500
          'Consumer Defensive': '#10b981', // emerald-500
          'Consumer Discretionary': '#ec4899', // pink-500
          'Consumer Staples': '#10b981', // emerald-500
          'Industrials': '#64748b', // slate-500
          'Industrial': '#64748b', // slate-500
          'Basic Materials': '#f97316', // orange-500
          'Materials': '#f97316', // orange-500
          'Real Estate': '#6366f1', // indigo-500
          'Unknown': '#9ca3af', // gray-400
        };
        return sectorColorMap[item.name] || '#9ca3af';
      });
    }
    
    // Default color palette for other tabs
    const baseColors = [
      '#f472b6', // pink
      '#60a5fa', // blue
      '#34d399', // green
      '#fbbf24', // yellow
      '#a78bfa', // purple
      '#f87171', // red
      '#818cf8', // indigo
      '#facc15', // amber
      '#4ade80', // emerald
      '#fb923c', // orange
      '#e879f9', // fuchsia
      '#38bdf8', // sky
      '#fb7185', // rose
      '#a3e635', // lime
    ];

    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  };

  // Format currency for display
  const formatCurrency = (value: number) => {
    // Handle NaN, null, undefined
    if (value == null || isNaN(value)) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(0);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    // Handle NaN, null, undefined
    if (value == null || isNaN(value)) {
      return '0.00%';
    }
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Chart data - use total value if available, otherwise use count
  const chartData = {
    labels: chartSortedData.map((item) => activeTab === 'type' ? formatAssetType(item.name) : item.name),
    datasets: [
      {
        label: hasPerformanceData ? 'Portfolio Value' : 'Assets',
        data: chartSortedData.map((item) => hasPerformanceData ? item.totalValue : item.count),
        backgroundColor: generateColors(chartSortedData.length),
        borderColor: 'rgba(255, 255, 255, 0.8)',
        borderWidth: 2,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          font: {
            size: 14,
          },
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        callbacks: {
          label: (context: { dataIndex: number }) => {
            const item = chartSortedData[context.dataIndex];
            const displayName = activeTab === 'type' ? formatAssetType(item.name) : item.name;
            if (hasPerformanceData) {
              return `${displayName}: ${formatCurrency(item.totalValue)} (${item.percentage.toFixed(1)}%)`;
            }
            return `${displayName}: ${item.count} assets (${item.percentage.toFixed(1)}%)`;
          },
        },
        padding: 12,
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 13,
        },
      },
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: { dataIndex: number }) => {
            const item = chartSortedData[context.dataIndex];
            if (hasPerformanceData) {
              return `${formatCurrency(item.totalValue)} (${item.percentage.toFixed(1)}%)`;
            }
            return `${item.count} assets (${item.percentage.toFixed(1)}%)`;
          },
        },
        padding: 12,
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 13,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          font: {
            size: 12,
          },
        },
      },
      y: {
        ticks: {
          font: {
            size: 13,
          },
        },
      },
    },
  };

  const handleDetailedSort = (field: DetailedSortField) => {
    if (detailedSortField === field) {
      setDetailedSortDirection(detailedSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setDetailedSortField(field);
      setDetailedSortDirection('desc');
    }
  };

  // Handle asset table sorting
  const handleAssetSort = (field: 'symbol' | 'name' | 'percentage' | 'totalValue' | 'unrealizedPnl') => {
    if (assetSortField === field) {
      setAssetSortDirection(assetSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setAssetSortField(field);
      setAssetSortDirection(field === 'symbol' || field === 'name' ? 'asc' : 'desc');
    }
  };

  // Sort assets helper function
  const sortAssets = (assets: HeldAsset[], assetPositions?: Array<{ asset_id: number; total_value: number; unrealized_pnl: number; percentage: number }>) => {
    return [...assets].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (assetSortField) {
        case 'symbol':
          aValue = a.symbol.toLowerCase();
          bValue = b.symbol.toLowerCase();
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'percentage':
          if (assetPositions) {
            const aPos = assetPositions.find(p => p.asset_id === a.id);
            const bPos = assetPositions.find(p => p.asset_id === b.id);
            aValue = aPos?.percentage ?? 0;
            bValue = bPos?.percentage ?? 0;
          } else {
            // All assets have equal percentage in their group
            aValue = a.symbol.toLowerCase();
            bValue = b.symbol.toLowerCase();
          }
          break;
        case 'totalValue':
          if (assetPositions) {
            const aPos = assetPositions.find(p => p.asset_id === a.id);
            const bPos = assetPositions.find(p => p.asset_id === b.id);
            aValue = aPos?.total_value ?? 0;
            bValue = bPos?.total_value ?? 0;
          } else {
            aValue = 0;
            bValue = 0;
          }
          break;
        case 'unrealizedPnl':
          if (assetPositions) {
            const aPos = assetPositions.find(p => p.asset_id === a.id);
            const bPos = assetPositions.find(p => p.asset_id === b.id);
            aValue = aPos?.unrealized_pnl ?? 0;
            bValue = bPos?.unrealized_pnl ?? 0;
          } else {
            aValue = 0;
            bValue = 0;
          }
          break;
        default:
          aValue = a.symbol.toLowerCase();
          bValue = b.symbol.toLowerCase();
      }

      if (aValue < bValue) return assetSortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return assetSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const toggleRow = (name: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedRows(newExpanded);
  };

  const toggleIndustry = (sectorName: string, industryName: string) => {
    const key = `${sectorName}:${industryName}`;
    const newExpanded = new Set(expandedIndustries);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedIndustries(newExpanded);
  };

  const DetailedSortIcon = ({ field }: { field: DetailedSortField }) => {
    if (detailedSortField !== field) {
      return <ArrowUpDown size={14} className="inline ml-1 opacity-40" />;
    }
    return detailedSortDirection === 'asc' ? (
      <ChevronUp size={14} className="inline ml-1 opacity-80" />
    ) : (
      <ChevronDown size={14} className="inline ml-1 opacity-80" />
    );
  };

  const IndustrySortIcon = ({ field }: { field: DetailedSortField }) => {
    if (industrySortField !== field) {
      return <ArrowUpDown size={12} className="inline ml-1 opacity-40" />;
    }
    return industrySortDirection === 'asc' ? (
      <ChevronUp size={12} className="inline ml-1 opacity-80" />
    ) : (
      <ChevronDown size={12} className="inline ml-1 opacity-80" />
    );
  };

  const AssetSortIcon = ({ field }: { field: 'symbol' | 'name' | 'percentage' | 'totalValue' | 'unrealizedPnl' }) => {
    if (assetSortField !== field) {
      return <ArrowUpDown size={12} className="inline ml-1 opacity-40" />;
    }
    return assetSortDirection === 'asc' ? (
      <ChevronUp size={12} className="inline ml-1 opacity-80" />
    ) : (
      <ChevronDown size={12} className="inline ml-1 opacity-80" />
    );
  };

  return (
    <div className="space-y-6">     
      {/* Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('sector')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              activeTab === 'sector'
                ? 'bg-white dark:bg-neutral-700 text-pink-600 dark:text-pink-400 shadow-sm font-medium'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Layers size={18} />
            <span className="hidden sm:inline">By Sector</span>
            <span className="sm:hidden">Sector</span>
          </button>
          <button
            onClick={() => setActiveTab('type')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              activeTab === 'type'
                ? 'bg-white dark:bg-neutral-700 text-pink-600 dark:text-pink-400 shadow-sm font-medium'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Building2 size={18} />
            <span className="hidden sm:inline">By Type</span>
            <span className="sm:hidden">Type</span>
          </button>
          <button
            onClick={() => setActiveTab('country')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              activeTab === 'country'
                ? 'bg-white dark:bg-neutral-700 text-pink-600 dark:text-pink-400 shadow-sm font-medium'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Globe size={18} />
            <span className="hidden sm:inline">By Country</span>
            <span className="sm:hidden">Country</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartType('pie')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              chartType === 'pie'
                ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <PieChartIcon size={16} />
            <span className="hidden sm:inline">Pie</span>
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              chartType === 'bar'
                ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <BarChart3 size={16} />
            <span className="hidden sm:inline">Bar</span>
          </button>
        </div>
      </div>

      {/* Chart and Table Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Chart */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 xl:col-span-2">
          <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            {chartType === 'pie' ? (
              <PieChartIcon size={20} className="text-pink-600 dark:text-pink-400" />
            ) : (
              <BarChart3 size={20} className="text-blue-600 dark:text-blue-400" />
            )}
            {activeTab === 'sector' && 'Sector Distribution'}
            {activeTab === 'type' && 'Asset Type Distribution'}
            {activeTab === 'country' && 'Country Distribution'}
          </h3>
          <div className="h-96 sm:h-[500px]">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="space-y-3 w-full">
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse w-3/4 mx-auto"></div>
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse w-1/2 mx-auto"></div>
                  <div className="h-40 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse mx-auto" style={{ width: '160px' }}></div>
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse w-2/3 mx-auto"></div>
                </div>
              </div>
            ) : chartType === 'pie' ? (
              <Pie data={chartData} options={pieOptions} />
            ) : (
              <Bar data={chartData} options={barOptions} />
            )}
          </div>
        </div>

        {/* Distribution Table with Expandable Details */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden xl:col-span-3">
          <div className="p-6 pb-0">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2 mb-4">
              <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
              Distribution {hasPerformanceData && '& Performance'}
            </h3>
          </div>
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-12 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse flex-1"></div>
                </div>
              ))}
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800 border-y border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th 
                    onClick={() => handleDetailedSort('name')}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {activeTab === 'sector' && 'Sector'}
                    {activeTab === 'type' && 'Type'}
                    {activeTab === 'country' && 'Country'}
                    <DetailedSortIcon field="name" />
                  </th>
                  <th 
                    onClick={() => handleDetailedSort('count')}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Assets
                    <DetailedSortIcon field="count" />
                  </th>
                  {hasPerformanceData && (
                    <>
                      <th 
                        onClick={() => handleDetailedSort('totalValue')}
                        className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        Total Value
                        <DetailedSortIcon field="totalValue" />
                      </th>
                      <th 
                        onClick={() => handleDetailedSort('unrealizedPnl')}
                        className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        Unrealized P&L
                        <DetailedSortIcon field="unrealizedPnl" />
                      </th>
                    </>
                  )}
                  <th 
                    onClick={() => handleDetailedSort('percentage')}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    % of Portfolio
                    <DetailedSortIcon field="percentage" />
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {detailedSortedData.map((item) => (
                  <React.Fragment key={item.name}>
                    <tr
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {activeTab === 'sector' && (() => {
                            const SectorIcon = getSectorIcon(item.name);
                            return <SectorIcon size={18} className={getSectorColor(item.name)} />;
                          })()}
                          {activeTab === 'country' && (
                            <>
                              {getCountryCode(item.name) ? (
                                <img
                                  src={`https://flagcdn.com/w40/${getCountryCode(item.name)}.png`}
                                  alt={`${item.name} flag`}
                                  loading="lazy"
                                  className="w-6 h-4 object-cover rounded shadow-sm"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.display = 'none';
                                    const globe = document.createElement('span');
                                    globe.textContent = '🌍';
                                    globe.className = 'text-lg';
                                    img.parentElement?.appendChild(globe);
                                  }}
                                />
                              ) : (
                                <span className="text-lg">🌍</span>
                              )}
                            </>
                          )}
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {activeTab === 'type' ? formatAssetType(item.name) : item.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        {item.count}
                      </span>
                    </td>
                    {hasPerformanceData && (
                      <>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {formatCurrency(item.totalValue)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className={`text-sm font-semibold ${item.unrealizedPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(item.unrealizedPnl)}
                          </div>
                          <div className={`text-xs font-medium ${item.unrealizedPnlPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatPercentage(item.unrealizedPnlPct)}
                          </div>
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-pink-600 dark:text-pink-400">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleRow(item.name)}
                        className="text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors"
                      >
                        {expandedRows.has(item.name) ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        )}
                      </button>
                    </td>
                  </tr>
                  {expandedRows.has(item.name) && (
                    <tr key={`${item.name}-details`}>
                      <td colSpan={hasPerformanceData ? 6 : 4} className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50">
                        {activeTab === 'sector' ? (
                          // Show industry breakdown for sectors
                          <div className="space-y-2">
                            <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
                              Industries in {item.name}
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full">
                                <thead>
                                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                      Industry
                                    </th>
                                    <th 
                                      className="px-4 py-2 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                      onClick={() => {
                                        if (industrySortField === 'count') {
                                          setIndustrySortDirection(industrySortDirection === 'asc' ? 'desc' : 'asc');
                                        } else {
                                          setIndustrySortField('count');
                                          setIndustrySortDirection('desc');
                                        }
                                      }}
                                    >
                                      Assets
                                      <IndustrySortIcon field="count" />
                                    </th>
                                    {hasPerformanceData && (
                                      <>
                                        <th 
                                          className="px-4 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                          onClick={() => {
                                            if (industrySortField === 'totalValue') {
                                              setIndustrySortDirection(industrySortDirection === 'asc' ? 'desc' : 'asc');
                                            } else {
                                              setIndustrySortField('totalValue');
                                              setIndustrySortDirection('desc');
                                            }
                                          }}
                                        >
                                          Total Value
                                          <IndustrySortIcon field="totalValue" />
                                        </th>
                                        <th 
                                          className="px-4 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                          onClick={() => {
                                            if (industrySortField === 'unrealizedPnl') {
                                              setIndustrySortDirection(industrySortDirection === 'asc' ? 'desc' : 'asc');
                                            } else {
                                              setIndustrySortField('unrealizedPnl');
                                              setIndustrySortDirection('desc');
                                            }
                                          }}
                                        >
                                          Unrealized P&L
                                          <IndustrySortIcon field="unrealizedPnl" />
                                        </th>
                                      </>
                                    )}
                                    <th 
                                      className="px-4 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                      onClick={() => {
                                        if (industrySortField === 'percentage') {
                                          setIndustrySortDirection(industrySortDirection === 'asc' ? 'desc' : 'asc');
                                        } else {
                                          setIndustrySortField('percentage');
                                          setIndustrySortDirection('desc');
                                        }
                                      }}
                                    >
                                      % of Sector
                                      <IndustrySortIcon field="percentage" />
                                    </th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                      Details
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    // Get industry data from API if available, otherwise show loading
                                    const sectorIndustries = sectorIndustriesData.get(item.name);
                                    const isLoadingSector = loadingIndustries.has(item.name);
                                    
                                    if (isLoadingSector) {
                                      return (
                                        <tr>
                                          <td colSpan={hasPerformanceData ? 6 : 4} className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                                            Loading industries...
                                          </td>
                                        </tr>
                                      );
                                    }
                                    
                                    if (!sectorIndustries || sectorIndustries.length === 0) {
                                      return (
                                        <tr>
                                          <td colSpan={hasPerformanceData ? 6 : 4} className="px-4 py-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
                                            No industries found
                                          </td>
                                        </tr>
                                      );
                                    }
                                    
                                    // Apply sorting to API data
                                    const sortedIndustries = [...sectorIndustries].sort((a, b) => {
                                      let aValue: number, bValue: number;
                                      
                                      switch (industrySortField) {
                                        case 'count':
                                          aValue = a.count;
                                          bValue = b.count;
                                          break;
                                        case 'totalValue':
                                          aValue = a.total_value;
                                          bValue = b.total_value;
                                          break;
                                        case 'unrealizedPnl':
                                          aValue = a.unrealized_pnl;
                                          bValue = b.unrealized_pnl;
                                          break;
                                        case 'percentage':
                                          aValue = a.percentage;
                                          bValue = b.percentage;
                                          break;
                                        default:
                                          aValue = a.count;
                                          bValue = b.count;
                                      }
                                      
                                      return industrySortDirection === 'asc' ? aValue - bValue : bValue - aValue;
                                    });
                                    
                                    return sortedIndustries.map(industry => {
                                      const industryKey = `${item.name}:${industry.name}`;
                                      const isExpanded = expandedIndustries.has(industryKey);
                                      const IndustryIcon = getIndustryIcon(industry.name);
                                      
                                      // Get actual asset objects for this industry
                                      const assetMap = new Map(item.assets.map(a => [a.id, a]));
                                      const industryAssets = industry.asset_ids
                                        .map(id => assetMap.get(id))
                                        .filter((asset): asset is HeldAsset => asset !== undefined);
                                      
                                      return (
                                        <React.Fragment key={industry.name}>
                                          <tr className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-900 transition-colors">
                                            <td className="px-4 py-3">
                                              <div className="flex items-center gap-2">
                                                <IndustryIcon size={16} className={getIndustryColor(industry.name)} />
                                                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                                  {industry.name}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-neutral-600 dark:text-neutral-400">
                                              {industry.count}
                                            </td>
                                            {hasPerformanceData && (
                                              <>
                                                <td className="px-4 py-3 text-right text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                                  {formatCurrency(industry.total_value)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                  <div className="flex flex-col items-end gap-0.5">
                                                    <span className={`text-sm font-medium ${
                                                      industry.unrealized_pnl >= 0
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-red-600 dark:text-red-400'
                                                    }`}>
                                                      {industry.unrealized_pnl >= 0 ? '+' : ''}
                                                      {formatCurrency(industry.unrealized_pnl)}
                                                    </span>
                                                  </div>
                                                </td>
                                              </>
                                            )}
                                            <td className="px-4 py-3 text-right">
                                              <span className="text-sm font-semibold text-pink-600 dark:text-pink-400">
                                                {industry.percentage.toFixed(1)}%
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              <button
                                                onClick={() => toggleIndustry(item.name, industry.name)}
                                                className="text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors"
                                              >
                                                {isExpanded ? (
                                                  <ChevronUp size={16} />
                                                ) : (
                                                  <ChevronDown size={16} />
                                                )}
                                              </button>
                                            </td>
                                          </tr>
                                          {isExpanded && (
                                            <tr key={`${industry.name}-assets`}>
                                              <td colSpan={hasPerformanceData ? 6 : 4} className="px-4 py-2 bg-white dark:bg-neutral-900">
                                                <table className="min-w-full">
                                                  <thead>
                                                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                                                      <th 
                                                        className="px-3 py-2 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                                        onClick={() => handleAssetSort('symbol')}
                                                      >
                                                        Symbol
                                                        <AssetSortIcon field="symbol" />
                                                      </th>
                                                      <th 
                                                        className="px-3 py-2 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                                        onClick={() => handleAssetSort('name')}
                                                      >
                                                        Name
                                                        <AssetSortIcon field="name" />
                                                      </th>
                                                      {hasPerformanceData && (
                                                        <>
                                                          <th 
                                                            className="px-3 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                                            onClick={() => handleAssetSort('totalValue')}
                                                          >
                                                            Total Value
                                                            <AssetSortIcon field="totalValue" />
                                                          </th>
                                                          <th 
                                                            className="px-3 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                                            onClick={() => handleAssetSort('unrealizedPnl')}
                                                          >
                                                            Unrealized P&L
                                                            <AssetSortIcon field="unrealizedPnl" />
                                                          </th>
                                                        </>
                                                      )}
                                                      <th 
                                                        className="px-3 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                                        onClick={() => handleAssetSort('percentage')}
                                                      >
                                                        % of Industry
                                                        <AssetSortIcon field="percentage" />
                                                      </th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {sortAssets(industryAssets, industry.asset_positions).map((asset) => {
                                                      // Get position data if available
                                                      const assetPosition = industry.asset_positions?.find(p => p.asset_id === asset.id);
                                                      const assetPercentage = assetPosition?.percentage ?? (1 / industryAssets.length) * 100;
                                                      
                                                      return (
                                                        <tr key={asset.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                                                          <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                                                <img
                                                                  src={getAssetLogoUrl(asset.symbol, asset.asset_type, asset.name)}
                                                                  alt={asset.symbol}
                                                                  loading="lazy"
                                                                  className="w-6 h-6 object-contain"
                                                                  onError={(e) => handleLogoError(e, asset.symbol, asset.name, asset.asset_type)}
                                                                />
                                                              </div>
                                                              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                                                {asset.symbol}
                                                              </span>
                                                            </div>
                                                          </td>
                                                          <td className="px-3 py-2">
                                                            <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate max-w-xs block">
                                                              {asset.name}
                                                            </span>
                                                          </td>
                                                          {hasPerformanceData && (
                                                            <>
                                                              <td className="px-3 py-2 text-right">
                                                                <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                                                                  {assetPosition ? formatCurrency(assetPosition.total_value) : '-'}
                                                                </span>
                                                              </td>
                                                              <td className="px-3 py-2 text-right">
                                                                <span className={`text-xs font-medium ${
                                                                  assetPosition && assetPosition.unrealized_pnl >= 0
                                                                    ? 'text-green-600 dark:text-green-400'
                                                                    : 'text-red-600 dark:text-red-400'
                                                                }`}>
                                                                  {assetPosition ? (
                                                                    <>
                                                                      {assetPosition.unrealized_pnl >= 0 ? '+' : ''}
                                                                      {formatCurrency(assetPosition.unrealized_pnl)}
                                                                    </>
                                                                  ) : '-'}
                                                                </span>
                                                              </td>
                                                            </>
                                                          )}
                                                          <td className="px-3 py-2 text-right">
                                                            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                                              {assetPercentage.toFixed(1)}%
                                                            </span>
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          // Show asset table for other tabs (type, country)
                          <div className="overflow-x-auto">
                            <table className="min-w-full">
                              <thead>
                                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                                  <th 
                                    className="px-3 py-2 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                    onClick={() => handleAssetSort('symbol')}
                                  >
                                    Symbol
                                    <AssetSortIcon field="symbol" />
                                  </th>
                                  <th 
                                    className="px-3 py-2 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                    onClick={() => handleAssetSort('name')}
                                  >
                                    Name
                                    <AssetSortIcon field="name" />
                                  </th>
                                  {hasPerformanceData && (
                                    <>
                                      <th 
                                        className="px-3 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                        onClick={() => handleAssetSort('totalValue')}
                                      >
                                        Total Value
                                        <AssetSortIcon field="totalValue" />
                                      </th>
                                      <th 
                                        className="px-3 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                        onClick={() => handleAssetSort('unrealizedPnl')}
                                      >
                                        Unrealized P&L
                                        <AssetSortIcon field="unrealizedPnl" />
                                      </th>
                                    </>
                                  )}
                                  <th 
                                    className="px-3 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                                    onClick={() => handleAssetSort('percentage')}
                                  >
                                    % of {activeTab === 'country' ? 'Country' : activeTab === 'type' ? 'Type' : 'Group'}
                                    <AssetSortIcon field="percentage" />
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  // Use asset positions from the item
                                  const assetPositions = item.assetPositions;
                                  
                                  return sortAssets(item.assets, assetPositions).map((asset) => {
                                    // Get position data if available
                                    const assetPosition = assetPositions?.find(p => p.asset_id === asset.id);
                                    const assetPercentage = assetPosition?.percentage ?? (1 / item.assets.length) * 100;
                                    
                                    return (
                                      <tr key={asset.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                                        <td className="px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                              <img
                                                src={getAssetLogoUrl(asset.symbol, asset.asset_type, asset.name)}
                                                alt={asset.symbol}
                                                loading="lazy"
                                                className="w-6 h-6 object-contain"
                                                onError={(e) => handleLogoError(e, asset.symbol, asset.name, asset.asset_type)}
                                              />
                                            </div>
                                            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                              {asset.symbol}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate max-w-xs block">
                                            {asset.name}
                                          </span>
                                        </td>
                                        {hasPerformanceData && (
                                          <>
                                            <td className="px-3 py-2 text-right">
                                              <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                                                {assetPosition ? formatCurrency(assetPosition.total_value) : '-'}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                              <span className={`text-xs font-medium ${
                                                assetPosition && assetPosition.unrealized_pnl >= 0
                                                  ? 'text-green-600 dark:text-green-400'
                                                  : 'text-red-600 dark:text-red-400'
                                              }`}>
                                                {assetPosition ? (
                                                  <>
                                                    {assetPosition.unrealized_pnl >= 0 ? '+' : ''}
                                                    {formatCurrency(assetPosition.unrealized_pnl)}
                                                  </>
                                                ) : '-'}
                                              </span>
                                            </td>
                                          </>
                                        )}
                                        <td className="px-3 py-2 text-right">
                                          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                            {assetPercentage.toFixed(1)}%
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
