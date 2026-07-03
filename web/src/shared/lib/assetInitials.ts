/**
 * Shared ticker-initials fallback used across all asset logo rendering.
 *
 * Standardizes on the symbol-first, 3-char, alphanumeric-stripped algorithm
 * already used by InsightsShared's `initialsFor` and the backend's
 * `generate_etf_logo` (rather than EtfCompositionSection's 2-char,
 * name-word-splitting variant), so every fallback badge in the app looks
 * the same.
 */
export function getAssetInitials(symbol?: string | null, name?: string | null): string {
  const source = (symbol || name || '?').replace(/[^A-Za-z0-9]/g, '')
  return (source || '?').slice(0, 3).toUpperCase()
}

interface AssetColorClasses {
  bg: string
  text: string
}

const PALETTE: AssetColorClasses[] = [
  { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-200' },
  { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-200' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-200' },
  { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-200' },
  { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-200' },
  { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-200' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/40', text: 'text-cyan-700 dark:text-cyan-200' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-200' },
]

/** Deterministic seed -> palette entry, so the same symbol always gets the same color. */
export function getAssetColorClasses(seed: string): AssetColorClasses {
  const normalized = seed || '?'
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}
