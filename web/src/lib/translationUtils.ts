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
 * Get all translated sectors
 * @param t - Translation function from react-i18next
 * @returns Array of objects with original and translated sector names
 */
export function getAllTranslatedSectors(t: TranslationFunction): Array<{
  original: string;
  translated: string;
}> {
  const sectors = [
    'Technology',
    'Communication Services',
    'Healthcare',
    'Financial Services',
    'Energy',
    'Utilities',
    'Consumer Cyclical',
    'Consumer Defensive',
    'Industrials',
    'Basic Materials',
    'Real Estate',
  ];

  return sectors.map(sector => ({
    original: sector,
    translated: getTranslatedSector(sector, t),
  }));
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
  
  // Normalize to uppercase for consistency
  const normalizedType = assetType.toUpperCase().trim();
  
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
    return assetType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  return translated;
}
