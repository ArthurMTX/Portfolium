import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AdminUsersModel } from '@/features/admin/types'

interface CreateUserModalProps {
  users: Pick<AdminUsersModel, 'newUser' | 'setNewUser' | 'setIsCreateOpen' | 'createUser' | 'creating'>
}

export function CreateUserModal({ users }: CreateUserModalProps) {
  const { t } = useTranslation()

  return (
    <div className="pf-modal-overlay">
      <div className="pf-modal-panel" role="dialog" aria-modal="true">
        <div className="pf-modal-header">
          <h2 className="pf-modal-title">{t('admin.createUser')}</h2>
          <button type="button" onClick={() => users.setIsCreateOpen(false)} className="pf-modal-close">
            <X size={20} />
          </button>
        </div>

        <form className="pf-modal-body pf-modal-section" onSubmit={users.createUser}>
          <div>
            <label className="pf-modal-label">{t('admin.emailField')}</label>
            <input
              className="pf-modal-input"
              placeholder={t('admin.emailPlaceholder')}
              type="email"
              value={users.newUser.email}
              onChange={(e) => users.setNewUser({ ...users.newUser, email: e.target.value })}
              required
            />
          </div>
          <div className="pf-modal-grid">
            <div>
              <label className="pf-modal-label">{t('admin.usernameField')}</label>
              <input
                className="pf-modal-input"
                placeholder={t('admin.usernamePlaceholder')}
                value={users.newUser.username}
                onChange={(e) => users.setNewUser({ ...users.newUser, username: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="pf-modal-label">{t('admin.fullNameField')}</label>
              <input
                className="pf-modal-input"
                placeholder={t('admin.fullNamePlaceholder')}
                value={users.newUser.full_name}
                onChange={(e) => users.setNewUser({ ...users.newUser, full_name: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="pf-modal-label">{t('admin.passwordField')}</label>
            <input
              className="pf-modal-input"
              placeholder={t('admin.passwordPlaceholder')}
              type="password"
              value={users.newUser.password}
              onChange={(e) => users.setNewUser({ ...users.newUser, password: e.target.value })}
              required
            />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!users.newUser.is_admin}
                onChange={(e) => users.setNewUser({ ...users.newUser, is_admin: e.target.checked })}
              />
              {t('admin.isAdminLabel')}
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!users.newUser.is_active}
                onChange={(e) => users.setNewUser({ ...users.newUser, is_active: e.target.checked })}
              />
              {t('admin.isActiveLabel')}
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!users.newUser.is_verified}
                onChange={(e) => users.setNewUser({ ...users.newUser, is_verified: e.target.checked })}
              />
              {t('admin.isVerifiedLabel')}
            </label>
          </div>
          <div className="pf-modal-footer -mx-5 -mb-5 mt-2">
            <button type="button" onClick={() => users.setIsCreateOpen(false)} className="pf-modal-button pf-modal-button--secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={users.creating} className="pf-modal-button pf-modal-button--primary">
              {users.creating ? t('common.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EditUserModalProps {
  users: Pick<AdminUsersModel, 'editingUser' | 'editPayload' | 'setEditPayload' | 'closeEditModal' | 'saveEdit'>
}

export function EditUserModal({ users }: EditUserModalProps) {
  const { t } = useTranslation()
  const editingUser = users.editingUser

  if (!editingUser) return null

  return (
    <div className="pf-modal-overlay">
      <div className="pf-modal-panel" role="dialog" aria-modal="true">
        <div className="pf-modal-header">
          <h2 className="pf-modal-title">{t('admin.editUser')}</h2>
          <button type="button" onClick={users.closeEditModal} className="pf-modal-close">
            <X size={20} />
          </button>
        </div>
        <form className="pf-modal-body pf-modal-section" onSubmit={users.saveEdit}>
          <div>
            <label className="pf-modal-label">{t('admin.emailField')}</label>
            <input
              className="pf-modal-input"
              value={users.editPayload.email || ''}
              onChange={(e) => users.setEditPayload((p) => ({ ...p, email: e.target.value }))}
              required
            />
          </div>
          <div className="pf-modal-grid">
            <div>
              <label className="pf-modal-label">{t('admin.usernameField')}</label>
              <input
                className="pf-modal-input"
                value={users.editPayload.username || ''}
                onChange={(e) => users.setEditPayload((p) => ({ ...p, username: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="pf-modal-label">{t('admin.fullNameField')}</label>
              <input
                className="pf-modal-input"
                value={users.editPayload.full_name || ''}
                onChange={(e) => users.setEditPayload((p) => ({ ...p, full_name: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="pf-modal-label">{t('admin.newPasswordField')}</label>
            <input
              className="pf-modal-input"
              type="password"
              value={users.editPayload.password || ''}
              onChange={(e) => users.setEditPayload((p) => ({ ...p, password: e.target.value }))}
              placeholder={t('admin.newPasswordPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!users.editPayload.is_admin}
                onChange={(e) => users.setEditPayload((p) => ({ ...p, is_admin: e.target.checked }))}
                disabled={editingUser.is_superuser}
              />
              <span>{t('admin.isAdminLabel')}</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!users.editPayload.is_active}
                onChange={(e) => users.setEditPayload((p) => ({ ...p, is_active: e.target.checked }))}
                disabled={editingUser.is_superuser}
              />
              <span>{t('admin.isActiveLabel')}</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!users.editPayload.is_verified}
                onChange={(e) => users.setEditPayload((p) => ({ ...p, is_verified: e.target.checked }))}
              />
              <span>{t('admin.isVerifiedLabel')}</span>
            </label>
          </div>
          <div className="pf-modal-footer -mx-5 -mb-5 mt-2">
            <button type="button" onClick={users.closeEditModal} className="pf-modal-button pf-modal-button--secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" className="pf-modal-button pf-modal-button--primary">
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
