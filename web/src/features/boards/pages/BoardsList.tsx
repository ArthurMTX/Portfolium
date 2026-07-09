import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Copy, PlusCircle, Star, StarOff, Trash2 } from 'lucide-react'
import api from '@/api'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import ConfirmModal from '@/shared/components/ConfirmModal'
import { ListSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
import {
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageShell,
  PageSummaryPanel,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import CreateBoardModal from '@/features/boards/components/core/CreateBoardModal'
import type { Board, LayoutConfig } from '@/features/boards/types'
import '@/shared/design/pages/boards.css'

function formatDate(dateString: string, locale?: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(locale || undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function widgetCount(board: Board): number {
  return board.layout_config.lg.length
}

export default function BoardsList() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const setPortfolios = usePortfolioStore((state) => state.setPortfolios)
  const setActivePortfolio = usePortfolioStore((state) => state.setActivePortfolio)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Board | null>(null)
  const [renameTarget, setRenameTarget] = useState<Board | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const { data: portfoliosData, isLoading: portfoliosLoading } = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.getPortfolios(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  useEffect(() => {
    if (!portfoliosData) return
    setPortfolios(portfoliosData)
    if (portfoliosData.length > 0 && !activePortfolioId) {
      setActivePortfolio(portfoliosData[0].id)
    }
  }, [portfoliosData, activePortfolioId, setPortfolios, setActivePortfolio])

  const { data: boards, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['boards'],
    queryFn: () => api.getDashboardLayouts(),
  })

  const createMutation = useMutation({
    mutationFn: (input: { name: string; description: string; layoutConfig: LayoutConfig }) =>
      api.createDashboardLayout({
        name: input.name,
        description: input.description || undefined,
        layout_config: input.layoutConfig,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['boards'] })
      setIsCreateOpen(false)
      navigate(`/boards/${created.uuid}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (uuid: string) => api.deleteDashboardLayout(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] })
      setDeleteTarget(null)
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: ({ uuid, name }: { uuid: string; name: string }) => api.duplicateDashboardLayout(uuid, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['boards'] }),
  })

  const renameMutation = useMutation({
    mutationFn: ({ uuid, name }: { uuid: string; name: string }) => api.updateDashboardLayout(uuid, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] })
      setRenameTarget(null)
    },
  })

  const setDefaultMutation = useMutation({
    mutationFn: ({ uuid, isDefault }: { uuid: string; isDefault: boolean }) =>
      api.updateDashboardLayout(uuid, { is_default: isDefault }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['boards'] }),
  })

  if (!portfoliosLoading && portfolios.length === 0) {
    return <EmptyPortfolioPrompt pageType="boards" />
  }

  const sortedBoards = [...(boards ?? [])].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
  const lastEditedBoard = sortedBoards[0]

  return (
    <PageShell className="boards-list">
      <PageHeader>
        <PageTitleBlock
          kicker={t('boards.list.kicker')}
          title={t('boards.list.title')}
          description={t('boards.list.description')}
        />
        <PageSummaryPanel
          lead={t('boards.list.boardCount', { count: sortedBoards.length })}
          description={lastEditedBoard ? `${t('boards.list.lastEdited')}: ${lastEditedBoard.name}` : undefined}
          actions={
            <button type="button" className="pf-button pf-button--primary" onClick={() => setIsCreateOpen(true)}>
              <PlusCircle size={16} />
              {t('boards.list.createBoard')}
            </button>
          }
        />
      </PageHeader>

      {isLoading ? (
        <ListSkeleton rows={3} label={t('common.loading')} />
      ) : isError ? (
        <StateBlock
          tone="error"
          title={t('boards.list.title')}
          description={error instanceof Error ? error.message : String(error)}
          actionLabel={t('common.retry')}
          onAction={() => refetch()}
        />
      ) : sortedBoards.length === 0 ? (
        <StateBlock
          tone="empty"
          title={t('boards.list.noBoardsTitle')}
          description={t('boards.list.noBoardsDescription')}
        >
          <button type="button" className="pf-button pf-button--primary" onClick={() => setIsCreateOpen(true)}>
            <PlusCircle size={16} />
            {t('boards.list.createBoard')}
          </button>
        </StateBlock>
      ) : (
        <PageMainGrid single>
          <PageMainColumn className="boards-list__grid">
            {sortedBoards.map((board) => (
              <article key={board.id} className="boards-list__card">
                <button
                  type="button"
                  className="boards-list__card-open"
                  onClick={() => navigate(`/boards/${board.uuid}`)}
                  aria-label={`${t('boards.list.open')} ${board.name}`}
                >
                  <div className="boards-list__card-main">
                    <div className="boards-list__card-title-row">
                      <h2>{board.name}</h2>
                      {board.is_default && <span className="boards-list__badge">{t('boards.list.default')}</span>}
                    </div>
                    <p>{board.description || '—'}</p>
                  </div>
                  <dl className="boards-list__card-facts">
                    <div>
                      <dt>{t('boards.detail.widgetCount')}</dt>
                      <dd>{widgetCount(board)}</dd>
                    </div>
                    <div>
                      <dt>{t('boards.list.lastEdited')}</dt>
                      <dd>{formatDate(board.updated_at, i18n.language)}</dd>
                    </div>
                  </dl>
                </button>

                <div className="boards-list__card-actions">
                  <button
                    type="button"
                    onClick={() => setDefaultMutation.mutate({ uuid: board.uuid, isDefault: !board.is_default })}
                    title={board.is_default ? t('boards.list.removeDefault') : t('boards.list.setDefault')}
                    aria-label={board.is_default ? t('boards.list.removeDefault') : t('boards.list.setDefault')}
                  >
                    {board.is_default ? <Star size={15} className="is-active" /> : <StarOff size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameTarget(board)
                      setRenameValue(board.name)
                    }}
                    title={t('boards.list.rename')}
                    aria-label={t('boards.list.rename')}
                  >
                    {t('boards.list.rename')}
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateMutation.mutate({ uuid: board.uuid, name: `${board.name} (${t('common.copy')})` })}
                    title={t('boards.list.duplicate')}
                    aria-label={t('boards.list.duplicate')}
                  >
                    <Copy size={15} />
                    {t('boards.list.duplicate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(board)}
                    title={t('boards.list.delete')}
                    aria-label={t('boards.list.delete')}
                  >
                    <Trash2 size={15} />
                    {t('boards.list.delete')}
                  </button>
                </div>
              </article>
            ))}
          </PageMainColumn>
        </PageMainGrid>
      )}

      <CreateBoardModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={(input) => createMutation.mutateAsync(input)}
        isSubmitting={createMutation.isPending}
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.uuid)}
        title={t('boards.list.deleteConfirmTitle')}
        message={t('boards.list.deleteConfirmMessage', { name: deleteTarget?.name })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        loading={deleteMutation.isPending}
      />

      {renameTarget && (
        <div className="pf-modal-overlay">
          <div className="pf-modal-panel pf-modal-panel--sm" role="dialog" aria-modal="true" aria-labelledby="rename-board-title">
            <div className="pf-modal-header">
              <h2 id="rename-board-title" className="pf-modal-title">
                {t('boards.list.renameTitle')}
              </h2>
            </div>
            <form
              className="pf-modal-body pf-modal-section"
              onSubmit={(event) => {
                event.preventDefault()
                if (renameTarget && renameValue.trim()) {
                  renameMutation.mutate({ uuid: renameTarget.uuid, name: renameValue.trim() })
                }
              }}
            >
              <div>
                <label className="pf-modal-label" htmlFor="rename-board-input">
                  {t('boards.list.boardName')}
                </label>
                <input
                  id="rename-board-input"
                  type="text"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  className="pf-modal-input"
                  autoFocus
                  required
                />
              </div>
              <div className="pf-modal-footer -mx-5 -mb-5 mt-2">
                <button type="button" onClick={() => setRenameTarget(null)} className="pf-modal-button pf-modal-button--secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={renameMutation.isPending} className="pf-modal-button pf-modal-button--primary">
                  {renameMutation.isPending ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  )
}
