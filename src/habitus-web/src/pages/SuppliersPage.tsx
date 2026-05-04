import { useEffect, useState, useCallback } from 'react';
import { Plus, Truck, Mail, Phone, MapPin, Building2, X, Edit2, Trash2 } from 'lucide-react';
import { suppliersApi, usersApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import type { SupplierDto, CreateSupplierRequest, UpdateSupplierRequest, PaginatedResponse } from '../types';

type ConfirmState = { message: string; onConfirm: () => void } | null;

type SupplierForm = CreateSupplierRequest & { isActive: boolean };

const initialSupplierForm: SupplierForm = {
  name: '',
  contact: '',
  email: '',
  phone: '',
  address: '',
  specialty: '',
  condominiumId: '',
  isActive: true,
};

export default function SuppliersPage({ embedded = false }: { embedded?: boolean }) {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<string>('all');
  const [condominiumId, setCondominiumId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<SupplierDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [form, setForm] = useState<SupplierForm>(initialSupplierForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const response = await usersApi.getMe();
        setCondominiumId(response.data.condominiumId || '');
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };
    loadUserData();
  }, []);

  const load = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const response = await suppliersApi.getPaged(page, pageSize, debouncedSearch);
      setPagination(response.data);
      setSuppliers(response.data.items);
      setCurrentPage(page);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { load(1); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!condominiumId) {
      showToast('Dados de utilizador incompletos. Por favor, recarregue a página.', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      if (editingId) {
        const updatePayload: UpdateSupplierRequest = {
          name: form.name,
          contact: form.contact,
          email: form.email,
          phone: form.phone,
          address: form.address,
          specialty: form.specialty,
          isActive: form.isActive,
        };
        await suppliersApi.update(editingId, updatePayload);
      } else {
        const createPayload: CreateSupplierRequest = {
          name: form.name,
          contact: form.contact,
          email: form.email,
          phone: form.phone,
          address: form.address,
          specialty: form.specialty,
          condominiumId,
        };
        await suppliersApi.create(createPayload);
      }
      
      setShowForm(false);
      setEditingId(null);
      setForm(initialSupplierForm);
      load();
    } catch (error) {
      console.error('Erro ao guardar fornecedor:', error);
      showToast('Erro ao guardar fornecedor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (supplier: SupplierDto) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      contact: supplier.contact,
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
    setConfirmState({
      message: 'Eliminar este fornecedor?',
      onConfirm: async () => {
        try {
          await suppliersApi.delete(id);
          load();
        } catch (error) {
          console.error('Erro ao eliminar fornecedor:', error);
          showToast('Erro ao eliminar fornecedor', 'error');
        }
      },
    });
  };

  const filteredSuppliers = suppliers
    .filter(s => s.condominiumId === condominiumId)
    .filter(s => {
      if (filterActive === 'active') return s.isActive;
      if (filterActive === 'inactive') return !s.isActive;
      return true;
    });

  return (
    <div className="space-y-6">
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
        <div className="flex items-center gap-3 ml-auto">
          <div className="w-80">
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
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

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
                    Contacto Principal
                  </label>
                  <input
                    type="text"
                    value={form.contact}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Nome do contacto"
                  />
                </div>

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
                  onClick={() => setShowForm(false)}
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
          </div>
        </div>
      )}

      {/* Suppliers Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-gray-500 mt-2">A carregar fornecedores...</p>
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
                  {supplier.contact && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Building2 className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{supplier.contact}</span>
                    </div>
                  )}
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

      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={() => { confirmState.onConfirm(); setConfirmState(null); }}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
