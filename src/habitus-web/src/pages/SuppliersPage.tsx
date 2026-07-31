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
import { useTranslation } from '../i18n/I18nProvider';

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
  const { t } = useTranslation();
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
        setLoadError(t('suppliers.error.noCondominium'));
        return;
      }

      const response = await suppliersApi.getPaged(condominiumId, page, pageSize, debouncedSearch);
      setPagination(response.data);
      setSuppliers(response.data.items);
      setCurrentPage(page);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
      setLoadError(t('suppliers.error.load'));
    } finally {
      setLoading(false);
    }
  }, [condominiumId, debouncedSearch, t]);

  useEffect(() => { load(1); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!condominiumId) {
      toastError(t('suppliers.error.incompleteUser'));
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
      toastError(t('suppliers.error.save'));
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
        toastError(t('suppliers.error.noCondominium'));
        return;
      }

      await suppliersApi.delete(condominiumId, deleteId);
      load();
    } catch (error) {
      console.error('Erro ao eliminar fornecedor:', error);
      toastError(t('suppliers.error.delete'));
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
        title={t('suppliers.delete.title')}
        message={t('suppliers.delete.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      {/* Header */}
      {!embedded ? (
        <PageHeader
          title={t('suppliers.title')}
          subtitle={t('suppliers.subtitle')}
          search={
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('suppliers.searchPlaceholder')}
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
                {t('suppliers.new')}
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
              placeholder={t('suppliers.searchPlaceholder')}
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
              {t('suppliers.new')}
            </Button>
          )}
        </div>
      )}

      {/* Filter */}
      <Segmented<string>
        ariaLabel={t('suppliers.filterAriaLabel')}
        value={filterActive}
        onChange={setFilterActive}
        options={[
          { value: 'all', label: t('suppliers.filter.all') },
          { value: 'active', label: t('suppliers.filter.active') },
          { value: 'inactive', label: t('suppliers.filter.inactive') },
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
        title={editingId ? t('suppliers.form.editTitle') : t('suppliers.new')}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                {t('suppliers.form.name')}
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={t('suppliers.form.namePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                {t('suppliers.form.specialty')}
              </label>
              <input
                type="text"
                required
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={t('suppliers.form.specialtyPlaceholder')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                {t('suppliers.form.phone')}
              </label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="+351 XXX XXX XXX"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              {t('common.email')}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              {t('suppliers.form.address')}
            </label>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder={t('suppliers.form.addressPlaceholder')}
            />
          </div>

          {editingId && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={(form as UpdateSupplierRequest).isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-line rounded focus:ring-indigo-500"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-ink-muted">
                {t('suppliers.form.activeLabel')}
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
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {editingId ? t('suppliers.form.save') : t('suppliers.form.create')}
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
        empty={<EmptyState icon={Truck} title={t('suppliers.empty')} />}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className={`bg-surface rounded-xl p-5 shadow-sm border ${
                  supplier.isActive ? 'border-line' : 'border-line bg-surface-muted'
                } hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-ink flex items-center gap-2">
                      {supplier.name}
                      {!supplier.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-control text-ink-muted rounded-full">
                          {t('common.inactive')}
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
                        title={t('common.edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <a href={`tel:${supplier.phone}`} className="hover:text-indigo-600">
                      {supplier.phone}
                    </a>
                  </div>
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-ink-muted">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <a href={`mailto:${supplier.email}`} className="hover:text-indigo-600 truncate">
                        {supplier.email}
                      </a>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-2 text-ink-muted">
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
