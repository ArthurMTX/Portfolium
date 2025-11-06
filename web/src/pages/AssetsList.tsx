import { useState, useEffect } from 'react'
import { Database, Search, ExternalLink, TrendingUp, Calendar, Globe, Tag, Loader } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { getAssetLogoUrl, handleLogoError, validateLogoImage } from '../lib/logoUtils'

interface Asset {
  id: number
  symbol: string
  name: string | null
  currency: string
  class: string | null
  asset_type: string | null
  sector: string | null
  industry: string | null
  country: string | null
  effective_sector: string | null
  effective_industry: string | null
  effective_country: string | null
  created_at: string
  updated_at: string
  first_transaction_date: string | null
  logo_fetched_at: string | null
  logo_content_type: string | null
}

export default function AssetsList() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCurrency, setFilterCurrency] = useState<string>('all')

  useEffect(() => {
    loadAssets()
  }, [])

  useEffect(() => {
    let filtered = assets

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (asset) =>
          asset.symbol.toLowerCase().includes(query) ||
          asset.name?.toLowerCase().includes(query) ||
          asset.sector?.toLowerCase().includes(query) ||
          asset.industry?.toLowerCase().includes(query)
      )
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((asset) => asset.asset_type === filterType)
    }

    // Currency filter
    if (filterCurrency !== 'all') {
      filtered = filtered.filter((asset) => asset.currency === filterCurrency)
    }

    setFilteredAssets(filtered)
  }, [searchQuery, filterType, filterCurrency, assets])

  const loadAssets = async () => {
    try {
      setLoading(true)
      // Use getHeldAssets which includes first_transaction_date and logo info
      // We get ALL assets by not passing a portfolio_id
      const heldData = await api.getHeldAssets()
      const soldData = await api.getSoldAssets()
      
      // Combine and deduplicate by asset_id
      const allAssets = [...heldData, ...soldData]
      const uniqueAssets = Array.from(
        new Map(allAssets.map(asset => [asset.id, asset])).values()
      )
      
      setAssets(uniqueAssets)
      setFilteredAssets(uniqueAssets)
    } catch (err) {
      console.error('Failed to load assets:', err)
    } finally {
      setLoading(false)
    }
  }

  const uniqueTypes = Array.from(new Set(assets.map((a) => a.asset_type).filter(Boolean)))
  const uniqueCurrencies = Array.from(new Set(assets.map((a) => a.currency)))

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Database className="text-blue-600" size={28} />
            Assets Database
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {filteredAssets.length} of {assets.length} assets
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by symbol, name, sector, or industry..."
            className="w-full pl-12 pr-4 py-3 border-2 border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Asset Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 border-2 border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map((type) => (
                <option key={type || 'unknown'} value={type || ''}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Currency
            </label>
            <select
              value={filterCurrency}
              onChange={(e) => setFilterCurrency(e.target.value)}
              className="w-full px-4 py-2 border-2 border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Currencies</option>
              {uniqueCurrencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card p-12 text-center">
          <Loader className="animate-spin mx-auto mb-4 text-blue-600" size={48} />
          <p className="text-neutral-600 dark:text-neutral-400">Loading assets...</p>
        </div>
      )}

      {/* Assets Table */}
      {!loading && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-100 dark:bg-neutral-800 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Logo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Currency</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Sector</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Industry</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Country</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">First Transaction</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-neutral-600 dark:text-neutral-400">
                      No assets found matching your filters
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <img
                          src={getAssetLogoUrl(asset.symbol, asset.asset_type, asset.name)}
                          alt={`${asset.symbol} logo`}
                          className="w-10 h-10 object-cover rounded"
                          onLoad={(e) => {
                            const img = e.currentTarget as HTMLImageElement
                            if (!validateLogoImage(img)) {
                              img.dispatchEvent(new Event('error'))
                            }
                          }}
                          onError={(e) => handleLogoError(e, asset.symbol, asset.name, asset.asset_type)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp size={14} className="text-blue-600 dark:text-blue-400" />
                          <span className="font-bold text-blue-600 dark:text-blue-400">{asset.symbol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 max-w-xs truncate">
                        {asset.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded text-xs font-medium">
                          {asset.asset_type || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded text-xs font-medium">
                          {asset.currency}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100">
                        <div className="flex items-center gap-1">
                          {asset.effective_sector !== asset.sector && asset.effective_sector && (
                            <span title="User override">
                              <Tag size={12} className="text-yellow-600 dark:text-yellow-400" />
                            </span>
                          )}
                          <span className={asset.effective_sector !== asset.sector ? 'font-semibold' : ''}>
                            {asset.effective_sector || asset.sector || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100">
                        <div className="flex items-center gap-1">
                          {asset.effective_industry !== asset.industry && asset.effective_industry && (
                            <span title="User override">
                              <Tag size={12} className="text-yellow-600 dark:text-yellow-400" />
                            </span>
                          )}
                          <span className={asset.effective_industry !== asset.industry ? 'font-semibold' : ''}>
                            {asset.effective_industry || asset.industry || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100">
                        <div className="flex items-center gap-1">
                          <Globe size={12} className="text-neutral-400" />
                          {asset.effective_country || asset.country || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="text-neutral-400" />
                          {formatDate(asset.first_transaction_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/dev/assets?symbol=${asset.symbol}`}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          <ExternalLink size={12} />
                          Debug
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
