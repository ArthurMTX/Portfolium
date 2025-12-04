import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { IconComponent } from './WatchlistTagManager'
import { useTranslation } from 'react-i18next'

interface WatchlistTag {
  id: number
  user_id: number
  name: string
  icon: string
  color: string
  created_at: string
  updated_at: string
}

interface WatchlistTagSelectorProps {
  availableTags: WatchlistTag[]
  selectedTagIds: number[]
  onChange: (tagIds: number[]) => void
  compact?: boolean
  placeholder?: string
}

export default function WatchlistTagSelector({
  availableTags,
  selectedTagIds,
  onChange,
  compact = false,
  placeholder,
}: WatchlistTagSelectorProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleTag = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  const selectedTags = availableTags.filter(tag => selectedTagIds.includes(tag.id))

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          {selectedTags.length > 0 ? (
            <div className="flex items-center gap-1">
              {selectedTags.slice(0, 2).map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs"
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                >
                  <IconComponent name={tag.icon} size={10} />
                  {tag.name}
                </span>
              ))}
              {selectedTags.length > 2 && (
                <span className="text-neutral-500">+{selectedTags.length - 2}</span>
              )}
            </div>
          ) : (
            <span className="text-neutral-500">{placeholder || t('watchlist.tags.select')}</span>
          )}
          <ChevronDown size={14} className="text-neutral-500" />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 min-w-[180px] py-1">
            {availableTags.length === 0 ? (
              <div className="px-3 py-2 text-sm text-neutral-500">
                {t('watchlist.tags.noTags')}
              </div>
            ) : (
              availableTags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left"
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                  >
                    <IconComponent name={tag.icon} size={12} />
                  </div>
                  <span className="flex-1 text-sm">{tag.name}</span>
                  {selectedTagIds.includes(tag.id) && (
                    <Check size={14} className="text-green-500" />
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="input w-full cursor-pointer flex items-center justify-between gap-2 min-h-[42px]"
      >
        {selectedTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectedTags.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                style={{ backgroundColor: tag.color + '20', color: tag.color }}
              >
                <IconComponent name={tag.icon} size={12} />
                {tag.name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleTag(tag.id)
                  }}
                  className="ml-0.5 hover:bg-black/10 rounded"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-neutral-500">{placeholder || t('watchlist.tags.select')}</span>
        )}
        <ChevronDown size={18} className="text-neutral-500 flex-shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 max-h-48 overflow-y-auto py-1">
          {availableTags.length === 0 ? (
            <div className="px-3 py-2 text-sm text-neutral-500">
              {t('watchlist.tags.noTags')}
            </div>
          ) : (
            availableTags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left"
              >
                <div
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                >
                  <IconComponent name={tag.icon} size={14} />
                </div>
                <span className="flex-1 text-sm">{tag.name}</span>
                {selectedTagIds.includes(tag.id) && (
                  <Check size={16} className="text-green-500" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
