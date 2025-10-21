import { useEffect, useState, useMemo, useCallback } from 'react';
import { Package, Building2, Briefcase, RefreshCw, ArrowUpDown, Archive, ChevronUp, ChevronDown, Shuffle, TrendingUp } from 'lucide-react';
import api from '../lib/api';
import AssetsCharts from '../components/AssetsCharts';
import SplitHistory from '../components/SplitHistory';
import TransactionHistory from '../components/TransactionHistory';

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
  country?: string | null;
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

  const [heldAssets, setHeldAssets] = useState<HeldAsset[]>([]);
  const [soldAssets, setSoldAssets] = useState<HeldAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showSold, setShowSold] = useState(true);
  const [splitHistoryAsset, setSplitHistoryAsset] = useState<{ id: number; symbol: string } | null>(null);
  const [transactionHistoryAsset, setTransactionHistoryAsset] = useState<{ id: number; symbol: string } | null>(null);
  const [assetSplitCounts, setAssetSplitCounts] = useState<Record<number, number>>({});
  const [assetTransactionCounts, setAssetTransactionCounts] = useState<Record<number, number>>({});

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const [held, sold] = await Promise.all([
        api.getHeldAssets(),
        api.getSoldAssets()
      ]);
      setHeldAssets(held);
      setSoldAssets(sold);
      
      // Load split counts and transaction counts for all assets
      const allAssets = [...held, ...sold];
      const splitCounts: Record<number, number> = {};
      const transactionCounts: Record<number, number> = {};
      await Promise.all(
        allAssets.map(async (asset) => {
          try {
            const [splits, transactions] = await Promise.all([
              api.getAssetSplitHistory(asset.id),
              api.getAssetTransactionHistory(asset.id)
            ]);
            splitCounts[asset.id] = splits.length;
            transactionCounts[asset.id] = transactions.length;
          } catch {
            splitCounts[asset.id] = 0;
            transactionCounts[asset.id] = 0;
          }
        })
      );
      setAssetSplitCounts(splitCounts);
      setAssetTransactionCounts(transactionCounts);
      
      setError(null);
    } catch (err) {
      setError('Failed to load assets');
      console.error('Error loading assets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

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
  }, [heldAssets, soldAssets, showSold, sortKey, sortDir]);

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

  // Normalize ticker by removing currency suffixes like -USD, -EUR, -USDT
  const normalizeTickerForLogo = (symbol: string): string => {
    return symbol.replace(/-(USD|EUR|GBP|USDT|BUSD|JPY|CAD|AUD|CHF|CNY)$/i, '')
  }

  const getAssetLogoUrl = (asset: HeldAsset) => {
    const normalizedSymbol = normalizeTickerForLogo(asset.symbol)
    const params = asset.asset_type?.toUpperCase() === 'ETF' ? '?asset_type=ETF' : ''
    return `/logos/${normalizedSymbol}${params}`
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

  const formatAssetType = (type: string | null) => {
    if (!type) return '-';
    if (type.trim().toLowerCase() === 'etf') return 'ETF';
    // Convert to title case and clean up
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatQuantity = (value: number) => {
    // Format with up to 8 decimals, then remove trailing zeros
    const formatted = value.toFixed(8);
    return formatted.replace(/\.?0+$/, '');
  };

  const getCountryCode = (country: string | null | undefined): string | null => {
    if (!country) return null;
    
    const countryCodeMap: Record<string, string> = {
      'USA': 'us',
      'United States': 'us',
      'US': 'us',
      'Canada': 'ca',
      'CA': 'ca',
      'United Kingdom': 'gb',
      'UK': 'gb',
      'GB': 'gb',
      'France': 'fr',
      'FR': 'fr',
      'Germany': 'de',
      'DE': 'de',
      'Italy': 'it',
      'IT': 'it',
      'Spain': 'es',
      'ES': 'es',
      'Netherlands': 'nl',
      'NL': 'nl',
      'Belgium': 'be',
      'BE': 'be',
      'Switzerland': 'ch',
      'CH': 'ch',
      'Sweden': 'se',
      'SE': 'se',
      'Norway': 'no',
      'NO': 'no',
      'Denmark': 'dk',
      'DK': 'dk',
      'Finland': 'fi',
      'FI': 'fi',
      'Japan': 'jp',
      'JP': 'jp',
      'China': 'cn',
      'CN': 'cn',
      'Hong Kong': 'hk',
      'HK': 'hk',
      'Singapore': 'sg',
      'SG': 'sg',
      'South Korea': 'kr',
      'Korea': 'kr',
      'KR': 'kr',
      'Australia': 'au',
      'AU': 'au',
      'New Zealand': 'nz',
      'NZ': 'nz',
      'Brazil': 'br',
      'BR': 'br',
      'Mexico': 'mx',
      'MX': 'mx',
      'India': 'in',
      'IN': 'in',
      'Russia': 'ru',
      'RU': 'ru',
      'South Africa': 'za',
      'ZA': 'za',
      'Ireland': 'ie',
      'IE': 'ie',
      'Austria': 'at',
      'AT': 'at',
      'Portugal': 'pt',
      'PT': 'pt',
      'Poland': 'pl',
      'PL': 'pl',
      'Czech Republic': 'cz',
      'CZ': 'cz',
      'Greece': 'gr',
      'GR': 'gr',
      'Turkey': 'tr',
      'TR': 'tr',
      'Israel': 'il',
      'IL': 'il',
      'UAE': 'ae',
      'AE': 'ae',
      'Saudi Arabia': 'sa',
      'SA': 'sa',
      'Luxembourg': 'lu',
      'LU': 'lu',
    };
    
    return countryCodeMap[country] || null;
  };

  const isActive = (key: SortKey) => sortKey === key;
  const SortIcon = ({ col }: { col: SortKey }) => {
    const active = isActive(col);
    if (!active) return <ArrowUpDown size={14} className="inline ml-1 opacity-40" />;
    return sortDir === 'asc' 
      ? <ChevronUp size={14} className="inline ml-1 opacity-80" />
      : <ChevronDown size={14} className="inline ml-1 opacity-80" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
        <button
          onClick={loadAssets}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package className="text-pink-600" size={32} />
            Assets
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {showSold
              ? 'Held and sold assets across all portfolios'
              : 'Currently held assets across all portfolios'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSold(!showSold)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showSold 
                ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-800' 
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <Archive size={18} />
            {showSold ? 'Hide Sold' : 'Show Sold'}
          </button>
          <button
            onClick={handleEnrichAll}
            disabled={enriching}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={enriching ? 'animate-spin' : ''} />
            {enriching ? 'Enriching...' : 'Enrich Metadata'}
          </button>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
  {heldAssets.length === 0 && (!showSold || soldAssets.length === 0) ? (
          <div className="p-8 text-center text-neutral-600 dark:text-neutral-400">
            <Package size={48} className="mx-auto mb-4 opacity-50" />
            <p>No assets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th 
                    onClick={() => handleSort('symbol')}
                    aria-sort={isActive('symbol') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Symbol <SortIcon col="symbol" />
                  </th>
                  <th 
                    onClick={() => handleSort('name')}
                    aria-sort={isActive('name') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Name <SortIcon col="name" />
                  </th>
                  <th 
                    onClick={() => handleSort('class')}
                    aria-sort={isActive('class') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Class <SortIcon col={"class"} />
                  </th>
                  <th 
                    onClick={() => handleSort('asset_type')}
                    aria-sort={isActive('asset_type') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Type <SortIcon col="asset_type" />
                  </th>
                  <th 
                    onClick={() => handleSort('country')}
                    aria-sort={isActive('country') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Country <SortIcon col="country" />
                  </th>
                  <th 
                    onClick={() => handleSort('sector')}
                    aria-sort={isActive('sector') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Sector <SortIcon col="sector" />
                  </th>
                  <th 
                    onClick={() => handleSort('industry')}
                    aria-sort={isActive('industry') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Industry <SortIcon col="industry" />
                  </th>
                  <th 
                    onClick={() => handleSort('total_quantity')}
                    aria-sort={isActive('total_quantity') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Quantity <SortIcon col="total_quantity" />
                  </th>
                  <th 
                    onClick={() => handleSort('portfolio_count')}
                    aria-sort={isActive('portfolio_count') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Portfolios <SortIcon col="portfolio_count" />
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {sortedAssets.map((asset) => (
                  <tr key={asset.id} className={`hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors ${asset.total_quantity === 0 ? 'opacity-60 bg-neutral-50 dark:bg-neutral-900' : ''}`}> 
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                          <img
                            src={getAssetLogoUrl(asset)}
                            alt={asset.symbol}
                            className="w-8 h-8 object-contain"
                            onLoad={(e) => {
                              const img = e.currentTarget as HTMLImageElement
                              // Skip if we've already validated this src
                              if (img.dataset.validated) return
                              img.dataset.validated = 'true'

                              // Draw to canvas and check opacity ratio
                              try {
                                const canvas = document.createElement('canvas')
                                const ctx = canvas.getContext('2d')
                                if (!ctx) return
                                const w = Math.min(img.naturalWidth || 0, 64) || 32
                                const h = Math.min(img.naturalHeight || 0, 64) || 32
                                if (w === 0 || h === 0) return
                                canvas.width = w
                                canvas.height = h
                                ctx.drawImage(img, 0, 0, w, h)
                                const data = ctx.getImageData(0, 0, w, h).data
                                let opaque = 0
                                for (let i = 0; i < data.length; i += 4) {
                                  const a = data[i + 3] // 0..255
                                  if (a > 8) opaque++
                                }
                                const total = (data.length / 4) || 1
                                const ratio = opaque / total
                                if (ratio < 0.01) {
                                  // Treat as error and trigger existing fallback chain
                                  img.dispatchEvent(new Event('error'))
                                }
                              } catch {
                                // Ignore canvas/security errors silently
                              }
                            }}
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement
                              if (!img.dataset.resolverTried) {
                                // Final fallback: ask backend to resolve best brand logo
                                img.dataset.resolverTried = 'true'
                                const params = new URLSearchParams()
                                if (asset.name) params.set('name', asset.name)
                                if (asset.asset_type) params.set('asset_type', asset.asset_type)
                                fetch(`/api/assets/logo/${asset.symbol}?${params.toString()}`, { redirect: 'follow' })
                                  .then((res) => {
                                    if (res.redirected) {
                                      img.src = res.url
                                    } else if (res.ok) {
                                      // Some environments may not expose redirected flag; try blob
                                      return res.blob().then((blob) => {
                                        img.src = URL.createObjectURL(blob)
                                      })
                                    } else {
                                      img.style.display = 'none'
                                    }
                                  })
                                  .catch(() => {
                                    img.style.display = 'none'
                                  })
                              } else {
                                img.style.display = 'none'
                              }
                            }}
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
                      {asset.country ? (
                        <div className="flex items-center gap-2">
                          {getCountryCode(asset.country) ? (
                            <img
                              src={`https://flagcdn.com/w40/${getCountryCode(asset.country)}.png`}
                              alt={`${asset.country} flag`}
                              className="w-6 h-4 object-cover rounded shadow-sm"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-lg">🌍</span>
                          )}
                          <span className="text-sm text-neutral-700 dark:text-neutral-300">
                            {asset.country}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm flex items-center gap-2">
                        {asset.sector ? (
                          <>
                            <Building2 size={14} className="text-neutral-400" />
                            {asset.sector}
                          </>
                        ) : (
                          '-'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm flex items-center gap-2">
                        {asset.industry ? (
                          <>
                            <Briefcase size={14} className="text-neutral-400" />
                            {asset.industry}
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
                            Sold
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm">{asset.portfolio_count}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {assetTransactionCounts[asset.id] > 0 && (
                          <button
                            onClick={() => setTransactionHistoryAsset({ id: asset.id, symbol: asset.symbol })}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors inline-flex items-center gap-1"
                            title={`View Transaction History (${assetTransactionCounts[asset.id]} transaction${assetTransactionCounts[asset.id] > 1 ? 's' : ''})`}
                          >
                            <TrendingUp size={16} />
                            <span className="text-xs">{assetTransactionCounts[asset.id]}</span>
                          </button>
                        )}
                        {assetSplitCounts[asset.id] > 0 && (
                          <button
                            onClick={() => setSplitHistoryAsset({ id: asset.id, symbol: asset.symbol })}
                            className="p-2 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 rounded transition-colors inline-flex items-center gap-1"
                            title={`View Split History (${assetSplitCounts[asset.id]} split${assetSplitCounts[asset.id] > 1 ? 's' : ''})`}
                          >
                            <Shuffle size={16} />
                            <span className="text-xs">{assetSplitCounts[asset.id]}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts - Bottom Section - Only show for held assets */}
      {(heldAssets.length > 0 || soldAssets.length > 0) && (
        <div className="pt-4">
          <h2 className="text-xl font-semibold mb-4 text-neutral-900 dark:text-neutral-100">
            Asset Distribution
          </h2>
          <AssetsCharts assets={sortedAssets} />
        </div>
      )}

      {/* Split History Modal */}
      {splitHistoryAsset && (
        <SplitHistory
          assetId={splitHistoryAsset.id}
          assetSymbol={splitHistoryAsset.symbol}
          onClose={() => setSplitHistoryAsset(null)}
        />
      )}

      {/* Transaction History Modal */}
      {transactionHistoryAsset && (
        <TransactionHistory
          assetId={transactionHistoryAsset.id}
          assetSymbol={transactionHistoryAsset.symbol}
          onClose={() => setTransactionHistoryAsset(null)}
        />
      )}
    </div>
  );
}