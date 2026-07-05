import { useState, useMemo } from 'react';
import { Search, X, Globe } from 'lucide-react';
import { getCountryCodeMapping } from '@/shared/lib/countryUtils';
import {
  PageControls,
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageMetric,
  PageMetricStrip,
  PageSection,
  PageSectionHeader,
  PageShell,
  PageSummaryPanel,
  PageTitleBlock,
} from '@/shared/components/PageLayout';
import '@/shared/design/pages/devtools.css';

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
    <PageShell className="devtools-page">
      <PageHeader>
        <PageTitleBlock
          kicker="Developer Tools"
          title="Country Flag Preview"
          description="Preview all country flags displayed on the Assets and Insights pages."
        />
        <PageSummaryPanel
          lead="Flag CDN Audit"
          description={`${loadedCount} loaded · ${failedCount} failed · ${filteredCountries.length} visible`}
        />
      </PageHeader>

      <PageMetricStrip label="Flag preview totals">
        <PageMetric label="Countries" value={totalCount} />
        <PageMetric label="Loaded" value={loadedCount} tone={loadedCount > 0 ? 'positive' : 'neutral'} />
        <PageMetric label="Failed" value={failedCount} tone={failedCount > 0 ? 'negative' : 'neutral'} />
        <PageMetric label="Results" value={filteredCountries.length} />
      </PageMetricStrip>

      <PageControls
        label="Flag preview search"
        start={
          <label className="pf-search devtools-page__search">
            <Search aria-hidden="true" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by country name or code..."
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')}>
                <X size={18} />
              </button>
            )}
          </label>
        }
      />

      {/* Info Banner */}
      <div className="devtools-page__message is-info">
        <Globe aria-hidden="true" size={20} />
        <div>
          <strong>About Flag Display</strong>
          <p>
              Flags are loaded from <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">flagcdn.com</code> CDN. 
              If a country doesn't have yfinance data or the flag fails to load, a 🌍 globe emoji is shown as fallback.
              The "Unknown" country also displays the globe emoji in both Assets and Insights pages.
            </p>
          </div>
        </div>

      <PageMainGrid single>
        <PageMainColumn>
          <PageSection>
            <PageSectionHeader title={searchQuery ? `Found ${filteredCountries.length} country(ies)` : 'All Countries'} />

        {filteredCountries.length === 0 ? (
              <div className="pf-empty-state">
            <p>No countries match your search</p>
            <button
              onClick={() => setSearchQuery('')}
                  className="pf-button pf-button--secondary"
            >
              Clear search
            </button>
          </div>
        ) : (
              <div className="devtools-page__card-grid">
            {filteredCountries.map(({ name, code }) => (
              <div
                key={code}
                    className="devtools-page__item-card"
              >
                <div className="flex flex-col items-center gap-3">
                  {/* Flag Display */}
                      <div className="devtools-page__flag-frame">
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
                        <h3 className="devtools-page__item-title" title={name}>
                      {name}
                    </h3>
                        <p className="devtools-page__muted">
                      {code}
                    </p>
                    {loadedFlags.has(code) && (
                          <span className="devtools-page__badge is-success">
                            Loaded
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </PageSection>

      {/* Special Cases */}
          <PageSection>
            <PageSectionHeader title="Special Cases" aside={<Globe aria-hidden="true" size={18} />} />
            <div className="devtools-page__message is-warning">
              <div>
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
          </PageSection>
        </PageMainColumn>
      </PageMainGrid>
    </PageShell>
  );
}
