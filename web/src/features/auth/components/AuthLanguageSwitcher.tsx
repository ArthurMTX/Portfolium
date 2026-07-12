import { useState } from 'react'
import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/app/hooks/useLanguage'
import { getFlagUrl } from '@/shared/lib/countryUtils'
import '@/shared/design/pages/auth.css'

const languages = [
  { code: 'en', name: 'English', country: 'GB' },
  { code: 'fr', name: 'Français', country: 'FR' },
]

interface AuthLanguageSwitcherProps {
  darkMode?: boolean
}

export default function AuthLanguageSwitcher({ darkMode = false }: AuthLanguageSwitcherProps) {
  const { t } = useTranslation()
  const { language, changeLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)

  const currentLanguage = languages.find(lang => lang.code === language) || languages[0]

  return (
    <div className="auth-language" data-theme={darkMode ? 'dark' : 'light'}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="pf-button pf-button--secondary auth-language__trigger"
        aria-label={t('navigation.changeLanguage')}
        aria-expanded={isOpen}
      >
        <Languages aria-hidden="true" />
        <img
          src={getFlagUrl(currentLanguage.country, 'w20') || ''}
          alt={`${currentLanguage.name} flag`}
          className="auth-language__flag"
        />
        <span>{currentLanguage.code.toUpperCase()}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="auth-language__backdrop"
            onClick={() => setIsOpen(false)}
          />

          <div className="auth-language__menu">
            {languages.map((lang) => (
              <button
                type="button"
                key={lang.code}
                onClick={() => {
                  changeLanguage(lang.code)
                  setIsOpen(false)
                }}
                className={`auth-language__option ${language === lang.code ? 'is-active' : ''}`}
              >
                <img
                  src={getFlagUrl(lang.country, 'w20') || ''}
                  alt={`${lang.name} flag`}
                  className="auth-language__flag"
                />
                <span>{lang.name}</span>
                {language === lang.code && (
                  <span className="auth-language__check">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
