import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Package, RefreshCw, Archive, ChevronUp, ChevronDown, Shuffle, TrendingUp, LineChart, Activity, Search, X, BarChart3, Edit } from 'lucide-react';
import api from '../lib/api';
import { getAssetLogoUrl, handleLogoError } from '../lib/logoUtils';
import { getSectorIcon, getIndustryIcon, getSectorColor, getIndustryColor } from '../lib/sectorIndustryUtils';
import { getCountryCode } from '../lib/countryUtils';
import { formatAssetType } from '../lib/formatUtils';
import AssetDistribution from '../components/AssetDistribution';
import SplitHistory from '../components/SplitHistory';
import TransactionHistory from '../components/TransactionHistory';
import AssetPriceChart from '../components/AssetPriceChart';
import SortIcon from '../components/SortIcon';
import AssetPriceDebug from '../components/AssetPriceDebug';
import AssetMetadataEdit from '../components/AssetMetadataEdit';
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt';
import EmptyTransactionsPrompt from '../components/EmptyTransactionsPrompt';
import usePortfolioStore from '../store/usePortfolioStore';
import { useTranslation } from 'react-i18next'
import { getTranslatedSector, getTranslatedIndustry } from '../lib/translationUtils'

interface HeldAsset {
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
  split_count?: number;
  transaction_count?: number;
  country: string | null;
  effective_sector?: string | null;
  effective_industry?: string | null;
  effective_country?: string | null;
  created_at: string;
  updated_at: string;
}

const sortableColumns = [
  'symbol',
  'name',
  'class',
  'country',
  'asset_type',
  'sector',
  'industry',
  'total_quantity',
  'portfolio_count',
] as const
type SortKey = typeof sortableColumns[number]
type SortDir = 'asc' | 'desc';

