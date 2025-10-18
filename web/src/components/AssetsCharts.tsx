
import { useMemo, useEffect, useState } from 'react';
import { Pie, Line } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, TimeScale } from 'chart.js';

Chart.register(ArcElement, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, TimeScale);

import api from '../lib/api';

Chart.register(ArcElement, Tooltip, Legend);


export interface HeldAsset {
  id: number;
  symbol: string;
  name: string;
  currency: string;
  class: string;
  sector: string | null;
  industry: string | null;
  asset_type: string | null;
  total_quantity: number;
  portfolio_count: number;
  country?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioHistoryPoint {
  date: string;
  value: number;
}

interface AssetsChartsProps {
  assets: HeldAsset[];
  portfolioId?: number;
}

export default function AssetsCharts({ assets, portfolioId }: AssetsChartsProps) {
  // Sector distribution
  const sectorData = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach(asset => {
      const key = asset.sector || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [assets]);

  // Type distribution
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach(asset => {
      const rawType = asset.asset_type || 'Unknown';
      // Format the type to title case
      const key = rawType === 'Unknown' ? 'Unknown' : 
        rawType.trim().toLowerCase() === 'etf' ? 'ETF' :
        rawType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [assets]);

  // Country distribution
  const countryData = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach(asset => {
      const key = asset.country || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [assets]);

  const sectorChartData = {
    labels: Object.keys(sectorData),
    datasets: [
      {
        data: Object.values(sectorData),
        backgroundColor: [
          '#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#818cf8', '#facc15', '#4ade80', '#f3f4f6', '#d1d5db'
        ],
      },
    ],
  };

  const typeChartData = {
    labels: Object.keys(typeData),
    datasets: [
      {
        data: Object.values(typeData),
        backgroundColor: [
          '#a78bfa', '#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#818cf8', '#facc15', '#4ade80', '#f3f4f6', '#d1d5db'
        ],
      },
    ],
  };

  const countryChartData = {
    labels: Object.keys(countryData),
    datasets: [
      {
        data: Object.values(countryData),
        backgroundColor: [
          '#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa', '#f87171', '#818cf8', '#facc15', '#4ade80', '#e879f9', '#fb923c', '#f3f4f6', '#d1d5db'
        ],
      },
    ],
  };

  // Portfolio price history chart state
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [interval, setInterval] = useState('daily');

  useEffect(() => {
    if (!portfolioId) return;
    setLoading(true);
    api.getPortfolioHistory(portfolioId, interval)
      .then(data => setHistory(data))
      .finally(() => setLoading(false));
  }, [portfolioId, interval]);

  const chartData = {
    labels: history.map(h => h.date),
    datasets: [
      {
        label: 'Portfolio Value',
        data: history.map(h => h.value),
        fill: false,
        borderColor: '#60a5fa',
        backgroundColor: '#60a5fa',
        tension: 0.1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index' as const, intersect: false },
    },
    scales: {
      x: { type: 'category' as const, title: { display: true, text: 'Date' } },
      y: { title: { display: true, text: 'Value' } },
    },
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Portfolio Value Chart */}
      {portfolioId && (
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-5 border border-neutral-200 dark:border-neutral-800 mb-6">
          <h3 className="text-sm font-semibold mb-3 text-neutral-700 dark:text-neutral-300">Portfolio Value Over Time</h3>
          <div className="flex gap-2 mb-2">
            {['daily', 'weekly', '6months', 'ytd', '1year', 'all'].map(opt => (
              <button
                key={opt}
                className={`px-3 py-1 rounded text-xs font-medium border ${interval === opt ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-neutral-100 border-neutral-300 text-neutral-700'}`}
                onClick={() => setInterval(opt)}
                disabled={loading}
              >
                {opt.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="h-64">
            {loading ? (
              <div className="flex items-center justify-center h-full text-neutral-400">Loading...</div>
            ) : (
              <Line data={chartData} options={chartOptions} />
            )}
          </div>
        </div>
      )}
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-5 border border-neutral-200 dark:border-neutral-800">
          <h3 className="text-sm font-semibold mb-3 text-neutral-700 dark:text-neutral-300">Assets by Sector</h3>
          <div className="h-64">
            <Pie data={sectorChartData} options={{ maintainAspectRatio: false, responsive: true }} />
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-5 border border-neutral-200 dark:border-neutral-800">
          <h3 className="text-sm font-semibold mb-3 text-neutral-700 dark:text-neutral-300">Assets by Type</h3>
          <div className="h-64">
            <Pie data={typeChartData} options={{ maintainAspectRatio: false, responsive: true }} />
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-5 border border-neutral-200 dark:border-neutral-800">
          <h3 className="text-sm font-semibold mb-3 text-neutral-700 dark:text-neutral-300">Assets by Country</h3>
          <div className="h-64">
            <Pie data={countryChartData} options={{ maintainAspectRatio: false, responsive: true }} />
          </div>
        </div>
      </div>
    </div>
  );
}
