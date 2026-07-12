import { useTranslation } from 'react-i18next'
import { PageStateSkeleton } from '@/shared/components/StatePrimitives'

export function AssetResearchViewSkeleton() {
  const { t } = useTranslation()
  return <PageStateSkeleton label={t('assetResearchView.loadingAssetResearch')} className="asset-research asset-research--loading" />
}
