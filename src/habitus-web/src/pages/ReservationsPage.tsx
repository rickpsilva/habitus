import { useEffect, useState, useCallback } from 'react';
import { Plus, Calendar, Trash2, Edit2, AlertCircle, Eye, Table as TableIcon, CalendarDays } from 'lucide-react';
import { reservationsApi, sharedSpacesApi, usersApi, unitsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import SearchBar from '../components/SearchBar';
import WeeklyCalendar from '../components/WeeklyCalendar';
import MonthlyCalendar from '../components/MonthlyCalendar';
import type { ReservationDto, SharedSpaceDto, UserDto, UnitDto, PaginatedResponse } from '../types';
import { PageHeader, Button, Segmented, ErrorState, DataTable, EmptyState, Badge, Card } from '../components/ui';
import type { Column, BadgeVariant } from '../components/ui';

const statusLabels: Record<string, string> = {
  Pending: 'Pendente',
  Approved: 'Aprovado',
  Rejected: 'Rejeitado',
  CancellationRequested: 'Pedido Cancelamento',
  Cancelled: 'Cancelado',
  Completed: 'Terminado',
};

const statusVariants: Record<string, BadgeVariant> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  CancellationRequested: 'attention',
  Cancelled: 'neutral',
  Completed: 'info',
};

type SortField = 'spaceName' | 'startTime' | 'endTime' | 'status' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function ReservationsPage() {
  const { isAdmin } = useAuth();
  const { error: toastError } = useToast();
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [spaces, setSpaces] = useState<SharedSpaceDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<ReservationDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
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
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'week' | 'month'>('table');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day; // Go back to Sunday
    const sunday = new Date(today.setDate(diff));
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  });

  const toDateTimeLocalValue = (date: Date) => {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const load = useCallback(async (page: number = 1) => {
    setLoading(true);
    setLoadError('');
    try {
      // Get current user data
      const userData = await usersApi.getMe();
      const userId = userData.data.id;
      const scopedCondominiumId = userData.data.condominiumId;
      
      setCurrentUserId(userId);

      if (!scopedCondominiumId) {
        setReservations([]);
        setSpaces([]);
        setUsers([userData.data]);
        setUnits([]);
        setPagination(null);
        setCurrentPage(page);
        setLoadError('Condomínio não identificado para o utilizador atual.');
        return;
      }
      
      // Load reservations and spaces (always needed)
      const [reservationsRes, spacesRes, unitsRes] = await Promise.all([
        reservationsApi.getPaged(scopedCondominiumId, page, pageSize, debouncedSearch),
        sharedSpacesApi.getAll(scopedCondominiumId),
        unitsApi.getAll(scopedCondominiumId)
      ]);
      
      // Load users based on role - only Admin can access getByCondominium
      let usersData = [userData.data]; // At minimum, we have the current user
      if (isAdmin) {
        try {
          const usersRes = await usersApi.getByCondominium(scopedCondominiumId);
          usersData = usersRes.data;
        } catch (error) {
          console.warn('Could not load all users, using current user only:', error);
        }
      }
      
      // Filter by condominium
      const filteredSpaces = spacesRes.data;
      const filteredUnits = unitsRes.data;
      let filteredReservations = reservationsRes.data.items.filter(r => r.condominiumId === scopedCondominiumId);
      
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
      setForm(prev => ({ ...prev, userId, condominiumId: scopedCondominiumId || '' }));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setLoadError('Não foi possível carregar as reservas.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, debouncedSearch]);

  useEffect(() => { load(1); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.userId || !form.spaceId) {
      toastError('Dados incompletos. Por favor, recarregue a página.');
      return;
    }
    
    if (!form.startTime || !form.endTime) {
      toastError('Por favor, preencha as datas de início e fim.');
      return;
    }
    
    // Validate that end time is after start time
    const startDate = new Date(form.startTime);
    const endDate = new Date(form.endTime);
    if (endDate <= startDate) {
      toastError('A data/hora de fim deve ser posterior à data/hora de início.');
      return;
    }
    
    // Validate that start time is not in the past
    const now = new Date();
    if (startDate.getTime() < now.getTime() - 60000) {
      toastError('A data de início deve ser igual ou posterior à data atual.');
      return;
    }

    if (!form.condominiumId) {
      toastError('Condomínio não identificado.');
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
        
        await reservationsApi.update(form.condominiumId, editingId, updateData);
      } else {
        // Create new reservation
        const createData = {
          spaceId: form.spaceId,
          userId: form.userId,
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
        };
        
        await reservationsApi.create(form.condominiumId, createData);
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
    } catch (err: unknown) {
      console.error('Erro ao guardar reserva:', err);
      const msg =
        typeof err === 'object' &&
        err !== null &&
        'response' in err
          ? (err as { response?: { data?: { message?: string } | string } }).response?.data
          : undefined;
      const normalizedMessage =
        typeof msg === 'string'
          ? msg
          : typeof msg === 'object' && msg !== null && 'message' in msg
            ? (msg as { message?: string }).message
            : undefined;
      setError(normalizedMessage ?? 'Conflito de horário. Tente outro período.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (reservation: ReservationDto) => {
    setEditingId(reservation.id);
    
    // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
    const startTime = toDateTimeLocalValue(new Date(reservation.startTime));
    const endTime = toDateTimeLocalValue(new Date(reservation.endTime));
    
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
      if (!form.condominiumId) {
        toastError('Condomínio não identificado.');
        return;
      }

      await reservationsApi.delete(form.condominiumId, deleteReservationId);
      setShowDeleteModal(false);
      setDeleteReservationId(null);
      load();
    } catch (error: unknown) {
      console.error('Erro ao eliminar reserva:', error);
      toastError('Erro ao eliminar reserva. Tente novamente.');
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

      if (!form.condominiumId) {
        toastError('Condomínio não identificado.');
        return;
      }
      
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
          await reservationsApi.approve(form.condominiumId, id, finalComment || undefined);
          break;
        case 'reject':
          await reservationsApi.reject(form.condominiumId, id, finalComment || undefined);
          break;
        case 'approveCancellation':
          await reservationsApi.approveCancellation(form.condominiumId, id, finalComment || undefined);
          break;
        case 'rejectCancellation':
          await reservationsApi.rejectCancellation(form.condominiumId, id, finalComment || undefined);
          break;
      }
      
      closeCommentModal();
      load();
    } catch (error: unknown) {
      const errorMessage =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : error instanceof Error
            ? error.message
            : 'Erro ao alterar estado';
      console.error('Erro ao alterar estado:', error);
      toastError(`Erro: ${errorMessage}`);
    }
  };

  const handleRequestCancellation = async (id: string) => {
    setCancelId(id);
  };

  const confirmCancellation = async () => {
    if (!cancelId) return;
    try {
      if (!form.condominiumId) {
        toastError('Condomínio não identificado.');
        return;
      }

      await reservationsApi.requestCancellation(form.condominiumId, cancelId);
      load();
    } catch (error: unknown) {
      const errorMessage =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : error instanceof Error
            ? error.message
            : 'Erro ao pedir cancelamento';
      console.error('Erro ao pedir cancelamento:', error);
      toastError(`Erro: ${errorMessage}`);
    } finally {
      setCancelId(null);
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

  // Calendar handlers
  const handleWeekChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    const daysToAdd = direction === 'next' ? 7 : -7;
    newDate.setDate(newDate.getDate() + daysToAdd);
    setCurrentWeekStart(newDate);
  };

  const handleSelectSlot = (date: Date, hour: number) => {
    // Create new reservation at selected time
    const startTime = new Date(date);
    startTime.setHours(hour, 0, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setHours(hour + 1, 0, 0, 0); // Default 1 hour duration
    
    setForm({
      spaceId: spaces.length > 0 ? spaces[0].id : '',
      userId: currentUserId,
      condominiumId: form.condominiumId,
      startTime: toDateTimeLocalValue(startTime),
      endTime: toDateTimeLocalValue(endTime),
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleSelectReservation = (reservation: ReservationDto) => {
    // Open details or edit based on permissions
    setSelectedReservation(reservation);
    setShowDetailsModal(true);
  };

  const handleSelectDay = (date: Date) => {
    // When clicking a day in monthly view, switch to weekly view for that week
    const day = date.getDay();
    const diff = date.getDate() - day; // Go back to Sunday
    const sunday = new Date(date);
    sunday.setDate(diff);
    sunday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(sunday);
    setViewMode('week');
  };

  const reservationColumns: Column<ReservationDto>[] = [
    {
      key: 'spaceName',
      header: 'Espaço',
      sortable: true,
      mobileLabel: 'Espaço',
      render: (r) => <span className="font-medium text-ink">{spaceName(r.spaceId)}</span>,
    },
    {
      key: 'startTime',
      header: 'Início',
      sortable: true,
      mobileLabel: 'Início',
      render: (r) =>
        new Date(r.startTime).toLocaleString('pt-PT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      key: 'endTime',
      header: 'Fim',
      sortable: true,
      mobileLabel: 'Fim',
      render: (r) =>
        new Date(r.endTime).toLocaleString('pt-PT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      mobileLabel: 'Estado',
      render: (r) => (
        <Badge variant={statusVariants[r.status] ?? 'neutral'}>
          {statusLabels[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      sortable: true,
      mobileLabel: 'Criado em',
      render: (r) =>
        new Date(r.createdAt).toLocaleString('pt-PT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      mobileLabel: 'Ações',
      render: (r) => (
        <div className="flex items-center justify-end gap-2 flex-wrap">
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
          {getAvailableActions(r).map((action, idx) => {
            const colorClasses = {
              green: 'text-green-600 hover:bg-green-50',
              red: 'text-red-600 hover:bg-red-50',
              orange: 'text-orange-600 hover:bg-orange-50',
            }[action.color] || 'text-ink-muted hover:bg-surface-hover';
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
          <button
            onClick={() => openDetailsModal(r)}
            className="inline-flex items-center gap-1 px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors text-xs font-medium"
            title="Ver detalhes"
          >
            <Eye className="w-4 h-4" />
            Detalhes
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={cancelId !== null}
        title="Pedir cancelamento"
        message="Tem a certeza que deseja pedir o cancelamento desta reserva?"
        confirmLabel="Pedir cancelamento"
        variant="warning"
        onConfirm={confirmCancellation}
        onCancel={() => setCancelId(null)}
      />
      <PageHeader
        title="Reservas"
        subtitle="Reservas dos espaços comuns"
        search={
          viewMode === 'table' ? (
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar reservas..."
            />
          ) : undefined
        }
        actions={
          <>
            {viewMode === 'table' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Todos os estados</option>
                <option value="Pending">Pendente</option>
                <option value="Approved">Aprovado</option>
                <option value="Rejected">Rejeitado</option>
                <option value="CancellationRequested">Pedido Cancelamento</option>
                <option value="Cancelled">Cancelado</option>
                <option value="Completed">Terminado</option>
              </select>
            )}
            <Segmented<'table' | 'week' | 'month'>
              ariaLabel="Modo de visualização"
              value={viewMode}
              onChange={setViewMode}
              className="w-full sm:w-auto"
              options={[
                { value: 'table', label: 'Tabela', icon: TableIcon },
                { value: 'week', label: 'Semanal', icon: Calendar },
                { value: 'month', label: 'Mensal', icon: CalendarDays },
              ]}
            />
            <Button onClick={() => setShowForm(true)} icon={Plus} fullWidth className="sm:w-auto">
              Nova Reserva
            </Button>
          </>
        }
      />

      {/* Spaces available */}
      {spaces.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {spaces.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-medium text-ink">{s.name}</h3>
              </div>
              {s.description && <p className="text-xs text-ink-subtle mb-2">{s.description}</p>}
              {s.capacity && s.capacity > 0 && <p className="text-xs text-ink-subtle">Capacidade: {s.capacity} pessoas</p>}
            </Card>
          ))}
        </div>
      )}

      {/* New/Edit reservation modal */}
      <ModalPopup
        open={showForm}
        onClose={handleCancelForm}
        title={editingId ? 'Editar Reserva' : 'Nova Reserva'}
        maxWidthClass="max-w-2xl"
      >
        {error && <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-ink-muted mb-1">Espaço</label>
            <select
              value={form.spaceId}
              onChange={(e) => setForm({ ...form, spaceId: e.target.value })}
              required
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Selecionar espaço</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.capacity && s.capacity > 0 ? ` (máx. ${s.capacity} pessoas)` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Início</label>
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              required
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Fim</label>
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              required
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={handleCancelForm} className="border border-line">
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              {editingId ? 'Atualizar' : 'Reservar'}
            </Button>
          </div>
        </form>
      </ModalPopup>

      {/* Calendar or Table view */}
      {!loading && loadError && viewMode !== 'table' && (
        <ErrorState message={loadError} onRetry={() => load(currentPage)} />
      )}

      {viewMode === 'week' ? (
        <WeeklyCalendar
          reservations={reservations}
          spaces={spaces}
          currentWeekStart={currentWeekStart}
          onWeekChange={handleWeekChange}
          onSelectSlot={handleSelectSlot}
          onSelectReservation={handleSelectReservation}
        />
      ) : viewMode === 'month' ? (
        <MonthlyCalendar
          reservations={reservations}
          spaces={spaces}
          onSelectDay={handleSelectDay}
          onSelectReservation={handleSelectReservation}
        />
      ) : (
        <>
          {/* Reservations table */}
          <DataTable<ReservationDto>
            columns={reservationColumns}
            rows={sortedReservations}
            rowKey={(r) => r.id}
            loading={loading}
            error={loadError || null}
            onRetry={() => load(currentPage)}
            sortBy={sortField}
            sortDirection={sortDirection}
            onSort={(key) => handleSort(key as SortField)}
            pagination={pagination ?? undefined}
            currentPage={currentPage}
            onPageChange={(page) => load(page)}
            emptyState={
              <EmptyState
                icon={Calendar}
                title="Sem reservas"
                description="Crie a primeira reserva de espaço comum"
              />
            }
          />
        </>
      )}

      {/* Comment Modal */}
      <ModalPopup
        open={showCommentModal}
        onClose={closeCommentModal}
        title="Comentário do Admin (opcional)"
        maxWidthClass="max-w-md"
      >
            
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
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={4}
            />
            <div className="flex flex-wrap justify-end gap-3 mt-4">
              <Button variant="ghost" onClick={closeCommentModal} className="border border-line">
                Cancelar
              </Button>
              <Button onClick={handleStatusAction}>
                Confirmar
              </Button>
            </div>
      </ModalPopup>

      {/* Details Modal */}
      <ModalPopup
        open={showDetailsModal && selectedReservation !== null}
        onClose={closeDetailsModal}
        title="Detalhes da Reserva"
        maxWidthClass="max-w-lg"
      >
        {selectedReservation && (
          <>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-ink-subtle">Espaço</label>
                <p className="text-base text-ink">{spaceName(selectedReservation.spaceId)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-ink-subtle">Morador</label>
                  <p className="text-base text-ink">{getUserName(selectedReservation.userId)}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-ink-subtle">Fração</label>
                  <p className="text-base text-ink">{getUserUnit(selectedReservation.userId)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-ink-subtle">Data/Hora Início</label>
                  <p className="text-base text-ink">
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
                  <label className="text-sm font-medium text-ink-subtle">Data/Hora Fim</label>
                  <p className="text-base text-ink">
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
                  <label className="text-sm font-medium text-ink-subtle">Estado</label>
                  <p>
                    <Badge variant={statusVariants[selectedReservation.status] ?? 'neutral'}>
                      {statusLabels[selectedReservation.status]}
                    </Badge>
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-ink-subtle">Data de Criação</label>
                  <p className="text-base text-ink">
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
                  <label className="text-sm font-medium text-ink-subtle mb-2 block">Histórico de Comentários</label>
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
                                  <span className="text-xs text-ink-subtle">{timestamp}</span>
                                </div>
                                <p className="text-sm text-ink">{text}</p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      // Fallback for old format or unformatted comments
                      return (
                        <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-ink">{comment}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end mt-6">
              <Button variant="secondary" onClick={closeDetailsModal}>
                Fechar
              </Button>
            </div>
          </>
        )}
      </ModalPopup>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteModal}
        title="Confirmar eliminação"
        message="Tem a certeza que pretende eliminar esta reserva? Esta ação não pode ser revertida."
        confirmLabel="Sim, eliminar"
        cancelLabel="Não, cancelar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
