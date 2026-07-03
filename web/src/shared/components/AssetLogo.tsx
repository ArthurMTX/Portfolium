import { useState, type ImgHTMLAttributes } from 'react'
import { getAssetLogoUrl, handleLogoError, validateLogoImage, resolveLogoVariantUrl, appendVariantParam } from '@/shared/lib/logoUtils'
import { getAssetInitials, getAssetColorClasses } from '@/shared/lib/assetInitials'
import { useIsDarkMode } from '@/shared/lib/useIsDarkMode'

interface AssetLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onLoad' | 'onError'> {
  symbol: string
  assetType?: string | null
  assetName?: string | null
  /** Explicit backend-resolved logo URLs (e.g. from the Asset schema), used
   * in preference to building a proxy URL from symbol/assetType/assetName. */
  logoLightUrl?: string | null
  logoDarkUrl?: string | null
  logoUrl?: string | null
  /** Render a colored initials badge on ultimate load failure. Default true. */
  showInitialsFallback?: boolean
}

export default function AssetLogo({
  symbol,
  assetType,
  assetName,
  logoLightUrl,
  logoDarkUrl,
  logoUrl,
  showInitialsFallback = true,
  className,
  ...imgProps
}: AssetLogoProps) {
  const isDark = useIsDarkMode()
  const [failed, setFailed] = useState(false)

  const overrideUrl = resolveLogoVariantUrl({ logoLightUrl, logoDarkUrl, logoUrl, isDark })
  const src = overrideUrl ?? appendVariantParam(getAssetLogoUrl(symbol, assetType, assetName), isDark ? 'dark' : 'light')

  if (failed && showInitialsFallback) {
    const initials = getAssetInitials(symbol, assetName)
    const { bg, text } = getAssetColorClasses(symbol || assetName || '?')
    return (
      <div
        className={`flex items-center justify-center rounded-lg text-xs font-semibold ${bg} ${text} ${className || ''}`}
        aria-label={assetName || symbol || 'Unknown asset'}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      {...imgProps}
      className={className}
      src={src}
      onLoad={(e) => {
        const img = e.currentTarget as HTMLImageElement
        if (!validateLogoImage(img)) {
          img.dispatchEvent(new Event('error'))
        }
      }}
      onError={(e) => handleLogoError(e, symbol, assetName, assetType, showInitialsFallback ? () => setFailed(true) : undefined)}
    />
  )
}
