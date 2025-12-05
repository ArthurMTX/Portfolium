import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { X, Plus, Trash2, Check, Pencil, Tag, Search } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { useTranslation } from 'react-i18next'
import iconTags from 'lucide-static/tags.json'

interface WatchlistTag {
  id: number
  user_id: number
  name: string
  icon: string
  color: string
  created_at: string
  updated_at: string
}

// Get all icon names from lucide-static tags.json
const ALL_ICONS = Object.keys(iconTags as Record<string, string[]>).sort()

// Icon tags for search - from lucide-static
const ICON_TAGS = iconTags as Record<string, string[]>

// Popular icons to show first when not searching
const POPULAR_ICONS = [
  'tag', 'star', 'heart', 'bookmark', 'flag',
  'zap', 'target', 'trending-up', 'trending-down', 'activity',
  'bar-chart', 'pie-chart', 'percent', 'wallet', 'credit-card',
  'dollar-sign', 'euro', 'banknote', 'bitcoin', 'piggy-bank',
  'check-circle', 'alert-circle', 'alert-triangle', 'info', 'help-circle',
  'bell', 'clock', 'calendar', 'hourglass', 'loader',
  'eye', 'eye-off', 'lock', 'shield', 'key',
  'briefcase', 'building', 'store', 'factory', 'warehouse',
  'shopping-cart', 'package', 'truck', 'globe', 'map',
  'map-pin', 'navigation', 'compass', 'plane',
  'sun', 'moon', 'leaf', 'flame', 'droplet',
  'rocket', 'lightbulb', 'sparkles', 'trophy', 'award',
  'crown', 'diamond', 'gem', 'gift', 'medal',
  'arrow-up', 'arrow-down', 'arrow-up-right',
  'chevron-up', 'chevron-down', 'refresh-cw',
  'plus', 'minus', 'x', 'check', 'search',
  'settings', 'sliders-horizontal', 'filter', 'sort-asc', 'sort-desc',
  'user', 'users', 'home', 'cpu', 'database',
  'server', 'cloud', 'gauge', 'bar-chart-3',
  'line-chart', 'list', 'grid-3x3', 'layout-dashboard', 'save',
  'edit', 'copy', 'link', 'share-2', 'download', 'upload'
].filter(icon => ALL_ICONS.includes(icon)) // Only keep icons that exist


// Predefined colors
const AVAILABLE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#737373',
  '#fca5a5', '#fdba74', '#fde047', '#86efac', '#5eead4', '#93c5fd', '#a5b4fc', '#c4b5fd', '#f9a8d4', '#a3a3a3'
]

interface WatchlistTagManagerProps {
  isOpen: boolean
  onClose: () => void
  onTagsUpdated: () => void
}

// Helper to convert kebab-case to PascalCase for icon lookup
const kebabToPascal = (str: string): string => {
  return str.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')
}

