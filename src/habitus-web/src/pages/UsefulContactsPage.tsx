import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, PhoneCall, ShieldAlert, Wrench, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usefulContactsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import { PageHeader, Button, AsyncState, EmptyState, Card, FilterBar, FilterChip } from '../components/ui';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/types';
import type { PaginatedResponse, UsefulContactCategory, UsefulContactDto } from '../types';

type CategoryOption = {
  value: number;
  labelKey: TranslationKey;
  icon: LucideIcon;
  badgeClass: string;
};

const categoryOptions: CategoryOption[] = [
  { value: 0, labelKey: 'usefulContacts.category.emergency', icon: ShieldAlert, badgeClass: 'bg-red-100 text-red-700' },
  { value: 1, labelKey: 'usefulContacts.category.service', icon: Wrench, badgeClass: 'bg-indigo-100 text-indigo-700' },
  { value: 2, labelKey: 'usefulContacts.category.administrative', icon: Building2, badgeClass: 'bg-control text-ink-muted' },
];

const categoryByString: Record<string, number> = {
  Emergency: 0,
  Service: 1,
  Administrative: 2,
};

const initialForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  postalCode: '',
  locality: '',
  category: 0,
};

function normalizeCategory(category: UsefulContactCategory): number {
  if (typeof category === 'number') {
    return category;
  }

  return categoryByString[category] ?? 0;
}

function categoryMeta(category: UsefulContactCategory) {
  const value = normalizeCategory(category);
  return categoryOptions.find((option) => option.value === value) ?? categoryOptions[0];
}

