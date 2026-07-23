import { useEffect, useState, useCallback } from 'react';
import { Plus, Truck, Mail, Phone, MapPin, Edit2, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { suppliersApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import type { SupplierDto, CreateSupplierRequest, UpdateSupplierRequest, PaginatedResponse } from '../types';

type SupplierForm = CreateSupplierRequest & { isActive: boolean };

const initialSupplierForm: SupplierForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  specialty: '',
  condominiumId: '',
  isActive: true,
};

export default function SuppliersPage({ embedded = false }: { embedded?: boolean }) {
  const { isAdmin, condominiumId } = useAuth();
  const { error: toastError } = useToast();
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<SupplierDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [form, setForm] = useState<SupplierForm>(initialSupplierForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (page: number = 1) => {
    setLoading(true);
    setLoadError('');
    try {
      if (!condominiumId) {
        setPagination(null);
        setSuppliers([]);
        setCurrentPage(page);
        setLoadError('Condomínio não identificado.');
        return;
      }

      const response = await suppliersApi.getPaged(condominiumId, page, pageSize, debouncedSearch);
      setPagination(response.data);
      setSuppliers(response.data.items);
      setCurrentPage(page);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
      setLoadError('Não foi possível carregar os fornecedores.');
    } finally {
      setLoading(false);
    }
  }, [condominiumId, debouncedSearch]);

  useEffect(() => { load(1); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!condominiumId) {
      toastError('Dados de utilizador incompletos. Por favor, recarregue a página.');
      return;
    }
    
    setSubmitting(true);
    try {
      if (editingId) {
        const updatePayload: UpdateSupplierRequest = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          specialty: form.specialty,
          isActive: form.isActive,
        };
        await suppliersApi.update(condominiumId, editingId, updatePayload);
      } else {
        const createPayload: CreateSupplierRequest = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          specialty: form.specialty,
          condominiumId,
        };
        await suppliersApi.create(condominiumId, createPayload);
      }
      
      setShowForm(false);
      setEditingId(null);
      setForm(initialSupplierForm);
      load();
    } catch (error) {
      console.error('Erro ao guardar fornecedor:', error);
      toastError('Erro ao guardar fornecedor. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (supplier: SupplierDto) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      specialty: supplier.specialty,
      condominiumId: supplier.condominiumId,
      isActive: supplier.isActive,
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

      await suppliersApi.delete(condominiumId, deleteId);
      load();
    } catch (error) {
      console.error('Erro ao eliminar fornecedor:', error);
      toastError('Erro ao eliminar fornecedor. Tente novamente.');
    } finally {
      setDeleteId(null);
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
      if (filterActive === 'active') return s.isActive;
      if (filterActive === 'inactive') return !s.isActive;
      return true;
    });

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={deleteId !== null}
        title="Eliminar fornecedor"
        message="Tem a certeza que deseja eliminar este fornecedor? Esta ação não pode ser revertida."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-7 h-7 text-indigo-600" />
              Fornecedores
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Gerir fornecedores de serviços do condomínio
            </p>
          </div>
        )}
        <div className={`flex items-center gap-3 flex-wrap sm:flex-nowrap ${!embedded ? 'w-full sm:w-auto sm:ml-auto justify-end' : 'w-full justify-between'}`}>
          <div className="w-full sm:w-72">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar fornecedores..."
            />
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setEditingId(null);
                setForm(initialSupplierForm);
                setShowForm(true);
              }}
              className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Novo Fornecedor
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'active', 'inactive'].map((filter) => (
          <button
            key={filter}
            onClick={() => setFilterActive(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterActive === filter
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filter === 'all' ? 'Todos' : filter === 'active' ? 'Ativos' : 'Inativos'}
          </button>
        ))}
      </div>

      {/* Form Modal */}
      <ModalPopup
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingId(null);
          setForm(initialSupplierForm);
        }}
        title={editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Nome do fornecedor"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Especialidade *
              </label>
              <input
                type="text"
                required
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Ex: Canalizador, Eletricista..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone *
              </label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="+351 XXX XXX XXX"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Morada
            </label>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Morada completa"
            />
          </div>

          {editingId && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={(form as UpdateSupplierRequest).isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Fornecedor Ativo
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(initialSupplierForm);
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'A guardar...' : editingId ? 'Guardar' : 'Criar'}
            </button>
          </div>
        </form>
      </ModalPopup>

      {/* Suppliers Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-gray-500 mt-2">A carregar fornecedores...</p>
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3">
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
            Tentar novamente
          </button>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Sem fornecedores registados</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className={`bg-white rounded-xl p-5 shadow-sm border ${
                  supplier.isActive ? 'border-gray-200' : 'border-gray-300 bg-gray-50'
                } hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      {supplier.name}
                      {!supplier.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                          Inativo
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-indigo-600 font-medium">{supplier.specialty}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <a href={`tel:${supplier.phone}`} className="hover:text-indigo-600">
                      {supplier.phone}
                    </a>
                  </div>
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <a href={`mailto:${supplier.email}`} className="hover:text-indigo-600 truncate">
                        {supplier.email}
                      </a>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span className="text-xs leading-relaxed">{supplier.address}</span>
                    </div>
                  )}
                </div>
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
