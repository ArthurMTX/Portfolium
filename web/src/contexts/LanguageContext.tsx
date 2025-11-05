import { createContext, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

interface LanguageContextType {
  language: string
  changeLanguage: (lng: string) => void
  t: (key: string, options?: Record<string, unknown>) => string
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation()

  const changeLanguage = async (lng: string) => {
    // Change i18n language immediately for UI
    i18n.changeLanguage(lng)
    
    // Try to save to backend (will only work if user is logged in)
    // We catch and ignore errors since this might be called before login
    try {
      await api.updateCurrentUser({ preferred_language: lng })
    } catch (error) {
      // Silently ignore - user might not be logged in yet
      // The language will be saved when they log in or update their profile
    }
  }

  return (
    <LanguageContext.Provider
      value={{
        language: i18n.language,
        changeLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export default LanguageProvider
