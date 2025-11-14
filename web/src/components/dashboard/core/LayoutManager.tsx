/**
 * Dashboard Layout Manager
 * Provides CRUD operations for saved layouts with import/export functionality
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  Save, 
  Trash2, 
  Copy, 
  Download, 
  Upload, 
  Star, 
  StarOff, 
  Plus,
  X,
  FileText,
  AlertTriangle,
  Library,
  Edit2,
  Check
} from 'lucide-react'
import api from '../../../lib/api'
import type {DashboardLayoutDTO, 
  DashboardLayoutCreate,
  DashboardLayoutExport 
} from '../../../types/dashboard'
import { Layout } from 'react-grid-layout'
import { PREDEFINED_LAYOUTS } from '../utils/predefinedLayouts'
import { useTranslation } from 'react-i18next'
import { loadLayout } from '../utils/defaultLayouts'
import { useAuth } from '../../../contexts/AuthContext'

/**
 * Compact layout vertically - removes gaps between widgets
 */
const compactLayout = (layout: Layout[], breakpoint: 'lg' | 'md' | 'sm'): Layout[] => {
  if (!layout || layout.length === 0) return layout
  
  // Sort by y position, then x position
  const sorted = [...layout].sort((a, b) => {
    if (a.y === b.y) return a.x - b.x
    return a.y - b.y
  })
  
  // Track occupied spaces using a grid
  const cols = breakpoint === 'lg' ? 12 : breakpoint === 'md' ? 8 : 4
  const grid: boolean[][] = []
  
  // Place each widget in the next available position
  const compacted = sorted.map(item => {
    // Find the first available y position for this widget
    let targetY = 0
    let foundPosition = false
    
    while (!foundPosition && targetY < 1000) { // Safety limit
      foundPosition = true
      
      // Check if this position has enough space
      for (let dy = 0; dy < item.h; dy++) {
        const row = targetY + dy
        if (!grid[row]) grid[row] = Array(cols).fill(false)
        
        for (let dx = 0; dx < item.w; dx++) {
          const col = item.x + dx
          if (col >= cols || grid[row][col]) {
            foundPosition = false
            break
          }
        }
        if (!foundPosition) break
      }
      
      if (!foundPosition) targetY++
    }
    
    // Mark this space as occupied
    for (let dy = 0; dy < item.h; dy++) {
      const row = targetY + dy
      if (!grid[row]) grid[row] = Array(cols).fill(false)
      for (let dx = 0; dx < item.w; dx++) {
        const col = item.x + dx
        if (col < cols) {
          grid[row][col] = true
        }
      }
    }
    
    return {
      ...item,
      y: targetY
    }
  })
  
  return compacted
}

interface LayoutManagerProps {
  isOpen: boolean
  onClose: () => void
  currentLayout: {
    lg: Layout[]
    md: Layout[]
    sm: Layout[]
  }
  onLoadLayout: (layout: DashboardLayoutDTO) => void
}

