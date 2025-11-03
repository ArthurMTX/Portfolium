import { useState } from 'react';
import { Search, X, Palette } from 'lucide-react';
import { SECTOR_ICONS, INDUSTRY_ICONS, getSectorColor, getIndustryColor } from '../lib/sectorIndustryUtils';

export default function IconPreview() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'sectors' | 'industries'>('sectors');

  // Filter sectors
  const filteredSectors = Object.entries(SECTOR_ICONS).filter(([name]) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter industries
  const filteredIndustries = Object.entries(INDUSTRY_ICONS).filter(([name]) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
          <Palette className="text-pink-600" size={28} />
          Sector & Industry Icon Preview
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
          Preview all available sector and industry icons from yfinance
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sectors or industries..."
          className="w-full pl-10 pr-10 py-3 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
        <button
          onClick={() => setSelectedTab('sectors')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            selectedTab === 'sectors'
              ? 'border-pink-600 text-pink-600 dark:text-pink-400'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          Sectors ({Object.keys(SECTOR_ICONS).length})
        </button>
        <button
          onClick={() => setSelectedTab('industries')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            selectedTab === 'industries'
              ? 'border-pink-600 text-pink-600 dark:text-pink-400'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          Industries ({Object.keys(INDUSTRY_ICONS).length})
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {Object.keys(SECTOR_ICONS).length}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Sectors</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {Object.keys(INDUSTRY_ICONS).length}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Industries</div>
        </div>
        <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
            {Object.keys(SECTOR_ICONS).length + Object.keys(INDUSTRY_ICONS).length}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Icons</div>
        </div>
      </div>

      {/* Sectors Tab Content */}
      {selectedTab === 'sectors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {searchQuery ? `Found ${filteredSectors.length} sector(s)` : 'All Sectors'}
            </h2>
          </div>

          {filteredSectors.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              <p>No sectors match your search</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-pink-600 dark:text-pink-400 hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSectors.map(([name, Icon]) => (
                <div
                  key={name}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                      <Icon size={24} className={getSectorColor(name)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {name}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        Icon: {Icon.displayName || Icon.name || 'LucideIcon'}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Icon size={16} className={getSectorColor(name)} />
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">16px</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Industries Tab Content */}
      {selectedTab === 'industries' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {searchQuery ? `Found ${filteredIndustries.length} industry(ies)` : 'All Industries'}
            </h2>
          </div>

          {filteredIndustries.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              <p>No industries match your search</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-pink-600 dark:text-pink-400 hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredIndustries.map(([name, Icon]) => (
                <div
                  key={name}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                      <Icon size={20} className={getIndustryColor(name)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-neutral-900 dark:text-neutral-100 line-clamp-2">
                        {name}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                        {Icon.displayName || Icon.name || 'Icon'}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Icon size={14} className={getIndustryColor(name)} />
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">14px</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
