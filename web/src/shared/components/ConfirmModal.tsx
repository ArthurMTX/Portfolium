import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { InlineLoading } from '@/shared/components/StatePrimitives'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  confirmButtonClass?: string
  loading?: boolean
  children?: React.ReactNode
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  confirmButtonClass,
  loading = false,
  children,
}: ConfirmModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      first?.focus()
    })

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const confirmVariantClass = variant === 'danger' ? 'pf-modal-button--danger' : 'pf-modal-button--primary'

  return (
    <div className="pf-modal-overlay" role="presentation">
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="pf-modal-panel pf-modal-panel--sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="pf-modal-header">
          <div>
            <h3 id="confirm-modal-title" className="pf-modal-title">
              {title}
            </h3>
            <p className="pf-modal-description">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="pf-modal-close"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="pf-modal-body pf-modal-body--compact">
          {children}
        </div>

        <div className="pf-modal-footer">
          <div />
          <div className="pf-modal-footer-actions">
          {cancelText && (
            <button
              onClick={onClose}
              disabled={loading}
              className="pf-modal-button pf-modal-button--secondary"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              onConfirm()
            }}
            disabled={loading}
            className={`pf-modal-button ${confirmButtonClass || confirmVariantClass}`}
          >
            {loading ? <InlineLoading label={confirmText} /> : confirmText}
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}
