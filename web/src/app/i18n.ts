import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '@/locales/en/common.json'
import enAuth from '@/locales/en/auth.json'
import enDashboard from '@/locales/en/dashboard.json'
import enPortfolios from '@/locales/en/portfolios.json'
import enAssets from '@/locales/en/assets.json'
import enTransactions from '@/locales/en/transactions.json'
import enCharts from '@/locales/en/charts.json'
import enInsights from '@/locales/en/insights.json'
import enSettings from '@/locales/en/settings.json'
import enNotifications from '@/locales/en/notifications.json'
import enAdmin from '@/locales/en/admin.json'
import enBoards from '@/locales/en/boards.json'
import enCash from '@/locales/en/cash.json'

import frCommon from '@/locales/fr/common.json'
import frAuth from '@/locales/fr/auth.json'
import frDashboard from '@/locales/fr/dashboard.json'
import frPortfolios from '@/locales/fr/portfolios.json'
import frAssets from '@/locales/fr/assets.json'
import frTransactions from '@/locales/fr/transactions.json'
import frCharts from '@/locales/fr/charts.json'
import frInsights from '@/locales/fr/insights.json'
import frSettings from '@/locales/fr/settings.json'
import frNotifications from '@/locales/fr/notifications.json'
import frAdmin from '@/locales/fr/admin.json'
import frBoards from '@/locales/fr/boards.json'
import frCash from '@/locales/fr/cash.json'

// Each locale is split across multiple files by domain (see src/locales/<lang>/*.json)
// but merged here into a single `translation` namespace, so existing t('domain.key')
// calls throughout the app keep working unchanged.
const enTranslation = {
  ...enCommon, ...enAuth, ...enDashboard, ...enPortfolios, ...enAssets,
  ...enTransactions, ...enCharts, ...enInsights, ...enSettings, ...enNotifications, ...enAdmin, ...enBoards, ...enCash,
}
const frTranslation = {
  ...frCommon, ...frAuth, ...frDashboard, ...frPortfolios, ...frAssets,
  ...frTransactions, ...frCharts, ...frInsights, ...frSettings, ...frNotifications, ...frAdmin, ...frBoards, ...frCash,
}

// Initialize i18next
i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources: {
      en: {
        translation: enTranslation,
      },
      fr: {
        translation: frTranslation,
      }
    },
    fallbackLng: 'en',
    debug: false,
    
    // Language detection options
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'portfolium-language',
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },
  })
