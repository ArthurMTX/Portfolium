import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } from 'chart.js'
import api, { PortfolioHistoryPointDTO } from '../lib/api'

Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

type IntervalOpt = 'daily' | 'weekly' | '6months' | 'ytd' | '1year' | 'all'

interface Props {
  portfolioId: number
}

const intervalLabels: Record<IntervalOpt, string> = {
  daily: '1D',
  weekly: '1W',
  '6months': '6M',
  ytd: 'YTD',
  '1year': '1Y',
  all: 'ALL',
}

export default function PortfolioHistoryChart({ portfolioId }: Props) {
  const [interval, setInterval] = useState<IntervalOpt>('daily')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<PortfolioHistoryPointDTO[]>([])

  useEffect(() => {
    let canceled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await api.getPortfolioHistory(portfolioId, interval)
        if (!canceled) setHistory(data)
      } finally {
        if (!canceled) setLoading(false)
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [portfolioId, interval])

  const chartData = {
    labels: history.map(h => h.date),
    datasets: [
      {
        label: 'Portfolio Value',
        data: history.map(h => h.value),
        borderColor: 'rgb(59,130,246)',
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart
          const {ctx: c, chartArea} = chart || {}
          if (!chartArea) return 'rgba(59,130,246,0.1)'
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, 'rgba(59,130,246,0.25)')
          gradient.addColorStop(1, 'rgba(59,130,246,0.02)')
          return gradient
        },
        fill: true,
        tension: 0,
        pointRadius: 0,
        borderWidth: 3,
        pointHoverRadius: 4,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(30,41,59,0.95)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#3b82f6',
        borderWidth: 1,
        padding: 12,
        caretSize: 8,
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        title: { display: false },
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 12 } },
      },
      y: {
        title: { display: false },
        grid: { color: 'rgba(100,116,139,0.08)' },
        ticks: { color: '#64748b', font: { size: 12 } },
      },
    },
    interaction: { mode: 'nearest' as const, intersect: false },
    maintainAspectRatio: false,
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 justify-center">
        {(['daily', 'weekly', '6months', 'ytd', '1year', 'all'] as IntervalOpt[]).map(opt => (
          <button
            key={opt}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition shadow-sm ${interval === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
            onClick={() => setInterval(opt)}
          >
            {intervalLabels[opt]}
          </button>
        ))}
      </div>
      <div style={{ minHeight: 320 }} className="bg-white dark:bg-neutral-900 rounded-xl shadow border border-neutral-200 dark:border-neutral-800 p-4">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            <div className="h-64 bg-neutral-100 dark:bg-neutral-800 rounded"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="text-neutral-400 text-center py-12">No data to display.</div>
        ) : (
          <Line data={chartData} options={chartOptions} height={320} />
        )}
      </div>
    </div>
  )
}
