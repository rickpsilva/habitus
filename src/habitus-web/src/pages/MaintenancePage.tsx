import { useEffect, useState, useCallback } from 'react';
import { Plus, Wrench, AlertCircle, Clock, CheckCircle2, Phone, Mail, MapPin, FileText, Upload, Download, Trash2, Eye } from 'lucide-react';
import { maintenanceApi, usersApi, suppliersApi, documentsApi, expenseCategoriesApi } from '../api/services';
import FileUpload from '../components/FileUpload';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import { PageHeader, Button, AsyncState, EmptyState, Badge, Card, Autocomplete } from '../components/ui';
import type { BadgeVariant } from '../components/ui';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';
import type { MaintenanceRequestDto, CreateMaintenanceRequest, SupplierDto, PaginatedResponse, DocumentDto, ExpenseCategoryDto } from '../types';

const getStatusMap = (t: TranslateFn): Record<string, { label: string; variant: BadgeVariant; icon: React.ElementType }> => ({
  Open: { label: t('status.open'), variant: 'warning', icon: AlertCircle },
  InProgress: { label: t('status.inProgress'), variant: 'info', icon: Clock },
  Completed: { label: t('status.completed'), variant: 'success', icon: CheckCircle2 },
});

const priorityVariants: Record<string, BadgeVariant> = {
  Low: 'neutral',
  Medium: 'warning',
  High: 'attention',
  Critical: 'danger',
};

const getPriorityLabels = (t: TranslateFn): Record<string, string> => ({
  Low: t('maintenance.priority.low'),
  Medium: t('maintenance.priority.medium'),
  High: t('maintenance.priority.high'),
  Critical: t('maintenance.priority.critical'),
});

const normalizeMaintenanceStatus = (status: string) => {
  if (status === 'Resolved' || status === 'Closed') {
    return 'Completed';
  }

  return status;
};

const isCompletedStatus = (status: string) => normalizeMaintenanceStatus(status) === 'Completed';

const getAvailableStatusOptions = (currentStatus: string) => {
  const normalizedStatus = normalizeMaintenanceStatus(currentStatus);

  if (isCompletedStatus(normalizedStatus)) {
    return ['Completed'];
  }

  if (normalizedStatus === 'InProgress') {
    return ['InProgress', 'Completed'];
  }

  return ['Open', 'InProgress', 'Completed'];
};

