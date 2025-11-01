import { useEffect, useState } from 'react';
import { X, Calendar, Clock, TrendingUp, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';

interface Price {
  date: string;
  price: number;
  volume: number | null;
  source: string;
}

interface AssetHealth {
  asset_id: number;
  symbol: string;
  name: string | null;
  status: string;
  total_price_records: number;
  first_transaction_date: string | null;
  first_transaction_actual: string | null;
  data_range: {
    start: string;
    end: string;
    days: number;
  } | null;
  coverage: {
    expected_trading_days: number;
    actual_data_points: number;
    coverage_pct: number;
    missing_days: number;
    gap_count: number;
  };
  sources: Record<string, number>;
  gaps: string[] | { total: number; sample: string[]; message: string };
  recommendations: string[];
}

interface AssetPriceDebugProps {
  assetId: number;
  symbol: string;
  onClose: () => void;
}

export default function AssetPriceDebug({ assetId, symbol, onClose }: AssetPriceDebugProps) {
  const [health, setHealth] = useState<AssetHealth | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'health' | 'prices'>('health');

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [healthData, pricesData] = await Promise.all([
          api.getAssetHealth(assetId),
          api.getAssetPriceHistory(assetId, 'ALL')
        ]);
        setHealth(healthData);
        setPrices(pricesData.prices);
      } catch (err) {
        console.error('Error loading asset debug data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [assetId]);

  const getHealthBadge = (percentage: number) => {
    if (percentage >= 90) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
          <CheckCircle2 size={14} />
          Excellent
        </span>
      );
    }
    if (percentage >= 70) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
          <AlertCircle size={14} />
          Good
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
        <AlertCircle size={14} />
        Poor
      </span>
    );
  };

  return (
    <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {symbol} - Price Data Debug
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Asset ID: {assetId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X size={24} className="text-neutral-500" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setView('health')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              view === 'health'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            Health Check
          </button>
          <button
            onClick={() => setView('prices')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              view === 'prices'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            Price Data ({prices.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : view === 'health' && health ? (
            <div className="space-y-6">
              {/* Health Score */}
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    Coverage Score
                  </h3>
                  {getHealthBadge(health.coverage.coverage_pct)}
                </div>
                <div className={`text-4xl font-bold mb-2 ${
                  health.coverage.coverage_pct >= 90
                    ? 'text-green-600 dark:text-green-400'
                    : health.coverage.coverage_pct >= 70
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {health.coverage.coverage_pct.toFixed(1)}%
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      health.coverage.coverage_pct >= 90
                        ? 'bg-green-500'
                        : health.coverage.coverage_pct >= 70
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${health.coverage.coverage_pct}%` }}
                  ></div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 mb-2">
                    <Calendar size={16} />
                    <span className="text-xs font-medium">Days Range</span>
                  </div>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {health.data_range?.days || 0}
                  </div>
                </div>

                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 mb-2">
                    <TrendingUp size={16} />
                    <span className="text-xs font-medium">Expected Days</span>
                  </div>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {health.coverage.expected_trading_days}
                  </div>
                </div>

                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 mb-2">
                    <Database size={16} />
                    <span className="text-xs font-medium">Actual Days</span>
                  </div>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {health.coverage.actual_data_points}
                  </div>
                </div>

                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 mb-2">
                    <Clock size={16} />
                    <span className="text-xs font-medium">Total Records</span>
                  </div>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {health.total_price_records}
                  </div>
                </div>
              </div>

              {/* Date Range */}
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                  Date Range
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">First Transaction:</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100 mt-1">
                      {health.first_transaction_date || health.first_transaction_actual || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">Oldest Price:</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100 mt-1">
                      {health.data_range?.start ? new Date(health.data_range.start).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">Newest Price:</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100 mt-1">
                      {health.data_range?.end ? new Date(health.data_range.end).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sources */}
              {Object.keys(health.sources).length > 0 && (
                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                    Data Sources
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(health.sources).map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between text-sm">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            source === 'yfinance_history'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : source === 'yfinance'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          {source}
                        </span>
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {health.recommendations.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-400 mb-3 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Recommendations
                  </h3>
                  <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-300">
                    {health.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-500 mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Gaps */}
              {health.coverage.gap_count > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-red-900 dark:text-red-400 mb-3">
                    Data Gaps Detected ({health.coverage.gap_count} missing days)
                  </h3>
                  <div className="text-sm text-red-800 dark:text-red-300">
                    <p className="mb-2">Missing {health.coverage.missing_days} out of {health.coverage.expected_trading_days} expected trading days.</p>
                    {Array.isArray(health.gaps) && health.gaps.length > 0 && (
                      <details className="cursor-pointer">
                        <summary className="font-medium hover:underline">View gap details</summary>
                        <div className="mt-2 max-h-40 overflow-y-auto text-xs font-mono bg-red-100 dark:bg-red-900/30 p-2 rounded">
                          {health.gaps.join(', ')}
                        </div>
                      </details>
                    )}
                    {!Array.isArray(health.gaps) && health.gaps.sample && (
                      <details className="cursor-pointer">
                        <summary className="font-medium hover:underline">{health.gaps.message}</summary>
                        <div className="mt-2 max-h-40 overflow-y-auto text-xs font-mono bg-red-100 dark:bg-red-900/30 p-2 rounded">
                          {health.gaps.sample.join(', ')}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Price Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">
                        Date/Time
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">
                        Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">
                        Volume
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">
                        Source
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {prices.map((price, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                        <td className="px-4 py-3 font-mono text-xs">
                          {new Date(price.date).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {price.price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400">
                          {price.volume ? price.volume.toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              price.source === 'yfinance_history'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : price.source === 'yfinance'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                            }`}
                          >
                            {price.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {prices.length === 0 && (
                <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
                  No price data available
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
