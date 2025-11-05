import { useState } from 'react'
import { Languages } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'
import { getFlagUrl } from '../lib/countryUtils'

const languages = [
  { code: 'en', name: 'English', country: 'GB' },
  { code: 'fr', name: 'Français', country: 'FR' },
]

interface AuthLanguageSwitcherProps {
  darkMode?: boolean
}

export default function AuthLanguageSwitcher({ darkMode = false }: AuthLanguageSwitcherProps) {
  const { language, changeLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  
  const currentLanguage = languages.find(lang => lang.code === language) || languages[0]

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          darkMode
            ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100'
            : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
        }`}
        aria-label="Change language"
      >
        <Languages size={18} />
        <img
          src={getFlagUrl(currentLanguage.country, 'w20') || ''}
          alt={`${currentLanguage.name} flag`}
          className="w-5 h-4 object-cover rounded-sm"
        />
        <span className="text-sm font-medium">{currentLanguage.code.toUpperCase()}</span>
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop to close on outside click */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown menu */}
          <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-20 ${
            darkMode 
              ? 'bg-neutral-800 border border-neutral-700' 
              : 'bg-white border border-gray-200'
          }`}>
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  changeLanguage(lang.code)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  language === lang.code
                    ? darkMode
                      ? 'bg-pink-900/30 text-pink-400'
                      : 'bg-pink-50 text-pink-600'
                    : darkMode
                      ? 'text-neutral-300 hover:bg-neutral-700'
                      : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <img
                  src={getFlagUrl(lang.country, 'w20') || ''}
                  alt={`${lang.name} flag`}
                  className="w-5 h-4 object-cover rounded-sm"
                />
                <span className="font-medium">{lang.name}</span>
                {language === lang.code && (
                  <span className="ml-auto text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
