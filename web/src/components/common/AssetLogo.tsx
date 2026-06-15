import type { ImgHTMLAttributes } from 'react'
import { getAssetLogoUrl, handleLogoError, validateLogoImage } from '../../lib/logoUtils'

interface AssetLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onLoad' | 'onError'> {
  symbol: string
  assetType?: string | null
  assetName?: string | null
}

export default function AssetLogo({
  symbol,
  assetType,
  assetName,
  ...imgProps
}: AssetLogoProps) {
  return (
    <img
      {...imgProps}
      src={getAssetLogoUrl(symbol, assetType, assetName)}
      onLoad={(e) => {
        const img = e.currentTarget as HTMLImageElement
        if (!validateLogoImage(img)) {
          img.dispatchEvent(new Event('error'))
        }
      }}
      onError={(e) => handleLogoError(e, symbol, assetName, assetType)}
    />
  )
}