// Render an icon by name - exported for use in other components
const IconComponent = ({ name, size = 16, className = '' }: { name: string; size?: number; className?: string }) => {
  const pascalName = kebabToPascal(name)
  const Icon = (LucideIcons as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[pascalName]
  if (!Icon) return <Tag size={size} className={className} />
  return <Icon size={size} className={className} />
}

// Search icons by name AND by tags (keywords)
const searchIcons = (query: string): string[] => {
  if (!query) return POPULAR_ICONS
  
  const lowerQuery = query.toLowerCase()
  const results: string[] = []
  
  for (const iconName of ALL_ICONS) {
    // Match by icon name
    if (iconName.includes(lowerQuery)) {
      results.push(iconName)
      continue
    }
    
    // Match by tags/keywords
    const tags = ICON_TAGS[iconName]
    if (tags && tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
      results.push(iconName)
    }
  }
  
  return results.slice(0, 100) // Limit results for performance
}

export default function WatchlistTagManager({ isOpen, onClose, onTagsUpdated }: WatchlistTagManagerProps) {
  const { t } = useTranslation()
  const [tags, setTags] = useState<WatchlistTag[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTag, setEditingTag] = useState<WatchlistTag | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [newTagIcon, setNewTagIcon] = useState('tag')
  const [newTagColor, setNewTagColor] = useState('#6366f1')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [iconSearch, setIconSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  
  const iconPickerRef = useRef<HTMLDivElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Close pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
        setShowIconPicker(false)
      }
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadTags = async () => {
    try {
      setLoading(true)
      const data = await api.getWatchlistTags()
      setTags(data)
    } catch (err) {
      console.error('Failed to load tags:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadTags()
      setError(null)
      setDeleteConfirm(null)
    }
  }, [isOpen])

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      setError(t('watchlist.tags.nameRequired'))
      return
    }

    try {
      setIsCreating(true)
      setError(null)
      await api.createWatchlistTag({
        name: newTagName.trim(),
        icon: newTagIcon,
        color: newTagColor,
      })
      setNewTagName('')
      setNewTagIcon('tag')
      setNewTagColor('#6366f1')
      await loadTags()
      onTagsUpdated()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(t('watchlist.tags.createFailed'))
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateTag = async (tag: WatchlistTag) => {
    try {
      await api.updateWatchlistTag(tag.id, {
        name: tag.name,
        icon: tag.icon,
        color: tag.color,
      })
      setEditingTag(null)
      await loadTags()
      onTagsUpdated()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      }
    }
  }

  const handleDeleteTag = async (tagId: number) => {
    try {
      await api.deleteWatchlistTag(tagId)
      setDeleteConfirm(null)
      await loadTags()
      onTagsUpdated()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      }
    }
  }

  // Search icons by name AND tags - uses lucide-static tags.json
  const filteredIcons = searchIcons(iconSearch)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              {t('watchlist.tags.manage')}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {tags.length} {tags.length === 1 ? 'tag' : 'tags'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Create New Tag - Fixed section (not scrollable) */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
          {/* Error message */}
          {error && (
            <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
            {t('watchlist.tags.createNew')}
          </label>
          
          <div className="flex gap-3">
            {/* Icon Picker */}
            <div className="relative" ref={iconPickerRef}>
              <button
                type="button"
                onClick={() => {
                  setShowIconPicker(!showIconPicker)
                  setShowColorPicker(false)
                }}
                className="w-11 h-11 flex items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                style={{ color: newTagColor }}
                title="Choose icon"
              >
                <IconComponent name={newTagIcon} size={20} />
              </button>
              
              {showIconPicker && (
                <div className="absolute top-full left-0 mt-1 z-[60] bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 p-3 w-72">
                  {/* Search */}
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      placeholder={`Search ${ALL_ICONS.length} icons...`}
                      className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                  
                  {/* Icons Grid */}
                  <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                    {filteredIcons.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => {
                          setNewTagIcon(icon)
                          setShowIconPicker(false)
                          setIconSearch('')
                        }}
                        className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors ${
                          newTagIcon === icon ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600' : ''
                        }`}
                        title={icon}
                      >
                        <IconComponent name={icon} size={16} />
                      </button>
                    ))}
                  </div>
                  {iconSearch && filteredIcons.length === 0 && (
                    <p className="text-xs text-neutral-500 text-center py-2">No icons found</p>
                  )}
                  {iconSearch && filteredIcons.length === 100 && (
                    <p className="text-xs text-neutral-400 text-center pt-2">Showing first 100 results</p>
                  )}
                </div>
              )}
            </div>

            {/* Color Picker */}
            <div className="relative" ref={colorPickerRef}>
              <button
                type="button"
                onClick={() => {
                  setShowColorPicker(!showColorPicker)
                  setShowIconPicker(false)
                }}
                className="w-11 h-11 rounded-lg border border-neutral-300 dark:border-neutral-600 overflow-hidden hover:ring-2 hover:ring-pink-500 transition-all"
                title="Choose color"
              >
                <div className="w-full h-full" style={{ backgroundColor: newTagColor }} />
              </button>
              
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 z-[60] bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 p-3 w-56">
                  <div className="grid grid-cols-10 gap-1">
                    {AVAILABLE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          setNewTagColor(color)
                          setShowColorPicker(false)
                        }}
                        className={`w-6 h-6 rounded transition-transform hover:scale-110 ${
                          newTagColor === color ? 'ring-2 ring-offset-1 ring-pink-500 dark:ring-offset-neutral-800' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Name Input */}
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder={t('watchlist.tags.namePlaceholder')}
              maxLength={30}
              className="flex-1 px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateTag()
                }
              }}
            />

            {/* Create Button */}
            <button
              onClick={handleCreateTag}
              disabled={isCreating || !newTagName.trim()}
              className="px-4 py-2.5 rounded-lg bg-pink-600 text-white font-medium hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Preview */}
          {newTagName && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Preview:</span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: newTagColor + '20', color: newTagColor }}
              >
                <IconComponent name={newTagIcon} size={12} />
                {newTagName}
              </span>
            </div>
          )}
        </div>

        {/* Existing Tags - Scrollable section */}
        <div className="p-6 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
              {t('watchlist.tags.existing')}
            </label>
            
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : tags.length === 0 ? (
              <div className="text-center py-8 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600">
                <Tag size={24} className="mx-auto text-neutral-400 dark:text-neutral-500 mb-2" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t('watchlist.tags.noTags')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 group"
                  >
                    {editingTag?.id === tag.id ? (
                      <>
                        {/* Editing Mode */}
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: editingTag.color + '20', color: editingTag.color }}
                        >
                          <IconComponent name={editingTag.icon} size={16} />
                        </div>
                        <input
                          type="text"
                          value={editingTag.name}
                          onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                          maxLength={30}
                          className="flex-1 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateTag(editingTag)}
                          className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-md transition-colors"
                          title="Save"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingTag(null)}
                          className="p-2 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : deleteConfirm === tag.id ? (
                      <>
                        {/* Delete Confirmation */}
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: tag.color + '20', color: tag.color }}
                        >
                          <IconComponent name={tag.icon} size={16} />
                        </div>
                        <span className="flex-1 text-sm text-red-600 dark:text-red-400">
                          Delete "{tag.name}"?
                        </span>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="px-3 py-1.5 text-xs text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 bg-neutral-200 dark:bg-neutral-600 hover:bg-neutral-300 dark:hover:bg-neutral-500 rounded-md transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Display Mode */}
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: tag.color + '20', color: tag.color }}
                        >
                          <IconComponent name={tag.icon} size={16} />
                        </div>
                        <span className="flex-1 font-medium text-neutral-900 dark:text-neutral-100 text-sm truncate">
                          {tag.name}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingTag({ ...tag })}
                            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(tag.id)}
                            className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

export { IconComponent, ALL_ICONS, AVAILABLE_COLORS }
