import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Building } from 'lucide-react';
import { sharedSpacesApi, usersApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
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
      };
      
      if (editingId) {
        await sharedSpacesApi.update(editingId, {
          name: data.name,
          description: data.description,
          capacity: data.capacity,
          rules: data.rules,
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
        condominiumId: form.condominiumId 
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
      condominiumId: form.condominiumId 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">A carregar...</div>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "p-6 max-w-7xl mx-auto"}>
      <ConfirmModal
        open={deleteId !== null}
        title="Eliminar espaço"
        message="Tem a certeza que deseja eliminar este espaço? Esta ação não pode ser revertida."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      <div className={embedded ? "" : "bg-white rounded-xl shadow-sm border border-gray-200"}>
        <div className={embedded ? "" : "p-6 border-b border-gray-200"}>
          {!embedded && (
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building className="w-7 h-7" />
                Espaços Comuns
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">Gestão dos espaços partilhados do condomínio</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="w-80">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Pesquisar espaços..."
              />
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Novo Espaço
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Editar Espaço' : 'Novo Espaço'}
            </h3>
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

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'A guardar...' : editingId ? 'Atualizar' : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          {spaces.length === 0 ? (
            <div className="text-center py-12">
              <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium">Nenhum espaço comum cadastrado</p>
              <p className="text-gray-400 text-sm mt-1">
                Crie o primeiro espaço comum para começar
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {spaces.map((space) => (
                  <div
                    key={space.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">{space.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Capacidade: {space.capacity} pessoas
                        </p>
                      </div>
                      <div className="flex gap-2">
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
                    </div>
                    
                    {space.description && (
                      <p className="text-sm text-gray-600 mb-3">{space.description}</p>
                    )}
                    
                    {space.rules && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-700 mb-1">Regras:</p>
                        <p className="text-xs text-gray-600 whitespace-pre-line">{space.rules}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {pagination && (
                <div className="mt-6">
                  <Pagination
                    pagination={pagination}
                    currentPage={currentPage}
                    onPageChange={(page) => load(page)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
