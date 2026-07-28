import { useEffect, useState, useCallback } from 'react';
import { Plus, Truck, Mail, Phone, MapPin, Edit2, Trash2 } from 'lucide-react';
import { suppliersApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import type { SupplierDto, CreateSupplierRequest, UpdateSupplierRequest, PaginatedResponse } from '../types';
import { PageHeader, Button, Segmented, AsyncState, EmptyState } from '../components/ui';

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
      {!embedded ? (
        <PageHeader
          title="Fornecedores"
          subtitle="Gerir fornecedores de serviços do condomínio"
          search={
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar fornecedores..."
            />
          }
          actions={
            isAdmin && (
              <Button
                onClick={() => {
                  setEditingId(null);
                  setForm(initialSupplierForm);
                  setShowForm(true);
                }}
                icon={Plus}
                fullWidth
                className="sm:w-auto"
              >
                Novo Fornecedor
              </Button>
            )
          }
        />
      ) : (
        <div className="flex w-full items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="w-full sm:w-72">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar fornecedores..."
            />
          </div>
          {isAdmin && (
            <Button
              onClick={() => {
                setEditingId(null);
                setForm(initialSupplierForm);
                setShowForm(true);
              }}
              icon={Plus}
              fullWidth
              className="sm:w-auto"
            >
              Novo Fornecedor
            </Button>
          )}
        </div>
      )}

      {/* Filter */}
      <Segmented<string>
        ariaLabel="Filtrar fornecedores por estado"
        value={filterActive}
        onChange={setFilterActive}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'active', label: 'Ativos' },
          { value: 'inactive', label: 'Inativos' },
        ]}
      />

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

          <div className="flex flex-wrap justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(initialSupplierForm);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              {editingId ? 'Guardar' : 'Criar'}
            </Button>
          </div>
        </form>
      </ModalPopup>

      {/* Suppliers Grid */}
      <AsyncState
        loading={loading}
        error={loadError || null}
        onRetry={() => load(currentPage)}
        isEmpty={filteredSuppliers.length === 0}
        skeleton="card"
        empty={<EmptyState icon={Truck} title="Sem fornecedores registados" />}
      >
        <div className="space-y-6">
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
        </div>
      </AsyncState>
    </div>
  );
}
