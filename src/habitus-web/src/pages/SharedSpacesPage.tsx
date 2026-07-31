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
import { useTranslation } from '../i18n/I18nProvider';
import type { SharedSpaceDto, PaginatedResponse } from '../types';

export default function SharedSpacesPage({ embedded = false }: { embedded?: boolean }) {
  const { isAdmin, condominiumId } = useAuth();
  const { error: toastError } = useToast();
  const { t } = useTranslation();
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
        setLoadError(t('sharedSpaces.error.condominiumNotIdentified'));
        return;
      }

      const response = await sharedSpacesApi.getPaged(condominiumId, page, pageSize, debouncedSearch);

      setPagination(response.data);
      setSpaces(response.data.items);
      setCurrentPage(page);
      setForm(prev => ({ ...prev, condominiumId }));
    } catch (error) {
      console.error('Erro ao carregar espaços:', error);
      setLoadError(t('sharedSpaces.error.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [condominiumId, debouncedSearch, t]);

  useEffect(() => { 
    load(1); 
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!condominiumId) {
      toastError(t('sharedSpaces.error.condominiumNotIdentifiedReload'));
      return;
    }
    
    if (!form.name || form.name.trim() === '') {
      toastError(t('sharedSpaces.error.nameRequired'));
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
            : t('sharedSpaces.error.saveFailed');
      console.error('Erro ao guardar espaço:', error);
      toastError(t('sharedSpaces.error.saveFailedDetail', { message: errorMessage ?? '' }));
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
        toastError(t('sharedSpaces.error.condominiumNotIdentified'));
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
            : t('sharedSpaces.error.deleteFailed');
      console.error('Erro ao eliminar espaço:', error);
      toastError(t('sharedSpaces.error.deleteFailedDetail', { message: errorMessage ?? '' }));
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
        title={t('sharedSpaces.delete.title')}
        message={t('sharedSpaces.delete.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* Modal form */}
      <ModalPopup
        open={showForm}
        onClose={handleCancel}
        title={editingId ? t('sharedSpaces.form.editTitle') : t('sharedSpaces.new')}
        maxWidthClass="max-w-lg"
      >
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('sharedSpaces.form.name')}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={t('sharedSpaces.form.namePlaceholder')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('sharedSpaces.form.capacity')}
                </label>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={t('sharedSpaces.form.capacityPlaceholder')}
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('sharedSpaces.form.color')}
                </label>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-full h-10 px-1 py-1 border border-line bg-surface rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                  title={t('sharedSpaces.form.colorTitle')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                {t('common.description')}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={3}
                placeholder={t('sharedSpaces.form.descriptionPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                {t('sharedSpaces.form.rules')}
              </label>
              <textarea
                value={form.rules}
                onChange={(e) => setForm({ ...form, rules: e.target.value })}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={4}
                placeholder={t('sharedSpaces.form.rulesPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                {t('sharedSpaces.form.fee')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">€</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.reservationFee}
                  onChange={(e) => setForm({ ...form, reservationFee: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <p className="mt-1 text-xs text-ink-subtle">
                {t('sharedSpaces.form.feeHelp')}
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={handleCancel} className="border border-line">
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={submitting}>
                {editingId ? t('sharedSpaces.form.update') : t('sharedSpaces.form.create')}
              </Button>
            </div>
          </form>
        </div>
      </ModalPopup>

      {!embedded ? (
        <PageHeader
          title={t('sharedSpaces.title')}
          subtitle={t('sharedSpaces.subtitle')}
          search={
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('sharedSpaces.searchPlaceholder')}
            />
          }
          actions={
            isAdmin && (
              <Button icon={Plus} onClick={() => setShowForm(true)} fullWidth className="sm:w-auto">
                {t('sharedSpaces.new')}
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
              placeholder={t('sharedSpaces.searchPlaceholder')}
            />
          </div>
          {isAdmin && (
            <Button icon={Plus} onClick={() => setShowForm(true)}>
              {t('sharedSpaces.new')}
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
            title={t('sharedSpaces.empty.title')}
            description={t('sharedSpaces.empty.description')}
          />
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map((space) => (
              <div
                key={space.id}
                className="border border-line rounded-xl p-4 bg-surface hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-ink truncate">{space.name}</h3>
                    {space.capacity && space.capacity > 0 && (
                      <p className="text-sm text-indigo-600 mt-0.5">
                        {t('sharedSpaces.card.capacity', { count: space.capacity })}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => handleEdit(space)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('common.edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(space.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {space.description && (
                  <p className="text-sm text-ink-muted mb-2">{space.description}</p>
                )}

                {space.rules && (
                  <div className="mt-2 pt-2 border-t border-line">
                    <p className="text-xs font-medium text-ink-muted mb-1">{t('sharedSpaces.card.rules')}</p>
                    <p className="text-xs text-ink-subtle whitespace-pre-line line-clamp-3">{space.rules}</p>
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
