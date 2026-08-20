import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Tag, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n/I18nProvider';
import { expenseCategoriesApi } from '../api/services';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import SearchBar from '../components/SearchBar';
import { PageHeader, Button, Badge, Segmented, DataTable, EmptyState, type Column } from '../components/ui';
import type { ExpenseCategoryDto, PaginatedResponse } from '../types';

const PAGE_SIZE = 10;

interface CategoryForm {
  id?: string;
  name: string;
  hashtags: string[];
  isActive: boolean;
}

const emptyForm = (): CategoryForm => ({ name: '', hashtags: [], isActive: true });

export default function ExpenseCategoriesPage({ embedded = false }: { embedded?: boolean }) {
  const { condominiumId, isAdmin } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const { t } = useTranslation();

  const [categories, setCategories] = useState<ExpenseCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [hashtagInput, setHashtagInput] = useState('');
  const [confirmToggleId, setConfirmToggleId] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (value: string) => {
    setFilterActive(value);
    setCurrentPage(1);
  };

  const load = useCallback(async () => {
    if (!condominiumId) {
      setCategories([]);
      setLoadError(t('expenseCategories.error.noCondominium'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    try {
      const response = await expenseCategoriesApi.getAll(condominiumId);
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading expense categories:', error);
      setLoadError(t('expenseCategories.error.load'));
      toastError(t('expenseCategories.error.loadToast'));
    } finally {
      setLoading(false);
    }
  }, [condominiumId, t, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredCategories = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return categories.filter((category) => {
      if (filterActive === 'active' && !category.isActive) return false;
      if (filterActive === 'inactive' && category.isActive) return false;
      return !query || category.name.toLowerCase().includes(query);
    });
  }, [categories, debouncedSearch, filterActive]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = useMemo(
    () => filteredCategories.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredCategories, safePage],
  );

  const pagination: PaginatedResponse<ExpenseCategoryDto> = {
    items: pageItems,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalItems: filteredCategories.length,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setHashtagInput('');
    setShowForm(true);
  };

  const openEdit = (category: ExpenseCategoryDto) => {
    setEditingId(category.id);
    setForm({
      id: category.id,
      name: category.name,
      hashtags: [...category.hashtags],
      isActive: category.isActive,
    });
    setHashtagInput('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setHashtagInput('');
  };

  const addHashtags = () => {
    const raw = hashtagInput.trim();
    if (!raw) return;
    const tags = raw
      .split(/[,\s#]+/)
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0 && !form.hashtags.includes(tag));
    if (tags.length > 0) {
      setForm((prev) => ({ ...prev, hashtags: [...prev.hashtags, ...tags] }));
    }
    setHashtagInput('');
  };

  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addHashtags();
    }
  };

  const removeHashtag = (tag: string) => {
    setForm((prev) => ({ ...prev, hashtags: prev.hashtags.filter((item) => item !== tag) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condominiumId) {
      toastError(t('expenseCategories.error.noCondominium'));
      return;
    }
    const name = form.name.trim();
    if (!name) {
      toastError(t('expenseCategories.error.nameRequired'));
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await expenseCategoriesApi.update(condominiumId, editingId, {
          name,
          hashtags: form.hashtags,
          isActive: form.isActive,
        });
        toastSuccess(t('expenseCategories.success.updated'));
      } else {
        await expenseCategoriesApi.create(condominiumId, {
          name,
          hashtags: form.hashtags,
          isActive: form.isActive,
          condominiumId,
        });
        toastSuccess(t('expenseCategories.success.created'));
      }
      closeForm();
      load();
    } catch (error) {
      console.error('Error saving expense category:', error);
      toastError(t('expenseCategories.error.save'));
    } finally {
      setSaving(false);
    }
  };

  const requestToggle = (category: ExpenseCategoryDto) => {
    if (category.isActive) {
      setConfirmToggleId(category.id);
    } else {
      void toggleCategory(category.id, true);
    }
  };

  const toggleCategory = async (id: string, nextActive: boolean) => {
    if (!condominiumId) return;
    const category = categories.find((c) => c.id === id);
    if (!category) return;

    try {
      await expenseCategoriesApi.update(condominiumId, id, {
        name: category.name,
        hashtags: category.hashtags,
        isActive: nextActive,
      });
      toastSuccess(
        nextActive ? t('expenseCategories.success.activated') : t('expenseCategories.success.deactivated'),
      );
      await load();
    } catch (error) {
      console.error('Error toggling expense category:', error);
      toastError(t('expenseCategories.error.toggle'));
    } finally {
      setConfirmToggleId(null);
    }
  };

  const columns: Column<ExpenseCategoryDto>[] = [
    {
      key: 'name',
      header: t('common.name'),
      mobileLabel: t('common.name'),
      render: (category) => <span className="font-medium text-ink">{category.name}</span>,
    },
    {
      key: 'hashtags',
      header: t('expenseCategories.hashtags'),
      mobileLabel: t('expenseCategories.hashtags'),
      render: (category) =>
        category.hashtags.length === 0 ? (
          <span className="text-sm text-ink-subtle">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {category.hashtags.map((tag) => (
              <Badge key={tag} variant="info" size="sm">
                #{tag}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      key: 'isActive',
      header: t('expenseCategories.status'),
      mobileLabel: t('expenseCategories.status'),
      render: (category) => (
        <Badge variant={category.isActive ? 'success' : 'neutral'} size="sm">
          {category.isActive ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('expenseCategories.actions'),
      align: 'right',
      mobileLabel: t('expenseCategories.actions'),
      render: (category) => (
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" icon={Edit2} onClick={() => openEdit(category)}>
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant={category.isActive ? 'danger' : 'success'}
            size="sm"
            icon={category.isActive ? Trash2 : Tag}
            onClick={() => requestToggle(category)}
          >
            {category.isActive ? t('expenseCategories.deactivate') : t('expenseCategories.activate')}
          </Button>
        </div>
      ),
    },
  ];

  const searchBar = (
    <SearchBar
      value={searchQuery}
      onChange={handleSearchChange}
      placeholder={t('expenseCategories.searchPlaceholder')}
    />
  );

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={confirmToggleId !== null}
        title={t('expenseCategories.confirm.deactivateTitle')}
        message={t('expenseCategories.confirm.deactivateMessage')}
        confirmLabel={t('expenseCategories.deactivate')}
        variant="warning"
        onConfirm={() => {
          if (confirmToggleId) void toggleCategory(confirmToggleId, false);
        }}
        onCancel={() => setConfirmToggleId(null)}
      />

      {/* Create/Edit Modal */}
      <ModalPopup
        open={showForm}
        onClose={closeForm}
        title={editingId ? t('expenseCategories.editTitle') : t('expenseCategories.new')}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              {t('common.name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t('expenseCategories.namePlaceholder')}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              {t('expenseCategories.hashtags')}
            </label>
            <input
              type="text"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={handleHashtagKeyDown}
              onBlur={addHashtags}
              placeholder={t('expenseCategories.hashtagsPlaceholder')}
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-ink-subtle mt-1">{t('expenseCategories.hashtagsHint')}</p>
          </div>

          {form.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.hashtags.map((tag) => (
                <Badge key={tag} variant="info" size="sm" icon={Tag}>
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeHashtag(tag)}
                    className="ml-1 hover:text-indigo-900"
                    aria-label={t('expenseCategories.removeHashtag', { tag })}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {editingId && (
            <div className="flex items-center gap-2">
              <input
                id="category-active"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 border-line rounded focus:ring-indigo-500"
              />
              <label htmlFor="category-active" className="text-sm text-ink-muted">
                {t('expenseCategories.isActive')}
              </label>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={closeForm}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" icon={editingId ? undefined : Plus} loading={saving}>
              {editingId ? t('expenseCategories.save') : t('expenseCategories.create')}
            </Button>
          </div>
        </form>
      </ModalPopup>

      {embedded ? (
        <div className="flex w-full items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="w-full sm:w-72">
            {searchBar}
          </div>
          {isAdmin && (
            <Button onClick={openCreate} icon={Plus} fullWidth className="sm:w-auto">
              {t('expenseCategories.new')}
            </Button>
          )}
        </div>
      ) : (
        <PageHeader
          title={t('expenseCategories.title')}
          subtitle={t('expenseCategories.subtitle')}
          search={searchBar}
          actions={
            isAdmin && (
              <Button onClick={openCreate} icon={Plus} fullWidth className="sm:w-auto">
                {t('expenseCategories.new')}
              </Button>
            )
          }
        />
      )}

      <Segmented<string>
        ariaLabel={t('expenseCategories.filterAriaLabel')}
        value={filterActive}
        onChange={handleFilterChange}
        options={[
          { value: 'all', label: t('expenseCategories.filter.all') },
          { value: 'active', label: t('expenseCategories.filter.active') },
          { value: 'inactive', label: t('expenseCategories.filter.inactive') },
        ]}
      />

      <DataTable<ExpenseCategoryDto>
        columns={columns}
        rows={pageItems}
        rowKey={(category) => category.id}
        loading={loading}
        error={loadError || null}
        onRetry={load}
        pagination={pagination}
        currentPage={safePage}
        onPageChange={setCurrentPage}
        emptyState={<EmptyState icon={Tag} title={t('expenseCategories.empty')} />}
      />
    </div>
  );
}
