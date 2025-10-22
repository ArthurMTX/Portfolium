import { Home, PlusCircle, TrendingUp, Package, Eye, LineChart, ArrowLeftRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface EmptyPortfolioPromptProps {
  pageType?: 'dashboard' | 'insights' | 'transactions' | 'assets' | 'watchlist' | 'charts'
}

export default function EmptyPortfolioPrompt({ pageType = 'dashboard' }: EmptyPortfolioPromptProps) {
  const navigate = useNavigate()

  const getIcon = () => {
    switch (pageType) {
      case 'insights':
        return <TrendingUp className="text-pink-400 dark:text-pink-500" size={80} />
      case 'transactions':
        return <ArrowLeftRight className="text-pink-400 dark:text-pink-500" size={80} />
      case 'assets':
        return <Package className="text-pink-400 dark:text-pink-500" size={80} />
      case 'watchlist':
        return <Eye className="text-pink-400 dark:text-pink-500" size={80} />
      case 'charts':
        return <LineChart className="text-pink-400 dark:text-pink-500" size={80} />
      default:
        return <Home className="text-pink-400 dark:text-pink-500" size={80} />
    }
  }

  const getTitle = () => {
    switch (pageType) {
      case 'insights':
        return 'No Portfolio Selected'
      case 'transactions':
        return 'No Portfolio to Track'
      case 'assets':
        return 'No Assets to Display'
      case 'watchlist':
        return 'Watchlist Ready'
      case 'charts':
        return 'No Data to Visualize'
      default:
        return 'No Portfolio Yet'
    }
  }

  const getMessage = () => {
    switch (pageType) {
      case 'insights':
        return 'Create or select a portfolio to view detailed insights, performance metrics, and analytics.'
      case 'transactions':
        return 'Create a portfolio first to start tracking your buy, sell, and dividend transactions.'
      case 'assets':
        return 'Create a portfolio and add transactions to see your assets and their distribution.'
      case 'watchlist':
        return 'While you can add assets to your watchlist, creating a portfolio will let you convert them into actual investments.'
      case 'charts':
        return 'Create a portfolio and add transactions to visualize your investment performance over time.'
      default:
        return 'Get started by creating your first portfolio to track your investments and analyze performance.'
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Decorative background gradient */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-950/20 dark:to-purple-950/20 rounded-3xl blur-3xl opacity-50"></div>
          
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

            {/* Message */}
            <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-8 max-w-lg mx-auto">
              {getMessage()}
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/portfolios')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <PlusCircle size={20} />
                Create Your First Portfolio
              </button>
            </div>

            {/* Additional help text */}
            <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                💡 <strong>Getting Started:</strong> A portfolio is a container for your investments. 
                You can create multiple portfolios to organize different investment strategies.
              </p>
            </div>

            {/* Visual decoration */}
            <div className="mt-6 flex justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></div>
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse delay-75"></div>
              <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse delay-150"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
