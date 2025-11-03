import { createContext, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface LanguageContextType {
  language: string
  changeLanguage: (lng: string) => void
  t: (key: string, options?: Record<string, unknown>) => string
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation()

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
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
