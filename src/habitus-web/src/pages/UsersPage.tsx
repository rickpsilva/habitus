import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trash2, Edit2, Mail, Phone, Shield, Building2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { usersApi, unitsApi, condominiumsApi, userRegistrationApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import type { UserDto, CreateUserRequest, UnitDto, CondominiumDto, PaginatedResponse, PendingUserDto } from '../types';

const roleLabels: Record<number, string> = {
  0: 'Gestor',
  1: 'Administrador',
  2: 'Morador',
};

const roleColors: Record<number, string> = {
  0: 'bg-emerald-100 text-emerald-700',
  1: 'bg-indigo-100 text-indigo-700',
  2: 'bg-gray-100 text-gray-600',
};

export default function UsersPage() {
  const { isManager, isAdmin, condominiumId } = useAuth();
  const navigate = useNavigate();
  
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
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
  const [isInternalAdmin, setIsInternalAdmin] = useState(false); // Admin Interno com fração
  const [pendingUsers, setPendingUsers] = useState<PendingUserDto[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const load = useCallback(async (page: number = 1) => {
    setLoading(true);
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
        const unitsResponse = await unitsApi.getAll();
        setUnits(unitsResponse.data);
        if (condominiumId) {
          const condoResponse = await condominiumsApi.getById(condominiumId);
          setCondominiums([condoResponse.data]);
        }
      }
      // Manager doesn't need units or condominiums in this view
    } catch (error) {
      console.error('Erro ao carregar utilizadores:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isManager, condominiumId, pageSize, debouncedSearch]);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const r = await userRegistrationApi.getPendingUsers();
      setPendingUsers(r.data);
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
    if (!confirm('Tem a certeza que deseja recusar e remover este utilizador?')) return;
    await userRegistrationApi.rejectUser(userId);
    setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate based on role
      if (formData.role === 1 || formData.role === 2) {
        if (!formData.condominiumId) {
          alert('Admin e Morador precisam de um condomínio');
          return;
        }
      }
      if (formData.role === UserRole.Resident && !formData.unitId) {
        alert('Morador precisa de uma fração');
        return;
      }

      // Admin cannot create Manager
      if (isAdmin && formData.role === UserRole.Manager) {
        alert('Admin não pode criar Gestores');
        return;
      }

      if (editingId) {
        // Find current user to get their current data
        const currentUser = users.find(u => u.id === editingId);
        if (!currentUser) throw new Error('User not found');
        
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
        await usersApi.create(formData);
      }
      setShowModal(false);
      setEditingId(null);
      resetForm();
      load();
    } catch (error) {
      console.error('Erro ao salvar utilizador:', error);
      alert('Erro ao salvar utilizador');
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
    if (!confirm('Tem certeza que deseja remover este utilizador?')) return;
    try {
      await usersApi.delete(id);
      load();
    } catch (error) {
      console.error('Erro ao remover utilizador:', error);
      alert('Erro ao remover utilizador');
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
    return u ? `Fração ${u.number} – Piso ${u.floor}` : unitId.slice(0, 8) + '…';
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
      <div className="text-center py-20 text-gray-400">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>Acesso restrito a gestores e administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Pending approvals (Admin only) ─────────────────────────────────── */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-amber-100">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-900">Pedidos Pendentes de Aprovação</h2>
            {pendingUsers.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                {pendingUsers.length}
              </span>
            )}
          </div>
          {pendingLoading ? (
            <div className="px-6 py-4 text-sm text-gray-400">A carregar…</div>
          ) : pendingUsers.length === 0 ? (
            <div className="px-6 py-4 text-sm text-gray-400">Nenhum pedido pendente.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {pendingUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between px-6 py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email} · {u.unitNumber ? `Fração ${u.unitNumber}` : '—'}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(u.id)}
                      title="Aprovar"
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleReject(u.id)}
                      title="Recusar"
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Recusar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilizadores</h1>
          <p className="text-gray-500 text-sm mt-0.5">{users.length} utilizadores registados</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-80">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Pesquisar utilizadores..."
            />
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Novo Utilizador
          </button>
        </div>
      </div>

      {!isManager && (
        <div className="flex flex-wrap gap-3">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">Todas as funções</option>
            <option value="1">Administrador</option>
            <option value="2">Morador</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-400">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum utilizador encontrado</p>
          </div>
        ) : (
          filtered.map((user) => (
            <div key={user.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{user.name}</h3>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${roleColors[user.role]}`}>
                    {roleLabels[user.role]}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(user)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
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
            </div>
          ))
        )}
      </div>
      
      {pagination && !loading && filtered.length > 0 && (
        <Pagination
          pagination={pagination}
          currentPage={currentPage}
          onPageChange={(page) => load(page)}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 my-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingId ? 'Editar Utilizador' : 'Novo Utilizador'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  disabled={!!editingId}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                />
              </div>
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
                  <input
                    type="password"
                    required={!editingId}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {isManager ? (
                // Manager: role is fixed to Manager, no condominium/unit
                <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium">
                  Gestor do Portal
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Função *</label>
                    <select
                      required
                      value={formData.role}
                      onChange={(e) => {
                        const newRole = Number(e.target.value) as UserRole;
                        setFormData({ ...formData, role: newRole, unitId: undefined });
                        if (newRole !== UserRole.Admin) setIsInternalAdmin(false);
                      }}
                      disabled={isAdmin && !editingId}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100"
                    >
                      <option value="1">Administrador</option>
                      <option value="2">Morador</option>
                    </select>
                    {isAdmin && !editingId && (
                      <p className="text-xs text-gray-500 mt-1">Admin só pode criar Admin e Morador</p>
                    )}
                  </div>
                  {(formData.role === UserRole.Admin || formData.role === UserRole.Resident) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Condomínio *</label>
                      <select
                        required
                        value={formData.condominiumId || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, condominiumId: e.target.value || undefined, unitId: undefined })
                        }
                        disabled={isAdmin}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100"
                      >
                        <option value="">Selecione...</option>
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
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="isInternalAdmin" className="text-sm font-medium text-gray-700">
                        Admin Interno (com fração atribuída)
                      </label>
                    </div>
                  )}
                  {(formData.role === UserRole.Resident || (formData.role === UserRole.Admin && isInternalAdmin)) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fração *</label>
                      <select
                        required={formData.role === 2}
                        value={formData.unitId || ''}
                        onChange={(e) => setFormData({ ...formData, unitId: e.target.value || undefined })}
                        disabled={!formData.condominiumId}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100"
                      >
                        <option value="">Selecione...</option>
                        {availableUnits.map((u) => (
                          <option key={u.id} value={u.id}>
                            Fração {u.number} – Piso {u.floor}
                          </option>
                        ))}
                      </select>
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
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Utilizador Ativo
                  </label>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editingId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
