import { useState, useEffect, useCallback } from 'react';
import { usersApi } from '../api/services';
import type { UserDto } from '../types';
import { useTranslation } from '../i18n/I18nProvider';
import { UserRole } from '../types';

interface UserImpersonationSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (userId: string, unitId?: string | null) => Promise<void>;
}

export function UserImpersonationSelector({ isOpen, onClose, onSelect }: UserImpersonationSelectorProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserDto[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await usersApi.getAll();
      // Filter to only Admin and Resident users (Managers cannot be impersonated)
      const validUsers = data.filter(u => u.role === UserRole.Admin || u.role === UserRole.Resident);
      setUsers(validUsers);
      setFilteredUsers(validUsers);
    } catch (err) {
      setError(t('impersonation.errorLoadingUsers'));
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen, loadUsers]);

  useEffect(() => {
    const filtered = users.filter(u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.condominiumName && u.condominiumName.toLowerCase().includes(search.toLowerCase()))
    );
    setFilteredUsers(filtered);
  }, [search, users]);

  const handleSelect = async (user: UserDto) => {
    setSelectedUser(user);
    setSelectedUnit(user.unitId ?? null);
  };

  const handleConfirm = async () => {
    if (!selectedUser) return;
    onClose();
    await onSelect(selectedUser.id, selectedUnit);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="impersonation-selector-title">
      <div className="modal impersonation-selector-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="impersonation-selector-title">{t('impersonation.selectUser')}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="search-box">
            <input
              type="text"
              placeholder={t('impersonation.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
              autoFocus
            />
          </div>

          {loading ? (
            <div className="loading">A carregar...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">{t('impersonation.noUsersFound')}</div>
          ) : (
            <div className="user-list">
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  className={`user-list-item ${selectedUser?.id === user.id ? 'selected' : ''}`}
                  onClick={() => handleSelect(user)}
                >
                  <div className="user-info">
                    <div className="user-name">{user.name}</div>
                    <div className="user-details">
                      <span className="user-email">{user.email}</span>
                      <span className={`user-role-badge role-${String(user.role).toLowerCase()}`}>
                        {user.role === UserRole.Admin ? t('role.admin') : t('role.resident')}
                      </span>
                      {user.condominiumName && (
                        <span className="user-condominium">{user.condominiumName}</span>
                      )}
                      {user.unitNumber && (
                        <span className="user-unit">{t('common.fraction', { number: user.unitNumber })}</span>
                      )}
                    </div>
                  </div>
                  {selectedUser?.id === user.id && (
                    <div className="unit-selector">
                      <label>{t('impersonation.selectUnit')}</label>
                      <select
                        value={selectedUnit ?? ''}
                        onChange={e => setSelectedUnit(e.target.value || null)}
                        className="unit-select"
                      >
                        <option value="">{t('impersonation.allUnits')}</option>
                        {user.unitId && (
                          <option value={user.unitId}>{user.unitNumber || user.unitId}</option>
                        )}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!selectedUser || loading}
          >
            {t('impersonation.startImpersonation')}
          </button>
        </div>
      </div>
    </div>
  );
}