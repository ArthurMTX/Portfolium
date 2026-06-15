import { Link } from 'react-router-dom'
import { TrendingDown, Home, BarChart3, AlertCircle } from 'lucide-react'
import { useTranslation, Trans } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()
  
  return (
    <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* Animated 404 with stock ticker style */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-900 rounded-lg mb-6">
            <TrendingDown className="text-red-600 dark:text-red-400" size={32} />
            <div className="text-left">
              <div className="text-5xl font-bold text-red-600 dark:text-red-400 font-mono">{t('notFound.errorCode')}</div>
              <div className="text-sm text-red-600 dark:text-red-400 font-medium">{t('notFound.percentChange')}</div>
            </div>
          </div>
        </div>

        {/* Main message */}
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-white mb-4">
          {t('notFound.title')}
        </h1>
        
        <div className="space-y-4 mb-6">
          <p className="text-lg text-neutral-600 dark:text-neutral-400">
            <Trans i18nKey="notFound.message">
              This page has been <span className="font-semibold text-red-600 dark:text-red-400">liquidated</span> from our portfolio.
            </Trans>
          </p>
          
          {/* Fun financial metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto my-6">
            <div className="card p-4">
              <div className="flex items-center justify-center gap-2 mb-1">
                <BarChart3 size={20} className="text-pink-600 dark:text-pink-400" />
                <div className="text-2xl font-bold text-neutral-900 dark:text-white">0</div>
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('notFound.assetsFound')}</div>
            </div>
            
            <div className="card p-4">
              <div className="flex items-center justify-center gap-2 mb-1">
                <TrendingDown size={20} className="text-red-600 dark:text-red-400" />
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">-100%</div>
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('notFound.dailyChange')}</div>
            </div>
            
            <div className="card p-4">
              <div className="flex items-center justify-center gap-2 mb-1">
                <AlertCircle size={20} className="text-amber-600 dark:text-amber-400" />
                <div className="text-2xl font-bold text-neutral-900 dark:text-white">404</div>
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('notFound.errorCodeLabel')}</div>
            </div>
          </div>

          {/* Easter egg messages */}
          <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 max-w-xl mx-auto">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 italic">
              💡 <span className="font-semibold">{t('notFound.investmentTip')}</span> {t('notFound.tipMessage')}
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-medium px-6 py-3 rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            <Home size={20} />
            {t('notFound.returnToDashboard')}
          </Link>
          
          <Link
            to="/portfolios"
            className="inline-flex items-center gap-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-medium px-6 py-3 rounded-lg transition-colors"
          >
            <BarChart3 size={20} />
            {t('notFound.viewPortfolios')}
          </Link>
        </div>

        {/* Additional easter egg */}
        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-400 dark:text-neutral-600 font-mono">
            {t('notFound.marketStatus', { time: new Date().toLocaleTimeString() })}
          </p>
        </div>
      </div>
    </div>
  )
}