export default function UsefulContactsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { condominiumId, isAdmin, isManager } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [contacts, setContacts] = useState<UsefulContactDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<UsefulContactDto | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(initialForm);
  const pageSize = 9;

  useEffect(() => {
    if (isManager) {
      navigate('/dashboard');
    }
  }, [isManager, navigate]);

  const loadContacts = useCallback(async () => {
    if (!condominiumId) {
      setContacts([]);
      setLoadError(t('usefulContacts.error.noCondominium'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const response = await usefulContactsApi.getAll(condominiumId);
      setContacts(response.data);
    } catch {
      setLoadError(t('usefulContacts.error.load'));
    } finally {
      setLoading(false);
    }
  }, [condominiumId, t]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return contacts.filter((contact) => {
      const matchesCategory = categoryFilter === 'all' || normalizeCategory(contact.category) === categoryFilter;
      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const category = t(categoryMeta(contact.category).labelKey).toLowerCase();
      return (
        contact.name.toLowerCase().includes(query) ||
        contact.phone.toLowerCase().includes(query) ||
        category.includes(query)
      );
    });
  }, [contacts, searchQuery, categoryFilter, t]);

  const categoryCounts = useMemo(
    () =>
      contacts.reduce<Record<number, number>>((acc, contact) => {
        const value = normalizeCategory(contact.category);
        acc[value] = (acc[value] ?? 0) + 1;
        return acc;
      }, {}),
    [contacts],
  );

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleCategoryFilter = (category: number | 'all') => {
    setCategoryFilter(category);
    setCurrentPage(1);
  };

  const totalItems = filteredContacts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedContacts = filteredContacts.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
  const pagination: PaginatedResponse<UsefulContactDto> = {
    items: paginatedContacts,
    page: safeCurrentPage,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: safeCurrentPage > 1,
    hasNextPage: safeCurrentPage < totalPages,
  };

  const openCreateModal = () => {
    setEditingContact(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const openEditModal = (contact: UsefulContactDto) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || '',
      address: contact.address || '',
      postalCode: contact.postalCode || '',
      locality: contact.locality || '',
      category: normalizeCategory(contact.category),
    });
    setShowForm(true);
  };

  const closeModal = () => {
    setShowForm(false);
    setEditingContact(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!condominiumId) {
      toastError(t('usefulContacts.error.noCondominium'));
      return;
    }

    if (!form.name.trim() || !form.phone.trim()) {
      toastError(t('usefulContacts.error.required'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        locality: form.locality.trim() || undefined,
        category: form.category,
      };

      if (editingContact) {
        await usefulContactsApi.update(condominiumId, editingContact.id, payload);
        toastSuccess(t('usefulContacts.success.updated'));
      } else {
        await usefulContactsApi.create(condominiumId, payload);
        toastSuccess(t('usefulContacts.success.created'));
      }

      closeModal();
      await loadContacts();
    } catch {
      toastError(t('usefulContacts.error.save'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || !condominiumId) {
      setDeleteId(null);
      return;
    }

    try {
      await usefulContactsApi.delete(condominiumId, deleteId);
      toastSuccess(t('usefulContacts.success.deleted'));
      await loadContacts();
    } catch {
      toastError(t('usefulContacts.error.delete'));
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={deleteId !== null}
        title={t('usefulContacts.delete.title')}
        message={t('usefulContacts.delete.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ModalPopup
        open={showForm}
        onClose={closeModal}
        title={editingContact ? t('usefulContacts.form.editTitle') : t('usefulContacts.form.createTitle')}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('common.name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('usefulContacts.form.namePlaceholder')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('common.phone')}</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ex: +351 213 000 000"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('common.email')}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ex: contacto@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('usefulContacts.form.address')}</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('usefulContacts.form.addressPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('usefulContacts.form.postalCode')}</label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => setForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={t('usefulContacts.form.postalCodePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('usefulContacts.form.locality')}</label>
              <input
                type="text"
                value={form.locality}
                onChange={(e) => setForm((prev) => ({ ...prev, locality: e.target.value }))}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={t('usefulContacts.form.localityPlaceholder')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('usefulContacts.form.category')}</label>
            <select
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={closeModal} className="border border-line">
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {editingContact ? t('usefulContacts.form.save') : t('usefulContacts.form.create')}
            </Button>
          </div>
        </form>
      </ModalPopup>

      <PageHeader
        title={t('usefulContacts.title')}
        subtitle={t('usefulContacts.subtitle')}
        search={
          <SearchBar
            value={searchQuery}
            onChange={handleSearch}
            placeholder={t('usefulContacts.searchPlaceholder')}
          />
        }
        actions={
          isAdmin && (
            <Button icon={Plus} onClick={openCreateModal} fullWidth className="sm:w-auto">
              {t('usefulContacts.newContact')}
            </Button>
          )
        }
      />

      <FilterBar>
        <FilterChip
          label={t('usefulContacts.filter.all')}
          active={categoryFilter === 'all'}
          count={contacts.length}
          onClick={() => handleCategoryFilter('all')}
        />
        {categoryOptions.map((option) => (
          <FilterChip
            key={option.value}
            label={t(option.labelKey)}
            icon={option.icon}
            active={categoryFilter === option.value}
            count={categoryCounts[option.value] ?? 0}
            onClick={() => handleCategoryFilter(option.value)}
          />
        ))}
      </FilterBar>

      <AsyncState
        loading={loading}
        error={loadError || null}
        onRetry={loadContacts}
        isEmpty={filteredContacts.length === 0}
        skeleton="card"
        empty={
          <EmptyState
            icon={PhoneCall}
            title={t('usefulContacts.empty')}
            description={
              isAdmin
                ? t('usefulContacts.emptyAdmin')
                : t('usefulContacts.emptyResident')
            }
          />
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedContacts.map((contact) => {
            const meta = categoryMeta(contact.category);
            const Icon = meta.icon;

            return (
              <Card key={contact.id} interactive className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-ink truncate">{contact.name}</h3>
                    <a href={`tel:${contact.phone}`} className="text-sm text-indigo-600 hover:text-indigo-700">
                      {contact.phone}
                    </a>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(contact)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('common.edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(contact.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  {contact.email && (
                    <div className="text-ink-muted">
                      <a href={`mailto:${contact.email}`} className="text-indigo-600 hover:text-indigo-700">
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {contact.address && (
                    <div className="text-ink-muted">{contact.address}</div>
                  )}
                  {(contact.postalCode || contact.locality) && (
                    <div className="text-ink-muted">
                      {contact.postalCode && <span>{contact.postalCode}</span>}
                      {contact.postalCode && contact.locality && <span>, </span>}
                      {contact.locality && <span>{contact.locality}</span>}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${meta.badgeClass}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {t(meta.labelKey)}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
        {filteredContacts.length > 0 && (
          <div className="mt-4">
            <Pagination pagination={pagination} currentPage={safeCurrentPage} onPageChange={setCurrentPage} />
          </div>
        )}
      </AsyncState>
    </div>
  );
}
