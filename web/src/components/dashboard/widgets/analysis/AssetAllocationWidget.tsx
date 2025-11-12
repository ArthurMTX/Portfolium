import { useState, useEffect } from 'react'
import { PieChart as PieChartIcon, BarChart3 } from 'lucide-react'
import { Pie, Bar } from 'react-chartjs-2'
import { Chart, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'
import { BaseWidgetProps } from '../../types'
import usePortfolioStore from '@/store/usePortfolioStore'
import api, { DistributionItemDTO } from '@/lib/api'
import { getSectorHexColor } from '@/lib/sectorIndustryUtils'
import { useTranslation } from 'react-i18next'
import { getTranslatedSector, getTranslatedAssetType } from '@/lib/translationUtils'
import { mockSectorsDistribution, mockTypesDistribution, mockCountriesDistribution } from '../../utils/mockDataProvider'

Chart.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

type DistributionType = 'sector' | 'type' | 'country'
type ChartType = 'pie' | 'donut' | 'bar'

interface AssetAllocationWidgetProps extends BaseWidgetProps {
  batchData?: { 
    asset_allocation?: unknown
    sector_allocation?: unknown
    country_allocation?: unknown
  }
}

export default function AssetAllocationWidget({ isPreview = false, batchData }: AssetAllocationWidgetProps) {
  const { t } = useTranslation()
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)

  const [activeTab, setActiveTab] = useState<DistributionType>('sector')
  const [chartType, setChartType] = useState<ChartType>('donut')
  const [distributionData, setDistributionData] = useState<DistributionItemDTO[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Use mock data in preview mode
    if (isPreview) {
      switch (activeTab) {
        case 'sector':
          setDistributionData(mockSectorsDistribution)
          break
        case 'type':
          setDistributionData(mockTypesDistribution)
          break
        case 'country':
          setDistributionData(mockCountriesDistribution)
          break
      }
      return
    }

    // Check if batch data is available for current tab
    const hasBatchData = (
      (activeTab === 'sector' && batchData?.sector_allocation) ||
      (activeTab === 'type' && batchData?.asset_allocation) ||
      (activeTab === 'country' && batchData?.country_allocation)
    )

    if (hasBatchData) {
      // Use batch data
      let data: DistributionItemDTO[]
      switch (activeTab) {
        case 'sector':
          data = batchData!.sector_allocation as DistributionItemDTO[]
          break
        case 'type':
          data = batchData!.asset_allocation as DistributionItemDTO[]
          break
        case 'country':
          data = batchData!.country_allocation as DistributionItemDTO[]
          break
      }
      setDistributionData(data)
      setLoading(false)
      return
    }

    if (!activePortfolioId) return

    const fetchData = async () => {
      setLoading(true)
      try {
        let data: DistributionItemDTO[]
        switch (activeTab) {
          case 'sector':
            data = await api.getSectorsDistribution(activePortfolioId)
            break
          case 'type':
            data = await api.getTypesDistribution(activePortfolioId)
            break
          case 'country':
            data = await api.getCountriesDistribution(activePortfolioId)
            break
        }
        setDistributionData(data)
      } catch (error) {
        console.error('Failed to fetch distribution data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [activePortfolioId, activeTab, isPreview, batchData])

  // Prepare chart data
  const chartData = {
    labels: distributionData.map(item => {
      if (activeTab === 'sector') {
        return getTranslatedSector(item.name, t)
      } else if (activeTab === 'type') {
        return getTranslatedAssetType(item.name, t)
      }
      return item.name
    }),
    datasets: [
      {
        data: distributionData.map(item => item.percentage),
        backgroundColor: distributionData.map((item, idx) => {
          if (activeTab === 'sector') {
            return getSectorHexColor(item.name)
          }
          // Generate colors for types and countries
          const colors = [
            '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
            '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
          ]
          return colors[idx % colors.length]
        }),
        borderWidth: 2,
        borderColor: 'rgb(255, 255, 255)',
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (context: any) => {
            const label = context.label || ''
            const value = context.parsed || 0
            return `${label}: ${value.toFixed(1)}%`
          },
        },
      },
    },
    cutout: chartType === 'donut' ? '60%' : undefined,
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (context: any) => {
            const value = context.parsed.x || 0
            return `${value.toFixed(1)}%`
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (value: any) => `${value}%`,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      y: {
        grid: {
          display: false,
        },
      },
    },
  }

  return (
    <div className="card h-full flex flex-col p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
            {chartType === 'bar' ? (
              <BarChart3 className="text-purple-600 dark:text-purple-400" size={18} />
            ) : (
              <PieChartIcon className="text-purple-600 dark:text-purple-400" size={18} />
            )}
          </div>
          <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t('dashboard.widgets.assetAllocation.name')}
          </h3>
        </div>
        {/* Chart Type Toggle */}
        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
          <button
            onClick={() => setChartType('donut')}
            className={`p-1 rounded ${
              chartType === 'donut'
                ? 'bg-white dark:bg-neutral-700 shadow-sm'
                : 'hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
            title={t('dashboard.widgets.assetAllocation.donutChart')}
          >
            <PieChartIcon size={14} />
          </button>
          <button
            onClick={() => setChartType('pie')}
            className={`p-1 rounded ${
              chartType === 'pie'
                ? 'bg-white dark:bg-neutral-700 shadow-sm'
                : 'hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
            title={t('dashboard.widgets.assetAllocation.pieChart')}
          >
            <PieChartIcon size={14} className="fill-current" />
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`p-1 rounded ${
              chartType === 'bar'
                ? 'bg-white dark:bg-neutral-700 shadow-sm'
                : 'hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
            title={t('dashboard.widgets.assetAllocation.barChart')}
          >
            <BarChart3 size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setActiveTab('sector')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'sector'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          {t('assets.sector')}
        </button>
        <button
          onClick={() => setActiveTab('type')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'type'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          {t('assets.type')}
        </button>
        <button
          onClick={() => setActiveTab('country')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'country'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          {t('assets.country')}
        </button>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : distributionData.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              {t('dashboard.widgets.assetAllocation.noAllocationData')}
            </p>
          </div>
        ) : (
          <div className="h-full flex flex-col gap-3">
            {/* Chart Area */}
            <div className="flex-1 min-h-0">
              {chartType === 'bar' ? (
                <Bar data={chartData} options={barOptions} />
              ) : (
                <Pie data={chartData} options={chartOptions} />
              )}

            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-xs">
              {distributionData.slice(0, 5).map((item, idx) => (
                <div key={item.name} className="flex items-center gap-1.5" title={
                  `${activeTab === 'sector'
                    ? getTranslatedSector(item.name, t)
                    : activeTab === 'type'
                    ? getTranslatedAssetType(item.name, t)
                    : item.name}: ${item.percentage < 0.1 ? item.percentage.toFixed(2) : item.percentage.toFixed(1)}%`
                }>
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        activeTab === 'sector'
                          ? getSectorHexColor(item.name)
                          : chartData.datasets[0].backgroundColor[idx],
                    }}
                  />
                  <span className="text-neutral-700 dark:text-neutral-300 truncate max-w-[120px]">
                    {activeTab === 'sector'
                      ? getTranslatedSector(item.name, t)
                      : activeTab === 'type'
                      ? getTranslatedAssetType(item.name, t)
                      : item.name}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium whitespace-nowrap">
                    {item.percentage < 0.1 
                      ? item.percentage.toFixed(2)
                      : item.percentage < 1
                      ? item.percentage.toFixed(1)
                      : item.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
