import { useState, useEffect, useMemo } from 'react';
import { X, Save, AlertCircle, Info } from 'lucide-react';
import api from '@/api';
import { SECTOR_ICONS, getIndustriesForSector, getSectorIcon, getIndustryIcon, getSectorColor } from '@/shared/lib/sectorIndustryUtils';
import { getTranslatedSector, getTranslatedIndustry } from '@/shared/lib/translationUtils';
import { getCountryCodeMapping, getFlagUrl } from '@/shared/lib/countryUtils';
import IconSelect from '@/shared/components/IconSelect';
import { useTranslation } from 'react-i18next'

// Extract unique country names (filter out codes, keep only full country names)
const COUNTRY_NAMES = Array.from(
  new Set(
    Object.keys(getCountryCodeMapping()).filter(key => {
      // Filter out 2-letter codes (US, UK, AE, etc.)
      if (key.length <= 2) return false;
      
      // Filter out 3-letter country codes (USA, UAE, etc.)
      if (key === key.toUpperCase() && key.length === 3) return false;
      
      // Filter out other short codes
      if (key === key.toUpperCase() && key.length <= 3) return false;
      
      return true;
    })
  )
).sort();

const SECTOR_NAMES = Object.keys(SECTOR_ICONS).sort();

interface AssetMetadataEditProps {
  asset: {
    id: number;
    symbol: string;
    name: string;
    sector: string | null;
    industry: string | null;
    country: string | null;
    effective_sector?: string | null;
    effective_industry?: string | null;
    effective_country?: string | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssetMetadataEdit({ asset, onClose, onSuccess }: AssetMetadataEditProps) {
  const [sectorOverride, setSectorOverride] = useState('');
  const [industryOverride, setIndustryOverride] = useState('');
  const [countryOverride, setCountryOverride] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { t } = useTranslation();

  // Get filtered industries based on selected sector
  const availableIndustries = getIndustriesForSector(sectorOverride || asset.sector);

  // Build options arrays with icons/flags
  const sectorOptions = useMemo(
    () =>
      SECTOR_NAMES.map((sector) => ({
        value: sector,
        label: getTranslatedSector(sector, t),
        icon: getSectorIcon(sector),
        iconColor: getSectorColor(sector),
      })),
    [t]
  );

  const industryOptions = useMemo(
    () =>
      availableIndustries.map((industry) => ({
        value: industry,
        label: getTranslatedIndustry(industry, t),
        icon: getIndustryIcon(industry),
      })),
    [availableIndustries, t]
  );

  const countryOptions = useMemo(
    () =>
      COUNTRY_NAMES.map((country) => ({
        value: country,
        label: country,
        flagUrl: getFlagUrl(country, 'w40') || undefined,
      })),
    []
  );

  // Initialize with current effective values ONLY on mount or when asset ID changes
  useEffect(() => {
    if (!asset.sector) {
      setSectorOverride(asset.effective_sector || '');
    }
    if (!asset.industry) {
      setIndustryOverride(asset.effective_industry || '');
    }
    if (!asset.country) {
      setCountryOverride(asset.effective_country || '');
    }
    setInitialized(true);
    // Only re-run when the asset ID changes (new asset opened), not on every asset update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id]);

  // Reset industry when sector changes or is cleared (but not during initialization)
  useEffect(() => {
    if (!initialized) return;
    
    // If sector is cleared, also clear industry
    if (!sectorOverride && !asset.sector) {
      setIndustryOverride('');
    }
    // If sector changes and current industry is not valid for the new sector, clear industry
    else if (industryOverride && !availableIndustries.includes(industryOverride)) {
      setIndustryOverride('');
    }
  }, [initialized, sectorOverride, asset.sector, availableIndustries, industryOverride]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const overrides: {
        sector_override?: string | null;
        industry_override?: string | null;
        country_override?: string | null;
      } = {};

      // Only include fields that can be overridden (where Yahoo Finance has no data)
      if (!asset.sector) {
        overrides.sector_override = sectorOverride.trim() || null;
      }
      if (!asset.industry) {
        overrides.industry_override = industryOverride.trim() || null;
      }
      if (!asset.country) {
        overrides.country_override = countryOverride.trim() || null;
      }

      await api.setAssetMetadataOverrides(asset.id, overrides);
      onClose(); // Close modal first
      onSuccess(); // Then trigger reload (async, but we don't wait)
    } catch (err) {
      console.error('Error setting metadata overrides:', err);
      setError(err instanceof Error ? err.message : 'Failed to save metadata overrides');
    } finally {
      setLoading(false);
    }
  };

  const hasYahooData = (field: 'sector' | 'industry' | 'country') => {
    return asset[field] !== null && asset[field] !== undefined;
  };

  return (
    <div className="pf-modal-overlay">
      <div className="pf-modal-panel pf-modal-panel--lg" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="pf-modal-header sticky top-0 bg-neutral-950 z-10">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="pf-modal-title">
                {t('assetMetadataEdit.title')}
              </h2>
              <p className="pf-modal-description">
                {asset.symbol} - {asset.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="pf-modal-close"
            aria-label={t('common.close')}
          >
            <X size={24} />
          </button>
        </div>

        {/* Info Box */}
        <div className="px-5 py-4 border-b border-neutral-800">
          <div className="flex gap-3">
            <Info className="text-neutral-500 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-sm text-neutral-300">
              <p className="font-semibold mb-1">{t('assetMetadataEdit.about')}</p>
              <ul className="list-disc list-inside space-y-1 text-neutral-500">
                <li>{t('assetMetadataEdit.about1')}</li>
                <li>{t('assetMetadataEdit.about2')} <strong>{t('assetMetadataEdit.about3')}</strong> {t('assetMetadataEdit.about4')}</li>
                <li>{t('assetMetadataEdit.about5')}</li>
                <li>{t('assetMetadataEdit.about6')}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="pf-modal-body pf-modal-section">
          {error && (
            <div className="pf-modal-callout pf-modal-callout--danger">
              <div className="flex gap-3">
                <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-red-900 dark:text-red-100">
                  <p className="font-semibold">{t('common.error')}</p>
                  <p className="text-red-800 dark:text-red-200">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sector */}
          <div>
            <label className="pf-modal-label">
              {t('assets.sector')}
            </label>
            {hasYahooData('sector') ? (
              <div className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                    {getTranslatedSector(asset.sector, t)}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-200 dark:bg-neutral-700 px-2 py-1 rounded">
                    {t('assetMetadataEdit.yahooFinance')}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('assetMetadataEdit.cannotOverride')}
                </p>
              </div>
            ) : (
              <div>
                <IconSelect
                  value={sectorOverride}
                  onChange={setSectorOverride}
                  options={sectorOptions}
                  placeholder={t('assetMetadataEdit.sectorPlaceholder')}
                  clearable
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('assetMetadataEdit.yahooFinance')}: <span className="text-neutral-400">{t('assetMetadataEdit.notAvailable')}</span>
                </p>
              </div>
            )}
          </div>

          {/* Industry */}
          <div>
            <label className="pf-modal-label">
              {t('assets.industry')}
            </label>
            {hasYahooData('industry') ? (
              <div className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                    {getTranslatedIndustry(asset.industry, t)}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-200 dark:bg-neutral-700 px-2 py-1 rounded">
                    {t('assetMetadataEdit.yahooFinance')}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('assetMetadataEdit.cannotOverride')}
                </p>
              </div>
            ) : (
              <div>
                <IconSelect
                  value={industryOverride}
                  onChange={setIndustryOverride}
                  options={industryOptions}
                  placeholder={t('assetMetadataEdit.industryPlaceholder')}
                  disabled={!sectorOverride && !asset.sector}
                  clearable
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {!sectorOverride && !asset.sector ? (
                    <span className="text-amber-600 dark:text-amber-400">{t('assetMetadataEdit.selectASector')}</span>
                  ) : (
                    <>{t('assetMetadataEdit.yahooFinance')}: <span className="text-neutral-400">{t('assetMetadataEdit.notAvailable')}</span></>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Country */}
          <div>
            <label className="pf-modal-label">
              {t('assets.country')}
            </label>
            {hasYahooData('country') ? (
              <div className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                    {asset.country}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-200 dark:bg-neutral-700 px-2 py-1 rounded">
                    {t('assetMetadataEdit.yahooFinance')}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('assetMetadataEdit.cannotOverride')}
                </p>
              </div>
            ) : (
              <div>
                <IconSelect
                  value={countryOverride}
                  onChange={setCountryOverride}
                  options={countryOptions}
                  placeholder={t('assetMetadataEdit.countryPlaceholder')}
                  clearable
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('assetMetadataEdit.yahooFinance')}: <span className="text-neutral-400">{t('assetMetadataEdit.notAvailable')}</span>
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pf-modal-footer -mx-5 -mb-5 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="pf-modal-button pf-modal-button--secondary"
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || (hasYahooData('sector') && hasYahooData('industry') && hasYahooData('country'))}
              className="pf-modal-button pf-modal-button--primary"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {t('common.saving')}...
                </>
              ) : (
                <>
                  <Save size={18} />
                  {t('assetMetadataEdit.saveOverrides')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
