import { PlusCircle, LineChart, Package, FileText, Sparkles, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface EmptyTransactionsPromptProps {
  pageType?: 'insights' | 'assets' | 'charts'
  portfolioName?: string
}

export default function EmptyTransactionsPrompt({ pageType = 'assets', portfolioName }: EmptyTransactionsPromptProps) {
  const navigate = useNavigate()

  const getIcon = () => {
    switch (pageType) {
      case 'insights':
        return <TrendingUp className="text-pink-400 dark:text-pink-500" size={80} />
      case 'charts':
        return <LineChart className="text-pink-400 dark:text-pink-500" size={80} />
      case 'assets':
        return <Package className="text-pink-400 dark:text-pink-500" size={80} />
      default:
        return <Package className="text-pink-400 dark:text-pink-500" size={80} />
    }
  }

  const getTitle = () => {
    switch (pageType) {
      case 'insights':
        return 'No Data for Insights Yet'
      case 'charts':
        return 'No Performance Data'
      default:
        return 'No Assets to Display'
    }
  }

  const getMessage = () => {
    const portfolio = portfolioName ? `"${portfolioName}"` : 'this portfolio'
    
    switch (pageType) {
      case 'insights':
        return `Start adding transactions to ${portfolio} to unlock detailed insights, performance metrics, and analytics.`
      case 'charts':
        return `Add transactions to ${portfolio} to visualize your investment performance over time with charts and graphs.`
      default:
        return `Add your first transaction to ${portfolio} to start tracking your investments and see your asset allocation.`
    }
  }

  const getSecondaryMessage = () => {
    switch (pageType) {
      case 'insights':
        return 'Portfolio insights include performance metrics, risk analysis, sector allocation, and benchmark comparisons.'
      case 'charts':
        return 'Interactive charts will show your portfolio value over time, daily changes, and performance trends.'
      default:
        return 'Once you add transactions, you\'ll see your holdings, market values, profit/loss, and asset distribution.'
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Decorative background gradient */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-950/20 dark:to-pink-950/20 rounded-3xl blur-3xl opacity-50"></div>
          
          {/* Main content card */}
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-12 text-center">
            {/* Icon */}
            <div className="mb-6 flex justify-center">
              {getIcon()}
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              {getTitle()}
            </h2>

            {/* Main Message */}
            <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-4 max-w-lg mx-auto">
              {getMessage()}
            </p>

            {/* Secondary Message */}
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8 max-w-md mx-auto">
              {getSecondaryMessage()}
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/transactions')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <PlusCircle size={20} />
                Add Your First Transaction
              </button>
            </div>

            {/* Getting Started Steps */}
            <div className="mt-10 pt-8 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex items-start gap-2 text-left max-w-lg mx-auto mb-4">
                <Sparkles size={20} className="text-pink-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                    Quick Start Guide
                  </h3>
                  <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 text-xs font-bold flex-shrink-0">
                        1
                      </span>
                      <span>Click "Add Your First Transaction" or go to the Transactions page</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold flex-shrink-0">
                        2
                      </span>
                      <span>Search for a stock or ETF ticker (e.g., AAPL, MSFT, SPY)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 text-xs font-bold flex-shrink-0">
                        3
                      </span>
                      <span>Enter the quantity, price, and date of your purchase</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold flex-shrink-0">
                        4
                      </span>
                      <span>Watch your portfolio come to life with real-time data!</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pro Tip */}
              <div className="mt-6 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-lg mx-auto">
                <div className="flex items-start gap-2">
                  <FileText size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                      💡 Pro Tip: Bulk Import
                    </p>
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      Already tracking your portfolio elsewhere? Use the CSV import feature on the Transactions page to quickly add all your holdings at once.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual decoration */}
            <div className="mt-8 flex justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
              <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse delay-75"></div>
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse delay-150"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
