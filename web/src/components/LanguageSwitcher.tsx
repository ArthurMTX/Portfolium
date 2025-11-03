import { useState } from 'react'
import { Languages, ChevronRight } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'
import { getFlagUrl } from '../lib/countryUtils'

const languages = [
  { code: 'en', name: 'English', country: 'GB' },
  { code: 'fr', name: 'Français', country: 'FR' },
  { code: 'es', name: 'Español', country: 'ES' },
]

export default function LanguageSwitcher() {
  const { language, changeLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  
  const currentLanguage = languages.find(lang => lang.code === language) || languages[0]

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Languages size={16} />
          <span>Language</span>
        </div>
        <div className="flex items-center gap-2">
          <img
            src={getFlagUrl(currentLanguage.country, 'w20') || ''}
            alt={`${currentLanguage.name} flag`}
            className="w-5 h-4 object-cover rounded-sm"
          />
          <ChevronRight 
            size={16} 
            className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
        </div>
      </button>
      
      {isOpen && (
        <div className="bg-neutral-50 dark:bg-neutral-900 border-l-2 border-pink-400 dark:border-pink-600">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                changeLanguage(lang.code)
                setIsOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-2 pl-8 text-sm transition-colors ${
                language === lang.code
                  ? 'bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <img
                src={getFlagUrl(lang.country, 'w20') || ''}
                alt={`${lang.name} flag`}
                className="w-5 h-4 object-cover rounded-sm"
              />
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
