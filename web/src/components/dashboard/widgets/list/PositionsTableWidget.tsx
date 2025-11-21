import { useState } from 'react'
import { LayoutList } from 'lucide-react'
import PositionsTable from '../../../PositionsTable'
import { PositionDTO } from '../../../../lib/api'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '../../types'

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
  soldPositionsLoading,
  isPreview: _isPreview = false 
}: PositionsTableWidgetProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'sold'>('current')
  const { t } = useTranslation()

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      {/* Header with Icon and Title */}
      <div className="px-5 pt-5 pb-2 flex items-center gap-2.5">
        <div className="w-9 h-9 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <LayoutList className="text-cyan-600 dark:text-cyan-400" size={18} />
        </div>
        <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t('dashboard.widgets.positions.name')}
        </h3>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex items-center gap-4 px-4 pt-2 border-b border-neutral-200 dark:border-neutral-700">
        <button
          onClick={() => setActiveTab('current')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'current'
              ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          {t('dashboard.currentPositions')}
          {positions && positions.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {positions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sold')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'sold'
              ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          {t('dashboard.soldPositions')}
          {soldPositions && soldPositions.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {soldPositions.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {activeTab === 'current' ? (
          <PositionsTable positions={positions || []} portfolioId={portfolioId} />
        ) : soldPositionsLoading ? (
          <div className="p-12 text-center">
            <p className="text-neutral-500 dark:text-neutral-400">
              {t('dashboard.loadingSoldPositions')}
            </p>
          </div>
        ) : (
          <PositionsTable positions={soldPositions || []} portfolioId={portfolioId} isSold={true} />
        )}
      </div>
    </div>
  )
}