export default function Assets() {

  const { portfolios, activePortfolioId } = usePortfolioStore()
  const [heldAssets, setHeldAssets] = useState<HeldAsset[]>([]);
  const [soldAssets, setSoldAssets] = useState<HeldAsset[]>([]);
  const [portfolioAssetIds, setPortfolioAssetIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showSold, setShowSold] = useState(() => {
    const saved = localStorage.getItem('assets-show-sold');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [splitHistoryAsset, setSplitHistoryAsset] = useState<{ id: number; symbol: string } | null>(null);
  const [transactionHistoryAsset, setTransactionHistoryAsset] = useState<{ id: number; symbol: string } | null>(null);
  const [priceChartAsset, setPriceChartAsset] = useState<{ id: number; symbol: string; currency: string } | null>(null);
  const [debugAsset, setDebugAsset] = useState<{ id: number; symbol: string } | null>(null);
  const [editAsset, setEditAsset] = useState<HeldAsset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const distributionRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // Load portfolio asset IDs when active portfolio changes
  useEffect(() => {
    const loadPortfolioAssetIds = async () => {
      if (!activePortfolioId) {
        setPortfolioAssetIds(new Set());
        return;
      }

      try {
        const [currentPositions, soldPositions] = await Promise.all([
          api.getPortfolioPositions(activePortfolioId),
          api.getSoldPositions(activePortfolioId)
        ]);
        const currentAssetIds = currentPositions.map(p => p.asset_id);
        const soldAssetIds = soldPositions.map(p => p.asset_id);
        const allAssetIds = new Set([...currentAssetIds, ...soldAssetIds]);
        setPortfolioAssetIds(allAssetIds);
      } catch (err) {
        console.error('Error loading portfolio asset IDs:', err);
        setPortfolioAssetIds(new Set());
      }
    };

    loadPortfolioAssetIds();
  }, [activePortfolioId]);

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load both asset lists and portfolio asset IDs if there's an active portfolio
      const promises = [
        api.getHeldAssets(activePortfolioId || undefined),
        api.getSoldAssets(activePortfolioId || undefined)
      ];
      
      if (activePortfolioId) {
        promises.push(
          api.getPortfolioPositions(activePortfolioId).then(positions => positions.map(p => p.asset_id)),
          api.getSoldPositions(activePortfolioId).then(positions => positions.map(p => p.asset_id))
        );
      }
      
      const results = await Promise.all(promises);
      const [held, sold] = results as [HeldAsset[], HeldAsset[], number[]?, number[]?];
      
      setHeldAssets(held);
      setSoldAssets(sold);
      
      // Update portfolio asset IDs if they were loaded
      if (activePortfolioId && results.length > 2) {
        const currentAssetIds = results[2] as number[];
        const soldAssetIds = results[3] as number[];
        const allAssetIds = new Set([...currentAssetIds, ...soldAssetIds]);
        setPortfolioAssetIds(allAssetIds);
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to load assets');
      console.error('Error loading assets:', err);
    } finally {
      setLoading(false);
    }
  }, [activePortfolioId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    localStorage.setItem('assets-show-sold', JSON.stringify(showSold));
  }, [showSold]);

  // Prevent body scroll when modals are open
  useEffect(() => {
    if (splitHistoryAsset || transactionHistoryAsset || priceChartAsset || debugAsset || editAsset) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [splitHistoryAsset, transactionHistoryAsset, priceChartAsset, debugAsset, editAsset])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedAssets = useMemo(() => {
    let combined = [...heldAssets];
    if (showSold) {
      combined = [...heldAssets, ...soldAssets];
    }
    
    // Filter by active portfolio if one is selected
    if (activePortfolioId && portfolioAssetIds.size > 0) {
      combined = combined.filter(asset => portfolioAssetIds.has(asset.id));
    }
    
    // Filter by search query (symbol and name only)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      combined = combined.filter(asset => {
        const symbol = asset.symbol.toLowerCase();
        const name = (asset.name || '').toLowerCase();
        
        return symbol.includes(query) || name.includes(query);
      });
    }
    
    const keyTypes = {
      symbol: 'string',
      name: 'string',
      class: 'string',
      country: 'string',
      asset_type: 'string',
      sector: 'string',
      industry: 'string',
      total_quantity: 'number',
      portfolio_count: 'number',
    } as const satisfies Record<SortKey, 'string' | 'number'>

    const dir = sortDir === 'asc' ? 1 : -1

    return combined.sort((a, b) => {
      const aVal = a[sortKey as keyof HeldAsset] as string | number | null | undefined
      const bVal = b[sortKey as keyof HeldAsset] as string | number | null | undefined

      const aNull = aVal === null || aVal === undefined
      const bNull = bVal === null || bVal === undefined
      if (aNull && bNull) return 0
      if (aNull) return 1
      if (bNull) return -1

      if (keyTypes[sortKey] === 'string') {
        const sa = String(aVal).toLowerCase()
        const sb = String(bVal).toLowerCase()
        return sa.localeCompare(sb) * dir
      }

      const na = Number(aVal)
      const nb = Number(bVal)
      if (isNaN(na) && isNaN(nb)) return 0
      if (isNaN(na)) return 1
      if (isNaN(nb)) return -1
      return (na - nb) * dir
    });
  }, [heldAssets, soldAssets, showSold, sortKey, sortDir, activePortfolioId, portfolioAssetIds, searchQuery]);

  const handleEnrichAll = async () => {
    try {
      setEnriching(true);
      await api.enrichAllAssets();
      await loadAssets();
    } catch (err) {
      console.error('Error enriching assets:', err);
    } finally {
      setEnriching(false);
    }
  };

  const getAssetClassColor = (assetClass: string) => {
    const colors: Record<string, string> = {
      'equity': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      'stock': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      'etf': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      'bond': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      'crypto': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
      'cryptocurrency': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
      'commodity': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
      'forex': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
      'cash': 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300',
    };
    return colors[assetClass.toLowerCase()] || 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300';
  };

  const getAssetTypeColor = (assetType: string) => {
    const type = assetType ? assetType.trim().toLowerCase() : '';
    const colors: Record<string, string> = {
      'equity': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      'cryptocurrency': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
      'etf': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      'common stock': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
      'stock': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
      'preferred stock': 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
      'adr': 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
      'fund': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
      'mutual fund': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
      'index fund': 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300',
      'reit': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      'trust': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      'derivative': 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
      'warrant': 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300',
      'unit': 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
    };
    return colors[type] || 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300';
  };

  const formatQuantity = (value: number) => {
    // Format with up to 8 decimals, then remove trailing zeros
    const formatted = value.toFixed(8);
    return formatted.replace(/\.?0+$/, '');
  };

  const isActive = (key: SortKey) => sortKey === key;

  // Get human-readable label for sort key
  const getSortLabel = (key: SortKey): string => {
    const labels: Record<SortKey, string> = {
      symbol: 'Symbol',
      name: 'Name',
      class: 'Class',
      country: 'Country',
      asset_type: 'Type',
      sector: 'Sector',
      industry: 'Industry',
      total_quantity: 'Quantity',
      portfolio_count: 'Portfolios',
    }
    return labels[key]
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Package className="text-pink-600" size={28} />
              {t('assets.title')}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
              {t('assets.loadingMessage')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="h-10 w-32 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
            <div className="h-10 w-40 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">{t('fields.symbol')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">{t('fields.name')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">{t('assets.class')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">{t('fields.type')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">{t('assets.country')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">{t('assets.sector')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">{t('assets.industry')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">{t('fields.quantity')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                        <div className="space-y-2">
                          <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                          <div className="h-3 w-12 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 rounded"></div></td>
                    <td className="px-6 py-4"><div className="h-6 w-20 bg-neutral-200 dark:bg-neutral-700 rounded-full"></div></td>
                    <td className="px-6 py-4"><div className="h-6 w-24 bg-neutral-200 dark:bg-neutral-700 rounded-full"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-28 bg-neutral-200 dark:bg-neutral-700 rounded"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-12 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts Skeleton */}
        <div className="pt-4">
          <h2 className="text-xl font-semibold mb-4 text-neutral-900 dark:text-neutral-100">
            {t('assets.assetDistribution')}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
              <div className="h-64 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse"></div>
            </div>
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
              <div className="h-64 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (portfolios.length === 0) {
    return <EmptyPortfolioPrompt pageType="assets" />
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
        <button
          onClick={loadAssets}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Check for empty state before rendering anything */}
      {heldAssets.length === 0 && (!showSold || soldAssets.length === 0) ? (
        <EmptyTransactionsPrompt pageType="assets" />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                <Package className="text-pink-600" size={28} />
                {t('assets.title')}
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
                {activePortfolioId ? (
                  showSold
                    ? t('assets.heldAndSoldAssetsIn', { portfolio: portfolios.find(p => p.id === activePortfolioId)?.name || 'this portfolio' })
                    : t('assets.heldAssetsIn', { portfolio: portfolios.find(p => p.id === activePortfolioId)?.name || 'this portfolio' })
                ) : (
                  showSold
                    ? t('assets.heldAndSoldAssetsAll')
                    : t('assets.heldAssetsAll')
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 sm:flex-none sm:min-w-[250px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('placeholders.searchSymbol')}
                  className="w-full pl-9 pr-8 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {/* Jump to Distribution Button */}
              <button
                onClick={() => {
                  distributionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="relative group px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 text-sm overflow-hidden"
                title={t('assets.jumpToDistribution')}
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                <BarChart3 size={18} className="relative z-10" />
                <span className="relative z-10 hidden sm:inline">{t('assets.distribution')}</span>
              </button>
              {/* Action buttons grouped together */}
              <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSold(!showSold)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm sm:text-base ${
                  showSold 
                    ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-800' 
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                <Archive size={16} />
                <span className="hidden sm:inline">{showSold ? t('assets.hideSold') : t('assets.showSold')}</span>
                <span className="sm:hidden">{showSold ? t('assets.hide') : t('assets.show')}</span>
              </button>
              <button
                onClick={handleEnrichAll}
                disabled={enriching}
                className="flex items-center gap-2 px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                <RefreshCw size={16} className={enriching ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{enriching ? t('assets.enrichingMetadata') : t('assets.enrichMetadata')}</span>
                <span className="sm:hidden">{enriching ? t('assets.enriching') : t('assets.enrich')}</span>
              </button>
              </div>
            </div>
          </div>

          {/* Assets Table */}
          <div>
            <>
              {/* Mobile: Sort Controls & Card Layout */}
              <div className="lg:hidden">
                {/* Sort Controls */}
                <div className="flex items-center gap-2 mb-3">
                  <label htmlFor="mobile-sort-assets" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                    {t('common.sortBy')}:
                  </label>
                  <select
                    id="mobile-sort-assets"
                    value={sortKey}
                    onChange={(e) => handleSort(e.target.value as SortKey)}
                    className="flex-1 input text-sm py-2 px-3"
                  >
                    {sortableColumns.map((option) => (
                      <option key={option} value={option}>
                        {getSortLabel(option)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                    className="btn-secondary p-2 flex items-center gap-1"
                    title={sortDir === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
                  >
                    {sortDir === 'asc' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {sortedAssets.length === 0 ? (
                    <div className="card text-center py-12 text-neutral-500 dark:text-neutral-400">
                      <p>{t('assets.empty.noAssetsMatch')}</p>
                      <p className="text-sm mt-2">
                        {t('assets.empty.noAssetsMatchInfo')}{' '}
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-pink-600 dark:text-pink-400 hover:underline font-medium"
                        >
                          {t('assets.empty.clearSearch')}
                        </button>
                      </p>
                    </div>
                  ) : (
                    sortedAssets.map((asset) => (
                      <div 
                        key={asset.id} 
                        className={`card p-4 ${asset.total_quantity === 0 ? 'opacity-60' : ''}`}
                      >
                        {/* Header: Logo, Symbol, Quantity */}
                        <div className="flex items-start justify-between mb-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <img
                              src={getAssetLogoUrl(asset.symbol, asset.asset_type, asset.name)}
                              alt={asset.symbol}
                              loading="lazy"
                              className="w-10 h-10 flex-shrink-0 object-contain"
                              onError={(e) => handleLogoError(e, asset.symbol, asset.name, asset.asset_type)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                                {asset.symbol}
                              </div>
                              <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                {asset.name || '-'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-3">
                            <div className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                              {formatQuantity(asset.total_quantity)}
                            </div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">
                              {asset.currency}
                            </div>
                          </div>
                        </div>

                        {/* Data Grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                          <div>
                            <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('assets.class')}</span>
                            <div className="mt-1">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${asset.class ? getAssetClassColor(asset.class) : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'}`}>
                                {asset.class ? asset.class.charAt(0).toUpperCase() + asset.class.slice(1).toLowerCase() : '-'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('fields.type')}</span>
                            <div className="mt-1 flex justify-end">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${asset.asset_type ? getAssetTypeColor(asset.asset_type) : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'}`}>
                                {formatAssetType(asset.asset_type)}
                              </span>
                            </div>
                          </div>
                          {(asset.country || asset.effective_country) && (
                            <div>
                              <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('assets.country')}</span>
                              <div className="flex items-center gap-2 mt-1">
                                {getCountryCode(asset.effective_country || asset.country || '') && (
                                  <img
                                    src={`https://flagcdn.com/w40/${getCountryCode(asset.effective_country || asset.country || '')}.png`}
                                    alt={`${asset.effective_country || asset.country} flag`}
                                    loading="lazy"
                                    className="w-6 h-4 object-cover rounded shadow-sm"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                )}
                                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                  {asset.effective_country || asset.country}
                                </span>
                              </div>
                            </div>
                          )}
                          {(asset.sector || asset.effective_sector) && (
                            <div className={!(asset.country || asset.effective_country) ? 'col-span-2' : 'text-right'}>
                              <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('assets.sector')}</span>
                              <div className={`flex items-center gap-2 mt-1 ${!(asset.country || asset.effective_country) ? '' : 'justify-end'}`}>
                                <div className={`flex items-center justify-center w-6 h-6 rounded-full ${getSectorColor(asset.effective_sector || asset.sector || '')}`}>
                                  {(() => {
                                    const SectorIcon = getSectorIcon(asset.effective_sector || asset.sector || '');
                                    return <SectorIcon size={14} />;
                                  })()}
                                </div>
                                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                  {getTranslatedSector(asset.effective_sector || asset.sector || '', t)}
                                </span>
                              </div>
                            </div>
                          )}
                          {(asset.industry || asset.effective_industry) && (
                            <div className="col-span-2">
                              <span className="text-neutral-500 dark:text-neutral-400 text-xs">{t('assets.industry')}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <div className={`flex items-center justify-center w-6 h-6 rounded-full ${getIndustryColor(asset.effective_industry || asset.industry || '')}`}>
                                  {(() => {
                                    const IndustryIcon = getIndustryIcon(asset.effective_industry || asset.industry || '');
                                    return <IndustryIcon size={14} />;
                                  })()}
                                </div>
                                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                  {getTranslatedIndustry(asset.effective_industry || asset.industry || '', t)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                          {/* Edit Metadata Button - Show if any metadata is missing */}
                          {(!asset.sector || !asset.industry || !asset.country) && (
                            <button
                              onClick={() => setEditAsset(asset)}
                              className="btn-secondary text-xs px-2 py-1.5 flex items-center gap-1.5"
                              title="Edit Metadata"
                            >
                              <Edit size={14} />
                              {t('common.edit')}
                            </button>
                          )}
                          {(asset.split_count ?? 0) > 0 && (
                            <button
                              onClick={() => setSplitHistoryAsset({ id: asset.id, symbol: asset.symbol })}
                              className="btn-secondary text-xs px-2 py-1.5 flex items-center gap-1.5"
                              title="View Split History"
                            >
                              <Shuffle size={14} />
                              {t('splitHistory.splits')} ({asset.split_count})
                            </button>
                          )}
                          {(asset.transaction_count ?? 0) > 0 && (
                            <button
                              onClick={() => setTransactionHistoryAsset({ id: asset.id, symbol: asset.symbol })}
                              className="btn-secondary text-xs px-2 py-1.5 flex items-center gap-1.5"
                              title="View Transactions"
                            >
                              <Activity size={14} />
                              {t('assets.txs')} ({asset.transaction_count})
                            </button>
                          )}
                          <button
                            onClick={() => setPriceChartAsset({ id: asset.id, symbol: asset.symbol, currency: asset.currency })}
                            className="btn-secondary text-xs px-2 py-1.5 flex items-center gap-1.5"
                            title="View Price Chart"
                          >
                            <LineChart size={14} />
                            {t('assets.chart')}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden lg:block bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th 
                    onClick={() => handleSort('symbol')}
                    aria-sort={isActive('symbol') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {t('fields.symbol')} <SortIcon column="symbol" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('name')}
                    aria-sort={isActive('name') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {t('fields.name')} <SortIcon column="name" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('class')}
                    aria-sort={isActive('class') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {t('assets.class')} <SortIcon column="class" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('asset_type')}
                    aria-sort={isActive('asset_type') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {t('fields.type')} <SortIcon column="asset_type" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('country')}
                    aria-sort={isActive('country') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {t('assets.country')} <SortIcon column="country" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('sector')}
                    aria-sort={isActive('sector') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {t('assets.sector')} <SortIcon column="sector" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('industry')}
                    aria-sort={isActive('industry') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {t('assets.industry')} <SortIcon column="industry" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('total_quantity')}
                    aria-sort={isActive('total_quantity') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {t('fields.quantity')} <SortIcon column="total_quantity" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {sortedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12">
                      <div className="text-center text-neutral-500 dark:text-neutral-400">
                        <p>{t('assets.empty.noAssetsMatch')}</p>
                        <p className="text-sm mt-2">
                          {t('assets.empty.noAssetsMatchInfo')} <br />
                          <button
                            onClick={() => setSearchQuery('')}
                            className="text-pink-600 dark:text-pink-400 hover:underline font-medium"
                          >
                            {t('assets.empty.clearSearch')}
                          </button>
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedAssets.map((asset) => (
                  <tr key={asset.id} className={`hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors ${asset.total_quantity === 0 ? 'opacity-60 bg-neutral-50 dark:bg-neutral-900' : ''}`}> 
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                          <img
                            src={getAssetLogoUrl(asset.symbol, asset.asset_type, asset.name)}
                            alt={asset.symbol}
                            loading="lazy"
                            className="w-8 h-8 object-contain"
                            onError={(e) => handleLogoError(e, asset.symbol, asset.name, asset.asset_type)}
                          />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {asset.symbol}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            {asset.currency}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-neutral-700 dark:text-neutral-300 max-w-xs">
                        {asset.name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${asset.class ? getAssetClassColor(asset.class) : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'}`}>
                        {asset.class ? asset.class.charAt(0).toUpperCase() + asset.class.slice(1).toLowerCase() : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${asset.asset_type ? getAssetTypeColor(asset.asset_type) : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'}`}>
                        {formatAssetType(asset.asset_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {asset.country || asset.effective_country ? (
                        <div className="flex items-center gap-2">
                          {getCountryCode(asset.effective_country || asset.country || '') ? (
                            <img
                              src={`https://flagcdn.com/w40/${getCountryCode(asset.effective_country || asset.country || '')}.png`}
                              alt={`${asset.effective_country || asset.country} flag`}
                              loading="lazy"
                              className="w-6 h-4 object-cover rounded shadow-sm"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-lg">🌍</span>
                          )}
                          <span className="text-sm text-neutral-700 dark:text-neutral-300">
                            {asset.effective_country || asset.country}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm flex items-center gap-2">
                        {asset.sector || asset.effective_sector ? (
                          <>
                            {(() => {
                              const SectorIcon = getSectorIcon(asset.effective_sector || asset.sector || '');
                              return <SectorIcon size={14} className={getSectorColor(asset.effective_sector || asset.sector || '')} />;
                            })()}
                            {getTranslatedSector(asset.effective_sector || asset.sector || '', t)}
                          </>
                        ) : (
                          '-'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm flex items-center gap-2">
                        {asset.industry || asset.effective_industry ? (
                          <>
                            {(() => {
                              const IndustryIcon = getIndustryIcon(asset.effective_industry || asset.industry || '');
                              return <IndustryIcon size={14} className={getIndustryColor(asset.effective_industry || asset.industry || '')} />;
                            })()}
                            {getTranslatedIndustry(asset.effective_industry || asset.industry || '', t)}
                          </>
                        ) : (
                          '-'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium">
                        {formatQuantity(asset.total_quantity)}
                        {asset.total_quantity === 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 ml-2">
                            {t('assets.sold')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Metadata Button - Show if any metadata is missing */}
                        {(!asset.sector || !asset.industry || !asset.country) && (
                          <button
                            onClick={() => setEditAsset(asset)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 rounded transition-colors"
                            title={t('assets.editAssetMetadata')}
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {/* Price Chart Button - Show for all assets with transactions */}
                        {(asset.transaction_count ?? 0) > 0 && (
                          <button
                            onClick={() => setPriceChartAsset({ id: asset.id, symbol: asset.symbol, currency: asset.currency || 'USD' })}
                            className="p-2 text-pink-600 hover:bg-pink-50 dark:text-pink-400 dark:hover:bg-pink-900/20 rounded transition-colors"
                            title={t('assets.viewPriceChart')}
                          >
                            <LineChart size={16} />
                          </button>
                        )}
                        {(asset.transaction_count ?? 0) > 0 && (
                          <button
                            onClick={() => setTransactionHistoryAsset({ id: asset.id, symbol: asset.symbol })}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors inline-flex items-center gap-1"
                            title={t('assets.viewTransactionHistory', { txCount: asset.transaction_count, suffix: asset.transaction_count! > 1 ? 's' : '' })}
                          >
                            <TrendingUp size={16} />
                            <span className="text-xs">{asset.transaction_count}</span>
                          </button>
                        )}
                        {(asset.split_count ?? 0) > 0 && (
                          <button
                            onClick={() => setSplitHistoryAsset({ id: asset.id, symbol: asset.symbol })}
                            className="p-2 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 rounded transition-colors inline-flex items-center gap-1"
                            title={t('assets.viewSplitHistory', { splitCount: asset.split_count, suffix: asset.split_count! > 1 ? 's' : '' })}
                          >
                            <Shuffle size={16} />
                            <span className="text-xs">{asset.split_count}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
              </div>
            </>
          </div>

          {/* Charts - Bottom Section - Only show for held assets */}
          <div className="pt-4" ref={distributionRef}>
            <h2 className="text-xl font-semibold mb-4 text-neutral-900 dark:text-neutral-100">
              {t('assets.assetDistribution')}
            </h2>
            <AssetDistribution 
              assets={sortedAssets} 
              portfolioId={activePortfolioId || undefined}
              currency={portfolios.find(p => p.id === activePortfolioId)?.base_currency || 'USD'}
            />
          </div>
        </>
      )}

      {/* Split History Modal */}
      {splitHistoryAsset && (
        <SplitHistory
          assetId={splitHistoryAsset.id}
          assetSymbol={splitHistoryAsset.symbol}
          portfolioId={activePortfolioId || undefined}
          onClose={() => setSplitHistoryAsset(null)}
        />
      )}

      {/* Transaction History Modal */}
      {transactionHistoryAsset && (
        <TransactionHistory
          assetId={transactionHistoryAsset.id}
          assetSymbol={transactionHistoryAsset.symbol}
          portfolioId={activePortfolioId || undefined}
          portfolioCurrency={portfolios.find(p => p.id === activePortfolioId)?.base_currency}
          onClose={() => setTransactionHistoryAsset(null)}
        />
      )}

      {/* Price Chart Modal */}
      {priceChartAsset && (
        <div className="modal-overlay bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between sticky top-0 bg-white dark:bg-neutral-900 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                  <LineChart className="text-pink-600 dark:text-pink-400" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {priceChartAsset.symbol} {t('assets.priceChart')}
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {t('assets.historicalPriceData')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Debug Button */}
                <button
                  onClick={() => {
                    setDebugAsset({ id: priceChartAsset.id, symbol: priceChartAsset.symbol });
                  }}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                  title="Debug Price Data Health"
                >
                  <Activity size={20} />
                </button>
                {/* Close Button */}
                <button
                  onClick={() => setPriceChartAsset(null)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <AssetPriceChart 
                assetId={priceChartAsset.id} 
                symbol={priceChartAsset.symbol}
                currency={priceChartAsset.currency}
              />
            </div>
          </div>
        </div>
      )}

      {/* Debug Price Data Modal */}
      {debugAsset && (
        <AssetPriceDebug
          assetId={debugAsset.id}
          symbol={debugAsset.symbol}
          onClose={() => setDebugAsset(null)}
        />
      )}

      {/* Edit Asset Metadata Modal */}
      {editAsset && (
        <AssetMetadataEdit
          asset={editAsset}
          onClose={() => setEditAsset(null)}
          onSuccess={() => {
            loadAssets(); // Reload assets to show updated effective values
          }}
        />
      )}
    </div>
  );
}