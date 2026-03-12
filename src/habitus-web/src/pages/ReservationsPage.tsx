import { useEffect, useState } from 'react';
import { Plus, Calendar, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Edit2, X, AlertCircle, MessageSquare } from 'lucide-react';
import { reservationsApi, sharedSpacesApi, usersApi, unitsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import type { ReservationDto, SharedSpaceDto, UserDto, UnitDto, PaginatedResponse } from '../types';

const statusLabels: Record<string, string> = {
  Pending: 'Pendente',
  Approved: 'Aprovado',
  Rejected: 'Rejeitado',
  CancellationRequested: 'Pedido Cancelamento',
  Cancelled: 'Cancelado',
  Completed: 'Terminado',
};

const statusColors: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  CancellationRequested: 'bg-orange-100 text-orange-700',
  Cancelled: 'bg-gray-100 text-gray-500',
  Completed: 'bg-blue-100 text-blue-700',
};

type SortField = 'spaceName' | 'startTime' | 'endTime' | 'status' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function ReservationsPage() {
  const { isAdmin } = useAuth();
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [spaces, setSpaces] = useState<SharedSpaceDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<ReservationDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const pageSize = 10;
  const [form, setForm] = useState({
    spaceId: '',
    userId: '',
    condominiumId: '',
    startTime: '',
    endTime: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentAction, setCommentAction] = useState<{ type: string; id: string } | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<ReservationDto | null>(null);
  const [overlappingReservations, setOverlappingReservations] = useState<ReservationDto[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReservationId, setDeleteReservationId] = useState<string | null>(null);

  const load = async (page: number = 1, search: string = searchQuery) => {
    setLoading(true);
    try {
      // Get current user data
      const userData = await usersApi.getMe();
      const userId = userData.data.id;
      const condominiumId = userData.data.condominiumId;
      
      setCurrentUserId(userId);
      
      // Load reservations and spaces (always needed)
      const [reservationsRes, spacesRes, unitsRes] = await Promise.all([
        reservationsApi.getPaged(page, pageSize, search),
        sharedSpacesApi.getAll(),
        unitsApi.getAll()
      ]);
      
      // Load users based on role - only Admin can access getByCondominium
      let usersData = [userData.data]; // At minimum, we have the current user
      if (isAdmin) {
        try {
          const usersRes = await usersApi.getByCondominium(condominiumId!);
          usersData = usersRes.data;
        } catch (error) {
          console.warn('Could not load all users, using current user only:', error);
        }
      }
      
      // Filter by condominium
      const filteredSpaces = spacesRes.data.filter(s => s.condominiumId === condominiumId);
      const filteredUnits = unitsRes.data.filter(u => u.condominiumId === condominiumId);
      let filteredReservations = reservationsRes.data.items.filter(r => r.condominiumId === condominiumId);
      
      // Moradores only see their own reservations, Admins see all
      if (!isAdmin) {
        filteredReservations = filteredReservations.filter(r => r.userId === userId);
      }
      
      setSpaces(filteredSpaces);
      setPagination(reservationsRes.data);
      setReservations(filteredReservations);
      setCurrentPage(page);
      setUsers(usersData);
      setUnits(filteredUnits);
      setForm(prev => ({ ...prev, userId, condominiumId: condominiumId || '' }));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        load(1, searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.userId || !form.spaceId) {
      alert('Dados incompletos. Por favor, recarregue a página.');
      return;
    }
    
    if (!form.startTime || !form.endTime) {
      alert('Por favor, preencha as datas de início e fim.');
      return;
    }
    
    // Validate that end time is after start time
    const startDate = new Date(form.startTime);
    const endDate = new Date(form.endTime);
    if (endDate <= startDate) {
      alert('A data/hora de fim deve ser posterior à data/hora de início.');
      return;
    }
    
    setError('');
    setSubmitting(true);
    try {
      if (editingId) {
        // Update existing reservation
        const updateData = {
          spaceId: form.spaceId,
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
        };
        
        await reservationsApi.update(editingId, updateData);
      } else {
        // Create new reservation
        const createData = {
          spaceId: form.spaceId,
          userId: form.userId,
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
        };
        
        await reservationsApi.create(createData);
      }
      
      setShowForm(false);
      setEditingId(null);
      setForm({ 
        spaceId: '', 
        userId: form.userId, 
        condominiumId: form.condominiumId,
        startTime: '', 
        endTime: '' 
      });
      load();
    } catch (err: any) {
      console.error('Erro ao guardar reserva:', err);
      const msg = err?.response?.data?.message || err?.response?.data;
      setError(msg ?? 'Conflito de horário. Tente outro período.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (reservation: ReservationDto) => {
    setEditingId(reservation.id);
    
    // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
    const startTime = new Date(reservation.startTime).toISOString().slice(0, 16);
    const endTime = new Date(reservation.endTime).toISOString().slice(0, 16);
    
    setForm({
      spaceId: reservation.spaceId,
      userId: form.userId,
      condominiumId: form.condominiumId,
      startTime,
      endTime,
    });
    setShowForm(true);
    setError('');
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setError('');
    setForm({ 
      spaceId: '', 
      userId: form.userId, 
      condominiumId: form.condominiumId,
      startTime: '', 
      endTime: '' 
    });
  };

  const handleDelete = (id: string) => {
    setDeleteReservationId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteReservationId) return;
    
    try {
      await reservationsApi.delete(deleteReservationId);
      setShowDeleteModal(false);
      setDeleteReservationId(null);
      load();
    } catch (error: any) {
      console.error('Erro ao eliminar reserva:', error);
      alert('Erro ao eliminar reserva');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteReservationId(null);
  };

  const spaceName = (id: string) => spaces.find((s) => s.id === id)?.name ?? id;
  
  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name ?? 'Utilizador desconhecido';
  };
  
  const getUserUnit = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user || !user.unitId) return 'N/A';
    const unit = units.find(u => u.id === user.unitId);
    return unit ? unit.number : 'N/A';
  };

  const checkOverlappingReservations = (reservation: ReservationDto): ReservationDto[] => {
    const startTime = new Date(reservation.startTime);
    const endTime = new Date(reservation.endTime);
    
    return reservations.filter(r => {
      // Skip the reservation itself
      if (r.id === reservation.id) return false;
      
      // Only check approved reservations for the same space
      if (r.spaceId !== reservation.spaceId || r.status !== 'Approved') return false;
      
      const rStart = new Date(r.startTime);
      const rEnd = new Date(r.endTime);
      
      // Check if time ranges overlap
      return (startTime < rEnd && endTime > rStart);
    });
  };

  const canEdit = (reservation: ReservationDto): boolean => {
    // Admin can edit Pending and Approved reservations
    if (isAdmin) {
      return reservation.status === 'Pending' || reservation.status === 'Approved';
    }
    // Morador can only edit their own Pending reservations
    return reservation.userId === currentUserId && reservation.status === 'Pending';
  };

  const openCommentModal = (type: string, id: string) => {
    setCommentAction({ type, id });
    setAdminComment('');
    
    // Check for overlapping reservations when approving
    if (type === 'approve') {
      const reservation = reservations.find(r => r.id === id);
      if (reservation) {
        const overlaps = checkOverlappingReservations(reservation);
        setOverlappingReservations(overlaps);
      }
    } else {
      setOverlappingReservations([]);
    }
    
    setShowCommentModal(true);
  };

  const closeCommentModal = () => {
    setShowCommentModal(false);
    setCommentAction(null);
    setAdminComment('');
    setOverlappingReservations([]);
  };

  const openDetailsModal = (reservation: ReservationDto) => {
    setSelectedReservation(reservation);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedReservation(null);
  };

  const handleStatusAction = async () => {
    if (!commentAction) return;
    
    try {
      const { type, id } = commentAction;
      
      // Build comment with timestamp for history
      let finalComment = adminComment.trim();
      if (finalComment) {
        const timestamp = new Date().toLocaleString('pt-PT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Get existing comments
        const reservation = reservations.find(r => r.id === id);
        const existingComments = reservation?.adminComments || '';
        
        // Append new comment with timestamp and action type
        const actionLabels: Record<string, string> = {
          'approve': 'Aprovado',
          'reject': 'Rejeitado',
          'approveCancellation': 'Cancelamento Aprovado',
          'rejectCancellation': 'Cancelamento Rejeitado'
        };
        
        const newComment = `[${timestamp}] ${actionLabels[type]}: ${finalComment}`;
        finalComment = existingComments ? `${existingComments}\n${newComment}` : newComment;
      }
      
      switch (type) {
        case 'approve':
          await reservationsApi.approve(id, finalComment || undefined);
          break;
        case 'reject':
          await reservationsApi.reject(id, finalComment || undefined);
          break;
        case 'approveCancellation':
          await reservationsApi.approveCancellation(id, finalComment || undefined);
          break;
        case 'rejectCancellation':
          await reservationsApi.rejectCancellation(id, finalComment || undefined);
          break;
      }
      
      closeCommentModal();
      load();
    } catch (error: any) {
      console.error('Erro ao alterar estado:', error);
      alert(`Erro: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleRequestCancellation = async (id: string) => {
    if (!confirm('Deseja pedir o cancelamento desta reserva?')) return;
    
    try {
      await reservationsApi.requestCancellation(id);
      load();
    } catch (error: any) {
      console.error('Erro ao pedir cancelamento:', error);
      alert(`Erro: ${error.response?.data?.message || error.message}`);
    }
  };

  const canRequestCancellation = (reservation: ReservationDto): boolean => {
    if (reservation.status !== 'Approved') return false;
    
    // Check if end time has not passed yet
    const endTime = new Date(reservation.endTime);
    const now = new Date();
    if (endTime <= now) return false; // Cannot cancel if reservation has ended
    
    // Only the reservation owner (Resident) can request cancellation, not Admin
    return !isAdmin && reservation.userId === currentUserId;
  };

  const getAvailableActions = (reservation: ReservationDto) => {
    const actions: Array<{ label: string; action: () => void; color: 'green' | 'red' | 'orange' }> = [];
    
    // Completed or already cancelled/rejected - no actions
    if (reservation.status === 'Completed' || reservation.status === 'Cancelled' || reservation.status === 'Rejected') {
      return actions;
    }
    
    // Admin actions
    if (isAdmin) {
      if (reservation.status === 'Pending') {
        actions.push(
          { label: 'Aprovar', action: () => openCommentModal('approve', reservation.id), color: 'green' },
          { label: 'Rejeitar', action: () => openCommentModal('reject', reservation.id), color: 'red' }
        );
      }
      
      if (reservation.status === 'CancellationRequested') {
        actions.push(
          { label: 'Aceitar Cancelamento', action: () => openCommentModal('approveCancellation', reservation.id), color: 'green' },
          { label: 'Rejeitar Cancelamento', action: () => openCommentModal('rejectCancellation', reservation.id), color: 'red' }
        );
      }
    }
    
    // User can request cancellation only if approved and not expired
    if (canRequestCancellation(reservation)) {
      actions.push(
        { label: 'Pedir Cancelamento', action: () => handleRequestCancellation(reservation.id), color: 'orange' }
      );
    }
    
    return actions;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-indigo-600" />
      : <ArrowDown className="w-4 h-4 text-indigo-600" />;
  };

  const filteredReservations = statusFilter 
    ? reservations.filter(r => r.status === statusFilter)
    : reservations;

  const sortedReservations = [...filteredReservations].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'spaceName':
        comparison = spaceName(a.spaceId).localeCompare(spaceName(b.spaceId));
        break;
      case 'startTime':
        comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        break;
      case 'endTime':
        comparison = new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-gray-500 text-sm mt-0.5">Reservas dos espaços comuns</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-80">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar reservas..."
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos os estados</option>
            <option value="Pending">Pendente</option>
            <option value="Approved">Aprovado</option>
            <option value="Rejected">Rejeitado</option>
            <option value="CancellationRequested">Pedido Cancelamento</option>
            <option value="Cancelled">Cancelado</option>
            <option value="Completed">Terminado</option>
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Reserva
          </button>
        </div>
      </div>

      {/* Spaces available */}
      {spaces.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {spaces.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-medium text-gray-900">{s.name}</h3>
              </div>
              {s.description && <p className="text-xs text-gray-500 mb-2">{s.description}</p>}
              {s.capacity > 0 && <p className="text-xs text-gray-400">Capacidade: {s.capacity} pessoas</p>}
            </div>
          ))}
        </div>
      )}

      {/* New/Edit reservation form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editingId ? 'Editar Reserva' : 'Nova Reserva'}
          </h3>
          {error && <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Espaço</label>
              <select
                value={form.spaceId}
                onChange={(e) => setForm({ ...form, spaceId: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecionar espaço</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} (máx. {s.capacity} pessoas)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
              <input
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={handleCancelForm} 
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? 'A guardar...' : editingId ? 'Atualizar' : 'Reservar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reservations table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400">A carregar...</div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sem reservas</p>
            <p className="text-sm text-gray-500 mt-1">Crie a primeira reserva de espaço comum</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th 
                    onClick={() => handleSort('spaceName')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Espaço
                      {getSortIcon('spaceName')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('startTime')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Início
                      {getSortIcon('startTime')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('endTime')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Fim
                      {getSortIcon('endTime')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('status')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Estado
                      {getSortIcon('status')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('createdAt')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Criado em
                      {getSortIcon('createdAt')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedReservations.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {spaceName(r.spaceId)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(r.startTime).toLocaleString('pt-PT', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(r.endTime).toLocaleString('pt-PT', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColors[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(r.createdAt).toLocaleString('pt-PT', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit and Delete buttons */}
                        {canEdit(r) && (
                          <>
                            <button 
                              onClick={() => handleEdit(r)} 
                              className="inline-flex items-center gap-1 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Editar reserva"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(r.id)} 
                              className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar reserva"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        
                        {/* Status action buttons */}
                        {getAvailableActions(r).map((action, idx) => {
                          const colorClasses = {
                            green: 'text-green-600 hover:bg-green-50',
                            red: 'text-red-600 hover:bg-red-50',
                            orange: 'text-orange-600 hover:bg-orange-50'
                          }[action.color] || 'text-gray-600 hover:bg-gray-50';
                          
                          return (
                            <button
                              key={idx}
                              onClick={action.action}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs ${colorClasses}`}
                              title={action.label}
                            >
                              {action.label}
                            </button>
                          );
                        })}
                        
                        {/* Show details button */}
                        <button
                          onClick={() => openDetailsModal(r)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Ver detalhes"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {pagination && !loading && reservations.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <Pagination
              pagination={pagination}
              currentPage={currentPage}
              onPageChange={(page) => load(page)}
            />
          </div>
        )}
      </div>

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Comentário do Admin (opcional)
            </h3>
            
            {/* Overlapping reservations warning */}
            {overlappingReservations.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-800 mb-1">
                      ⚠️ Atenção: Reservas Sobrepostas
                    </p>
                    <p className="text-xs text-red-700 mb-2">
                      Existem {overlappingReservations.length} reserva(s) aprovada(s) para o mesmo espaço no mesmo período:
                    </p>
                    <ul className="text-xs text-red-700 space-y-1">
                      {overlappingReservations.map(r => (
                        <li key={r.id}>
                          • {new Date(r.startTime).toLocaleString('pt-PT', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })} - {new Date(r.endTime).toLocaleString('pt-PT', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            <textarea
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              placeholder="Digite um comentário se desejar..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={4}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={closeCommentModal}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleStatusAction}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Detalhes da Reserva
              </h3>
              <button
                onClick={closeDetailsModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Espaço</label>
                <p className="text-base text-gray-900">{spaceName(selectedReservation.spaceId)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Morador</label>
                  <p className="text-base text-gray-900">{getUserName(selectedReservation.userId)}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Fração</label>
                  <p className="text-base text-gray-900">{getUserUnit(selectedReservation.userId)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Data/Hora Início</label>
                  <p className="text-base text-gray-900">
                    {new Date(selectedReservation.startTime).toLocaleString('pt-PT', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Data/Hora Fim</label>
                  <p className="text-base text-gray-900">
                    {new Date(selectedReservation.endTime).toLocaleString('pt-PT', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Estado</label>
                  <p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedReservation.status]}`}>
                      {statusLabels[selectedReservation.status]}
                    </span>
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Data de Criação</label>
                  <p className="text-base text-gray-900">
                    {new Date(selectedReservation.createdAt).toLocaleString('pt-PT', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
              
              {selectedReservation.adminComments && (
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">Histórico de Comentários</label>
                  <div className="space-y-2">
                    {selectedReservation.adminComments.split('\n').map((comment, idx) => {
                      // Parse comment format: [DD/MM/YYYY HH:MM] Action: Comment
                      const match = comment.match(/^\[([^\]]+)\] ([^:]+): (.+)$/);
                      if (match) {
                        const [, timestamp, action, text] = match;
                        return (
                          <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-amber-800">{action}</span>
                                  <span className="text-xs text-gray-500">{timestamp}</span>
                                </div>
                                <p className="text-sm text-gray-900">{text}</p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      // Fallback for old format or unformatted comments
                      return (
                        <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-gray-900">{comment}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={closeDetailsModal}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Confirmar Eliminação
                </h3>
                <p className="text-sm text-gray-600">
                  Tem a certeza que pretende eliminar esta reserva? Esta ação não pode ser revertida.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Não, cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Sim, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
