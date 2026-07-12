import { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PREDEFINED_LAYOUTS } from '@/features/boards/components/utils/predefinedLayouts'
import { starterLayouts } from '@/features/boards/components/utils/starterLayout'
import type { LayoutConfig } from '@/features/boards/types'

interface CreateBoardModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (input: { name: string; description: string; layoutConfig: LayoutConfig }) => unknown
  isSubmitting?: boolean
}

const BLANK_LAYOUT: LayoutConfig = { lg: [], md: [], sm: [] }

export default function CreateBoardModal({ isOpen, onClose, onCreate, isSubmitting = false }: CreateBoardModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const reset = () => {
    setName('')
    setDescription('')
    setSelectedTemplate('blank')
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError(t('boards.create.nameRequired'))
      return
    }

    const layoutConfig: LayoutConfig =
      selectedTemplate === 'blank'
        ? BLANK_LAYOUT
        : PREDEFINED_LAYOUTS.find((layout) => layout.name === selectedTemplate)?.layout_config ?? starterLayouts

    await onCreate({ name: name.trim(), description: description.trim(), layoutConfig })
    reset()
  }

  return (
    <div className="pf-modal-overlay">
      <div className="pf-modal-panel pf-modal-panel--sm" role="dialog" aria-modal="true" aria-labelledby="create-board-title">
        <div className="pf-modal-header">
          <h2 id="create-board-title" className="pf-modal-title">
            {t('boards.create.title')}
          </h2>
          <button onClick={handleClose} className="pf-modal-close" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pf-modal-body pf-modal-section">
          <div>
            <label className="pf-modal-label" htmlFor="board-name">
              {t('boards.create.nameLabel')} *
            </label>
            <input
              id="board-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="pf-modal-input"
              placeholder={t('boards.create.namePlaceholder')}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="pf-modal-label" htmlFor="board-description">
              {t('boards.create.descriptionLabel')}
            </label>
            <textarea
              id="board-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="pf-modal-textarea"
              rows={2}
              placeholder={t('boards.create.descriptionPlaceholder')}
            />
          </div>

          <div>
            <span className="pf-modal-label">{t('boards.create.startFrom')}</span>
            <div className="board-create__starters" role="radiogroup" aria-label={t('boards.create.startFrom')}>
              <label className={`board-create__starter ${selectedTemplate === 'blank' ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="board-starter"
                  value="blank"
                  checked={selectedTemplate === 'blank'}
                  onChange={() => setSelectedTemplate('blank')}
                />
                <span className="board-create__starter-title">{t('boards.create.blank')}</span>
                <span className="board-create__starter-description">{t('boards.create.blankDescription')}</span>
              </label>
              {PREDEFINED_LAYOUTS.map((template) => (
                <label
                  key={template.name}
                  className={`board-create__starter ${selectedTemplate === template.name ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="board-starter"
                    value={template.name}
                    checked={selectedTemplate === template.name}
                    onChange={() => setSelectedTemplate(template.name)}
                  />
                  <span className="board-create__starter-title">{template.name}</span>
                  <span className="board-create__starter-description">
                    {template.description || t('boards.create.templateDescription')}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && <div className="pf-modal-callout pf-modal-callout--danger">{error}</div>}

          <div className="pf-modal-footer -mx-5 -mb-5 mt-2">
            <button type="button" onClick={handleClose} className="pf-modal-button pf-modal-button--secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={isSubmitting} className="pf-modal-button pf-modal-button--primary">
              {isSubmitting ? t('common.saving') : t('boards.create.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
