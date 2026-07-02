import { useState } from 'react'
import { Languages, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/app/hooks/useLanguage'
import { getFlagUrl } from '@/shared/lib/countryUtils'

const languages = [
  { code: 'en', name: 'English', country: 'GB' },
  { code: 'fr', name: 'Français', country: 'FR' },
]

export default function LanguageSwitcher() {
  const { language, changeLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  
  const currentLanguage = languages.find(lang => lang.code === language) || languages[0]

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="pf-menu-item justify-between"
        type="button"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <Languages aria-hidden="true" />
          <span>Language</span>
        </div>
        <div className="flex items-center gap-2">
          <img
            src={getFlagUrl(currentLanguage.country, 'w20') || ''}
            alt={`${currentLanguage.name} flag`}
            className="w-5 h-4 object-cover rounded-sm"
          />
          <ChevronRight 
            aria-hidden="true"
            className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
        </div>
      </button>
      
      {isOpen && (
        <div className="border-l-2 border-pink-400 bg-neutral-50 dark:border-pink-600 dark:bg-neutral-900">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                changeLanguage(lang.code)
                setIsOpen(false)
              }}
              type="button"
              className={`flex w-full items-center gap-3 px-4 py-2 pl-8 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-pink-500/30 ${
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
