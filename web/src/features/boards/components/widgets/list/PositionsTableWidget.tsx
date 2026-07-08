import { useState } from 'react'
import { LayoutList } from 'lucide-react'
import PositionsTable from '@/features/portfolios/components/PositionsTable'
import RealizedPositionsTable from '@/features/portfolios/components/RealizedPositionsTable'
import { PositionDTO } from '@/api'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { getRealizedPositions } from '@/features/portfolios/lib/realizedPositions'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'

interface PositionsTableWidgetProps extends BaseWidgetProps {
  portfolioId: number
  positions: PositionDTO[]
  soldPositions?: PositionDTO[]
  soldPositionsLoading?: boolean
}

export default function PositionsTableWidget({
  portfolioId,
  positions,
  soldPositions,
  soldPositionsLoading
}: PositionsTableWidgetProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'realized' | 'sold'>('current')
  const { t } = useTranslation()
  const realizedPositions = getRealizedPositions(positions || [])

  return (
    <BaseWidget
      title="dashboard.widgets.positions.name"
      icon={LayoutList}
      iconColor="text-cyan-600 dark:text-cyan-400"
      iconBgColor="bg-cyan-50 dark:bg-cyan-900/20"
      scrollable={false}
      contentClassName="flex flex-col min-h-0"
      subHeader={
        <div className="pf-widget-subheader">
          <button
            onClick={() => setActiveTab('current')}
            className={`pf-widget-subheader-tab ${activeTab === 'current' ? 'pf-widget-subheader-tab--active' : ''}`}
          >
            {t('dashboard.widgets.positions.currentPositions')}
            {positions && positions.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                {positions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('realized')}
            className={`pf-widget-subheader-tab ${activeTab === 'realized' ? 'pf-widget-subheader-tab--active' : ''}`}
          >
            {t('dashboard.widgets.positions.realizedPositions')}
            {realizedPositions.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                {realizedPositions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sold')}
            className={`pf-widget-subheader-tab ${activeTab === 'sold' ? 'pf-widget-subheader-tab--active' : ''}`}
          >
            {t('dashboard.widgets.positions.soldPositions')}
            {soldPositions && soldPositions.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                {soldPositions.length}
              </span>
            )}
          </button>
        </div>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {activeTab === 'current' ? (
          <PositionsTable positions={positions || []} portfolioId={portfolioId} />
        ) : activeTab === 'realized' ? (
          <RealizedPositionsTable positions={realizedPositions} portfolioId={portfolioId} />
        ) : soldPositionsLoading ? (
          <div className="p-12 text-center">
            <p className="text-neutral-500 dark:text-neutral-400">
              {t('dashboard.widgets.positions.loadingSoldPositions')}
            </p>
          </div>
        ) : (
          <PositionsTable positions={soldPositions || []} portfolioId={portfolioId} isSold={true} />
        )}
      </div>
    </BaseWidget>
  )
}
