import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LifeBuoy, UserCheck, Search } from 'lucide-react';
import { usersApi, condominiumsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n/I18nProvider';
import { Button, Card, Badge } from '../components/ui';
import type { CondominiumDto, PaginatedResponse } from '../types';
import { UserRole } from '../types';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';

type HelpdeskTab = 'impersonate' | 'tickets' | 'logs';

interface ImpersonatableUser {
  id: string;
  name: string;
  email: string;
  role: number;
  condominiumId: string;
  condominiumName: string;
  unitId?: string;
  unitNumber?: string;
}

export default function HelpdeskPage() {
  const { isManager, startImpersonation } = useAuth();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();
  const { t } = useTranslation();

  // Guard: Only Manager can access
  useEffect(() => {
    if (!isManager) {
      navigate('/dashboard');
    }
  }, [isManager, navigate]);

  // State
  const [activeTab, setActiveTab] = useState<HelpdeskTab>('impersonate');
  const [condominiums, setCondominiums] = useState<CondominiumDto[]>([]);
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('');
  const [users, setUsers] = useState<ImpersonatableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterUserType, setFilterUserType] = useState<'all' | 'admin' | 'resident'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<any> | null>(null);
  const pageSize = 10;
  const [impersonating, setImpersonating] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load condominiums on mount
  useEffect(() => {
    const loadCondominiums = async () => {
      try {
        const response = await condominiumsApi.getAll();
        const activeCondominiums = response.data.filter(c => c.isActive);
        setCondominiums(activeCondominiums);
        if (activeCondominiums.length > 0 && !selectedCondominiumId) {
          setSelectedCondominiumId(activeCondominiums[0].id);
        }
      } catch (error) {
        console.error('Erro ao carregar condomínios:', error);
      }
    };
    loadCondominiums();
  }, []);

  // Load users when condominium or filters change
  const loadUsers = useCallback(async (page: number = 1) => {
    if (!selectedCondominiumId) {
      setUsers([]);
      setPagination(null);
      return;
    }

    setLoading(true);
    setLoadError('');
    try {
      // Use the impersonatable endpoint with condominium filter
      const condoId = selectedCondominiumId || undefined;
      const response = await usersApi.getImpersonatable(page, pageSize, debouncedSearch, condoId);
      let usersData = response.data.items as ImpersonatableUser[];

      // Filter by user type if not 'all' (client-side for now, can be moved to backend)
      if (filterUserType !== 'all') {
        const targetRole = filterUserType === 'admin' ? UserRole.Admin : UserRole.Resident;
        usersData = usersData.filter(u => u.role === targetRole);
      }

      // Use backend pagination
      const { totalItems, totalPages } = response.data;

      setUsers(usersData);
      setPagination({
        items: usersData,
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      });
      setCurrentPage(page);
    } catch (error) {
      console.error('Erro ao carregar utilizadores:', error);
      setLoadError(t('helpdesk.error.loadUsers'));
      toastError(t('helpdesk.error.loadUsersToast'));
    } finally {
      setLoading(false);
    }
  }, [selectedCondominiumId, filterUserType, debouncedSearch, t, toastError]);

  useEffect(() => {
    loadUsers(1);
  }, [loadUsers]);

  const handleImpersonate = async (user: ImpersonatableUser) => {
    setImpersonating(user.id);
    try {
      await startImpersonation(user.id, user.unitId);
      toastSuccess(t('helpdesk.impersonation.started', { name: user.name }));
      navigate('/dashboard');
    } catch (error) {
      console.error('Impersonation failed:', error);
      toastError(t('auth.error.impersonationFailed'));
    } finally {
      setImpersonating(null);
    }
  };

  const roleLabel = (role: number) => {
    switch (role) {
      case UserRole.Admin: return t('role.admin');
      case UserRole.Resident: return t('role.resident');
      default: return t('role.manager');
    }
  };

  const roleBadgeClass = (role: number) => {
    switch (role) {
      case UserRole.Admin: return 'bg-indigo-100 text-indigo-700';
      case UserRole.Resident: return 'bg-amber-100 text-amber-700';
      default: return 'bg-emerald-100 text-emerald-700';
    }
  };

  if (!isManager) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md w-full">
          <div className="text-center py-8">
            <LifeBuoy className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-ink mb-2">{t('helpdesk.accessDenied')}</h2>
            <p className="text-ink-muted mb-6">{t('helpdesk.managerOnly')}</p>
            <Button onClick={() => navigate('/dashboard')}>Voltar ao dashboard</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('helpdesk.title')}</h1>
          <p className="text-ink-muted">{t('helpdesk.subtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-line">
        <nav className="flex gap-1" aria-label={t('helpdesk.tabsLabel')}>
          {[
            { id: 'impersonate', label: t('helpdesk.tabs.impersonate'), icon: UserCheck },
            { id: 'tickets', label: t('helpdesk.tabs.tickets'), icon: LifeBuoy },
            { id: 'logs', label: t('helpdesk.tabs.logs'), icon: Search },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as HelpdeskTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-surface text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'impersonate' && (
        <div className="space-y-6">
          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              {/* Condominium Selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink-muted">{t('helpdesk.condominium')}</label>
                <select
                  value={selectedCondominiumId}
                  onChange={(e) => setSelectedCondominiumId(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('helpdesk.selectCondominium')}</option>
                  {condominiums.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* User Type Filter */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink-muted">{t('helpdesk.userType')}</label>
                <select
                  value={filterUserType}
                  onChange={(e) => setFilterUserType(e.target.value as 'all' | 'admin' | 'resident')}
                  className="w-full px-3 py-2 border border-line rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">{t('helpdesk.allTypes')}</option>
                  <option value="admin">{t('role.admin')}</option>
                  <option value="resident">{t('role.resident')}</option>
                </select>
              </div>

              {/* Search */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                <label className="text-sm font-medium text-ink-muted">{t('helpdesk.common.search')}</label>
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder={t('helpdesk.searchPlaceholder')}
                />
              </div>
            </div>
          </Card>

          {/* Users Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line text-left text-sm font-medium text-ink-muted">
                    <th className="px-4 py-3">{t('helpdesk.common.name')}</th>
                    <th className="px-4 py-3">{t('helpdesk.common.email')}</th>
                    <th className="px-4 py-3">{t('helpdesk.role')}</th>
                    <th className="px-4 py-3">{t('helpdesk.condominium')}</th>
                    <th className="px-4 py-3">{t('helpdesk.fraction')}</th>
                    <th className="px-4 py-3 w-24 text-right">{t('helpdesk.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          <span>{t('helpdesk.common.loading')}</span>
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                        {loadError ? loadError : t('helpdesk.noUsersFound')}
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-surface-hover transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink">{user.name}</div>
                        </td>
                        <td className="px-4 py-3 text-ink-muted">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(user.role)}`}>
                            {roleLabel(user.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-muted">{user.condominiumName}</td>
                        <td className="px-4 py-3">
                          {user.unitNumber ? (
                            <Badge variant="neutral" size="sm">{user.unitNumber}</Badge>
                          ) : (
                            <span className="text-ink-muted text-sm">{t('helpdesk.allFractions')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleImpersonate(user)}
                            disabled={impersonating === user.id}
                            className="w-24"
                          >
                            {impersonating === user.id ? (
                              <span className="flex items-center justify-center gap-1.5">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                {t('helpdesk.starting')}
                              </span>
                            ) : (
                              t('helpdesk.impersonate')
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && !loading && users.length > 0 && (
              <div className="px-4 py-3 border-t border-line">
                <Pagination
                  pagination={pagination}
                  currentPage={currentPage}
                  onPageChange={(page) => loadUsers(page)}
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'tickets' && (
        <Card className="p-8 text-center">
          <LifeBuoy className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-ink mb-2">{t('helpdesk.tabs.tickets')}</h3>
          <p className="text-ink-muted">{t('helpdesk.comingSoon')}</p>
        </Card>
      )}

      {activeTab === 'logs' && (
        <Card className="p-8 text-center">
          <Search className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-ink mb-2">{t('helpdesk.tabs.logs')}</h3>
          <p className="text-ink-muted">{t('helpdesk.comingSoon')}</p>
        </Card>
      )}
    </div>
  );
}