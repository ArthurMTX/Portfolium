import { useTranslation } from 'react-i18next'
import type { User } from '@/app/providers/AuthContext'
import { getFlagUrl } from '@/shared/lib/countryUtils'
import type { AdminUsersModel, LanguageDisplay } from '@/features/admin/types'

function getLanguageDisplay(language: string | null | undefined): LanguageDisplay {
  const normalized = (language || 'en').trim().toLowerCase()
  if (normalized.startsWith('fr')) {
    return {
      countryCode: 'FR',
      label: 'FR',
      alt: 'Français',
    }
  }

  return {
    countryCode: 'GB',
    label: 'EN',
    alt: 'English',
  }
}

interface AdminUsersTableProps {
  currentUser: User | null
  users: Pick<
    AdminUsersModel,
    | 'filteredUsers'
    | 'sortKey'
    | 'sortDir'
    | 'handleSort'
    | 'toggleActive'
    | 'toggleAdmin'
    | 'deleteUser'
    | 'openEditModal'
  >
}

export default function AdminUsersTable({ currentUser, users }: AdminUsersTableProps) {
  const { t } = useTranslation()

  return (
    <div className="admin-page__table-wrap">
      <table className="pf-table admin-page__table">
        <thead>
          <tr>
            <th className="admin-page__sortable" onClick={() => users.handleSort('id')}>
              {t('admin.id')} {users.sortKey === 'id' && (users.sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="admin-page__sortable" onClick={() => users.handleSort('email')}>
              {t('admin.email')} {users.sortKey === 'email' && (users.sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="admin-page__sortable" onClick={() => users.handleSort('username')}>
              {t('admin.username')} {users.sortKey === 'username' && (users.sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th>{t('admin.language')}</th>
            <th>{t('admin.active')}</th>
            <th>{t('admin.admin')}</th>
            <th>{t('admin.2fa')}</th>
            <th className="admin-page__sortable" onClick={() => users.handleSort('created_at')}>
              {t('admin.created')} {users.sortKey === 'created_at' && (users.sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="admin-page__actions-heading">{t('admin.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.filteredUsers.map((u) => {
            const language = getLanguageDisplay(u.preferred_language)

            return (
              <tr key={u.id}>
                <td>
                  <div className="admin-page__cell-strong">{u.id}</div>
                </td>
                <td>
                  <div className="admin-page__identity-cell">
                    <div>{u.email}</div>
                    {u.is_admin ? (
                      <span className="admin-page__badge">{t('admin.admin')}</span>
                    ) : (
                      u.is_superuser && <span className="admin-page__badge">{t('admin.superuser')}</span>
                    )}
                    {!u.is_active && <span className="admin-page__badge is-muted">{t('admin.inactive')}</span>}
                    {u.is_verified && <span className="admin-page__badge is-success">{t('admin.verified')}</span>}
                  </div>
                </td>
                <td>
                  <div>{u.username}</div>
                </td>
                <td>
                  <div className="admin-page__language">
                    <img
                      src={getFlagUrl(language.countryCode, 'w40') || ''}
                      alt={language.alt}
                      className="admin-page__flag"
                      title={language.alt}
                    />
                    <span>{language.label}</span>
                  </div>
                </td>
                <td>
                  <span className={`admin-page__badge ${u.is_active ? 'is-success' : 'is-muted'}`}>
                    {u.is_active ? t('admin.active') : t('admin.inactive')}
                  </span>
                </td>
                <td>
                  <span className={`admin-page__badge ${u.is_admin ? '' : 'is-muted'}`}>
                    {u.is_admin ? t('admin.admin') : t('admin.user')}
                  </span>
                </td>
                <td>
                  <span className={`admin-page__badge ${u.totp_enabled ? 'is-success' : 'is-muted'}`}>
                    {u.totp_enabled ? t('twoFactor.enabled') : t('twoFactor.disabled')}
                  </span>
                </td>
                <td>
                  <div className="admin-page__muted">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                  </div>
                </td>
                <td className="admin-page__actions-cell">
                  <div className="admin-page__row-actions">
                    <button
                      type="button"
                      onClick={() => users.toggleActive(u)}
                      disabled={u.is_superuser}
                      className="pf-button pf-button--secondary"
                      title={u.is_superuser ? t('admin.cannotDeactivatePrimaryAdmin') : ''}
                    >
                      {u.is_active ? t('admin.deactivate') : t('admin.activate')}
                    </button>
                    <button
                      type="button"
                      onClick={() => users.toggleAdmin(u)}
                      disabled={u.is_superuser}
                      className="pf-button pf-button--secondary"
                      title={u.is_superuser ? t('admin.cannotRemovePrimaryAdmin') : ''}
                    >
                      {u.is_admin ? t('admin.revokeAdmin') : t('admin.makeAdmin')}
                    </button>
                    <button type="button" onClick={() => users.openEditModal(u)} className="pf-button pf-button--secondary">
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => users.deleteUser(u)}
                      disabled={u.id === currentUser?.id || u.is_superuser}
                      className="pf-button pf-button--ghost admin-page__danger-action"
                      title={u.is_superuser ? t('admin.cannotDeletePrimaryAdmin') : ''}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
