import { useMemo, useState } from 'react'
import { Layers, X } from 'lucide-react'
import { BaseWidgetProps } from '../../types'
import { BaseWidget } from '../base/BaseWidget'
import { ViewAllButton } from '../base/ViewAllButton'
import { formatCurrency } from '@/lib/formatUtils'
import usePortfolioStore from '@/store/usePortfolioStore'
import { useTranslation } from 'react-i18next'

interface ThemeAssetContribution {
  symbol: string
  name: string
  contribution_value: number
}

interface ThemeAllocationItem {
  theme: string
  value: number
  percentage: number
  assets: ThemeAssetContribution[]
}

interface ThemeAllocationWidgetProps extends BaseWidgetProps {
  batchData?: {
    theme_allocation?: unknown
  }
}

const PREVIEW_DATA: ThemeAllocationItem[] = [
  {
    theme: 'AI Infrastructure',
    value: 12453.22,
    percentage: 18.42,
    assets: [
      { symbol: 'NVDA', name: 'NVIDIA Corporation', contribution_value: 5200 },
      { symbol: 'NBIS', name: 'Nebius Group N.V.', contribution_value: 3100 },
      { symbol: 'PLTR', name: 'Palantir Technologies', contribution_value: 2800 },
      { symbol: 'AMD', name: 'Advanced Micro Devices', contribution_value: 1353.22 },
    ],
  },
  {
    theme: 'Data Centers',
    value: 9622,
    percentage: 14.2,
    assets: [
      { symbol: 'NVDA', name: 'NVIDIA Corporation', contribution_value: 3900 },
      { symbol: 'MSFT', name: 'Microsoft Corporation', contribution_value: 2722 },
      { symbol: 'AMZN', name: 'Amazon.com', contribution_value: 3000 },
    ],
  },
  {
    theme: 'Defense Tech',
    value: 6583,
    percentage: 9.7,
    assets: [
      { symbol: 'PLTR', name: 'Palantir Technologies', contribution_value: 3300 },
      { symbol: 'LMT', name: 'Lockheed Martin', contribution_value: 3283 },
    ],
  },
  {
    theme: 'Space',
    value: 4138,
    percentage: 6.1,
    assets: [
      { symbol: 'RKLB', name: 'Rocket Lab', contribution_value: 2488 },
      { symbol: 'PLTR', name: 'Palantir Technologies', contribution_value: 1650 },
    ],
  },
]

function parseThemeAllocation(raw: unknown): ThemeAllocationItem[] {
  if (!Array.isArray(raw)) return []

  const parsed: ThemeAllocationItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue

    const candidate = item as {
      theme?: unknown
      value?: unknown
      percentage?: unknown
      assets?: unknown
    }

    const theme = typeof candidate.theme === 'string' ? candidate.theme.trim() : ''
    const value = Number(candidate.value)
    const percentage = Number(candidate.percentage)
    if (!theme || Number.isNaN(value) || Number.isNaN(percentage)) continue

    const assets: ThemeAssetContribution[] = Array.isArray(candidate.assets)
      ? candidate.assets
          .filter((asset): asset is ThemeAssetContribution => {
            if (!asset || typeof asset !== 'object') return false
            const parsedAsset = asset as {
              symbol?: unknown
              name?: unknown
              contribution_value?: unknown
            }
            return (
              typeof parsedAsset.symbol === 'string' &&
              typeof parsedAsset.name === 'string' &&
              !Number.isNaN(Number(parsedAsset.contribution_value))
            )
          })
          .map((asset) => ({
            symbol: asset.symbol,
            name: asset.name,
            contribution_value: Number(asset.contribution_value),
          }))
      : []

    parsed.push({
      theme,
      value,
      percentage,
      assets: assets.sort((a, b) => b.contribution_value - a.contribution_value),
    })
  }

  return parsed.sort((a, b) => b.value - a.value)
}

export default function ThemeAllocationWidget({ isPreview = false, batchData }: ThemeAllocationWidgetProps) {
  const { t } = useTranslation()
  const [showAll, setShowAll] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState<ThemeAllocationItem | null>(null)

  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolio = portfolios.find((portfolio) => portfolio.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'USD'

  const themeAllocation = useMemo(() => {
    if (isPreview) return PREVIEW_DATA
    return parseThemeAllocation(batchData?.theme_allocation)
  }, [isPreview, batchData])

  const visibleThemes = showAll ? themeAllocation : themeAllocation.slice(0, 10)

  const headerAction = themeAllocation.length > 10 ? (
    <ViewAllButton
      onClick={() => setShowAll((prev) => !prev)}
      label={showAll ? t('common.close') : t('common.viewAll')}
    />
  ) : null

  return (
    <>
      <BaseWidget
        title="dashboard.widgets.themeAllocation.name"
        icon={Layers}
        iconColor="text-indigo-600 dark:text-indigo-400"
        iconBgColor="bg-indigo-50 dark:bg-indigo-900/20"
        isEmpty={themeAllocation.length === 0}
        emptyMessage="dashboard.widgets.themeAllocation.empty"
        emptyIcon={Layers}
        actions={headerAction}
        scrollable={false}
      >
        <div className="px-5 pb-4">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            <span>{t('dashboard.widgets.themeAllocation.columns.theme')}</span>
            <span className="text-right">{t('dashboard.widgets.themeAllocation.columns.percentage')}</span>
            <span className="text-right">{t('dashboard.widgets.themeAllocation.columns.value')}</span>
          </div>

          <div className="space-y-1.5">
            {visibleThemes.map((item) => (
              <button
                key={item.theme}
                type="button"
                onClick={() => setSelectedTheme(item)}
                className="w-full grid grid-cols-[1fr_auto_auto] gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors"
              >
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate" title={item.theme}>
                  {item.theme}
                </span>
                <span className="text-sm text-neutral-600 dark:text-neutral-300 text-right font-semibold">
                  {item.percentage.toFixed(1)}%
                </span>
                <span className="text-sm text-neutral-700 dark:text-neutral-200 text-right font-semibold whitespace-nowrap">
                  {formatCurrency(item.value, portfolioCurrency)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </BaseWidget>

      {selectedTheme && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] p-4 flex items-center justify-center">
          <div className="w-full max-w-xl bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-start justify-between p-5 border-b border-neutral-200 dark:border-neutral-700">
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{selectedTheme.theme}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('dashboard.widgets.themeAllocation.modal.portfolioShare', {
                    percentage: selectedTheme.percentage.toFixed(1),
                  })}
                </p>
                <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mt-1">
                  {formatCurrency(selectedTheme.value, portfolioCurrency)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTheme(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                aria-label={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-3">
                {t('dashboard.widgets.themeAllocation.modal.assets')}
              </h4>
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {selectedTheme.assets.map((asset) => (
                  <div
                    key={`${selectedTheme.theme}-${asset.symbol}-${asset.name}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-neutral-50 dark:bg-neutral-800/70"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{asset.symbol}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{asset.name}</p>
                    </div>
                    <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                      {formatCurrency(asset.contribution_value, portfolioCurrency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
