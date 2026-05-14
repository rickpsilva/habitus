import { useEffect, useState, useCallback } from 'react';
import { Plus, Wrench, AlertCircle, Clock, CheckCircle2, Phone, Mail, MapPin, Building, FileText, Upload, Download, Trash2 } from 'lucide-react';
import { maintenanceApi, usersApi, suppliersApi, documentsApi } from '../api/services';
import FileUpload from '../components/FileUpload';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import type { MaintenanceRequestDto, CreateMaintenanceRequest, SupplierDto, PaginatedResponse, DocumentDto } from '../types';

const statusMap: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  Open: { label: 'Aberto', className: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  InProgress: { label: 'Em curso', className: 'bg-blue-100 text-blue-700', icon: Clock },
  Completed: { label: 'Concluído', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
};

const priorityMap: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-600',
  Medium: 'bg-yellow-100 text-yellow-700',
  High: 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
};

const priorityLabels: Record<string, string> = {
  Low: 'Baixa',
  Medium: 'Média',
  High: 'Alta',
  Critical: 'Crítica',
};

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
  const { isAdmin, condominiumId, unitId } = useAuth();
  const { success, error: toastError, warning } = useToast();
  const [requests, setRequests] = useState<MaintenanceRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('Open');
  const [currentPage, setCurrentPage] = useState(1);
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
  const [statusForm, setStatusForm] = useState({
    status: '',
    supplierId: '',
    adminComments: '',
    hasExpense: false,
    expenseAmount: '',
    invoiceDocumentId: '',
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
      suppliersApi.getAll().then((r) => {
        const filtered = r.data.filter(s => s.condominiumId === condominiumId && s.isActive);
        setSuppliers(filtered);
      }).catch(console.error);
    }
  }, [condominiumId]);

  const load = useCallback(() => {
    setLoading(true);
    maintenanceApi.getAll()
      .then((r) => {
        const scopedItems = condominiumId
          ? r.data
            .filter((item) => item.condominiumId === condominiumId)
            .map((item) => ({ ...item, status: normalizeMaintenanceStatus(item.status) }))
          : [];
        setRequests(scopedItems);
      })
      .finally(() => setLoading(false));
  }, [condominiumId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setCurrentPage(1); }, [filter, debouncedSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.condominiumId || !form.unitId || !form.createdBy) {
      toastError('O utlizador necessita de estar associado a uma fração para registo de manutenção.');
      return;
    }
    
    setSubmitting(true);
    try {
      await maintenanceApi.create(form);
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
      success('Pedido de manutenção criado com sucesso.');
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      toastError('Erro ao criar pedido de manutenção. Tente novamente.');
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
    });
    setMaintenanceDocuments([]);
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    const nextStatus = normalizeMaintenanceStatus(statusForm.status);

    if (isCompletedStatus(nextStatus)) {
      if (!statusForm.expenseAmount || parseFloat(statusForm.expenseAmount) <= 0) {
        warning('Por favor, indique o valor da despesa para registar como concluída.');
        return;
      }
    }

    if (!isCompletedStatus(nextStatus) && statusForm.hasExpense) {
      if (!statusForm.expenseAmount || parseFloat(statusForm.expenseAmount) <= 0) {
        warning('Por favor, indique o valor da despesa.');
        return;
      }
      if (!statusForm.invoiceDocumentId) {
        warning('Por favor, anexe a fatura.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await maintenanceApi.updateStatus(selectedRequest.id, {
        status: nextStatus,
        supplierId: statusForm.supplierId || undefined,
        adminComments: statusForm.adminComments || undefined,
        hasExpense: isCompletedStatus(nextStatus) ? true : statusForm.hasExpense,
        expenseAmount: (isCompletedStatus(nextStatus) || statusForm.hasExpense) && statusForm.expenseAmount ? parseFloat(statusForm.expenseAmount) : undefined,
        invoiceDocumentId: (isCompletedStatus(nextStatus) || statusForm.hasExpense) && statusForm.invoiceDocumentId ? statusForm.invoiceDocumentId : undefined,
      });
      handleCloseStatusPanel();
      load();
      success('Estado da manutenção atualizado.');
    } catch (error) {
      console.error('Erro ao atualizar estado:', error);
      toastError('Erro ao atualizar estado da manutenção. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Document management functions
  const loadMaintenanceDocuments = async (maintenanceRequestId: string) => {
    try {
      const response = await documentsApi.getPaged(1, 100, '', 'Maintenance');
      const docs = response.data.items.filter(doc => doc.maintenanceRequestId === maintenanceRequestId);
      setMaintenanceDocuments(docs);
    } catch (err) {
      console.error('Failed to load maintenance documents:', err);
    }
  };

  const handleDocUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !selectedRequest) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', uploadForm.name);
      formData.append('type', uploadForm.type);
      formData.append('context', 'Maintenance');
      formData.append('description', uploadForm.description);
      formData.append('maintenanceRequestId', selectedRequest.id);

      await documentsApi.upload(formData);
      setShowDocUploadModal(false);
      setUploadFile(null);
      setUploadForm({ name: '', type: 'MaintenanceInvoice', description: '' });
      loadMaintenanceDocuments(selectedRequest.id);
      success('Documento carregado com sucesso.');
    } catch (err) {
      toastError('Erro ao carregar documento. Tente novamente.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDocDelete = async (id: string) => {
    setDeleteDocId(id);
  };

  const confirmDocDelete = async () => {
    if (!deleteDocId || !selectedRequest) return;
    try {
      await documentsApi.delete(deleteDocId);
      loadMaintenanceDocuments(selectedRequest.id);
      success('Documento eliminado.');
    } catch (err) {
      toastError('Erro ao eliminar documento. Tente novamente.');
      console.error(err);
    } finally {
      setDeleteDocId(null);
    }
  };

  const handleDocDownload = async (id: string, fileName: string) => {
    try {
      await documentsApi.download(id, fileName);
    } catch (error) {
      toastError('Erro ao descarregar o documento. Tente novamente.');
      console.error(error);
    }
  };

  const searchTerm = debouncedSearch.trim().toLowerCase();
  const statusCounts = requests.reduce<Record<'Open' | 'InProgress' | 'Completed', number>>((acc, request) => {
    const normalizedStatus = normalizeMaintenanceStatus(request.status) as 'Open' | 'InProgress' | 'Completed';
    acc[normalizedStatus] += 1;
    return acc;
  }, { Open: 0, InProgress: 0, Completed: 0 });

  const filtered = requests.filter((request) => {
    const matchesFilter = filter === 'All' || normalizeMaintenanceStatus(request.status) === filter;
    if (!matchesFilter) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    return [request.title, request.description, request.location]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(searchTerm));
  });

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRequests = filtered.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
  const pagination: PaginatedResponse<MaintenanceRequestDto> = {
    items: paginatedRequests,
    page: safeCurrentPage,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: safeCurrentPage > 1,
    hasNextPage: safeCurrentPage < totalPages,
  };

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={deleteDocId !== null}
        title="Eliminar documento"
        message="Tem a certeza que deseja eliminar este documento? Esta ação não pode ser revertida."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDocDelete}
        onCancel={() => setDeleteDocId(null)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manutenção</h1>
          <p className="text-gray-500 text-sm mt-0.5">Pedidos de manutenção do condomínio</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-80">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar pedidos..."
            />
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Pedido
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { key: 'Open', label: 'Aberto', count: statusCounts.Open, className: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
          { key: 'InProgress', label: 'Em curso', count: statusCounts.InProgress, className: 'border-blue-200 bg-blue-50 text-blue-800' },
          { key: 'Completed', label: 'Concluído', count: statusCounts.Completed, className: 'border-green-200 bg-green-50 text-green-800' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
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
        title="Novo Pedido de Manutenção"
        maxWidthClass="max-w-lg"
      >
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Torneira avariada na cozinha"
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
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localização</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Fração 3A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.keys(priorityLabels).map((p) => (
                  <option key={p} value={p}>{priorityLabels[p]}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
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
        {['All', 'Open', 'InProgress', 'Completed'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s === 'All' ? `Todos (${requests.length})` : `${statusMap[s]?.label ?? s} (${statusCounts[s as 'Open' | 'InProgress' | 'Completed']})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">A carregar...</div>
        ) : paginatedRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Sem pedidos de manutenção
          </div>
        ) : (
          <>
            {paginatedRequests.map((m) => {
              const { label, className, icon: Icon } = statusMap[m.status] ?? statusMap['Open'];
              return (
                <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <Icon className="w-5 h-5 mt-0.5 shrink-0 text-gray-400" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{m.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{m.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>{label}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityMap[m.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                            {priorityLabels[m.priority] ?? m.priority}
                          </span>
                          {m.location && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{m.location}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isAdmin && !isCompletedStatus(m.status) ? (
                      <button
                        onClick={() => handleOpenStatusPanel(m)}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
                      >
                        Gerir Estado
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenStatusPanel(m)}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
                      >
                        Ver Detalhes
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Criado em: {new Date(m.createdAt).toLocaleDateString('pt-PT')}
                  </p>
                </div>
              );
            })}
            
            {pagination && (
              <Pagination
                pagination={pagination}
                currentPage={safeCurrentPage}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}
      </div>

      {/* Status Management Modal */}
      <ModalPopup
        open={showStatusPanel && selectedRequest !== null}
        onClose={handleCloseStatusPanel}
        title={isAdmin && selectedRequest && !isCompletedStatus(selectedRequest.status) ? 'Gerir Estado da Manutenção' : 'Detalhes da Manutenção'}
        maxWidthClass="max-w-3xl"
        bodyClassName="max-h-[75vh] overflow-y-auto px-6 py-4 space-y-5"
      >
        {selectedRequest && (
          <>
              {/* Request Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-900">{selectedRequest.title}</p>
                <p className="text-sm text-gray-500 mt-1">{selectedRequest.description}</p>
                {selectedRequest.location && (
                  <p className="text-xs text-gray-400 mt-2">{selectedRequest.location}</p>
                )}
              </div>

              {/* Form */}
              {isAdmin && !isCompletedStatus(selectedRequest.status) ? (
                <form onSubmit={handleStatusUpdate} className="space-y-4">
                  {/* Status Select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                    <select
                      value={statusForm.status}
                      onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {getAvailableStatusOptions(selectedRequest.status).map((value) => (
                        <option key={value} value={value}>{statusMap[value]?.label ?? value}</option>
                      ))}
                    </select>
                  </div>

                  {/* Supplier Select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fornecedor <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <select
                      value={statusForm.supplierId}
                      onChange={(e) => setStatusForm({ ...statusForm, supplierId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Sem fornecedor</option>
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
                          <p className="text-xs font-medium text-blue-900 mb-2">Informações de Contato</p>
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
                          {selectedSupplier.contact && (
                            <div className="flex items-center gap-2 text-sm text-blue-700">
                              <Building className="w-4 h-4" />
                              <span>{selectedSupplier.contact}</span>
                            </div>
                          )}
                        </div>
                      ) : null;
                    })()
                  )}

                  {/* Admin Comments */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Comentário <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <textarea
                      value={statusForm.adminComments}
                      onChange={(e) => setStatusForm({ ...statusForm, adminComments: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder="Adicione um comentário sobre esta atualização..."
                    />
                  </div>

                  {isCompletedStatus(statusForm.status) && (
                    <div className="border-t border-gray-200 pt-4 space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Custo da Manutenção <span className="text-red-500">*</span>
                        </p>
                        <p className="text-xs text-gray-500 mb-3">
                          O custo é obrigatório para registar a manutenção como concluída.
                        </p>
                      </div>

                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                        {/* Expense Amount */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Valor da Despesa <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={statusForm.expenseAmount}
                              onChange={(e) => setStatusForm({ ...statusForm, expenseAmount: e.target.value })}
                              required
                              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {/* Invoice Document */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fatura <span className="text-gray-400 font-normal">(opcional)</span>
                          </label>
                          <select
                            value={statusForm.invoiceDocumentId}
                            onChange={(e) => setStatusForm({ ...statusForm, invoiceDocumentId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Selecione a fatura (opcional)</option>
                            {maintenanceDocuments
                              .filter(doc => doc.type === 'MaintenanceInvoice')
                              .map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                  {doc.name} ({new Date(doc.uploadedAt).toLocaleDateString('pt-PT')})
                                </option>
                              ))}
                          </select>
                          {maintenanceDocuments.filter(doc => doc.type === 'MaintenanceInvoice').length === 0 && (
                            <p className="mt-1 text-xs text-gray-500">
                              Pode adicionar uma fatura na secção de documentos abaixo.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Comment History */}
                  {selectedRequest.adminComments && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Histórico de Comentários</label>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">{selectedRequest.adminComments}</pre>
                      </div>
                    </div>
                  )}

                  {/* Documents Section */}
                  {!isCompletedStatus(selectedRequest.status) && (
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700">Documentos</label>
                        <button
                          type="button"
                          onClick={() => setShowDocUploadModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Adicionar
                        </button>
                      </div>

                      {maintenanceDocuments.length === 0 ? (
                        <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-xs">Nenhum documento anexado</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {maintenanceDocuments.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                                  <p className="text-xs text-gray-400">
                                    {new Date(doc.uploadedAt).toLocaleDateString('pt-PT')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleDocDownload(doc.id, doc.name)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Baixar"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDocDelete(doc.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Excluir"
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
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleCloseStatusPanel}
                      className="flex-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {submitting ? 'A guardar...' : 'Guardar Alterações'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {/* Read-only Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900">
                      {statusMap[selectedRequest.status as keyof typeof statusMap]?.label || selectedRequest.status}
                    </div>
                  </div>

                  {/* Read-only Supplier */}
                  {selectedRequest.supplierId && (
                    (() => {
                      const supplier = suppliers.find(s => s.id === selectedRequest.supplierId);
                      return supplier ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                          <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900">
                            {supplier.name} - {supplier.specialty}
                          </div>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2 mt-2">
                            <p className="text-xs font-medium text-blue-900 mb-2">Informações de Contato</p>
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
                            {supplier.contact && (
                              <div className="flex items-center gap-2 text-sm text-blue-700">
                                <Building className="w-4 h-4" />
                                <span>{supplier.contact}</span>
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">Comentários</label>
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">{selectedRequest.adminComments}</pre>
                      </div>
                    </div>
                  )}

                  {/* Read-only Documents */}
                  <div className="border-t border-gray-200 pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Documentos</label>
                    {maintenanceDocuments.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">Nenhum documento anexado</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {maintenanceDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                                <p className="text-xs text-gray-400">
                                  {new Date(doc.uploadedAt).toLocaleDateString('pt-PT')}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDocDownload(doc.id, doc.name)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                              title="Baixar"
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
                      className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Fechar
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
        title="Adicionar Documento"
        maxWidthClass="max-w-lg"
      >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-sm text-gray-500">Orçamento, fatura ou outro documento</p>
            </div>

            <form onSubmit={handleDocUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Documento *
                </label>
                <select
                  required
                  value={uploadForm.type}
                  onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MaintenanceInvoice">Fatura</option>
                  <option value="MaintenanceQuote">Orçamento</option>
                  <option value="MaintenanceReport">Relatório</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Documento *
                </label>
                <input
                  type="text"
                  required
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  placeholder="Ex: Fatura de Reparação"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição (opcional)
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Detalhes sobre este documento..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <FileUpload
                onFileSelect={setUploadFile}
                currentFile={uploadFile}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDocUploadModal(false);
                    setUploadFile(null);
                    setUploadForm({ name: '', type: 'MaintenanceInvoice', description: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'A carregar...' : 'Adicionar'}
                </button>
              </div>
            </form>
      </ModalPopup>
    </div>
  );
}
