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
import type { AssemblyDto, CreateAssemblyRequest, UpdateAssemblyRequest, PaginatedResponse, DocumentDto } from '../types';

const statusLabels: Record<string, string> = {
  Scheduled: 'Agendada',
  InProgress: 'Em Curso',
  Completed: 'Concluída',
  Cancelled: 'Cancelada',
};

const statusColors: Record<string, string> = {
  Scheduled: 'bg-blue-100 text-blue-700',
  InProgress: 'bg-yellow-100 text-yellow-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-gray-100 text-gray-500',
};

export default function AssembliesPage() {
  const { isAdmin, condominiumId } = useAuth();
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const [assemblies, setAssemblies] = useState<AssemblyDto[]>([]);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
      return;
    }

    setLoading(true);
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
      .finally(() => setLoading(false));
  }, [condominiumId, debouncedSearch]);

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
      toastError('Condomínio não selecionado.');
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
      toastError('Erro ao guardar assembleia.');
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
      toastError('Erro ao eliminar assembleia.');
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
      toastError('Erro ao guardar notas.');
    } finally {
      setSubmitting(false);
    }
  };

  const openMinutes = async (assembly: AssemblyDto) => {
    if (!condominiumId) {
      toastError('Condomínio não selecionado.');
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
      toastError('Erro ao carregar o conteúdo das atas.');
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
      toastSuccess('Draft das atas guardado com sucesso!');
    } catch (error) {
      console.error('Erro ao guardar draft das atas:', error);
      toastError('Erro ao guardar draft das atas.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteAssembly = async () => {
    if (!selectedAssembly) return;
    if (!minutes.trim()) {
      toastError('Por favor insira as atas da assembleia antes de concluir.');
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
      toastSuccess('Assembleia concluída! As atas foram publicadas e notificações enviadas.');
    } catch (error) {
      console.error('Erro ao concluir assembleia:', error);
      toastError('Erro ao concluir assembleia.');
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
      toastError('Por favor insira o motivo do cancelamento.');
      return;
    }
    setSubmitting(true);
    try {
      await assembliesApi.cancel(condominiumId, selectedAssembly.id, cancellationReason);
      setShowCancelModal(false);
      load();
    } catch (error) {
      console.error('Erro ao cancelar assembleia:', error);
      toastError('Erro ao cancelar assembleia.');
    } finally {
      setSubmitting(false);
    }
  };

  // Document management
  const loadAssemblyDocuments = async (assemblyId: string) => {
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
  };

  // Load documents when detail modal opens
  useEffect(() => {
    if (showDetailModal && selectedAssembly) {
      loadAssemblyDocuments(selectedAssembly.id);
    }
  }, [showDetailModal, selectedAssembly]);

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
      toastError('Erro ao fazer upload do documento.');
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
      toastError('Erro ao eliminar documento.');
    } finally {
      setDeleteDocumentId(null);
    }
  };

  const handleDocumentDownload = async (id: string, fileName: string) => {
    if (!condominiumId) {
      toastError('Condomínio não selecionado.');
      return;
    }

    try {
      await documentsApi.download(condominiumId, id, fileName);
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toastError('Erro ao fazer download do documento.');
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
    AssemblyMinutes: 'Ata',
    AssemblyConvocation: 'Convocatória',
    AssemblyAttachment: 'Anexo',
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
        toastWarning(`${response.data.success} ficheiro(s) carregado(s) com sucesso! ${response.data.failed} falhou(aram).`);
      } else {
        toastSuccess(`${response.data.success} ficheiro(s) adicionado(s) com sucesso!`);
      }

      // Reload documents if in detail modal
      if (selectedAssembly && selectedAssembly.id === quickUploadAssembly.id) {
        await loadAssemblyDocuments(quickUploadAssembly.id);
      }
    } catch (error) {
      console.error('Erro ao fazer upload dos documentos:', error);
      toastError('Erro ao fazer upload dos documentos.');
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
        toastError(`Ficheiro "${file.name}" demasiado grande. Máximo: 100MB`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Limit to 10 files
    if (validFiles.length > 10) {
      toastError('Máximo de 10 ficheiros por vez.');
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
        title="Eliminar assembleia"
        message="Tem a certeza que deseja eliminar esta assembleia? Esta ação não pode ser revertida."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDeleteAssembly}
        onCancel={() => setDeleteAssemblyId(null)}
      />
      <ConfirmModal
        open={confirmCompleteOpen}
        title="Concluir assembleia"
        message={"Tem a certeza que deseja concluir esta assembleia?\n\nIsso irá:\n• Marcar a assembleia como Concluída\n• Enviar notificações a todos os utilizadores\n• As atas ficarão disponíveis publicamente"}
        confirmLabel="Concluir"
        variant="warning"
        onConfirm={doCompleteAssembly}
        onCancel={() => setConfirmCompleteOpen(false)}
      />
      <ConfirmModal
        open={deleteDocumentId !== null}
        title="Eliminar documento"
        message="Tem a certeza que deseja eliminar este documento?"
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDeleteDocument}
        onCancel={() => setDeleteDocumentId(null)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assembleias</h1>
          <p className="text-gray-500 text-sm mt-0.5">Reuniões e assembleias de condóminos</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-80">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar assembleias..."
            />
          </div>
          {isAdmin && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Assembleia
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <ModalPopup
        open={showForm && isAdmin}
        onClose={() => setShowForm(false)}
        title={editId ? 'Editar Assembleia' : 'Nova Assembleia'}
        maxWidthClass="max-w-2xl"
      >
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Assembleia Geral Ordinária 2026"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Ordem de trabalhos e outras informações relevantes..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Salão comum do condomínio"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium"
              >
                {submitting ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </form>
      </ModalPopup>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Scheduled', 'InProgress', 'Completed', 'Cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === status 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {status === 'All' ? 'Todas' : statusLabels[status] ?? status}
            {status !== 'All' && (
              <span className="ml-1.5 text-xs opacity-75">
                ({assemblies.filter(a => a.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">A carregar...</div>
        ) : filteredAssemblies.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            {statusFilter === 'All' ? 'Sem assembleias agendadas' : `Sem assembleias com estado "${statusLabels[statusFilter] ?? statusFilter}"`}
          </div>
        ) : (
          <>
            {filteredAssemblies.map((a) => {
              const isDragOver = dragOverAssemblyId === a.id;
              const isDisabled = a.status === 'Cancelled';
              
              return (
                <div 
                  key={a.id} 
                  className={`bg-white rounded-xl shadow-sm border p-4 transition-all ${
                    isDragOver && !isDisabled && isAdmin
                      ? 'border-indigo-400 border-2 bg-indigo-50 shadow-lg'
                      : 'border-gray-100'
                  } ${!isDisabled && isAdmin ? 'hover:shadow-md' : ''}`}
                  onDragOver={(e) => handleDragOver(e, a.id, isDisabled)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, a)}
                >
                  {isDragOver && !isDisabled && isAdmin && (
                    <div className="flex items-center justify-center gap-2 mb-3 p-3 bg-indigo-100 border-2 border-dashed border-indigo-400 rounded-lg">
                      <Upload className="w-5 h-5 text-indigo-600" />
                      <span className="text-sm font-medium text-indigo-700">Soltar ficheiro para adicionar à assembleia</span>
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
                          className="font-medium text-gray-900 hover:text-indigo-600 text-left"
                        >
                          {a.title}
                        </button>
                        {a.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{a.description}</p>}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {statusLabels[a.status] ?? a.status}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(a.scheduledAt).toLocaleString('pt-PT')}
                          </span>
                          {a.location && (
                            <span className="text-xs text-gray-400">{a.location}</span>
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
                          title="Adicionar Documentos"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Documentos
                        </button>
                      )}
                      {isAdmin && a.status === 'InProgress' && (
                        <button 
                          onClick={() => openNotes(a)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                          title="Editar Notas"
                        >
                          Notas
                        </button>
                      )}
                      {isAdmin && (a.status === 'InProgress' || a.status === 'Scheduled') && (
                        <button 
                          onClick={() => openMinutes(a)}
                          className="px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 border border-green-200 rounded-lg transition-colors"
                          title="Inserir Atas (marca como concluída)"
                        >
                          Atas
                        </button>
                      )}
                      {isAdmin && a.status !== 'Cancelled' && a.status !== 'Completed' && (
                        <button 
                          onClick={() => openCancel(a)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                          title="Cancelar Assembleia"
                        >
                          Cancelar
                        </button>
                      )}
                      {isAdmin && a.status === 'Scheduled' && (
                        <>
                          <button onClick={() => openEdit(a)} className="text-gray-400 hover:text-indigo-500">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-500">
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
          </>
        )}
      </div>

      {/* Detail Modal */}
      <ModalPopup
        open={showDetailModal && selectedAssembly !== null}
        onClose={() => setShowDetailModal(false)}
        title="Detalhes da Assembleia"
        maxWidthClass="max-w-2xl"
        bodyClassName="space-y-4 p-6"
      >
            {selectedAssembly && (
              <>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Título</label>
                <p className="text-gray-900 mt-1">{selectedAssembly.title}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Descrição</label>
                <p className="text-gray-700 mt-1 whitespace-pre-wrap">{selectedAssembly.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Data e Hora</label>
                  <p className="text-gray-900 mt-1">{new Date(selectedAssembly.scheduledAt).toLocaleString('pt-PT')}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Local</label>
                  <p className="text-gray-900 mt-1">{selectedAssembly.location}</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Estado</label>
                <p className="mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[selectedAssembly.status]}`}>
                    {statusLabels[selectedAssembly.status]}
                  </span>
                </p>
              </div>
              {selectedAssembly.notes && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Notas</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <RichTextDisplay content={selectedAssembly.notes} className="text-sm" />
                  </div>
                </div>
              )}
              {selectedAssembly.minutes && (selectedAssembly.status === 'Completed' || (selectedAssembly.status === 'InProgress' && isAdmin)) && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">
                    Atas {selectedAssembly.status === 'InProgress' && '(Draft em edição)'}
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
                  <label className="text-xs font-medium text-gray-500 uppercase">Motivo do Cancelamento</label>
                  <div className="mt-1 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-gray-700">{selectedAssembly.cancellationReason}</p>
                  </div>
                </div>
              )}

              {/* Documents Section */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-gray-500 uppercase">Documentos Anexados</label>
                  {isAdmin && selectedAssembly.status !== 'Cancelled' && (
                    <button
                      onClick={() => setShowUploadDocument(!showUploadDocument)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors font-medium"
                    >
                      <Upload className="w-3 h-3" />
                      {showUploadDocument ? 'Cancelar' : 'Adicionar Documento'}
                    </button>
                  )}
                </div>

                {/* Upload Form */}
                {showUploadDocument && isAdmin && selectedAssembly.status !== 'Cancelled' && (
                  <form onSubmit={handleUploadDocument} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                    <MultipleFileUpload
                      onFilesSelect={setUploadFiles}
                      currentFiles={uploadFiles}
                      removeFile={(index) => setUploadFiles(prev => prev.filter((_, i) => i !== index))}
                      disabled={uploadingDocument}
                      maxFiles={1}
                    />
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nome do Documento *</label>
                      <input
                        type="text"
                        value={uploadForm.name}
                        onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Ex: Ata da Assembleia"
                        required
                        disabled={uploadingDocument}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
                      <select
                        value={uploadForm.type}
                        onChange={(e) =>
                          setUploadForm({
                            ...uploadForm,
                            type: e.target.value as 'AssemblyMinutes' | 'AssemblyConvocation' | 'AssemblyAttachment',
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                        disabled={uploadingDocument}
                      >
                        <option value="AssemblyMinutes">Ata</option>
                        <option value="AssemblyConvocation">Convocatória</option>
                        <option value="AssemblyAttachment">Anexo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Descrição (opcional)</label>
                      <textarea
                        value={uploadForm.description}
                        onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                        rows={2}
                        placeholder="Adicione notas sobre o documento..."
                        disabled={uploadingDocument}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUploadDocument(false);
                          setUploadFiles([]);
                        }}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={uploadingDocument}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={uploadFiles.length === 0 || uploadingDocument}
                        className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingDocument ? 'A carregar...' : 'Carregar'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Documents List */}
                <div className="space-y-2">
                  {loadingDocuments ? (
                    <div className="text-center py-4 text-sm text-gray-400">A carregar documentos...</div>
                  ) : assemblyDocuments.length === 0 ? (
                    <div className="text-center py-4 text-sm text-gray-400">
                      Nenhum documento anexado
                    </div>
                  ) : (
                    assemblyDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500">
                                {documentTypeLabels[doc.type] || doc.type}
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="text-xs text-gray-500">{formatFileSize(doc.fileSize)}</span>
                              <span className="text-gray-300">•</span>
                              <span className="text-xs text-gray-500">
                                {new Date(doc.uploadedAt).toLocaleDateString('pt-PT')}
                              </span>
                            </div>
                            {doc.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{doc.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleDocumentDownload(doc.id, doc.name)}
                            className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                            title="Descarregar"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                              title="Eliminar"
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
            <div className="border-t border-gray-200 pt-4 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Fechar
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
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Notas da Assembleia
                </h2>
                {notesAutoSaving && (
                  <span className="text-xs text-gray-500 animate-pulse">A guardar...</span>
                )}
                {!notesAutoSaving && notesLastSaved && (
                  <span className="text-xs text-green-600">✓ Guardado</span>
                )}
              </div>
              <button onClick={() => setShowNotesModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" type="button">
                <X className="w-5 h-5 text-gray-500" />
              </button>
          </div>
        }
      >
            {selectedAssembly && isAdmin && (
              <>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-500 mb-3">Utilize este espaço para tirar notas durante a assembleia em curso.</p>
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="Adicione notas sobre a assembleia..."
                height="350px"
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium"
              >
                {submitting ? 'A guardar...' : 'Guardar Notas'}
              </button>
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
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Atas da Assembleia
                </h2>
                {minutesAutoSaving && (
                  <span className="text-xs text-gray-500 animate-pulse">A guardar...</span>
                )}
                {!minutesAutoSaving && minutesLastSaved && (
                  <span className="text-xs text-green-600">✓ Guardado</span>
                )}
              </div>
              <button onClick={() => setShowMinutesModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" type="button">
                <X className="w-5 h-5 text-gray-500" />
              </button>
          </div>
        }
      >
            {selectedAssembly && isAdmin && (
              <>
            <div className="px-6 py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-800">
                  💾 <strong>Auto-save ativo:</strong> As suas alterações são guardadas automaticamente.<br />
                  Clique em <strong>"Guardar Draft"</strong> para salvar manualmente ou <strong>"Concluir Assembleia"</strong> quando terminar.
                </p>
              </div>
              <RichTextEditor
                value={minutes}
                onChange={setMinutes}
                placeholder="Insira as atas da assembleia..."
                height="350px"
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between gap-3">
              <button
                onClick={() => setShowMinutesModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Fechar
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveDraftMinutes}
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium"
                >
                  {submitting ? 'A guardar...' : 'Guardar Draft'}
                </button>
                <button
                  onClick={handleCompleteAssembly}
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium"
                >
                  Concluir Assembleia
                </button>
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
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-600" />
                Cancelar Assembleia
              </h2>
              <button onClick={() => setShowCancelModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" type="button">
                <X className="w-5 h-5 text-gray-500" />
              </button>
          </div>
        }
      >
            {selectedAssembly && isAdmin && (
              <>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 mb-3">
                Por favor indique o motivo do cancelamento desta assembleia.
              </p>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                placeholder="Motivo do cancelamento..."
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Voltar
              </button>
              <button
                onClick={handleCancel}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium"
              >
                {submitting ? 'A cancelar...' : 'Cancelar Assembleia'}
              </button>
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
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  Adicionar Documento
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {quickUploadAssembly?.title ?? ''}
                </p>
              </div>
              <button 
                onClick={() => setShowQuickUploadModal(false)} 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                type="button"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
          </div>
        }
      >
            {quickUploadAssembly && isAdmin && (
              <>

            <form onSubmit={handleQuickUpload} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arquivos (máx. 10 ficheiros)
                </label>
                <MultipleFileUpload
                  onFilesSelect={setUploadFiles}
                  currentFiles={uploadFiles}
                  removeFile={(index) => setUploadFiles(prev => prev.filter((_, i) => i !== index))}
                  disabled={uploadingDocument}
                  maxFiles={10}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Os tipos de documento serão detetados automaticamente com base nos nomes dos ficheiros.
                  Use palavras-chave como "ata", "convocatoria" ou "anexo" nos nomes.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowQuickUploadModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={uploadingDocument}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploadFiles.length === 0 || uploadingDocument}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploadingDocument ? (
                    <>A carregar...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Carregar {uploadFiles.length > 0 ? `${uploadFiles.length} Documento${uploadFiles.length > 1 ? 's' : ''}` : 'Documentos'}
                    </>
                  )}
                </button>
              </div>
            </form>
              </>
            )}
      </ModalPopup>
    </div>
  );
}
