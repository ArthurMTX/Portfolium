import { useEffect, useState } from 'react';
import { Search, X, LucideIcon } from 'lucide-react';
import { 
  SECTOR_ICONS, 
  INDUSTRY_ICONS, 
  getSectorColor, 
  getIndustryColor,
  getSectorForIndustry,
  getExampleTickerForIndustry,
  getExampleNameForIndustry,
} from '@/shared/lib/sectorIndustryUtils';
import { getTranslatedSector, getTranslatedIndustry } from '@/shared/lib/translationUtils';
import AssetLogo from '@/shared/components/AssetLogo';
import { useTranslation } from 'react-i18next';
import { getThemeColor, getThemeHexColor, getThemeIcon } from '@/shared/lib/themeUtils';
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
  PageTabs,
  PageTitleBlock,
} from '@/shared/components/PageLayout';
import '@/shared/design/pages/devtools.css';

type ThemeHierarchy = Record<string, string[]>;

export default function IconPreview() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'sectors' | 'industries' | 'themes'>('sectors');
  const [themeHierarchy, setThemeHierarchy] = useState<ThemeHierarchy>({});
  const [themeHierarchyError, setThemeHierarchyError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadThemeHierarchy = async () => {
      try {
        const response = await fetch('/api/assets/themes/hierarchy');
        if (!response.ok) {
          throw new Error(`Failed to load theme hierarchy (${response.status})`);
        }

        const data = (await response.json()) as ThemeHierarchy;
        if (isActive) {
          setThemeHierarchy(data);
          setThemeHierarchyError(null);
        }
      } catch (error) {
        if (isActive) {
          setThemeHierarchyError(error instanceof Error ? error.message : 'Failed to load theme hierarchy');
        }
      }
    };

    loadThemeHierarchy();

    return () => {
      isActive = false;
    };
  }, []);

  const themeEntries = Object.entries(themeHierarchy);
  const filteredThemes = themeEntries.filter(([name]) => {
    const lowerQuery = searchQuery.toLowerCase();
    const subthemes = themeHierarchy[name] || [];

    return (
      name.toLowerCase().includes(lowerQuery) ||
      subthemes.some((subtheme) => subtheme.toLowerCase().includes(lowerQuery))
    );
  });

  const totalSubthemes = themeEntries.reduce((sum, [, subthemes]) => sum + subthemes.length, 0);

  const sortedThemeEntries = [...filteredThemes].sort(([a], [b]) => a.localeCompare(b));

  // Filter sectors
  const filteredSectors = Object.entries(SECTOR_ICONS).filter(([name]) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group industries by sector and filter
  const industriesBySector: Record<string, Array<[string, LucideIcon]>> = {};
  
  Object.entries(INDUSTRY_ICONS).forEach(([industryName, icon]) => {
    const sector = getSectorForIndustry(industryName) || 'Unknown';
    const matchesSearch = industryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         sector.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (matchesSearch) {
      if (!industriesBySector[sector]) {
        industriesBySector[sector] = [];
      }
      industriesBySector[sector].push([industryName, icon]);
    }
  });

  // Sort sectors alphabetically, but put Other and Unknown at the end
  const sortedSectors = Object.keys(industriesBySector).sort((a, b) => {
    const isASpecial = a === 'Other' || a === 'Unknown';
    const isBSpecial = b === 'Other' || b === 'Unknown';
    
    // Both are special - maintain order (Other, then Unknown)
    if (isASpecial && isBSpecial) {
      if (a === 'Other') return -1;
      if (b === 'Other') return 1;
      return 0;
    }
    
    // A is special, B is not - A goes to end
    if (isASpecial) return 1;
    
    // B is special, A is not - B goes to end
    if (isBSpecial) return -1;
    
    // Neither is special - sort alphabetically
    return a.localeCompare(b);
  });
  
  // Count total filtered industries
  const totalFilteredIndustries = Object.values(industriesBySector).reduce(
    (sum, industries) => sum + industries.length, 
    0
  );

  return (
    <PageShell className="devtools-page">
      <PageHeader>
        <PageTitleBlock
          kicker="Developer Tools"
          title="Icon Preview"
          description="Preview all available sector, industry, theme, and subtheme icons and colors."
        />
        <PageSummaryPanel
          lead="Visual Taxonomy"
          description={`${Object.keys(SECTOR_ICONS).length + Object.keys(INDUSTRY_ICONS).length} sector and industry icons · ${themeEntries.length + totalSubthemes} theme entries`}
        />
      </PageHeader>

      <PageMetricStrip label="Icon preview totals">
        <PageMetric label="Sectors" value={Object.keys(SECTOR_ICONS).length} />
        <PageMetric label="Industries" value={Object.keys(INDUSTRY_ICONS).length} />
        <PageMetric label="Icons" value={Object.keys(SECTOR_ICONS).length + Object.keys(INDUSTRY_ICONS).length} />
        <PageMetric label="Themes + Subthemes" value={themeEntries.length + totalSubthemes} />
      </PageMetricStrip>

      <PageControls
        label="Icon preview controls"
        start={
          <PageTabs label="Icon families">
            <button type="button" onClick={() => setSelectedTab('sectors')} className={selectedTab === 'sectors' ? 'is-active' : undefined}>
              Sectors ({Object.keys(SECTOR_ICONS).length})
            </button>
            <button type="button" onClick={() => setSelectedTab('industries')} className={selectedTab === 'industries' ? 'is-active' : undefined}>
              Industries ({Object.keys(INDUSTRY_ICONS).length})
            </button>
            <button type="button" onClick={() => setSelectedTab('themes')} className={selectedTab === 'themes' ? 'is-active' : undefined}>
              Themes ({themeEntries.length})
            </button>
          </PageTabs>
        }
        end={
          <label className="pf-search devtools-page__search">
            <Search aria-hidden="true" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sectors, industries, themes, or subthemes..."
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')}>
                <X size={18} />
              </button>
            )}
          </label>
        }
      />

      {themeHierarchyError && (
        <div className="devtools-page__message is-warning">
          {themeHierarchyError}
        </div>
      )}

      <PageMainGrid single>
        <PageMainColumn>

      {/* Sectors Tab Content */}
      {selectedTab === 'sectors' && (
            <PageSection>
              <PageSectionHeader title={searchQuery ? `Found ${filteredSectors.length} sector(s)` : 'All Sectors'} />

          {filteredSectors.length === 0 ? (
                <div className="pf-empty-state">
              <p>No sectors match your search</p>
              <button
                onClick={() => setSearchQuery('')}
                    className="pf-button pf-button--secondary"
              >
                Clear search
              </button>
            </div>
          ) : (
                <div className="devtools-page__card-grid">
              {filteredSectors.map(([name, Icon]) => (
                <div
                  key={name}
                      className="devtools-page__item-card"
                >
                      <div className="devtools-page__item-row">
                        <div className="devtools-page__item-icon">
                      <Icon size={24} className={getSectorColor(name)} />
                    </div>
                        <div>
                          <h3 className="devtools-page__item-title">
                        {name}
                      </h3>
                          <p className="devtools-page__muted">
                        Icon: {Icon.displayName || Icon.name || 'LucideIcon'}
                      </p>
                          <div className="devtools-page__filter-row">
                        <Icon size={16} className={getSectorColor(name)} />
                            <span className="devtools-page__muted">16px</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
            </PageSection>
      )}

          {/* Industries Tab Content */}
          {selectedTab === 'industries' && (
            <PageSection>
              <PageSectionHeader
                title={searchQuery ? `Found ${totalFilteredIndustries} industry(ies) across ${sortedSectors.length} sector(s)` : 'All Industries by Sector'}
              />

          {totalFilteredIndustries === 0 ? (
                <div className="pf-empty-state">
              <p>No industries match your search</p>
              <button
                onClick={() => setSearchQuery('')}
                    className="pf-button pf-button--secondary"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedSectors.map((sector) => {
                const SectorIcon = SECTOR_ICONS[sector];
                const industries = industriesBySector[sector];
                
                return (
                  <div key={sector} className="space-y-4">
                    {/* Sector Header */}
                    <div className="flex items-center gap-3 pb-2 border-b-2 border-neutral-200 dark:border-neutral-700">
                      {SectorIcon && <SectorIcon size={24} className={getSectorColor(sector)} />}
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                          {getTranslatedSector(sector, t)}
                        </h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {industries.length} {industries.length === 1 ? 'industry' : 'industries'}
                        </p>
                      </div>
                    </div>

                    {/* Industries Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {industries.map(([industryName, Icon]) => {
                        const exampleTicker = getExampleTickerForIndustry(industryName);
                        const exampleName = getExampleNameForIndustry(industryName)
                        
                        return (
                          <div
                            key={industryName}
                            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 hover:shadow-lg transition-shadow"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                                <Icon size={20} className={getIndustryColor(industryName)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm text-neutral-900 dark:text-neutral-100 line-clamp-2">
                                  {getTranslatedIndustry(industryName, t)}
                                </h4>
                                
                                {/* Example Company */}
                                {exampleTicker && (
                                  <div className="mt-3 flex items-center gap-2 p-2 bg-neutral-50 dark:bg-neutral-800 rounded-md">
                                    <AssetLogo
                                      symbol={exampleTicker}
                                      assetType="STOCK"
                                      alt={exampleTicker}
                                      className="w-6 h-6 rounded object-cover flex-shrink-0"
                                      loading="lazy"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">
                                        {exampleTicker}
                                      </p>
                                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                        {exampleName}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </PageSection>
          )}

          {selectedTab === 'themes' && (
            <PageSection>
              <PageSectionHeader
                title={searchQuery ? `Found ${sortedThemeEntries.length} theme(s)` : 'All Themes and Subthemes'}
                aside={`${themeEntries.length} themes · ${totalSubthemes} subthemes`}
              />

          {sortedThemeEntries.length === 0 ? (
                <div className="pf-empty-state">
              <p>No themes match your search</p>
              <button
                onClick={() => setSearchQuery('')}
                    className="pf-button pf-button--secondary"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedThemeEntries.map(([themeName, subthemes]) => {
                const ThemeIcon = getThemeIcon(themeName)
                const themeColor = getThemeColor(themeName)
                const themeHex = getThemeHexColor(themeName)

                return (
                  <div
                    key={themeName}
                    className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm"
                    style={{ borderColor: `${themeHex}40`, backgroundColor: `${themeHex}10` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 rounded-lg bg-white/80 dark:bg-neutral-800 p-3">
                        <ThemeIcon size={24} className={themeColor} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {themeName}
                          </h3>
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-300">
                            {subthemes.length} subthemes
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {subthemes.map((subthemeName) => {
                            const SubthemeIcon = getThemeIcon(subthemeName)
                            const subthemeColor = getThemeColor(subthemeName)
                            const subthemeHex = getThemeHexColor(subthemeName)

                            return (
                              <div
                                key={`${themeName}-${subthemeName}`}
                                className="flex items-center gap-3 rounded-md border border-white/60 dark:border-neutral-700 bg-white/70 dark:bg-neutral-950/40 px-3 py-2"
                                style={{ borderColor: `${subthemeHex}33` }}
                              >
                                <SubthemeIcon size={18} className={subthemeColor} />
                                <span className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                  {subthemeName}
                                </span>
                                <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subthemeHex }} />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
            </PageSection>
          )}
        </PageMainColumn>
      </PageMainGrid>
    </PageShell>
  );
}
