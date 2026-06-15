import { PlusCircle, LineChart, Package, FileText, Sparkles, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface EmptyTransactionsPromptProps {
  pageType?: 'insights' | 'assets' | 'charts' | 'metrics'
  portfolioName?: string
}

export default function EmptyTransactionsPrompt({ pageType = 'assets', portfolioName }: EmptyTransactionsPromptProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const getIcon = () => {
    switch (pageType) {
      case 'insights':
        return <TrendingUp className="text-pink-400 dark:text-pink-500" size={80} />
      case 'charts':
        return <LineChart className="text-pink-400 dark:text-pink-500" size={80} />
      case 'metrics':
        return <LineChart className="text-pink-400 dark:text-pink-500" size={80} />
      case 'assets':
        return <Package className="text-pink-400 dark:text-pink-500" size={80} />
      default:
        return <Package className="text-pink-400 dark:text-pink-500" size={80} />
    }
  }

  const portfolio = portfolioName ? `"${portfolioName}"` : t('common.portfolio')

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
              {t(`emptyTransactions.${pageType}.title`)}
            </h2>

            {/* Main Message */}
            <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-4 max-w-lg mx-auto">
              {t(`emptyTransactions.${pageType}.message`, { portfolio })}
            </p>

            {/* Secondary Message */}
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8 max-w-md mx-auto">
              {t(`emptyTransactions.${pageType}.secondaryMessage`)}
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/transactions')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <PlusCircle size={20} />
                {t('emptyTransactions.addButton')}
              </button>
            </div>

            {/* Getting Started Steps */}
            <div className="mt-10 pt-8 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex items-start gap-2 text-left max-w-lg mx-auto mb-4">
                <Sparkles size={20} className="text-pink-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                    {t('emptyTransactions.quickStartTitle')}
                  </h3>
                  <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 text-xs font-bold flex-shrink-0">
                        1
                      </span>
                      <span>{t('emptyTransactions.step1')}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold flex-shrink-0">
                        2
                      </span>
                      <span>{t('emptyTransactions.step2')}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 text-xs font-bold flex-shrink-0">
                        3
                      </span>
                      <span>{t('emptyTransactions.step3')}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold flex-shrink-0">
                        4
                      </span>
                      <span>{t('emptyTransactions.step4')}</span>
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
                      {t('emptyTransactions.proTipTitle')}
                    </p>
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      {t('emptyTransactions.proTipMessage')}
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
