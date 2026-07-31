import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trash2, Edit2, Mail, Phone, Shield, Building2, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { usersApi, unitsApi, condominiumsApi, userRegistrationApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import { UserRole } from '../types';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import { Button, Card, EmptyState } from '../components/ui';
import { useTranslation } from '../i18n/I18nProvider';
import type { UserDto, CreateUserRequest, UnitDto, CondominiumDto, PaginatedResponse, PendingUserDto } from '../types';

const roleColors: Record<number, string> = {
  0: 'bg-emerald-100 text-emerald-700',
  1: 'bg-indigo-100 text-indigo-700',
  2: 'bg-control text-ink-muted',
};

export default function UsersPage() {
  const { isManager, isAdmin, condominiumId } = useAuth();
  const navigate = useNavigate();
  const { error: toastError } = useToast();
  const { t } = useTranslation();
  const roleLabels: Record<number, string> = {
    0: t('role.manager'),
    1: t('role.admin'),
    2: t('role.resident'),
  };
  // Guard: Only Manager and Admin can access
  useEffect(() => {
    if (!isManager && !isAdmin) {
      navigate('/dashboard');
    }
  }, [isManager, isAdmin, navigate]);
  
  const [users, setUsers] = useState<UserDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [condominiums, setCondominiums] = useState<CondominiumDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const [filterRole, setFilterRole] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<UserDto> | null>(null);
  const pageSize = 10;
  const [formData, setFormData] = useState<CreateUserRequest>({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 2, // Resident by default
    condominiumId: undefined,
    unitId: undefined,
  });
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isInternalAdmin, setIsInternalAdmin] = useState(false); // Admin Interno com fração
  const [pendingUsers, setPendingUsers] = useState<PendingUserDto[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [showPendingApprovals, setShowPendingApprovals] = useState(false);

  const load = useCallback(async (page: number = 1) => {
    setLoading(true);
    setLoadError('');
    try {
      let usersResponse;

      if (isAdmin && condominiumId) {
        usersResponse = await usersApi.getByCondominiumPaged(condominiumId, page, pageSize, debouncedSearch);
      } else {
        usersResponse = await usersApi.getPaged(page, pageSize, debouncedSearch);
      }

      let usersData = usersResponse.data.items;
      if (isManager) {
        // Manager only sees other platform Managers
        usersData = usersData.filter(u => u.role === UserRole.Manager);
      } else if (isAdmin) {
        // Admin never sees platform Managers
        usersData = usersData.filter(u => u.role !== UserRole.Manager);
      }

      setPagination(usersResponse.data);
      setUsers(usersData);
      setCurrentPage(page);

      if (isAdmin) {
        if (condominiumId) {
          const unitsResponse = await unitsApi.getAll(condominiumId);
          setUnits(unitsResponse.data);
          const condoResponse = await condominiumsApi.getById(condominiumId);
          setCondominiums([condoResponse.data]);
        } else {
          setUnits([]);
        }
      }
      // Manager doesn't need units or condominiums in this view
    } catch (error) {
      console.error('Erro ao carregar utilizadores:', error);
      setLoadError(t('users.error.load'));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isManager, condominiumId, pageSize, debouncedSearch, t]);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const r = await userRegistrationApi.getPendingUsers();
      setPendingUsers(r.data); if (r.data.length > 0) setShowPendingApprovals(true);
    } catch { /* silent */ } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
    if (isAdmin) loadPending();
  }, [load, loadPending, isAdmin]);

  const handleApprove = async (userId: string) => {
    await userRegistrationApi.approveUser(userId);
    // Move user from pending to active list
    setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
    load(currentPage);
  };

  const handleReject = async (userId: string) => {
    setRejectId(userId);
  };

  const confirmReject = async () => {
    if (!rejectId) return;
    try {
      await userRegistrationApi.rejectUser(rejectId);
      setPendingUsers((prev) => prev.filter((u) => u.id !== rejectId));
    } catch {
      toastError(t('users.error.reject'));
    } finally {
      setRejectId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate based on role
      if (formData.role === 1 || formData.role === 2) {
        if (!formData.condominiumId) {
          toastError(t('users.error.condoRequired'));
          return;
        }
      }
      if (formData.role === UserRole.Resident && !formData.unitId) {
        toastError(t('users.error.unitRequired'));
        return;
      }

      // Admin cannot create Manager
      if (isAdmin && formData.role === UserRole.Manager) {
        toastError(t('users.error.adminCannotCreateManager'));
        return;
      }

      if (editingId) {
        // Find current user to get their current data
        const currentUser = users.find(u => u.id === editingId);
        if (!currentUser) throw new Error('User not found');
        
        setSubmitting(true);
        await usersApi.update(editingId, {
          id: editingId,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          condominiumId: formData.condominiumId,
          unitId: formData.unitId,
          isActive: isActive,
        });
      } else {
        setSubmitting(true);
        await usersApi.create(formData);
      }
      setShowModal(false);
      setEditingId(null);
      resetForm();
      load();
    } catch (error) {
      console.error('Erro ao guardar utilizador:', error);
      toastError(t('users.error.save'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: isManager ? UserRole.Manager : 2,
      condominiumId: isAdmin ? condominiumId || undefined : undefined,
      unitId: undefined,
    });
    setIsActive(true);
    setIsInternalAdmin(false);
  };

  const handleEdit = (user: UserDto) => {
    setEditingId(user.id);
    
    // Determinar se é Admin Interno (Admin com unitId)
    const isInternal = user.role === UserRole.Admin && !!user.unitId;
    
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't pre-fill password
      phone: user.phone,
      role: user.role,
      condominiumId: user.condominiumId,
      unitId: user.unitId,
    });
    setIsActive(user.isActive);
    setIsInternalAdmin(isInternal);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await usersApi.delete(deleteId);
      load();
    } catch (error) {
      console.error('Erro ao remover utilizador:', error);
      toastError(t('users.error.delete'));
    } finally {
      setDeleteId(null);
    }
  };

  const handleNew = () => {
    setEditingId(null);
    resetForm();
    setShowModal(true);
  };

  const unitLabel = (unitId?: string) => {
    if (!unitId) return '-';
    const u = units.find((u) => u.id === unitId);
    return u ? t('users.unitLabel', { number: u.number, floor: u.floor }) : unitId.slice(0, 8) + '…';
  };

  const condominiumLabel = (condoId?: string) => {
    if (!condoId) return '-';
    const c = condominiums.find((c) => c.id === condoId);
    return c ? c.name : condoId.slice(0, 8) + '…';
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole ? u.role.toString() === filterRole : true;
    // Admin should not see Managers
    const isAllowedRole = isAdmin ? u.role !== UserRole.Manager : true;
    return matchesSearch && matchesRole && isAllowedRole;
  });

  const availableUnits = units.filter(u => 
    !formData.condominiumId || u.condominiumId === formData.condominiumId
  );

  if (!isManager && !isAdmin) {
    return (
      <div className="text-center py-20 text-ink-subtle">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>{t('users.accessRestricted')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={deleteId !== null}
        title={t('users.delete.title')}
        message={t('users.delete.message')}
        confirmLabel={t('users.delete.confirm')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      <ConfirmModal
        open={rejectId !== null}
        title={t('users.reject.title')}
        message={t('users.reject.message')}
        confirmLabel={t('users.reject.confirm')}
        variant="danger"
        onConfirm={confirmReject}
        onCancel={() => setRejectId(null)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('users.title')}</h1>
          <p className="text-ink-subtle text-sm mt-0.5">{t('users.registeredCount', { count: users.length })}</p>
        </div>
        <div className="flex w-full sm:w-auto items-center justify-end gap-3 flex-wrap sm:flex-nowrap">
          <div className="w-full sm:w-80">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={t('users.searchPlaceholder')}
            />
          </div>
          <Button onClick={handleNew} icon={Plus} className="w-full sm:w-auto justify-center">
            {t('users.new')}
          </Button>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-surface rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPendingApprovals((prev) => !prev)}
            className="w-full px-4 py-3 border-b border-amber-100 flex items-center justify-between text-left hover:bg-amber-50/60 transition-colors"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <Clock className="w-4 h-4 text-amber-500" />
              {t('users.pending.title')}
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                {pendingUsers.length}
              </span>
            </span>
            {showPendingApprovals ? <ChevronUp className="w-4 h-4 text-ink-subtle" /> : <ChevronDown className="w-4 h-4 text-ink-subtle" />}
          </button>

          {showPendingApprovals && (
            pendingLoading ? (
              <div className="px-4 py-3 text-sm text-ink-subtle">{t('users.pending.loading')}</div>
            ) : pendingUsers.length === 0 ? (
              <div className="px-4 py-3 text-sm text-ink-subtle">{t('users.pending.empty')}</div>
            ) : (
              <ul className="divide-y divide-line app-scrollbar max-h-64 overflow-y-auto">
                {pendingUsers.map((u) => (
                  <li key={u.id} className="flex flex-wrap sm:flex-nowrap items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{u.name}</p>
                      <p className="text-xs text-ink-subtle truncate">{u.email} · {u.unitNumber ? t('common.fraction', { number: u.unitNumber }) : '—'}</p>
                    </div>
                    <div className="w-full sm:w-auto flex gap-2 sm:flex-shrink-0">
                      <button
                        onClick={() => handleApprove(u.id)}
                        title={t('users.pending.approve')}
                        className="flex-1 sm:flex-none justify-center flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {t('users.pending.approve')}
                      </button>
                      <button
                        onClick={() => handleReject(u.id)}
                        title={t('users.pending.reject')}
                        className="flex-1 sm:flex-none justify-center flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {t('users.pending.reject')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}

      {!isManager && (
        <div className="flex flex-wrap gap-3">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface"
          >
            <option value="">{t('users.filter.allRoles')}</option>
            <option value="1">{t('role.admin')}</option>
            <option value="2">{t('role.resident')}</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!loading && loadError && (
          <div className="col-span-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {loadError}
            </span>
            <button
              type="button"
              onClick={() => load(currentPage)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('users.retry')}
            </button>
          </div>
        )}
        {loading ? (
          <div className="col-span-full text-center py-12 text-ink-subtle">{t('users.loading')}</div>
        ) : !loadError && filtered.length === 0 ? (
          <EmptyState icon={Users} title={t('users.empty')} className="col-span-full" />
        ) : !loadError ? (
          filtered.map((user) => (
            <Card key={user.id} interactive className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-ink">{user.name}</h3>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${roleColors[user.role]}`}>
                    {roleLabels[user.role]}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(user)}
                    className="p-1.5 text-ink-subtle hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="p-1.5 text-ink-subtle hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-ink-muted">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>{user.phone}</span>
                </div>
                {user.role !== UserRole.Manager && (
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{condominiumLabel(user.condominiumId)}</span>
                  </div>
                )}
                {user.role === UserRole.Resident && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{unitLabel(user.unitId)}</span>
                  </div>
                )}
              </div>
            </Card>
          ))
        ) : null}
      </div>
      
      {pagination && !loading && filtered.length > 0 && (
        <Pagination
          pagination={pagination}
          currentPage={currentPage}
          onPageChange={(page) => load(page)}
        />
      )}

      {/* Modal */}
      <ModalPopup
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingId(null);
        }}
        title={editingId ? t('users.form.editTitle') : t('users.new')}
        maxWidthClass="max-w-lg"
      >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('common.name')} *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('common.email')} *</label>
                <input
                  type="email"
                  required
                  disabled={!!editingId}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-surface-muted"
                />
              </div>
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">{t('users.form.password')} *</label>
                  <input
                    type="password"
                    required={!editingId}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('common.phone')} *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {isManager ? (
                // Manager: role is fixed to Manager, no condominium/unit
                <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium">
                  {t('users.form.portalManager')}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">{t('users.form.role')} *</label>
                    <select
                      required
                      value={formData.role}
                      onChange={(e) => {
                        const newRole = Number(e.target.value) as UserRole;
                        setFormData({ ...formData, role: newRole, unitId: undefined });
                        if (newRole !== UserRole.Admin) setIsInternalAdmin(false);
                      }}
                      disabled={isAdmin && !editingId}
                      className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-surface-muted"
                    >
                      <option value="1">{t('role.admin')}</option>
                      <option value="2">{t('role.resident')}</option>
                    </select>
                    {isAdmin && !editingId && (
                      <p className="text-xs text-ink-subtle mt-1">{t('users.form.adminRoleHint')}</p>
                    )}
                  </div>
                  {(formData.role === UserRole.Admin || formData.role === UserRole.Resident) && (
                    <div>
                      <label className="block text-sm font-medium text-ink-muted mb-1">{t('users.form.condominium')} *</label>
                      <select
                        required
                        value={formData.condominiumId || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, condominiumId: e.target.value || undefined, unitId: undefined })
                        }
                        disabled={isAdmin}
                        className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-surface-muted"
                      >
                        <option value="">{t('users.form.selectPlaceholder')}</option>
                        {condominiums.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {formData.role === UserRole.Admin && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isInternalAdmin"
                        checked={isInternalAdmin}
                        onChange={(e) => {
                          setIsInternalAdmin(e.target.checked);
                          if (!e.target.checked) setFormData({ ...formData, unitId: undefined });
                        }}
                        className="w-4 h-4 text-indigo-600 border-line rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="isInternalAdmin" className="text-sm font-medium text-ink-muted">
                        {t('users.form.internalAdmin')}
                      </label>
                    </div>
                  )}
                  {(formData.role === UserRole.Resident || (formData.role === UserRole.Admin && isInternalAdmin)) && (
                    <div>
                      <label className="block text-sm font-medium text-ink-muted mb-1">{t('users.form.unit')} *</label>
                      {availableUnits.length === 0 ? (
                        <div className="w-full px-3 py-2 border border-amber-300 bg-amber-50 rounded-lg text-sm text-amber-700 flex items-center justify-between">
                          <span>{t('users.form.noUnits')}</span>
                          <a
                            href="/units"
                            className="ml-2 font-semibold text-amber-900 hover:text-amber-600 underline transition-colors"
                          >
                            {t('users.form.registerUnit')}
                          </a>
                        </div>
                      ) : (
                        <select
                          required={formData.role === 2}
                          value={formData.unitId || ''}
                          onChange={(e) => setFormData({ ...formData, unitId: e.target.value || undefined })}
                          disabled={!formData.condominiumId}
                          className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-surface-muted"
                        >
                          <option value="">{t('users.form.selectPlaceholder')}</option>
                          {availableUnits.map((u) => (
                            <option key={u.id} value={u.id}>
                              {t('users.unitLabel', { number: u.number, floor: u.floor })}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </>
              )}
              {editingId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-line rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-ink-muted">
                    {t('users.form.activeUser')}
                  </label>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                  }}
                  disabled={submitting}
                  fullWidth
                  className="border border-line"
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" fullWidth loading={submitting}>
                  {editingId ? t('users.form.save') : t('users.form.create')}
                </Button>
              </div>
            </form>
      </ModalPopup>
    </div>
  );
}
