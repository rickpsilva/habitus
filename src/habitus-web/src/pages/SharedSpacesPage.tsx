import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Building } from 'lucide-react';
import { sharedSpacesApi, usersApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import type { SharedSpaceDto, PaginatedResponse } from '../types';

export default function SharedSpacesPage({ embedded = false }: { embedded?: boolean }) {
  const { isAdmin } = useAuth();
  const { error: toastError } = useToast();
  const [spaces, setSpaces] = useState<SharedSpaceDto[]>([]);
  const [loading, setLoading] = useState(true);
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
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const userData = await usersApi.getMe();
      const condominiumId = userData.data.condominiumId || '';
      
      const response = await sharedSpacesApi.getPaged(page, pageSize, debouncedSearch);
      // Filter by condominium if admin
      const filtered = isAdmin 
        ? response.data.items.filter(s => s.condominiumId === condominiumId)
        : response.data.items;
      
      setPagination(response.data);
      setSpaces(filtered);
      setCurrentPage(page);
      setForm(prev => ({ ...prev, condominiumId }));
    } catch (error) {
      console.error('Erro ao carregar espaços:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, debouncedSearch]);

  useEffect(() => { 
    load(1); 
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.condominiumId) {
      alert('Condomínio não identificado. Por favor, recarregue a página.');
      return;
    }
    
    if (!form.name || form.name.trim() === '') {
      alert('Nome é obrigatório.');
      return;
    }
    
    if (!form.capacity || parseInt(form.capacity) <= 0) {
      alert('Capacidade deve ser maior que zero.');
      return;
    }
    
    setSubmitting(true);
    try {
      const data = {
        name: form.name,
        description: form.description,
        capacity: parseInt(form.capacity),
        rules: form.rules,
        condominiumId: form.condominiumId,
        reservationFee: parseFloat(form.reservationFee) || 0,
      };
      
      if (editingId) {
        await sharedSpacesApi.update(editingId, {
          name: data.name,
          description: data.description,
          capacity: data.capacity,
          rules: data.rules,
          reservationFee: data.reservationFee,
        });
      } else {
        await sharedSpacesApi.create(data);
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
      alert(`Erro ao guardar espaço: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (space: SharedSpaceDto) => {
    setEditingId(space.id);
    setForm({
      name: space.name,
      description: space.description,
      capacity: space.capacity.toString(),
      rules: space.rules,
      condominiumId: space.condominiumId,
      reservationFee: (space.reservationFee ?? 0).toString(),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await sharedSpacesApi.delete(deleteId);
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
                  Capacidade *
                </label>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Ex: 50"
                  min="1"
                  required
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

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'A guardar...' : editingId ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      </ModalPopup>

      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building className="w-7 h-7" />
            Espaços Comuns
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Gestão dos espaços partilhados do condomínio</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-48">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Pesquisar espaços..."
          />
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Novo Espaço
          </button>
        )}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-500">A carregar...</div>
      ) : spaces.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum espaço comum registado</p>
          <p className="text-gray-400 text-sm mt-1">Crie o primeiro espaço comum para começar</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map((space) => (
              <div
                key={space.id}
                className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{space.name}</h3>
                    <p className="text-sm text-indigo-600 mt-0.5">
                      Capacidade: {space.capacity} pessoas
                    </p>
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
        </>
      )}
    </div>
  );
}
