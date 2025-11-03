import { useState, useMemo } from 'react';
import { Search, X, Flag, Globe } from 'lucide-react';
import { getCountryCodeMapping } from '../lib/countryUtils';

export default function FlagPreview() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loadedFlags, setLoadedFlags] = useState<Set<string>>(new Set());
  const [failedFlags, setFailedFlags] = useState<Set<string>>(new Set());

  const countryMapping = useMemo(() => getCountryCodeMapping(), []);

  // Get unique countries (remove aliases/duplicates)
  const uniqueCountries = useMemo(() => {
    const seen = new Set<string>();
    const countries: Array<{ name: string; code: string }> = [];

    Object.entries(countryMapping).forEach(([name, code]) => {
      // Skip uppercase codes and prefer full names
      if (name === name.toUpperCase()) return;
      if (!seen.has(code)) {
        seen.add(code);
        countries.push({ name, code });
      }
    });

    return countries.sort((a, b) => a.name.localeCompare(b.name));
  }, [countryMapping]);

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return uniqueCountries;
    
    const query = searchQuery.toLowerCase();
    return uniqueCountries.filter(
      (country) =>
        country.name.toLowerCase().includes(query) ||
        country.code.toLowerCase().includes(query)
    );
  }, [uniqueCountries, searchQuery]);

  const handleFlagLoad = (code: string) => {
    setLoadedFlags((prev) => new Set([...prev, code]));
    setFailedFlags((prev) => {
      const newSet = new Set(prev);
      newSet.delete(code);
      return newSet;
    });
  };

  const handleFlagError = (code: string) => {
    setFailedFlags((prev) => new Set([...prev, code]));
    setLoadedFlags((prev) => {
      const newSet = new Set(prev);
      newSet.delete(code);
      return newSet;
    });
  };

  const loadedCount = loadedFlags.size;
  const failedCount = failedFlags.size;
  const totalCount = uniqueCountries.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
          <Flag className="text-pink-600" size={28} />
          Country Flag Preview
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
          Preview all country flags displayed on the Assets and Insights pages
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by country name or code..."
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {totalCount}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Countries</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {loadedCount}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Flags Loaded</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {failedCount}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Failed to Load</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {filteredCountries.length}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Search Results</div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Globe className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">About Flag Display</p>
            <p className="text-blue-700 dark:text-blue-300">
              Flags are loaded from <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">flagcdn.com</code> CDN. 
              If a country doesn't have yfinance data or the flag fails to load, a 🌍 globe emoji is shown as fallback.
              The "Unknown" country also displays the globe emoji in both Assets and Insights pages.
            </p>
          </div>
        </div>
      </div>

      {/* Country Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {searchQuery ? `Found ${filteredCountries.length} country(ies)` : 'All Countries'}
          </h2>
        </div>

        {filteredCountries.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
            <p>No countries match your search</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-pink-600 dark:text-pink-400 hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredCountries.map(({ name, code }) => (
              <div
                key={code}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex flex-col items-center gap-3">
                  {/* Flag Display */}
                  <div className="w-full aspect-[4/3] flex items-center justify-center bg-neutral-50 dark:bg-neutral-800 rounded overflow-hidden">
                    {failedFlags.has(code) ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-4xl">🌍</span>
                        <span className="text-xs text-red-600 dark:text-red-400">Failed</span>
                      </div>
                    ) : (
                      <img
                        src={`https://flagcdn.com/w80/${code}.png`}
                        srcSet={`https://flagcdn.com/w160/${code}.png 2x`}
                        alt={`${name} flag`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onLoad={() => handleFlagLoad(code)}
                        onError={() => handleFlagError(code)}
                      />
                    )}
                  </div>

                  {/* Country Info */}
                  <div className="w-full text-center">
                    <h3 className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate" title={name}>
                      {name}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-mono mt-1">
                      {code}
                    </p>
                    {loadedFlags.has(code) && (
                      <span className="inline-block mt-1 text-xs text-green-600 dark:text-green-400">
                        ✓ Loaded
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Special Cases */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
        <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
          <Globe className="text-amber-600 dark:text-amber-400" size={18} />
          Special Cases
        </h3>
        <div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <span className="text-lg">🌍</span>
            <div>
              <strong>Unknown Country:</strong> Displays globe emoji (🌍) when country is "Unknown" or not available
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">🌍</span>
            <div>
              <strong>Failed Flags:</strong> Falls back to globe emoji if flag image fails to load
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono text-xs bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded">US</span>
            <div>
              <strong>Common Aliases:</strong> USA → us, UK → gb, UAE → ae, etc.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
