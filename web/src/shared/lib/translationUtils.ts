/**
 * Translation utilities for sectors and industries
 * 
 * Provides helper functions to get translated names for sectors and industries
 * while maintaining fallback to original values if translation is not available.
 */

/**
 * Type for the translation function from react-i18next
 * Compatible with TFunction<"translation", undefined> from i18next
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TranslationFunction = (key: string, options?: any) => string;

/**
 * Canonical asset type synonyms.
 *
 * The backend exposes two loosely related fields for an asset's type:
 * `asset_type` (verbatim from the market data provider, e.g. "EQUITY")
 * and the legacy `class` enum (defaults to "stock" for most assets).
 * Both end up rendered as "asset type" in the UI, so anything reaching
 * these formatters must be normalized to one vocabulary first or the
 * same instrument shows up as "Stock" in one place and "Equity" in
 * another.
 */
const ASSET_TYPE_SYNONYMS: Record<string, string> = {
  STOCK: 'EQUITY',
  'MUTUAL FUND': 'MUTUAL_FUND',
}

export function normalizeAssetType(assetType: string): string {
  const normalized = assetType.toUpperCase().trim()
  return ASSET_TYPE_SYNONYMS[normalized] || normalized
}

/**
 * Get translated sector name
 * @param sector - Original sector name from API
 * @param t - Translation function from react-i18next
 * @returns Translated sector name, or original if translation not found
 */
export function getTranslatedSector(
  sector: string | null | undefined,
  t: TranslationFunction
): string {
  // Ensure t is a function
  if (typeof t !== 'function') {
    console.error('getTranslatedSector: t is not a function', t);
    return sector || 'Unknown';
  }
  
  if (!sector) return t('sectors.Unknown');
  
  // Try to get translation, fallback to original value
  const translationKey = `sectors.${sector}`;
  const translated = t(translationKey);
  
  // If translation returns the key itself, it means translation doesn't exist
  return translated === translationKey ? sector : translated;
}

/**
 * Get translated industry name
 * @param industry - Original industry name from API
 * @param t - Translation function from react-i18next
 * @returns Translated industry name, or original if translation not found
 */
export function getTranslatedIndustry(
  industry: string | null | undefined,
  t: TranslationFunction
): string {
  // Ensure t is a function
  if (typeof t !== 'function') {
    console.error('getTranslatedIndustry: t is not a function', t);
    return industry || 'Unknown';
  }
  
  if (!industry) return t('industries.Unknown');
  
  // Try to get translation, fallback to original value
  const translationKey = `industries.${industry}`;
  const translated = t(translationKey);
  
  // If translation returns the key itself, it means translation doesn't exist
  return translated === translationKey ? industry : translated;
}

/**
 * Get translated asset class name
 * @param assetClass - Original asset class from API (stock, etf, crypto, cash)
 * @param t - Translation function from react-i18next
 * @returns Translated asset class name, or original if translation not found
 */
export function getTranslatedAssetClass(
  assetClass: string | null | undefined,
  t: TranslationFunction
): string {
  // Ensure t is a function
  if (typeof t !== 'function') {
    console.error('getTranslatedAssetClass: t is not a function', t);
    return assetClass || '-';
  }
  
  if (!assetClass) return '-';
  
  // Normalize to lowercase for consistency
  const normalizedClass = assetClass.toLowerCase();
  
  // Try to get translation, fallback to formatted original value
  const translationKey = `assetClasses.${normalizedClass}`;
  const translated = t(translationKey);
  
  // If translation returns the key itself, it means translation doesn't exist
  if (translated === translationKey) {
    // Fallback: capitalize first letter
    return assetClass.charAt(0).toUpperCase() + assetClass.slice(1).toLowerCase();
  }
  
  return translated;
}

/**
 * Get translated asset type name
 * @param assetType - Original asset type from API (EQUITY, ETF, CRYPTO, etc.)
 * @param t - Translation function from react-i18next
 * @returns Translated asset type name, or formatted original if translation not found
 */
export function getTranslatedAssetType(
  assetType: string | null | undefined,
  t: TranslationFunction
): string {
  // Ensure t is a function
  if (typeof t !== 'function') {
    console.error('getTranslatedAssetType: t is not a function', t);
    return assetType || '-';
  }
  
  if (!assetType) return '-';

  // Normalize to a canonical type (e.g. STOCK -> EQUITY) for consistency
  const normalizedType = normalizeAssetType(assetType);

  // Special handling for ETF to keep it uppercase
  if (normalizedType === 'ETF') {
    const translationKey = `assetTypes.${normalizedType}`;
    const translated = t(translationKey);
    return translated === translationKey ? 'ETF' : translated;
  }
  
  // Try to get translation
  const translationKey = `assetTypes.${normalizedType}`;
  const translated = t(translationKey);
  
  // If translation returns the key itself, it means translation doesn't exist
  if (translated === translationKey) {
    // Fallback: convert to title case
    return normalizedType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  return translated;
}
