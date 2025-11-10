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
  Library
} from 'lucide-react'
import api from '../../../lib/api'
import type {DashboardLayoutDTO, 
  DashboardLayoutCreate,
  DashboardLayoutExport 
} from '../../../types/dashboard'
import { Layout } from 'react-grid-layout'
import { PREDEFINED_LAYOUTS } from '../utils/predefinedLayouts'

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
  portfolioId?: number
  onLoadLayout: (layout: DashboardLayoutDTO) => void
}

export default function LayoutManager({
  isOpen,
  onClose,
  currentLayout,
  portfolioId,
  onLoadLayout,
}: LayoutManagerProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'saved' | 'templates' | 'import'>('saved')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [importJson, setImportJson] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Fetch saved layouts
  const { data: layouts, isLoading } = useQuery({
    queryKey: ['dashboard-layouts', portfolioId],
    queryFn: () => api.getDashboardLayouts(portfolioId),
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
    mutationFn: ({ id, ...data }: { id: number; is_default?: boolean }) =>
      api.updateDashboardLayout(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-layouts'] })
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
      api.importDashboardLayout(data, portfolioId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-layouts'] })
      onLoadLayout(data)
      setImportJson('')
      setError(null)
      setActiveTab('saved') // Switch back to saved layouts tab
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson) as DashboardLayoutExport
      
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
      setError(err instanceof Error ? err.message : 'Invalid JSON')
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
      portfolio_id: portfolioId,
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Layout Manager
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Save, load, and share your dashboard layouts
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
        <div className="flex items-center gap-2 p-6 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setShowSaveDialog(true)}
            className="btn bg-pink-600 hover:bg-pink-700 text-white flex items-center gap-2 px-4 py-2"
          >
            <Save size={16} />
            Save Current Layout
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
            My Layouts
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
            Templates
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
            Import JSON
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {activeTab === 'saved' && (
            <>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-pink-600 border-t-transparent" />
              <p className="text-neutral-600 dark:text-neutral-400 mt-4">Loading layouts...</p>
            </div>
          ) : !layouts || layouts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto text-neutral-400" size={48} />
              <p className="text-neutral-600 dark:text-neutral-400 mt-4">No saved layouts yet</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-2">
                Save your current layout to get started
              </p>
            </div>
          ) : (
            layouts.map((layout) => (
              <div
                key={layout.id}
                className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-pink-300 dark:hover:border-pink-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {layout.name}
                      </h3>
                      {layout.is_default && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    {layout.description && (
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                        {layout.description}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
                      Updated: {new Date(layout.updated_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
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
                      className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                      title="Load this layout"
                    >
                      <Plus size={16} className="text-green-600 dark:text-green-400" />
                    </button>
                    <button
                      onClick={() => toggleDefault(layout)}
                      className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                      title={layout.is_default ? 'Remove as default' : 'Set as default'}
                    >
                      {layout.is_default ? (
                        <Star size={16} className="text-yellow-500 fill-yellow-500" />
                      ) : (
                        <StarOff size={16} className="text-neutral-400" />
                      )}
                    </button>
                    <button
                      onClick={() => duplicateMutation.mutate({ id: layout.id, name: `${layout.name} (Copy)` })}
                      className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                      title="Duplicate"
                    >
                      <Copy size={16} className="text-blue-600 dark:text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleExport(layout.id, layout.name)}
                      className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                      title="Export as JSON"
                    >
                      <Download size={16} className="text-purple-600 dark:text-purple-400" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(layout.id)}
                      className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>
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
                  <strong>💡 Pro tip:</strong> These are professionally designed layouts optimized for different investment styles. Click "Load" to apply any template.
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
                          Template
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
                            Loading...
                          </>
                        ) : (
                          <>
                            <Plus size={16} />
                            Load
                          </>
                        )}
                      </button>
                      <button
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                        title="Download JSON"
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
                  Paste exported layout JSON below to import a custom layout.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Layout JSON
                </label>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder='Paste exported JSON here (e.g., { "name": "My Layout", "layout_config": {...} })'
                  className="w-full h-64 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={!importJson.trim() || importMutation.isPending}
                  className="btn bg-pink-600 hover:bg-pink-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 px-4 py-2"
                >
                  {importMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Import Layout
                    </>
                  )}
                </button>
                <button
                  onClick={() => setImportJson('')}
                  className="btn bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 px-4 py-2"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4">
                Save Current Layout
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Layout Name *
                  </label>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="e.g., My Custom Dashboard"
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    placeholder="Describe this layout..."
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
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="btn bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save Layout'}
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