export default function LayoutManager({
  isOpen,
  onClose,
  currentLayout,
  onLoadLayout,
}: LayoutManagerProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'saved' | 'templates' | 'import'>('saved')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingLayout, setEditingLayout] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [saveConfirmId, setSaveConfirmId] = useState<number | null>(null)
  const { t } = useTranslation()

  // Fetch saved layouts (now global across all portfolios)
  const { data: layouts, isLoading } = useQuery({
    queryKey: ['dashboard-layouts'],
    queryFn: () => api.getDashboardLayouts(),
    enabled: isOpen,
  })

  // Save current layout
  const saveMutation = useMutation({
    mutationFn: (data: DashboardLayoutCreate) => api.createDashboardLayout(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-layouts'] })
      setShowSaveDialog(false)
      setSaveName('')
      setSaveDescription('')
      setError(null)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  // Update layout
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; description?: string; is_default?: boolean; layout_config?: { lg: Layout[]; md: Layout[]; sm: Layout[] } }) =>
      api.updateDashboardLayout(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-layouts'] })
      setEditingLayout(null)
      setError(null)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  // Delete layout
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteDashboardLayout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-layouts'] })
    },
  })

  // Duplicate layout
  const duplicateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.duplicateDashboardLayout(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-layouts'] })
    },
  })

  // Export layout
  const handleExport = async (layoutId: number, layoutName: string) => {
    try {
      const exportData = await api.exportDashboardLayout(layoutId)
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${layoutName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_layout.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  // Import layout
  const importMutation = useMutation({
    mutationFn: (data: DashboardLayoutExport) => 
      api.importDashboardLayout(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-layouts'] })
      onLoadLayout(data)
      setSelectedFile(null)
      setError(null)
      setActiveTab('saved') // Switch back to saved layouts tab
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Please select a file to import')
      return
    }

    try {
      const text = await selectedFile.text()
      const parsed = JSON.parse(text) as DashboardLayoutExport
      
      // Validate structure
      if (!parsed.layout_config || !parsed.layout_config.lg || !parsed.layout_config.md || !parsed.layout_config.sm) {
        throw new Error('Invalid layout format: missing required breakpoints')
      }
      
      // Compact the layouts to remove gaps
      const compactedLayout: DashboardLayoutExport = {
        ...parsed,
        layout_config: {
          lg: compactLayout(parsed.layout_config.lg, 'lg'),
          md: compactLayout(parsed.layout_config.md, 'md'),
          sm: compactLayout(parsed.layout_config.sm, 'sm'),
        }
      }
      
      importMutation.mutate(compactedLayout)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON file')
    }
  }

  const handleSave = () => {
    if (!saveName.trim()) {
      setError('Please enter a layout name')
      return
    }

    saveMutation.mutate({
      name: saveName.trim(),
      description: saveDescription.trim() || undefined,
      portfolio_id: null, // Layouts are now global across all portfolios
      layout_config: currentLayout,
      is_default: false,
    })
  }

  const toggleDefault = (layout: DashboardLayoutDTO) => {
    updateMutation.mutate({
      id: layout.id,
      is_default: !layout.is_default,
    })
  }

  const startEditing = (layout: DashboardLayoutDTO) => {
    setEditingLayout(layout.id)
    setEditName(layout.name)
    setEditDescription(layout.description || '')
    setError(null)
  }

  const cancelEditing = () => {
    setEditingLayout(null)
    setEditName('')
    setEditDescription('')
    setError(null)
  }

  const saveEditing = (layoutId: number) => {
    if (!editName.trim()) {
      setError('Please enter a layout name')
      return
    }

    updateMutation.mutate({
      id: layoutId,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    })
  }

  const handleDelete = (layoutId: number) => {
    deleteMutation.mutate(layoutId)
    setDeleteConfirmId(null)
  }

  const handleSaveToLayout = (layoutId: number) => {
    // Load the ACTUAL current layout from localStorage (the source of truth)
    const actualCurrentLayout = {
      lg: loadLayout('lg', user?.id),
      md: loadLayout('md', user?.id),
      sm: loadLayout('sm', user?.id),
    }
    
    // Compact the layout before saving
    const compactedLayout = {
      lg: compactLayout(actualCurrentLayout.lg, 'lg'),
      md: compactLayout(actualCurrentLayout.md, 'md'),
      sm: compactLayout(actualCurrentLayout.sm, 'sm'),
    }
    
    console.log('Saving layout config:', compactedLayout)
    
    updateMutation.mutate({
      id: layoutId,
      layout_config: compactedLayout,
    }, {
      onSuccess: () => {
        console.log('Layout saved successfully')
        setSaveConfirmId(null)
      },
      onError: (error) => {
        console.error('Failed to save layout:', error)
        setError(`Failed to save: ${error.message}`)
      }
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {t('dashboard.layouts.title')}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {t('dashboard.layouts.description')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-medium text-red-900 dark:text-red-100">Error</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 p-6 border-b border-neutral-200 dark:border-neutral-800 flex-wrap">
          <button
            onClick={() => setShowSaveDialog(true)}
            className="btn bg-pink-600 hover:bg-pink-700 text-white flex items-center gap-2 px-4 py-2"
          >
            <Plus size={16} />
            {t('dashboard.layouts.saveAsNewLayout')}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-6">
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'saved'
                ? 'border-pink-600 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <Save size={16} className="inline mr-2" />
            {t('dashboard.layouts.myLayouts')}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-pink-600 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <Library size={16} className="inline mr-2" />
            {t('dashboard.layouts.templates')}
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-pink-600 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <Upload size={16} className="inline mr-2" />
            {t('common.import')}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {activeTab === 'saved' && (
            <>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-pink-600 border-t-transparent" />
              <p className="text-neutral-600 dark:text-neutral-400 mt-4">{t('dashboard.layouts.loadingLayouts')}</p>
            </div>
          ) : !layouts || layouts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto text-neutral-400" size={48} />
              <p className="text-neutral-600 dark:text-neutral-400 mt-4">{t('dashboard.layouts.noSavedLayouts')}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-2">
                {t('dashboard.layouts.noSavedLayoutsInfo')}
              </p>
            </div>
          ) : (
            layouts.map((layout) => (
              <div
                key={layout.id}
                className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-pink-300 dark:hover:border-pink-700 transition-colors"
              >
                {editingLayout === layout.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        {t('dashboard.layouts.layoutName')} *
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        {t('dashboard.layouts.descriptionField')}
                      </label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1.5 text-sm bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={() => saveEditing(layout.id)}
                        disabled={updateMutation.isPending}
                        className="px-3 py-1.5 text-sm bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check size={14} />
                        {t('common.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {layout.name}
                        </h3>
                        {layout.is_default && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full">
                            {t('common.default')}
                          </span>
                        )}
                      </div>
                      {layout.description && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                          {layout.description}
                        </p>
                      )}
                      <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
                        {t('common.updatedAt', { date: new Date(layout.updated_at).toLocaleDateString() })}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          // Compact the layout before loading
                          const compactedLayout: DashboardLayoutDTO = {
                            ...layout,
                            layout_config: {
                              lg: compactLayout(layout.layout_config.lg, 'lg'),
                              md: compactLayout(layout.layout_config.md, 'md'),
                              sm: compactLayout(layout.layout_config.sm, 'sm'),
                            }
                          }
                          onLoadLayout(compactedLayout)
                        }}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                        title={t('dashboard.layouts.loadThisLayout')}
                      >
                        <Plus size={14} />
                        {t('common.load')}
                      </button>
                      <button
                        onClick={() => setSaveConfirmId(layout.id)}
                        className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                        title={t('dashboard.layouts.saveCurrentToThisLayout')}
                      >
                        <Save size={14} />
                        {t('common.save')}
                      </button>
                      <div className="w-px h-6 bg-neutral-300 dark:bg-neutral-700" />
                      <button
                        onClick={() => startEditing(layout)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                        title={t('common.edit')}
                      >
                        <Edit2 size={16} className="text-blue-600 dark:text-blue-400" />
                      </button>
                      <button
                        onClick={() => toggleDefault(layout)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                        title={layout.is_default ? t('dashboard.layouts.removeAsDefault') : t('dashboard.layouts.setAsDefault')}
                      >
                        {layout.is_default ? (
                          <Star size={16} className="text-yellow-500 fill-yellow-500" />
                        ) : (
                          <StarOff size={16} className="text-neutral-400" />
                        )}
                      </button>
                      <button
                        onClick={() => duplicateMutation.mutate({ id: layout.id, name: `${layout.name} (${t('common.copy')})` })}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                        title={t('dashboard.layouts.duplicateLayout')}
                      >
                        <Copy size={16} className="text-blue-600 dark:text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleExport(layout.id, layout.name)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                        title={t('common.export')}
                      >
                        <Download size={16} className="text-purple-600 dark:text-purple-400" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(layout.id)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Save Confirmation */}
                {saveConfirmId === layout.id && (
                  <div className="mt-3 p-3 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg">
                    <p className="text-sm text-pink-900 dark:text-pink-100 mb-2">
                      <strong>{t('dashboard.layouts.confirmSave')}</strong> {t('dashboard.layouts.saveCurrentConfirm').replace('{name}', layout.name)}
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setSaveConfirmId(null)}
                        className="px-3 py-1.5 text-sm bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={() => handleSaveToLayout(layout.id)}
                        disabled={updateMutation.isPending}
                        className="px-3 py-1.5 text-sm bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {updateMutation.isPending ? t('common.saving') : t('common.save')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete Confirmation */}
                {deleteConfirmId === layout.id && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-900 dark:text-red-100 mb-2">
                      <strong>{t('common.confirmDelete')}</strong> {t('dashboard.layouts.deleteLayoutConfirm').replace('{name}', layout.name)}
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1.5 text-sm bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={() => handleDelete(layout.id)}
                        disabled={deleteMutation.isPending}
                        className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? t('common.deleting') : t('common.delete')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          </>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <>
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>{t('dashboard.proTip')}:</strong> {t('dashboard.layouts.proTipInfo')}
                </p>
              </div>
              {PREDEFINED_LAYOUTS.map((template, index) => (
                <div
                  key={index}
                  className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-pink-300 dark:hover:border-pink-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {template.name}
                        </h3>
                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full">
                          {t('dashboard.layouts.template')}
                        </span>
                      </div>
                      {template.description && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                          {template.description}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          // Compact the template layout before importing
                          const compactedTemplate: DashboardLayoutExport = {
                            ...template,
                            layout_config: {
                              lg: compactLayout(template.layout_config.lg, 'lg'),
                              md: compactLayout(template.layout_config.md, 'md'),
                              sm: compactLayout(template.layout_config.sm, 'sm'),
                            }
                          }
                          importMutation.mutate(compactedTemplate)
                        }}
                        className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        disabled={importMutation.isPending}
                      >
                        {importMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            {t('common.loading')}
                          </>
                        ) : (
                          <>
                            <Plus size={16} />
                            {t('common.load')}
                          </>
                        )}
                      </button>
                      <button
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                        title={t('common.export')}
                        onClick={(e) => {
                          e.preventDefault()
                          const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_template.json`
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          URL.revokeObjectURL(url)
                        }}
                      >
                        <Download size={16} className="text-purple-600 dark:text-purple-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Import JSON Tab */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  {t('dashboard.layouts.importLayoutInfo')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  {t('dashboard.layouts.selectLayoutFile')}
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileSelect}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 dark:file:bg-pink-900/30 dark:file:text-pink-300 dark:hover:file:bg-pink-900/50 cursor-pointer"
                  />
                </div>
                {selectedFile && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                    {t('common.selected')}: <span className="font-medium">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={!selectedFile || importMutation.isPending}
                  className="btn bg-pink-600 hover:bg-pink-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 px-4 py-2"
                >
                  {importMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      {t('common.importing')}
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      {t('common.import')}
                    </>
                  )}
                </button>
                {selectedFile && (
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="btn bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 px-4 py-2"
                  >
                    {t('common.clear')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4">
                {t('dashboard.layouts.saveAsNewLayout')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {t('dashboard.layouts.layoutName')} *
                  </label>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder={t('dashboard.layouts.layoutNamePlaceholder')}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {t('dashboard.layouts.descriptionField')} ({t('common.optional')})
                  </label>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    placeholder={t('dashboard.layouts.descriptionPlaceholder')}
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowSaveDialog(false)
                      setSaveName('')
                      setSaveDescription('')
                      setError(null)
                    }}
                    className="btn bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 px-4 py-2"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="btn bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
