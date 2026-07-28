import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Building } from 'lucide-react';
import { sharedSpacesApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import { PageHeader, Button, AsyncState, EmptyState } from '../components/ui';
import type { SharedSpaceDto, PaginatedResponse } from '../types';

export default function SharedSpacesPage({ embedded = false }: { embedded?: boolean }) {
  const { isAdmin, condominiumId } = useAuth();
  const { error: toastError } = useToast();
  const [spaces, setSpaces] = useState<SharedSpaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<SharedSpaceDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    capacity: '',
    rules: '',
    condominiumId: '',
    reservationFee: '0',
    color: '#4F46E5',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (page: number = 1) => {
    setLoading(true);
    setLoadError('');
    try {
      if (!condominiumId) {
        setPagination(null);
        setSpaces([]);
        setCurrentPage(page);
        setForm(prev => ({ ...prev, condominiumId: '' }));
        setLoadError('Condomínio não identificado.');
        return;
      }

      const response = await sharedSpacesApi.getPaged(condominiumId, page, pageSize, debouncedSearch);

      setPagination(response.data);
      setSpaces(response.data.items);
      setCurrentPage(page);
      setForm(prev => ({ ...prev, condominiumId }));
    } catch (error) {
      console.error('Erro ao carregar espaços:', error);
      setLoadError('Não foi possível carregar os espaços comuns.');
    } finally {
      setLoading(false);
    }
  }, [condominiumId, debouncedSearch]);

  useEffect(() => { 
    load(1); 
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!condominiumId) {
      toastError('Condomínio não identificado. Por favor, recarregue a página.');
      return;
    }
    
    if (!form.name || form.name.trim() === '') {
      toastError('Nome e obrigatorio.');
      return;
    }
    
    // Capacity is now optional - allow empty or 0
    // No validation needed here
    
    setSubmitting(true);
    try {
      const data = {
        name: form.name,
        description: form.description,
        capacity: form.capacity ? parseInt(form.capacity) : undefined,
        rules: form.rules,
        condominiumId,
        reservationFee: parseFloat(form.reservationFee) || 0,
        color: form.color,
      };
      
      if (editingId) {
        await sharedSpacesApi.update(condominiumId, editingId, {
          name: data.name,
          description: data.description,
          capacity: data.capacity,
          rules: data.rules,
          reservationFee: data.reservationFee,
          color: data.color,
        });
      } else {
        await sharedSpacesApi.create(condominiumId, data);
      }
      
      setShowForm(false);
      setEditingId(null);
      setForm({ 
        name: '', 
        description: '', 
        capacity: '', 
        rules: '', 
        condominiumId: form.condominiumId,
        reservationFee: '0',
        color: '#4F46E5',
      });
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
            : 'Erro ao guardar espaço';
      console.error('Erro ao guardar espaço:', error);
      toastError(`Erro ao guardar espaco: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (space: SharedSpaceDto) => {
    setEditingId(space.id);
    setForm({
      name: space.name,
      description: space.description,
      capacity: space.capacity ? space.capacity.toString() : '',
      rules: space.rules,
      condominiumId: space.condominiumId,
      reservationFee: (space.reservationFee ?? 0).toString(),
      color: space.color || '#4F46E5',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      if (!condominiumId) {
        toastError('Condomínio não identificado.');
        return;
      }

      await sharedSpacesApi.delete(condominiumId, deleteId);
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
            : 'Erro ao eliminar espaço';
      console.error('Erro ao eliminar espaço:', error);
      toastError(`Erro ao eliminar espaço: ${errorMessage}`);
    } finally {
      setDeleteId(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ 
      name: '', 
      description: '', 
      capacity: '', 
      rules: '', 
      condominiumId: form.condominiumId,
      reservationFee: '0',
      color: '#4F46E5',
    });
  };

  return (
    <div className={embedded ? "space-y-4" : "p-6 max-w-7xl mx-auto space-y-4"}>
      <ConfirmModal
        open={deleteId !== null}
        title="Eliminar espaço"
        message="Tem a certeza que deseja eliminar este espaço? Esta ação não pode ser revertida."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* Modal form */}
      <ModalPopup
        open={showForm}
        onClose={handleCancel}
        title={editingId ? 'Editar Espaço' : 'Novo Espaço'}
        maxWidthClass="max-w-lg"
      >
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Ex: Salão de Festas"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacidade
                </label>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Ex: 50 (deixe vazio para ilimitado)"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cor no Calendário
                </label>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                  title="Escolha a cor para este espaço no calendário"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={3}
                placeholder="Descrição do espaço"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Regras de Utilização
              </label>
              <textarea
                value={form.rules}
                onChange={(e) => setForm({ ...form, rules: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={4}
                placeholder="Ex: Horário: 8h-22h. Proibido fumar. Respeitar limites de ruído."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Taxa de Reserva (€)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.reservationFee}
                  onChange={(e) => setForm({ ...form, reservationFee: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Taxa cobrada ao residente por cada reserva. Deixe 0 para reservas gratuitas.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={handleCancel} className="border border-gray-300">
                Cancelar
              </Button>
              <Button type="submit" loading={submitting}>
                {editingId ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </div>
      </ModalPopup>

      {!embedded ? (
        <PageHeader
          title="Espaços Comuns"
          subtitle="Gestão dos espaços partilhados do condomínio"
          search={
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar espaços..."
            />
          }
          actions={
            isAdmin && (
              <Button icon={Plus} onClick={() => setShowForm(true)} fullWidth className="sm:w-auto">
                Novo Espaço
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-48">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar espaços..."
            />
          </div>
          {isAdmin && (
            <Button icon={Plus} onClick={() => setShowForm(true)}>
              Novo Espaço
            </Button>
          )}
        </div>
      )}

      {/* Cards */}
      <AsyncState
        loading={loading}
        error={loadError || null}
        onRetry={() => load(currentPage)}
        isEmpty={spaces.length === 0}
        skeleton="card"
        empty={
          <EmptyState
            icon={Building}
            title="Nenhum espaço comum registado"
            description="Crie o primeiro espaço comum para começar"
          />
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map((space) => (
              <div
                key={space.id}
                className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{space.name}</h3>
                    {space.capacity && space.capacity > 0 && (
                      <p className="text-sm text-indigo-600 mt-0.5">
                        Capacidade: {space.capacity} pessoas
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => handleEdit(space)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(space.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {space.description && (
                  <p className="text-sm text-gray-600 mb-2">{space.description}</p>
                )}

                {space.rules && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-700 mb-1">Regras:</p>
                    <p className="text-xs text-gray-500 whitespace-pre-line line-clamp-3">{space.rules}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {pagination && (
            <Pagination
              pagination={pagination}
              currentPage={currentPage}
              onPageChange={(page) => load(page)}
            />
          )}
        </div>
      </AsyncState>
    </div>
  );
}
