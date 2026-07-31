import { useEffect, useState, useCallback } from 'react';
import { Plus, ClipboardList, Trash2, Pencil, X, FileText, Ban, CheckCircle2, Calendar, Download, Upload } from 'lucide-react';
import { assembliesApi, documentsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import RichTextEditor from '../components/RichTextEditor';
import RichTextDisplay from '../components/RichTextDisplay';
import MultipleFileUpload from '../components/MultipleFileUpload';
import { PageHeader, Button, FilterBar, FilterChip, AsyncState, EmptyState, Badge } from '../components/ui';
import type { BadgeVariant } from '../components/ui';
import type { AssemblyDto, CreateAssemblyRequest, UpdateAssemblyRequest, PaginatedResponse, DocumentDto } from '../types';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';

const getStatusLabels = (t: TranslateFn): Record<string, string> => ({
  Scheduled: t('assemblies.status.scheduled'),
  InProgress: t('assemblies.status.inProgress'),
  Completed: t('assemblies.status.completed'),
  Cancelled: t('assemblies.status.cancelled'),
});

const statusVariants: Record<string, BadgeVariant> = {
  Scheduled: 'info',
  InProgress: 'warning',
  Completed: 'success',
  Cancelled: 'neutral',
};

export default function AssembliesPage() {
  const { isAdmin, condominiumId } = useAuth();
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const { t, formatDate, formatDateTime } = useTranslation();
  const statusLabels = getStatusLabels(t);
  const [assemblies, setAssemblies] = useState<AssemblyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleteAssemblyId, setDeleteAssemblyId] = useState<string | null>(null);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateAssemblyRequest>({
    title: '',
    description: '',
    scheduledAt: '',
    location: '',
    condominiumId: condominiumId || '',
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('All');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<AssemblyDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAssembly, setSelectedAssembly] = useState<AssemblyDto | null>(null);

  // Notes modal state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesAutoSaving, setNotesAutoSaving] = useState(false);
  const [notesLastSaved, setNotesLastSaved] = useState<Date | null>(null);

  // Minutes modal state
  const [showMinutesModal, setShowMinutesModal] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [minutesAutoSaving, setMinutesAutoSaving] = useState(false);
  const [minutesLastSaved, setMinutesLastSaved] = useState<Date | null>(null);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  // Documents state
  const [assemblyDocuments, setAssemblyDocuments] = useState<DocumentDto[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [showUploadDocument, setShowUploadDocument] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadForm, setUploadForm] = useState<{
    name: string;
    type: 'AssemblyMinutes' | 'AssemblyConvocation' | 'AssemblyAttachment';
    description: string;
  }>({
    name: '',
    type: 'AssemblyMinutes',
    description: '',
  });
  const [uploadingDocument, setUploadingDocument] = useState(false);

  // Quick upload modal (from card)
  const [showQuickUploadModal, setShowQuickUploadModal] = useState(false);
  const [quickUploadAssembly, setQuickUploadAssembly] = useState<AssemblyDto | null>(null);
  const [dragOverAssemblyId, setDragOverAssemblyId] = useState<string | null>(null);

  const load = useCallback((page: number = 1) => {
    if (!condominiumId) {
      setAssemblies([]);
      setPagination(null);
      setLoadError(t('assemblies.error.condominiumNotIdentified'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    assembliesApi.getPaged(condominiumId, page, pageSize, debouncedSearch)
      .then((r) => {
        const scoped = r.data.items;
        // Sort by most recent scheduled date first
        const sorted = scoped.sort((a, b) => 
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
        );
        setPagination({ ...r.data, items: sorted, totalItems: sorted.length });
        setAssemblies(sorted);
        setCurrentPage(page);
      })
      .catch(() => {
        setLoadError(t('assemblies.error.load'));
      })
      .finally(() => setLoading(false));
  }, [condominiumId, debouncedSearch, t]);

  useEffect(() => { load(1); }, [load]);
  
  // Filter assemblies by status
  const filteredAssemblies = statusFilter === 'All' 
    ? assemblies 
    : assemblies.filter(a => a.status === statusFilter);

  const openNew = () => {
    setEditId(null);
    setForm({
      title: '',
      description: '',
      scheduledAt: '',
      location: '',
      condominiumId: condominiumId || '',
    });
    setShowForm(true);
  };

  const openEdit = (a: AssemblyDto) => {
    setEditId(a.id);
    const updateForm: UpdateAssemblyRequest = {
      title: a.title,
      description: a.description,
      scheduledAt: a.scheduledAt ? new Date(a.scheduledAt).toISOString().slice(0, 16) : '',
      location: a.location,
    };
    setForm({ 
      condominiumId: a.condominiumId,
      title: updateForm.title || '',
      description: updateForm.description || '',
      scheduledAt: updateForm.scheduledAt || '',
      location: updateForm.location || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condominiumId) {
      toastError(t('assemblies.error.condominiumNotSelected'));
      return;
    }

    setSubmitting(true);
    try {
      if (editId) {
        const updateData: UpdateAssemblyRequest = {
          title: form.title,
          description: form.description,
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
          location: form.location,
        };
        await assembliesApi.update(condominiumId, editId, updateData);
      } else {
        const createData: CreateAssemblyRequest = {
          ...form,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
        };
        await assembliesApi.create(condominiumId, createData);
      }
      setShowForm(false);
      load();
    } catch (error) {
      console.error('Erro ao guardar assembleia:', error);
      toastError(t('assemblies.error.save'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteAssemblyId(id);
  };

  const confirmDeleteAssembly = async () => {
    if (!deleteAssemblyId || !condominiumId) return;
    try {
      await assembliesApi.delete(condominiumId, deleteAssemblyId);
      load();
    } catch (error) {
      console.error('Erro ao eliminar assembleia:', error);
      toastError(t('assemblies.error.delete'));
    } finally {
      setDeleteAssemblyId(null);
    }
  };

  const openDetails = (assembly: AssemblyDto) => {
    setSelectedAssembly(assembly);
    setShowDetailModal(true);
  };

  const openNotes = (assembly: AssemblyDto) => {
    setSelectedAssembly(assembly);
    setNotes(assembly.notes || '');
    setNotesLastSaved(null);
    setShowNotesModal(true);
  };

  // Auto-save notes
  useEffect(() => {
    if (!showNotesModal || !selectedAssembly || notes === (selectedAssembly.notes || '')) {
      return;
    }

    if (!condominiumId) {
      return;
    }

    const timer = setTimeout(async () => {
      setNotesAutoSaving(true);
      try {
        await assembliesApi.updateNotes(condominiumId, selectedAssembly.id, notes);
        setNotesLastSaved(new Date());
        // Update selectedAssembly to reflect new saved state
        setSelectedAssembly({ ...selectedAssembly, notes });
      } catch (error) {
        console.error('Erro no auto-save das notas:', error);
      } finally {
        setNotesAutoSaving(false);
      }
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(timer);
  }, [condominiumId, notes, showNotesModal, selectedAssembly]);

  const handleSaveNotes = async () => {
    if (!selectedAssembly || !condominiumId) return;
    setSubmitting(true);
    try {
      await assembliesApi.updateNotes(condominiumId, selectedAssembly.id, notes);
      setShowNotesModal(false);
      load();
    } catch (error) {
      console.error('Erro ao guardar notas:', error);
      toastError(t('assemblies.error.saveNotes'));
    } finally {
      setSubmitting(false);
    }
  };

  const openMinutes = async (assembly: AssemblyDto) => {
    if (!condominiumId) {
      toastError(t('assemblies.error.condominiumNotSelected'));
      return;
    }

    try {
      const res = await assembliesApi.getById(condominiumId, assembly.id);
      const latestAssembly = res.data;
      setSelectedAssembly(latestAssembly);
      setMinutes(latestAssembly.minutes || '');
      setMinutesLastSaved(null);
      setShowMinutesModal(true);
    } catch (error) {
      console.error('Erro ao carregar atas da assembleia:', error);
      toastError(t('assemblies.error.loadMinutes'));
    }
  };

  // Auto-save minutes draft (sem completar a assembleia)
  useEffect(() => {
    if (!showMinutesModal || !selectedAssembly || minutes === (selectedAssembly.minutes || '')) {
      return;
    }

    if (!condominiumId) {
      return;
    }

    const timer = setTimeout(async () => {
      setMinutesAutoSaving(true);
      try {
        await assembliesApi.updateMinutesDraft(condominiumId, selectedAssembly.id, minutes);
        setMinutesLastSaved(new Date());
        // Update selectedAssembly to reflect new saved state
        setSelectedAssembly({ ...selectedAssembly, minutes });
      } catch (error) {
        console.error('Erro no auto-save das atas:', error);
      } finally {
        setMinutesAutoSaving(false);
      }
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(timer);
  }, [condominiumId, minutes, showMinutesModal, selectedAssembly]);

  const handleSaveDraftMinutes = async () => {
    if (!selectedAssembly || !condominiumId) return;
    setSubmitting(true);
    try {
      await assembliesApi.updateMinutesDraft(condominiumId, selectedAssembly.id, minutes);
      setMinutesLastSaved(new Date());
      toastSuccess(t('assemblies.success.draftSaved'));
    } catch (error) {
      console.error('Erro ao guardar draft das atas:', error);
      toastError(t('assemblies.error.saveDraft'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteAssembly = async () => {
    if (!selectedAssembly) return;
    if (!minutes.trim()) {
      toastError(t('assemblies.error.minutesRequired'));
      return;
    }
    setConfirmCompleteOpen(true);
  };

  const doCompleteAssembly = async () => {
    if (!selectedAssembly || !condominiumId) return;
    setConfirmCompleteOpen(false);
    setSubmitting(true);
    try {
      await assembliesApi.updateMinutes(condominiumId, selectedAssembly.id, minutes);
      setShowMinutesModal(false);
      load();
      toastSuccess(t('assemblies.success.completed'));
    } catch (error) {
      console.error('Erro ao concluir assembleia:', error);
      toastError(t('assemblies.error.complete'));
    } finally {
      setSubmitting(false);
    }
  };

  const openCancel = (assembly: AssemblyDto) => {
    setSelectedAssembly(assembly);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const handleCancel = async () => {
    if (!selectedAssembly || !condominiumId) return;
    if (!cancellationReason.trim()) {
      toastError(t('assemblies.error.cancellationReasonRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await assembliesApi.cancel(condominiumId, selectedAssembly.id, cancellationReason);
      setShowCancelModal(false);
      load();
    } catch (error) {
      console.error('Erro ao cancelar assembleia:', error);
      toastError(t('assemblies.error.cancel'));
    } finally {
      setSubmitting(false);
    }
  };

  // Document management
  const loadAssemblyDocuments = useCallback(async (assemblyId: string) => {
    if (!condominiumId) return;

    setLoadingDocuments(true);
    try {
      const response = await documentsApi.getByAssembly(condominiumId, assemblyId);
      setAssemblyDocuments(response.data);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
    } finally {
      setLoadingDocuments(false);
    }
  }, [condominiumId]);

  // Load documents when detail modal opens
  useEffect(() => {
    if (showDetailModal && selectedAssembly) {
      loadAssemblyDocuments(selectedAssembly.id);
    }
  }, [loadAssemblyDocuments, showDetailModal, selectedAssembly]);

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0 || !selectedAssembly || !condominiumId) return;

    setUploadingDocument(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFiles[0]); // Use first file from array
      formData.append('name', uploadForm.name);
      formData.append('type', uploadForm.type);
      formData.append('context', 'Assembly');
      formData.append('assemblyId', selectedAssembly.id);
      
      if (uploadForm.description) {
        formData.append('description', uploadForm.description);
      }

      await documentsApi.upload(condominiumId, formData);
      setShowUploadDocument(false);
      setUploadFiles([]);
      setUploadForm({
        name: '',
        type: 'AssemblyMinutes',
        description: '',
      });
      await loadAssemblyDocuments(selectedAssembly.id);
    } catch (error) {
      console.error('Erro ao fazer upload do documento:', error);
      toastError(t('assemblies.error.uploadDocument'));
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    setDeleteDocumentId(documentId);
  };

  const confirmDeleteDocument = async () => {
    if (!deleteDocumentId || !condominiumId) return;
    try {
      await documentsApi.delete(condominiumId, deleteDocumentId);
      if (selectedAssembly) {
        await loadAssemblyDocuments(selectedAssembly.id);
      }
    } catch (error) {
      console.error('Erro ao eliminar documento:', error);
      toastError(t('assemblies.error.deleteDocument'));
    } finally {
      setDeleteDocumentId(null);
    }
  };

  const handleDocumentDownload = async (id: string, fileName: string) => {
    if (!condominiumId) {
      toastError(t('assemblies.error.condominiumNotSelected'));
      return;
    }

    try {
      await documentsApi.download(condominiumId, id, fileName);
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toastError(t('assemblies.error.downloadDocument'));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const documentTypeLabels: Record<string, string> = {
    AssemblyMinutes: t('assemblies.docType.minutes'),
    AssemblyConvocation: t('assemblies.docType.convocation'),
    AssemblyAttachment: t('assemblies.docType.attachment'),
  };

  // Quick upload from card
  const openQuickUpload = (assembly: AssemblyDto) => {
    setQuickUploadAssembly(assembly);
    setUploadFiles([]);
    setUploadForm({
      name: '',
      type: 'AssemblyConvocation',
      description: '',
    });
    setShowQuickUploadModal(true);
  };

  const handleQuickUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0 || !quickUploadAssembly || !condominiumId) return;

    setUploadingDocument(true);
    try {
      const formData = new FormData();
      
      // Add all files
      uploadFiles.forEach(file => {
        formData.append('files', file);
      });
      
      formData.append('context', 'Assembly');
      formData.append('assemblyId', quickUploadAssembly.id);

      const response = await documentsApi.uploadMultiple(condominiumId, formData);
      
      setShowQuickUploadModal(false);
      setQuickUploadAssembly(null);
      setUploadFiles([]);
      setUploadForm({
        name: '',
        type: 'AssemblyConvocation',
        description: '',
      });

      if (response.data.failed > 0) {
        toastWarning(t('assemblies.success.uploadPartial', { success: response.data.success, failed: response.data.failed }));
      } else {
        toastSuccess(t('assemblies.success.uploadAll', { count: response.data.success }));
      }

      // Reload documents if in detail modal
      if (selectedAssembly && selectedAssembly.id === quickUploadAssembly.id) {
        await loadAssemblyDocuments(quickUploadAssembly.id);
      }
    } catch (error) {
      console.error('Erro ao fazer upload dos documentos:', error);
      toastError(t('assemblies.error.uploadDocuments'));
    } finally {
      setUploadingDocument(false);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent, assemblyId: string, isDisabled: boolean) => {
    if (isDisabled || !isAdmin) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverAssemblyId(assemblyId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverAssemblyId(null);
  };

  const handleDrop = async (e: React.DragEvent, assembly: AssemblyDto) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverAssemblyId(null);

    if (assembly.status === 'Cancelled' || !isAdmin) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Validate each file size (100MB max)
    const validFiles = files.filter(file => {
      if (file.size > 100 * 1024 * 1024) {
        toastError(t('assemblies.error.fileTooLarge', { name: file.name }));
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Limit to 10 files
    if (validFiles.length > 10) {
      toastError(t('assemblies.error.maxFiles', { max: 10 }));
      return;
    }

    setQuickUploadAssembly(assembly);
    setUploadFiles(validFiles);
    setUploadForm({
      name: '',
      type: 'AssemblyConvocation',
      description: '',
    });
    setShowQuickUploadModal(true);
  };

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={deleteAssemblyId !== null}
        title={t('assemblies.deleteModal.title')}
        message={t('assemblies.deleteModal.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDeleteAssembly}
        onCancel={() => setDeleteAssemblyId(null)}
      />
      <ConfirmModal
        open={confirmCompleteOpen}
        title={t('assemblies.completeModal.title')}
        message={t('assemblies.completeModal.message')}
        confirmLabel={t('assemblies.completeModal.confirm')}
        variant="warning"
        onConfirm={doCompleteAssembly}
        onCancel={() => setConfirmCompleteOpen(false)}
      />
      <ConfirmModal
        open={deleteDocumentId !== null}
        title={t('assemblies.deleteDocModal.title')}
        message={t('assemblies.deleteDocModal.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDeleteDocument}
        onCancel={() => setDeleteDocumentId(null)}
      />
      <PageHeader
        title={t('assemblies.title')}
        subtitle={t('assemblies.subtitle')}
        search={
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('assemblies.searchPlaceholder')}
          />
        }
        actions={
          isAdmin && (
            <Button icon={Plus} onClick={openNew} fullWidth className="sm:w-auto">
              {t('assemblies.new')}
            </Button>
          )
        }
      />

      {/* Form */}
      <ModalPopup
        open={showForm && isAdmin}
        onClose={() => setShowForm(false)}
        title={editId ? t('assemblies.form.editTitle') : t('assemblies.new')}
        maxWidthClass="max-w-2xl"
      >
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('assemblies.form.title')}</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('assemblies.form.titlePlaceholder')}
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
                placeholder={t('assemblies.form.descriptionPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('assemblies.form.dateTime')}</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                required
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('assemblies.form.location')}</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('assemblies.form.locationPlaceholder')}
              />
            </div>
            <div className="sm:col-span-2 flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowForm(false)} className="border border-line">
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={submitting}>
                {t('assemblies.form.save')}
              </Button>
            </div>
          </form>
      </ModalPopup>

      {/* Filters */}
      <FilterBar>
        {['All', 'Scheduled', 'InProgress', 'Completed', 'Cancelled'].map((status) => (
          <FilterChip
            key={status}
            label={status === 'All' ? t('assemblies.filter.all') : statusLabels[status] ?? status}
            active={statusFilter === status}
            count={status === 'All' ? undefined : assemblies.filter((a) => a.status === status).length}
            onClick={() => setStatusFilter(status)}
          />
        ))}
      </FilterBar>

      {/* List */}
      <AsyncState
        loading={loading}
        error={loadError || null}
        onRetry={() => load(currentPage)}
        isEmpty={filteredAssemblies.length === 0}
        skeleton="list"
        empty={
          <EmptyState
            icon={ClipboardList}
            title={statusFilter === 'All' ? t('assemblies.empty') : t('assemblies.emptyFiltered', { status: statusLabels[statusFilter] ?? statusFilter })}
          />
        }
      >
        <div className="space-y-3">
          {filteredAssemblies.map((a) => {
              const isDragOver = dragOverAssemblyId === a.id;
              const isDisabled = a.status === 'Cancelled';
              
              return (
                <div 
                  key={a.id} 
                  className={`bg-surface rounded-xl shadow-sm border p-4 transition-all ${
                    isDragOver && !isDisabled && isAdmin
                      ? 'border-indigo-400 border-2 bg-indigo-50 shadow-lg'
                      : 'border-line'
                  } ${!isDisabled && isAdmin ? 'hover:shadow-md' : ''}`}
                  onDragOver={(e) => handleDragOver(e, a.id, isDisabled)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, a)}
                >
                  {isDragOver && !isDisabled && isAdmin && (
                    <div className="flex items-center justify-center gap-2 mb-3 p-3 bg-indigo-100 border-2 border-dashed border-indigo-400 rounded-lg">
                      <Upload className="w-5 h-5 text-indigo-600" />
                      <span className="text-sm font-medium text-indigo-700">{t('assemblies.dropToAdd')}</span>
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 shrink-0">
                        <ClipboardList className="w-5 h-5 text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <button 
                          onClick={() => openDetails(a)}
                          className="font-medium text-ink hover:text-indigo-600 text-left"
                        >
                          {a.title}
                        </button>
                        {a.description && <p className="text-sm text-ink-subtle mt-0.5 line-clamp-2">{a.description}</p>}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant={statusVariants[a.status] ?? 'neutral'}>
                            {statusLabels[a.status] ?? a.status}
                          </Badge>
                          <span className="text-xs text-ink-subtle flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDateTime(a.scheduledAt)}
                          </span>
                          {a.location && (
                            <span className="text-xs text-ink-subtle">{a.location}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      {isAdmin && a.status !== 'Cancelled' && (
                        <button 
                          onClick={() => openQuickUpload(a)}
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1.5"
                          title={t('assemblies.card.addDocuments')}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {t('assemblies.card.documents')}
                        </button>
                      )}
                      {isAdmin && a.status === 'InProgress' && (
                        <button 
                          onClick={() => openNotes(a)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                          title={t('assemblies.card.editNotes')}
                        >
                          {t('assemblies.card.notes')}
                        </button>
                      )}
                      {isAdmin && (a.status === 'InProgress' || a.status === 'Scheduled') && (
                        <button 
                          onClick={() => openMinutes(a)}
                          className="px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 border border-green-200 rounded-lg transition-colors"
                          title={t('assemblies.card.insertMinutes')}
                        >
                          {t('assemblies.card.minutes')}
                        </button>
                      )}
                      {isAdmin && a.status !== 'Cancelled' && a.status !== 'Completed' && (
                        <button 
                          onClick={() => openCancel(a)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                          title={t('assemblies.card.cancelAssembly')}
                        >
                          {t('common.cancel')}
                        </button>
                      )}
                      {isAdmin && a.status === 'Scheduled' && (
                        <>
                          <button onClick={() => openEdit(a)} className="text-ink-subtle hover:text-indigo-500">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(a.id)} className="text-ink-subtle hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {pagination && (
              <Pagination
                pagination={pagination}
                currentPage={currentPage}
                onPageChange={(page) => load(page)}
              />
            )}
        </div>
      </AsyncState>

      {/* Detail Modal */}
      <ModalPopup
        open={showDetailModal && selectedAssembly !== null}
        onClose={() => setShowDetailModal(false)}
        title={t('assemblies.detail.title')}
        maxWidthClass="max-w-2xl"
        bodyClassName="space-y-4 p-6"
      >
            {selectedAssembly && (
              <>
              <div>
                <label className="text-xs font-medium text-ink-subtle uppercase">{t('assemblies.form.title')}</label>
                <p className="text-ink mt-1">{selectedAssembly.title}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-subtle uppercase">{t('common.description')}</label>
                <p className="text-ink-muted mt-1 whitespace-pre-wrap">{selectedAssembly.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-ink-subtle uppercase">{t('assemblies.form.dateTime')}</label>
                  <p className="text-ink mt-1">{formatDateTime(selectedAssembly.scheduledAt)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-subtle uppercase">{t('assemblies.form.location')}</label>
                  <p className="text-ink mt-1">{selectedAssembly.location}</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-subtle uppercase">{t('assemblies.detail.status')}</label>
                <p className="mt-1">
                  <Badge variant={statusVariants[selectedAssembly.status] ?? 'neutral'}>
                    {statusLabels[selectedAssembly.status]}
                  </Badge>
                </p>
              </div>
              {selectedAssembly.notes && (
                <div>
                  <label className="text-xs font-medium text-ink-subtle uppercase">{t('assemblies.card.notes')}</label>
                  <div className="mt-1 p-3 bg-surface-muted rounded-lg">
                    <RichTextDisplay content={selectedAssembly.notes} className="text-sm" />
                  </div>
                </div>
              )}
              {selectedAssembly.minutes && (selectedAssembly.status === 'Completed' || (selectedAssembly.status === 'InProgress' && isAdmin)) && (
                <div>
                  <label className="text-xs font-medium text-ink-subtle uppercase">
                    {t('assemblies.card.minutes')} {selectedAssembly.status === 'InProgress' && t('assemblies.detail.draftEditing')}
                  </label>
                  <div className={`mt-1 p-3 rounded-lg border ${
                    selectedAssembly.status === 'Completed' 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <RichTextDisplay content={selectedAssembly.minutes} className="text-sm" />
                  </div>
                </div>
              )}
              {selectedAssembly.cancellationReason && (
                <div>
                  <label className="text-xs font-medium text-ink-subtle uppercase">{t('assemblies.detail.cancellationReason')}</label>
                  <div className="mt-1 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-ink-muted">{selectedAssembly.cancellationReason}</p>
                  </div>
                </div>
              )}

              {/* Documents Section */}
              <div className="border-t border-line pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-ink-subtle uppercase">{t('assemblies.detail.attachedDocuments')}</label>
                  {isAdmin && selectedAssembly.status !== 'Cancelled' && (
                    <button
                      onClick={() => setShowUploadDocument(!showUploadDocument)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors font-medium"
                    >
                      <Upload className="w-3 h-3" />
                      {showUploadDocument ? t('common.cancel') : t('assemblies.detail.addDocument')}
                    </button>
                  )}
                </div>

                {/* Upload Form */}
                {showUploadDocument && isAdmin && selectedAssembly.status !== 'Cancelled' && (
                  <form onSubmit={handleUploadDocument} className="bg-surface-muted rounded-lg p-4 mb-4 space-y-3">
                    <MultipleFileUpload
                      onFilesSelect={setUploadFiles}
                      currentFiles={uploadFiles}
                      removeFile={(index) => setUploadFiles(prev => prev.filter((_, i) => i !== index))}
                      disabled={uploadingDocument}
                      maxFiles={1}
                    />
                    <div>
                      <label className="block text-xs font-medium text-ink-muted mb-1">{t('assemblies.upload.docNameLabel')}</label>
                      <input
                        type="text"
                        value={uploadForm.name}
                        onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder={t('assemblies.upload.docNamePlaceholder')}
                        required
                        disabled={uploadingDocument}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-muted mb-1">{t('assemblies.upload.typeLabel')}</label>
                      <select
                        value={uploadForm.type}
                        onChange={(e) =>
                          setUploadForm({
                            ...uploadForm,
                            type: e.target.value as 'AssemblyMinutes' | 'AssemblyConvocation' | 'AssemblyAttachment',
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                        disabled={uploadingDocument}
                      >
                        <option value="AssemblyMinutes">{t('assemblies.docType.minutes')}</option>
                        <option value="AssemblyConvocation">{t('assemblies.docType.convocation')}</option>
                        <option value="AssemblyAttachment">{t('assemblies.docType.attachment')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-muted mb-1">{t('assemblies.upload.descriptionLabel')}</label>
                      <textarea
                        value={uploadForm.description}
                        onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                        rows={2}
                        placeholder={t('assemblies.upload.descriptionPlaceholder')}
                        disabled={uploadingDocument}
                      />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowUploadDocument(false);
                          setUploadFiles([]);
                        }}
                        disabled={uploadingDocument}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        loading={uploadingDocument}
                        disabled={uploadFiles.length === 0}
                      >
                        {t('assemblies.upload.submit')}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Documents List */}
                <div className="space-y-2">
                  {loadingDocuments ? (
                    <div className="text-center py-4 text-sm text-ink-subtle">{t('assemblies.loadingDocuments')}</div>
                  ) : assemblyDocuments.length === 0 ? (
                    <div className="text-center py-4 text-sm text-ink-subtle">
                      {t('assemblies.noDocuments')}
                    </div>
                  ) : (
                    assemblyDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-surface-muted rounded-lg border border-line">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="w-4 h-4 text-ink-subtle shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{doc.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-ink-subtle">
                                {documentTypeLabels[doc.type] || doc.type}
                              </span>
                              <span className="text-ink-subtle">•</span>
                              <span className="text-xs text-ink-subtle">{formatFileSize(doc.fileSize)}</span>
                              <span className="text-ink-subtle">•</span>
                              <span className="text-xs text-ink-subtle">
                                {formatDate(doc.uploadedAt)}
                              </span>
                            </div>
                            {doc.description && (
                              <p className="text-xs text-ink-subtle mt-1 line-clamp-1">{doc.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleDocumentDownload(doc.id, doc.name)}
                            className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                            title={t('assemblies.download')}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                              title={t('common.delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            <div className="border-t border-line pt-4 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-control hover:bg-control-hover text-ink rounded-lg text-sm font-medium transition-colors"
              >
                {t('assemblies.detail.close')}
              </button>
            </div>
              </>
            )}
      </ModalPopup>

      {/* Notes Modal */}
      <ModalPopup
        open={showNotesModal && selectedAssembly !== null && isAdmin}
        onClose={() => setShowNotesModal(false)}
        maxWidthClass="max-w-2xl"
        bodyClassName="p-0"
        header={
          <div className="sticky top-0 bg-surface border-b border-line px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  {t('assemblies.notes.title')}
                </h2>
                {notesAutoSaving && (
                  <span className="text-xs text-ink-subtle animate-pulse">{t('assemblies.autoSaving')}</span>
                )}
                {!notesAutoSaving && notesLastSaved && (
                  <span className="text-xs text-green-600">{t('assemblies.saved')}</span>
                )}
              </div>
              <button onClick={() => setShowNotesModal(false)} className="p-2 hover:bg-surface-hover rounded-lg transition-colors" type="button">
                <X className="w-5 h-5 text-ink-subtle" />
              </button>
          </div>
        }
      >
            {selectedAssembly && isAdmin && (
              <>
            <div className="px-6 py-4">
              <p className="text-sm text-ink-subtle mb-3">{t('assemblies.notes.hint')}</p>
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder={t('assemblies.notes.placeholder')}
                height="350px"
              />
            </div>
            <div className="px-6 py-4 border-t border-line flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowNotesModal(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveNotes} loading={submitting}>
                {t('assemblies.notes.save')}
              </Button>
            </div>
              </>
            )}
      </ModalPopup>

      {/* Minutes Modal */}
      <ModalPopup
        open={showMinutesModal && selectedAssembly !== null && isAdmin}
        onClose={() => setShowMinutesModal(false)}
        maxWidthClass="max-w-2xl"
        bodyClassName="p-0"
        header={
          <div className="sticky top-0 bg-surface border-b border-line px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  {t('assemblies.minutes.title')}
                </h2>
                {minutesAutoSaving && (
                  <span className="text-xs text-ink-subtle animate-pulse">{t('assemblies.autoSaving')}</span>
                )}
                {!minutesAutoSaving && minutesLastSaved && (
                  <span className="text-xs text-green-600">{t('assemblies.saved')}</span>
                )}
              </div>
              <button onClick={() => setShowMinutesModal(false)} className="p-2 hover:bg-surface-hover rounded-lg transition-colors" type="button">
                <X className="w-5 h-5 text-ink-subtle" />
              </button>
          </div>
        }
      >
            {selectedAssembly && isAdmin && (
              <>
            <div className="px-6 py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-800">
                  💾 <strong>{t('assemblies.minutes.autoSaveLabel')}</strong> {t('assemblies.minutes.autoSaveInfo')}<br />
                  {t('assemblies.minutes.instructionPrefix')}<strong>"{t('assemblies.minutes.saveDraft')}"</strong>{t('assemblies.minutes.instructionMiddle')}<strong>"{t('assemblies.minutes.completeAssembly')}"</strong>{t('assemblies.minutes.instructionSuffix')}
                </p>
              </div>
              <RichTextEditor
                value={minutes}
                onChange={setMinutes}
                placeholder={t('assemblies.minutes.placeholder')}
                height="350px"
              />
            </div>
            <div className="px-6 py-4 border-t border-line flex flex-wrap justify-between gap-3">
              <Button variant="ghost" onClick={() => setShowMinutesModal(false)}>
                {t('assemblies.detail.close')}
              </Button>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleSaveDraftMinutes} loading={submitting}>
                  {t('assemblies.minutes.saveDraft')}
                </Button>
                <Button variant="success" onClick={handleCompleteAssembly} loading={submitting}>
                  {t('assemblies.minutes.completeAssembly')}
                </Button>
              </div>
            </div>
              </>
            )}
      </ModalPopup>

      {/* Cancel Modal */}
      <ModalPopup
        open={showCancelModal && selectedAssembly !== null && isAdmin}
        onClose={() => setShowCancelModal(false)}
        maxWidthClass="max-w-md"
        bodyClassName="p-0"
        header={
          <div className="sticky top-0 bg-surface border-b border-line px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-600" />
                {t('assemblies.card.cancelAssembly')}
              </h2>
              <button onClick={() => setShowCancelModal(false)} className="p-2 hover:bg-surface-hover rounded-lg transition-colors" type="button">
                <X className="w-5 h-5 text-ink-subtle" />
              </button>
          </div>
        }
      >
            {selectedAssembly && isAdmin && (
              <>
            <div className="px-6 py-4">
              <p className="text-sm text-ink-muted mb-3">
                {t('assemblies.cancelModal.hint')}
              </p>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                placeholder={t('assemblies.cancelModal.placeholder')}
              />
            </div>
            <div className="px-6 py-4 border-t border-line flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowCancelModal(false)}>
                {t('assemblies.cancelModal.back')}
              </Button>
              <Button variant="danger" onClick={handleCancel} loading={submitting}>
                {t('assemblies.card.cancelAssembly')}
              </Button>
            </div>
              </>
            )}
      </ModalPopup>

      {/* Quick Upload Modal */}
      <ModalPopup
        open={showQuickUploadModal && quickUploadAssembly !== null && isAdmin}
        onClose={() => setShowQuickUploadModal(false)}
        maxWidthClass="max-w-2xl"
        bodyClassName="p-0"
        header={
          <div className="sticky top-0 bg-surface border-b border-line px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  {t('assemblies.detail.addDocument')}
                </h2>
                <p className="text-sm text-ink-subtle mt-0.5">
                  {quickUploadAssembly?.title ?? ''}
                </p>
              </div>
              <button 
                onClick={() => setShowQuickUploadModal(false)} 
                className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                type="button"
              >
                <X className="w-5 h-5 text-ink-subtle" />
              </button>
          </div>
        }
      >
            {quickUploadAssembly && isAdmin && (
              <>

            <form onSubmit={handleQuickUpload} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  {t('assemblies.quickUpload.filesLabel')}
                </label>
                <MultipleFileUpload
                  onFilesSelect={setUploadFiles}
                  currentFiles={uploadFiles}
                  removeFile={(index) => setUploadFiles(prev => prev.filter((_, i) => i !== index))}
                  disabled={uploadingDocument}
                  maxFiles={10}
                />
                <p className="mt-2 text-xs text-ink-subtle">
                  {t('assemblies.quickUpload.hint')}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-line">
                <Button
                  variant="ghost"
                  onClick={() => setShowQuickUploadModal(false)}
                  disabled={uploadingDocument}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  icon={Upload}
                  loading={uploadingDocument}
                  disabled={uploadFiles.length === 0}
                >
                  {uploadFiles.length === 0
                    ? t('assemblies.quickUpload.submitEmpty')
                    : uploadFiles.length === 1
                      ? t('assemblies.quickUpload.submitOne', { count: uploadFiles.length })
                      : t('assemblies.quickUpload.submitMany', { count: uploadFiles.length })}
                </Button>
              </div>
            </form>
              </>
            )}
      </ModalPopup>
    </div>
  );
}