export default function MaintenancePage() {
  const { t, formatDate } = useTranslation();
  const { isAdmin, condominiumId, unitId } = useAuth();
  const { success, error: toastError, warning } = useToast();
  const statusMap = getStatusMap(t);
  const priorityLabels = getPriorityLabels(t);
  const [requests, setRequests] = useState<MaintenanceRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('Open');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusCounts, setStatusCounts] = useState({ Open: 0, InProgress: 0, Completed: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [form, setForm] = useState<CreateMaintenanceRequest>({
    title: '',
    description: '',
    priority: 'Medium',
    condominiumId: condominiumId || '',
    unitId: unitId || '',
    createdBy: '',
    location: '',
    photos: [],
  });
  const [submitting, setSubmitting] = useState(false);

  // Status panel state
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequestDto | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryDto[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [statusForm, setStatusForm] = useState({
    status: '',
    supplierId: '',
    adminComments: '',
    hasExpense: false,
    expenseAmount: '',
    invoiceDocumentId: '',
    expenseCategoryId: '',
  });

  // Documents state
  const [maintenanceDocuments, setMaintenanceDocuments] = useState<DocumentDto[]>([]);
  const [showDocUploadModal, setShowDocUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    type: 'MaintenanceInvoice',
    description: '',
  });
  const [uploading, setUploading] = useState(false);

  // Load current user data to get ID
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const response = await usersApi.getMe();
        // Update form with user data
        setForm(prev => ({
          ...prev,
          condominiumId: response.data.condominiumId || condominiumId || '',
          unitId: response.data.unitId || unitId || '',
          createdBy: response.data.id,
        }));
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };
    loadUserData();
  }, [condominiumId, unitId]);

  // Load suppliers
  useEffect(() => {
    if (condominiumId) {
      suppliersApi.getAll(condominiumId).then((r) => {
        setSuppliers(r.data.filter(s => s.isActive));
      }).catch(console.error);
    }
  }, [condominiumId]);

  // Load active expense categories for completion flow
  useEffect(() => {
    if (!condominiumId) return;
    setCategoriesLoading(true);
    expenseCategoriesApi.getActive(condominiumId)
      .then((r) => {
        setExpenseCategories(r.data);
      })
      .catch((error) => {
        console.error('Error loading expense categories:', error);
        toastError(t('maintenance.error.loadCategories'));
      })
      .finally(() => setCategoriesLoading(false));
  }, [condominiumId, t, toastError]);

  const load = useCallback(() => {
    if (!condominiumId) {
      setRequests([]);
      setTotalItems(0);
      setLoadError(t('maintenance.error.condominiumNotIdentified'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    maintenanceApi.getPaged(condominiumId, currentPage, pageSize, debouncedSearch, filter === 'All' ? undefined : filter)
      .then((r) => {
        const scopedItems = r.data.items
          .map((item) => ({ ...item, status: normalizeMaintenanceStatus(item.status) }));
        setRequests(scopedItems);
        setTotalItems(r.data.totalItems);
      })
      .catch(() => {
        setLoadError(t('maintenance.error.load'));
      })
      .finally(() => setLoading(false));
  }, [condominiumId, currentPage, debouncedSearch, filter, t]);

  const loadStatusCounts = useCallback(() => {
    if (!condominiumId) return;
    maintenanceApi.getStatusCounts(condominiumId)
      .then((r) => {
        setStatusCounts({ Open: r.data.open, InProgress: r.data.inProgress, Completed: r.data.completed });
      })
      .catch(() => toastError(t('maintenance.error.load')));
  }, [condominiumId, t, toastError]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStatusCounts(); }, [loadStatusCounts]);

  const handleFilterChange = (value: string) => {
    setFilter(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!condominiumId) {
      toastError(t('maintenance.error.noCondominiumSelected'));
      return;
    }
    
    if (!form.condominiumId || !form.unitId || !form.createdBy) {
      toastError(t('maintenance.error.needsUnit'));
      return;
    }
    
    setSubmitting(true);
    try {
      await maintenanceApi.create(condominiumId, form);
      setShowForm(false);
      // Reset form but keep user data
      setForm({ 
        title: '', 
        description: '', 
        priority: 'Medium', 
        condominiumId: form.condominiumId,
        unitId: form.unitId, 
        createdBy: form.createdBy, 
        location: '',
        photos: [],
      });
      load();
      loadStatusCounts();
      success(t('maintenance.success.created'));
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      toastError(t('maintenance.error.create'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenStatusPanel = (request: MaintenanceRequestDto) => {
    setSelectedRequest(request);
    setStatusForm({
      status: normalizeMaintenanceStatus(request.status),
      supplierId: request.supplierId || '',
      adminComments: '',
      hasExpense: request.hasExpense || false,
      expenseAmount: request.expenseAmount?.toString() || '',
      invoiceDocumentId: request.invoiceDocumentId || '',
      expenseCategoryId: request.expenseCategoryId || '',
    });
    setShowStatusPanel(true);
    loadMaintenanceDocuments(request.id);
  };

  const handleCloseStatusPanel = () => {
    setShowStatusPanel(false);
    setSelectedRequest(null);
    setStatusForm({ 
      status: '', 
      supplierId: '', 
      adminComments: '',
      hasExpense: false,
      expenseAmount: '',
      invoiceDocumentId: '',
      expenseCategoryId: '',
    });
    setMaintenanceDocuments([]);
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    const nextStatus = normalizeMaintenanceStatus(statusForm.status);

    if (isCompletedStatus(nextStatus)) {
      if (!statusForm.expenseAmount || parseFloat(statusForm.expenseAmount) <= 0) {
        warning(t('maintenance.error.expenseRequiredComplete'));
        return;
      }
      if (!statusForm.expenseCategoryId) {
        warning(t('maintenance.error.expenseCategoryRequired'));
        return;
      }
    }

    if (!isCompletedStatus(nextStatus) && statusForm.hasExpense) {
      if (!statusForm.expenseAmount || parseFloat(statusForm.expenseAmount) <= 0) {
        warning(t('maintenance.error.expenseRequired'));
        return;
      }
      if (!statusForm.invoiceDocumentId) {
        warning(t('maintenance.error.invoiceRequired'));
        return;
      }
    }

    setSubmitting(true);
    try {
      if (!condominiumId) {
        toastError(t('maintenance.error.noCondominiumSelected'));
        return;
      }

      await maintenanceApi.updateStatus(condominiumId, selectedRequest.id, {
        status: nextStatus,
        supplierId: statusForm.supplierId || undefined,
        adminComments: statusForm.adminComments || undefined,
        hasExpense: isCompletedStatus(nextStatus) ? true : statusForm.hasExpense,
        expenseAmount: (isCompletedStatus(nextStatus) || statusForm.hasExpense) && statusForm.expenseAmount ? parseFloat(statusForm.expenseAmount) : undefined,
        invoiceDocumentId: (isCompletedStatus(nextStatus) || statusForm.hasExpense) && statusForm.invoiceDocumentId ? statusForm.invoiceDocumentId : undefined,
        expenseCategoryId: (isCompletedStatus(nextStatus) || statusForm.hasExpense) && statusForm.expenseCategoryId ? statusForm.expenseCategoryId : undefined,
      });
      handleCloseStatusPanel();
      load();
      loadStatusCounts();
      success(t('maintenance.success.statusUpdated'));
    } catch (error) {
      console.error('Erro ao atualizar estado:', error);
      toastError(t('maintenance.error.statusUpdate'));
    } finally {
      setSubmitting(false);
    }
  };

  // Document management functions
  const loadMaintenanceDocuments = async (maintenanceRequestId: string) => {
    if (!condominiumId) return;

    try {
      const response = await documentsApi.getPaged(condominiumId, 1, 100, '', 'Maintenance');
      const docs = response.data.items.filter(doc => doc.maintenanceRequestId === maintenanceRequestId);
      setMaintenanceDocuments(docs);
    } catch (err) {
      console.error('Failed to load maintenance documents:', err);
    }
  };

  const handleDocUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !selectedRequest || !condominiumId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', uploadForm.name);
      formData.append('type', uploadForm.type);
      formData.append('context', 'Maintenance');
      formData.append('description', uploadForm.description);
      formData.append('maintenanceRequestId', selectedRequest.id);

      await documentsApi.upload(condominiumId, formData);
      setShowDocUploadModal(false);
      setUploadFile(null);
      setUploadForm({ name: '', type: 'MaintenanceInvoice', description: '' });
      loadMaintenanceDocuments(selectedRequest.id);
      success(t('maintenance.success.docUploaded'));
    } catch (err) {
      toastError(t('maintenance.error.docUpload'));
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDocDelete = async (id: string) => {
    setDeleteDocId(id);
  };

  const confirmDocDelete = async () => {
    if (!deleteDocId || !selectedRequest || !condominiumId) return;
    try {
      await documentsApi.delete(condominiumId, deleteDocId);
      loadMaintenanceDocuments(selectedRequest.id);
      success(t('maintenance.success.docDeleted'));
    } catch (err) {
      toastError(t('maintenance.error.docDelete'));
      console.error(err);
    } finally {
      setDeleteDocId(null);
    }
  };

  const handleDocDownload = async (id: string, fileName: string) => {
    if (!condominiumId) {
      toastError(t('maintenance.error.noCondominiumSelected'));
      return;
    }

    try {
      await documentsApi.download(condominiumId, id, fileName);
    } catch (error) {
      toastError(t('maintenance.error.docDownload'));
      console.error(error);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pagination: PaginatedResponse<MaintenanceRequestDto> = {
    items: requests,
    page: currentPage,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage * pageSize < totalItems,
  };
  const allCount = statusCounts.Open + statusCounts.InProgress + statusCounts.Completed;

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={deleteDocId !== null}
        title={t('maintenance.deleteDoc.title')}
        message={t('maintenance.deleteDoc.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDocDelete}
        onCancel={() => setDeleteDocId(null)}
      />
      <PageHeader
        title={t('maintenance.title')}
        subtitle={t('maintenance.subtitle')}
        search={
          <SearchBar
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={t('maintenance.searchPlaceholder')}
          />
        }
        actions={
          <Button onClick={() => setShowForm(!showForm)} icon={Plus} fullWidth className="sm:w-auto">
            {t('maintenance.newRequest')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { key: 'Open', label: t('status.open'), count: statusCounts.Open, className: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
          { key: 'InProgress', label: t('status.inProgress'), count: statusCounts.InProgress, className: 'border-blue-200 bg-blue-50 text-blue-800' },
          { key: 'Completed', label: t('status.completed'), count: statusCounts.Completed, className: 'border-green-200 bg-green-50 text-green-800' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleFilterChange(item.key)}
            className={`rounded-xl border p-4 text-left transition-colors ${item.className} ${filter === item.key ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
          >
            <p className="text-sm font-medium">{item.label}</p>
            <p className="mt-1 text-2xl font-bold">{item.count}</p>
          </button>
        ))}
      </div>

      {/* New request form */}
      <ModalPopup
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('maintenance.form.title')}
        maxWidthClass="max-w-lg"
      >
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('maintenance.form.titleLabel')}</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('maintenance.form.titlePlaceholder')}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('common.description')}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                rows={3}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('maintenance.form.location')}</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('maintenance.form.locationPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('maintenance.form.priority')}</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.keys(priorityLabels).map((p) => (
                  <option key={p} value={p}>{priorityLabels[p]}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={submitting}>
                {t('maintenance.form.save')}
              </Button>
            </div>
          </form>
      </ModalPopup>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Open', 'InProgress', 'Completed'].map((s) => (
          <button
            key={s}
            onClick={() => handleFilterChange(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s ? 'bg-indigo-600 text-white' : 'bg-surface text-ink-muted border border-line hover:bg-surface-hover'
            }`}
          >
            {s === 'All' ? t('maintenance.filter.all', { count: allCount }) : t('maintenance.filter.count', { label: statusMap[s]?.label ?? s, count: statusCounts[s as 'Open' | 'InProgress' | 'Completed'] })}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        <AsyncState
          loading={loading}
          error={loadError || null}
          onRetry={load}
          isEmpty={requests.length === 0}
          empty={<EmptyState icon={Wrench} title={t('maintenance.empty')} />}
        >
          <>
            {requests.map((m) => {
              const { label, variant, icon: Icon } = statusMap[m.status] ?? statusMap['Open'];
              return (
                <Card key={m.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <Icon className="w-5 h-5 mt-0.5 shrink-0 text-ink-subtle" />
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{m.title}</p>
                        <p className="text-sm text-ink-subtle mt-0.5 line-clamp-2">{m.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant={variant}>{label}</Badge>
                          <Badge variant={priorityVariants[m.priority] ?? 'neutral'}>
                            {priorityLabels[m.priority] ?? m.priority}
                          </Badge>
                          {m.location && (
                            <Badge variant="neutral">{m.location}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {isAdmin && !isCompletedStatus(m.status) ? (
                      <button
                        onClick={() => handleOpenStatusPanel(m)}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
                      >
                        {t('maintenance.manageStatus')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenStatusPanel(m)}
                        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover border border-line rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {t('maintenance.details')}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-ink-subtle mt-2">
                    {t('maintenance.createdAt', { date: formatDate(m.createdAt) })}
                  </p>
                </Card>
              );
            })}
            
            {pagination && (
              <Pagination
                pagination={pagination}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        </AsyncState>
      </div>

      {/* Status Management Modal */}
      <ModalPopup
        open={showStatusPanel && selectedRequest !== null}
        onClose={handleCloseStatusPanel}
        title={isAdmin && selectedRequest && !isCompletedStatus(selectedRequest.status) ? t('maintenance.statusPanel.manageTitle') : t('maintenance.statusPanel.detailsTitle')}
        maxWidthClass="max-w-3xl"
        bodyClassName="max-h-[75vh] overflow-y-auto px-6 py-4 space-y-5"
      >
        {selectedRequest && (
          <>
              {/* Request Info */}
              <div className="bg-surface-muted rounded-lg p-4">
                <p className="font-medium text-ink">{selectedRequest.title}</p>
                <p className="text-sm text-ink-subtle mt-1">{selectedRequest.description}</p>
                {selectedRequest.location && (
                  <p className="text-xs text-ink-subtle mt-2">{selectedRequest.location}</p>
                )}
              </div>

              {/* Form */}
              {isAdmin && !isCompletedStatus(selectedRequest.status) ? (
                <form onSubmit={handleStatusUpdate} className="space-y-4">
                  {/* Status Select */}
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">{t('maintenance.form.status')}</label>
                    <select
                      value={statusForm.status}
                      onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {getAvailableStatusOptions(selectedRequest.status).map((value) => (
                        <option key={value} value={value}>{statusMap[value]?.label ?? value}</option>
                      ))}
                    </select>
                  </div>

                  {/* Supplier Select */}
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">
                      {t('maintenance.form.supplier')} <span className="text-ink-subtle font-normal">{t('maintenance.optional')}</span>
                    </label>
                    <select
                      value={statusForm.supplierId}
                      onChange={(e) => setStatusForm({ ...statusForm, supplierId: e.target.value })}
                      className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">{t('maintenance.form.noSupplier')}</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} - {s.specialty}</option>
                      ))}
                    </select>
                  </div>

                  {/* Supplier Contact Info */}
                  {statusForm.supplierId && (
                    (() => {
                      const selectedSupplier = suppliers.find(s => s.id === statusForm.supplierId);
                      return selectedSupplier ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-medium text-blue-900 mb-2">{t('maintenance.contactInfo')}</p>
                          {selectedSupplier.phone && (
                            <div className="flex items-center gap-2 text-sm text-blue-700">
                              <Phone className="w-4 h-4" />
                              <span>{selectedSupplier.phone}</span>
                            </div>
                          )}
                          {selectedSupplier.email && (
                            <div className="flex items-center gap-2 text-sm text-blue-700">
                              <Mail className="w-4 h-4" />
                              <span>{selectedSupplier.email}</span>
                            </div>
                          )}
                          {selectedSupplier.address && (
                            <div className="flex items-center gap-2 text-sm text-blue-700">
                              <MapPin className="w-4 h-4" />
                              <span>{selectedSupplier.address}</span>
                            </div>
                          )}
                          
                        </div>
                      ) : null;
                    })()
                  )}

                  {/* Admin Comments */}
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">
                      {t('maintenance.form.comment')} <span className="text-ink-subtle font-normal">{t('maintenance.optional')}</span>
                    </label>
                    <textarea
                      value={statusForm.adminComments}
                      onChange={(e) => setStatusForm({ ...statusForm, adminComments: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder={t('maintenance.form.commentPlaceholder')}
                    />
                  </div>

                  {isCompletedStatus(statusForm.status) && (
                    <div className="border-t border-line pt-4 space-y-4">
                      <div>
                        <p className="text-sm font-medium text-ink-muted mb-1">
                          {t('maintenance.form.cost')} <span className="text-red-500">*</span>
                        </p>
                        <p className="text-xs text-ink-subtle mb-3">
                          {t('maintenance.form.costRequired')}
                        </p>
                      </div>

                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                        {/* Expense Amount */}
                        <div>
                          <label className="block text-sm font-medium text-ink-muted mb-1">
                            {t('maintenance.form.expenseAmount')} <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">€</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={statusForm.expenseAmount}
                              onChange={(e) => setStatusForm({ ...statusForm, expenseAmount: e.target.value })}
                              required
                              className="w-full pl-8 pr-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {/* Expense Category */}
                        <div>
                          <label className="block text-sm font-medium text-ink-muted mb-1">
                            {t('financial.form.category')} <span className="text-red-500">*</span>
                          </label>
                          <Autocomplete
                            value={statusForm.expenseCategoryId || null}
                            onChange={(id) => setStatusForm({ ...statusForm, expenseCategoryId: id ?? '' })}
                            options={expenseCategories.map((c) => ({
                              id: c.id,
                              label: c.name,
                              hashtags: c.hashtags,
                            }))}
                            loading={categoriesLoading}
                            placeholder={t('maintenance.form.categoryPlaceholder')}
                            emptyMessage={t('maintenance.form.noCategories')}
                            showSelectedHashtags
                          />
                        </div>

                        {/* Invoice Document */}
                        <div>
                          <label className="block text-sm font-medium text-ink-muted mb-1">
                            {t('maintenance.form.invoice')} <span className="text-ink-subtle font-normal">{t('maintenance.optional')}</span>
                          </label>
                          <select
                            value={statusForm.invoiceDocumentId}
                            onChange={(e) => setStatusForm({ ...statusForm, invoiceDocumentId: e.target.value })}
                            className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">{t('maintenance.form.selectInvoice')}</option>
                            {maintenanceDocuments
                              .filter(doc => doc.type === 'MaintenanceInvoice')
                              .map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                  {t('maintenance.invoiceOption', { name: doc.name, date: formatDate(doc.uploadedAt) })}
                                </option>
                              ))}
                          </select>
                          {maintenanceDocuments.filter(doc => doc.type === 'MaintenanceInvoice').length === 0 && (
                            <p className="mt-1 text-xs text-ink-subtle">
                              {t('maintenance.form.addInvoiceHint')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Comment History */}
                  {selectedRequest.adminComments && (
                    <div>
                      <label className="block text-sm font-medium text-ink-muted mb-2">{t('maintenance.commentHistory')}</label>
                      <div className="bg-surface-muted rounded-lg p-3 max-h-40 overflow-y-auto">
                        <pre className="text-xs text-ink-muted whitespace-pre-wrap font-sans">{selectedRequest.adminComments}</pre>
                      </div>
                    </div>
                  )}

                  {/* Documents Section */}
                  {!isCompletedStatus(selectedRequest.status) && (
                    <div className="border-t border-line pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-ink-muted">{t('maintenance.documents')}</label>
                        <button
                          type="button"
                          onClick={() => setShowDocUploadModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {t('maintenance.add')}
                        </button>
                      </div>

                      {maintenanceDocuments.length === 0 ? (
                        <div className="text-center py-6 text-ink-subtle bg-surface-muted rounded-lg">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-xs">{t('maintenance.noDocuments')}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {maintenanceDocuments.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-3 border border-line rounded-lg hover:bg-surface-hover transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <FileText className="w-4 h-4 text-ink-subtle shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-ink truncate">{doc.name}</p>
                                  <p className="text-xs text-ink-subtle">
                                    {formatDate(doc.uploadedAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleDocDownload(doc.id, doc.name)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title={t('maintenance.download')}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDocDelete(doc.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title={t('maintenance.deleteTooltip')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      variant="ghost"
                      onClick={handleCloseStatusPanel}
                      fullWidth
                      className="flex-1 border border-line"
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" loading={submitting} fullWidth className="flex-1">
                      {t('maintenance.saveChanges')}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {/* Read-only Status */}
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">{t('maintenance.form.status')}</label>
                    <div className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface-muted text-ink">
                      {statusMap[selectedRequest.status as keyof typeof statusMap]?.label || selectedRequest.status}
                    </div>
                  </div>

                  {/* Read-only Supplier */}
                  {selectedRequest.supplierId && (
                    (() => {
                      const supplier = suppliers.find(s => s.id === selectedRequest.supplierId);
                      return supplier ? (
                        <div>
                          <label className="block text-sm font-medium text-ink-muted mb-1">{t('maintenance.form.supplier')}</label>
                          <div className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-surface-muted text-ink">
                            {supplier.name} - {supplier.specialty}
                          </div>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2 mt-2">
                            <p className="text-xs font-medium text-blue-900 mb-2">{t('maintenance.contactInfo')}</p>
                            {supplier.phone && (
                              <div className="flex items-center gap-2 text-sm text-blue-700">
                                <Phone className="w-4 h-4" />
                                <span>{supplier.phone}</span>
                              </div>
                            )}
                            {supplier.email && (
                              <div className="flex items-center gap-2 text-sm text-blue-700">
                                <Mail className="w-4 h-4" />
                                <span>{supplier.email}</span>
                              </div>
                            )}
                            {supplier.address && (
                              <div className="flex items-center gap-2 text-sm text-blue-700">
                                <MapPin className="w-4 h-4" />
                                <span>{supplier.address}</span>
                              </div>
                            )}
                            
                          </div>
                        </div>
                      ) : null;
                    })()
                  )}

                  {/* Read-only Comment History */}
                  {selectedRequest.adminComments && (
                    <div>
                      <label className="block text-sm font-medium text-ink-muted mb-2">{t('maintenance.comments')}</label>
                      <div className="bg-surface-muted rounded-lg p-3 border border-line">
                        <pre className="text-xs text-ink-muted whitespace-pre-wrap font-sans">{selectedRequest.adminComments}</pre>
                      </div>
                    </div>
                  )}

                  {/* Read-only Documents */}
                  <div className="border-t border-line pt-4">
                    <label className="block text-sm font-medium text-ink-muted mb-3">{t('maintenance.documents')}</label>
                    {maintenanceDocuments.length === 0 ? (
                      <div className="text-center py-6 text-ink-subtle bg-surface-muted rounded-lg">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">{t('maintenance.noDocuments')}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {maintenanceDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 border border-line rounded-lg hover:bg-surface-hover transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText className="w-4 h-4 text-ink-subtle shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-ink truncate">{doc.name}</p>
                                <p className="text-xs text-ink-subtle">
                                  {formatDate(doc.uploadedAt)}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDocDownload(doc.id, doc.name)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                              title={t('maintenance.download')}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Close Button for Residents */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleCloseStatusPanel}
                      className="w-full px-4 py-2 bg-control hover:bg-control-hover text-ink rounded-lg text-sm font-medium transition-colors"
                    >
                      {t('maintenance.close')}
                    </button>
                  </div>
                </div>
              )}
          </>
        )}
      </ModalPopup>

      {/* Document Upload Modal */}
      <ModalPopup
        open={showDocUploadModal}
        onClose={() => {
          setShowDocUploadModal(false);
          setUploadFile(null);
          setUploadForm({ name: '', type: 'MaintenanceInvoice', description: '' });
        }}
        title={t('maintenance.uploadDoc.title')}
        maxWidthClass="max-w-lg"
      >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-sm text-ink-subtle">{t('maintenance.uploadDoc.subtitle')}</p>
            </div>

            <form onSubmit={handleDocUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('maintenance.uploadDoc.typeLabel')} *
                </label>
                <select
                  required
                  value={uploadForm.type}
                  onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MaintenanceInvoice">{t('maintenance.docType.invoice')}</option>
                  <option value="MaintenanceQuote">{t('maintenance.docType.quote')}</option>
                  <option value="MaintenanceReport">{t('maintenance.docType.report')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('maintenance.uploadDoc.nameLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  placeholder={t('maintenance.uploadDoc.namePlaceholder')}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('maintenance.uploadDoc.descriptionLabel')}
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder={t('maintenance.uploadDoc.descriptionPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <FileUpload
                onFileSelect={setUploadFile}
                currentFile={uploadFile}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />

              <div className="flex flex-wrap gap-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDocUploadModal(false);
                    setUploadFile(null);
                    setUploadForm({ name: '', type: 'MaintenanceInvoice', description: '' });
                  }}
                  fullWidth
                  className="flex-1 border border-line"
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={uploading} disabled={!uploadFile} fullWidth className="flex-1">
                  {t('maintenance.add')}
                </Button>
              </div>
            </form>
      </ModalPopup>
    </div>
  );
}
