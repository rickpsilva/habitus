import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Download, Trash2, Plus, Upload as UploadIcon, ChevronDown, ChevronRight, Calendar, Home, Wrench } from 'lucide-react';
import { documentsApi, assembliesApi, unitsApi, maintenanceApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import FileUpload from '../components/FileUpload';
import { PageHeader, Button, ErrorState, Card, EmptyState, Skeleton } from '../components/ui';
import type { DocumentDto, PaginatedResponse, AssemblyDto, UnitDto, MaintenanceRequestDto } from '../types';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';

const getContextLabels = (t: TranslateFn): Record<string, string> => ({
  Condominium: t('documents.context.condominium'),
  Unit: t('documents.context.unit'),
  Assembly: t('documents.context.assembly'),
  Maintenance: t('documents.context.maintenance'),
  Financial: t('documents.context.financial'),
});

const getTypeLabels = (t: TranslateFn): Record<string, string> => ({
  UnitInsurance: t('documents.type.unitInsurance'),
  UnitOwnershipProof: t('documents.type.unitOwnershipProof'),
  UnitOther: t('documents.type.unitOther'),
  AssemblyMinutes: t('documents.type.assemblyMinutes'),
  AssemblyConvocation: t('documents.type.assemblyConvocation'),
  AssemblyAttachment: t('documents.type.assemblyAttachment'),
  MaintenanceInvoice: t('documents.type.maintenanceInvoice'),
  MaintenanceQuote: t('documents.type.maintenanceQuote'),
  MaintenanceReport: t('documents.type.maintenanceReport'),
  FinancialBankStatement: t('documents.type.financialBankStatement'),
  FinancialAnnualReport: t('documents.type.financialAnnualReport'),
  FinancialBudget: t('documents.type.financialBudget'),
  FinancialAudit: t('documents.type.financialAudit'),
  FinancialTaxDocument: t('documents.type.financialTaxDocument'),
  FinancialOther: t('documents.type.financialOther'),
  CondominiumRegulation: t('documents.type.condominiumRegulation'),
  CondominiumInsurance: t('documents.type.condominiumInsurance'),
  CondominiumContract: t('documents.type.condominiumContract'),
  Other: t('documents.type.other'),
});

const typeColors: Record<string, string> = {
  UnitInsurance: 'bg-blue-100 text-blue-700',
  UnitOwnershipProof: 'bg-purple-100 text-purple-700',
  UnitOther: 'bg-control text-ink-muted',
  AssemblyMinutes: 'bg-indigo-100 text-indigo-700',
  AssemblyConvocation: 'bg-violet-100 text-violet-700',
  AssemblyAttachment: 'bg-purple-100 text-purple-700',
  MaintenanceInvoice: 'bg-green-100 text-green-700',
  MaintenanceQuote: 'bg-yellow-100 text-yellow-700',
  MaintenanceReport: 'bg-orange-100 text-orange-700',
  FinancialBankStatement: 'bg-emerald-100 text-emerald-700',
  FinancialAnnualReport: 'bg-teal-100 text-teal-700',
  FinancialBudget: 'bg-cyan-100 text-cyan-700',
  FinancialAudit: 'bg-sky-100 text-sky-700',
  FinancialTaxDocument: 'bg-blue-100 text-blue-700',
  FinancialOther: 'bg-control text-ink-muted',
  CondominiumRegulation: 'bg-blue-100 text-blue-700',
  CondominiumInsurance: 'bg-cyan-100 text-cyan-700',
  CondominiumContract: 'bg-teal-100 text-teal-700',
  Other: 'bg-control text-ink-muted',
};

const documentTypesByContext: Record<string, string[]> = {
  Condominium: ['CondominiumRegulation', 'CondominiumInsurance', 'CondominiumContract', 'Other'],
  Unit: ['UnitInsurance', 'UnitOwnershipProof', 'UnitOther'],
  Assembly: ['AssemblyMinutes', 'AssemblyConvocation', 'AssemblyAttachment'],
  Maintenance: ['MaintenanceInvoice', 'MaintenanceQuote', 'MaintenanceReport'],
  Financial: ['FinancialBankStatement', 'FinancialAnnualReport', 'FinancialBudget', 'FinancialAudit', 'FinancialTaxDocument', 'FinancialOther'],
};

export default function DocumentsPage() {
  const { isAdmin, condominiumId } = useAuth();
  const { error: toastError } = useToast();
  const { t, formatDate } = useTranslation();
  const contextLabels = getContextLabels(t);
  const typeLabels = getTypeLabels(t);
  const [searchParams] = useSearchParams();
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assemblies, setAssemblies] = useState<AssemblyDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequestDto[]>([]);
  const [expandedAssemblies, setExpandedAssemblies] = useState<Set<string>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedMaintenance, setExpandedMaintenance] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<DocumentDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'Condominium');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    type: '',
    description: '',
    unitId: '',
    assemblyId: '',
    maintenanceRequestId: '',
    year: new Date().getFullYear().toString(),
  });
  const [uploading, setUploading] = useState(false);
  const pageSize = 10;

  const load = useCallback((page: number = 1) => {
    if (!condominiumId) {
      setDocuments([]);
      setPagination(null);
      setLoadError(t('documents.error.noCondominium'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    documentsApi.getPaged(condominiumId, page, pageSize, debouncedSearch, activeTab)
      .then((r) => {
        setPagination(r.data);
        setDocuments(r.data.items);
        setCurrentPage(page);
      })
      .catch(() => {
        setLoadError(t('documents.error.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [activeTab, condominiumId, debouncedSearch, pageSize, t]);

  const loadAssemblies = useCallback(() => {
    if (!condominiumId) {
      setAssemblies([]);
      return;
    }

    assembliesApi.getPaged(condominiumId, 1, 100)
      .then((r) => setAssemblies(r.data.items))
      .catch(() => setAssemblies([]));
  }, [condominiumId]);

  const loadUnits = useCallback(() => {
    if (!condominiumId) {
      setUnits([]);
      return;
    }

    unitsApi.getPaged(condominiumId, 1, 100)
      .then((r) => setUnits(r.data.items))
      .catch(() => setUnits([]));
  }, [condominiumId]);

  const loadMaintenanceRequests = useCallback(() => {
    if (!condominiumId) {
      setMaintenanceRequests([]);
      return;
    }

    maintenanceApi.getPaged(condominiumId, 1, 100)
      .then((r) => setMaintenanceRequests(r.data.items))
      .catch(() => setMaintenanceRequests([]));
  }, [condominiumId]);

  useEffect(() => {
    load(1);
    if (activeTab === 'Assembly') loadAssemblies();
    else if (activeTab === 'Unit') loadUnits();
    else if (activeTab === 'Maintenance') loadMaintenanceRequests();
  }, [load, activeTab, loadAssemblies, loadUnits, loadMaintenanceRequests]);

  const handleDelete = async (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId || !condominiumId) return;
    try {
      await documentsApi.delete(condominiumId, deleteId);
      load();
    } catch {
      toastError(t('documents.error.deleteFailed'));
    } finally {
      setDeleteId(null);
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    if (!condominiumId) {
      toastError(t('documents.error.noCondominiumSelected'));
      return;
    }

    try {
      await documentsApi.download(condominiumId, id, fileName);
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toastError(t('documents.error.downloadFailed'));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !condominiumId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', uploadForm.name);
      formData.append('type', uploadForm.type);
      formData.append('context', activeTab);
      
      if (uploadForm.description) {
        formData.append('description', uploadForm.description);
      }

      // Add context-specific IDs
      if (activeTab === 'Unit' && uploadForm.unitId) {
        formData.append('unitId', uploadForm.unitId);
      }
      if (activeTab === 'Assembly' && uploadForm.assemblyId) {
        formData.append('assemblyId', uploadForm.assemblyId);
      }
      if (activeTab === 'Maintenance' && uploadForm.maintenanceRequestId) {
        formData.append('maintenanceRequestId', uploadForm.maintenanceRequestId);
      }
      if (activeTab === 'Financial' && uploadForm.year) {
        formData.append('year', uploadForm.year);
      }

      await documentsApi.upload(condominiumId, formData);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadForm({
        name: '',
        type: '',
        description: '',
        unitId: '',
        assemblyId: '',
        maintenanceRequestId: '',
        year: new Date().getFullYear().toString(),
      });
      load();
    } catch {
      toastError(t('documents.error.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const openUploadModal = () => {
    setUploadForm({
      name: '',
      type: documentTypesByContext[activeTab][0],
      description: '',
      unitId: '',
      assemblyId: '',
      maintenanceRequestId: '',
      year: new Date().getFullYear().toString(),
    });
    setUploadFile(null);
    setShowUploadModal(true);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const toggleAssembly = (assemblyId: string) => {
    setExpandedAssemblies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assemblyId)) {
        newSet.delete(assemblyId);
      } else {
        newSet.add(assemblyId);
      }
      return newSet;
    });
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(unitId)) {
        newSet.delete(unitId);
      } else {
        newSet.add(unitId);
      }
      return newSet;
    });
  };

  const toggleMaintenance = (maintenanceId: string) => {
    setExpandedMaintenance(prev => {
      const newSet = new Set(prev);
      if (newSet.has(maintenanceId)) {
        newSet.delete(maintenanceId);
      } else {
        newSet.add(maintenanceId);
      }
      return newSet;
    });
  };

  const toggleYear = (year: number) => {
    setExpandedYears(prev => {
      const newSet = new Set(prev);
      if (newSet.has(year)) {
        newSet.delete(year);
      } else {
        newSet.add(year);
      }
      return newSet;
    });
  };

  const getDocumentsByAssembly = () => {
    const grouped = new Map<string, DocumentDto[]>();
    documents.forEach(doc => {
      if (doc.assemblyId) {
        if (!grouped.has(doc.assemblyId)) {
          grouped.set(doc.assemblyId, []);
        }
        grouped.get(doc.assemblyId)!.push(doc);
      }
    });
    return grouped;
  };

  const getDocumentsByUnit = () => {
    const grouped = new Map<string, DocumentDto[]>();
    documents.forEach(doc => {
      if (doc.unitId) {
        if (!grouped.has(doc.unitId)) {
          grouped.set(doc.unitId, []);
        }
        grouped.get(doc.unitId)!.push(doc);
      }
    });
    return grouped;
  };

  const getDocumentsByMaintenance = () => {
    const grouped = new Map<string, DocumentDto[]>();
    documents.forEach(doc => {
      if (doc.maintenanceRequestId) {
        if (!grouped.has(doc.maintenanceRequestId)) {
          grouped.set(doc.maintenanceRequestId, []);
        }
        grouped.get(doc.maintenanceRequestId)!.push(doc);
      }
    });
    return grouped;
  };

  const getDocumentsByYear = () => {
    const grouped = new Map<number, DocumentDto[]>();
    documents.forEach(doc => {
      if (doc.year) {
        if (!grouped.has(doc.year)) {
          grouped.set(doc.year, []);
        }
        grouped.get(doc.year)!.push(doc);
      }
    });
    return grouped;
  };

  const getAssemblyInfo = (assemblyId: string) => {
    return assemblies.find(a => a.id === assemblyId);
  };

  const getUnitInfo = (unitId: string) => {
    return units.find(u => u.id === unitId);
  };

  const getMaintenanceInfo = (maintenanceId: string) => {
    return maintenanceRequests.find(m => m.id === maintenanceId);
  };

  const getMaintenanceStatusColor = (status: string) => {
    const normalizedStatus = status === 'Resolved' || status === 'Closed' ? 'Completed' : status;
    const colors: Record<string, string> = {
      Open: 'bg-yellow-100 text-yellow-700',
      InProgress: 'bg-blue-100 text-blue-700',
      Completed: 'bg-green-100 text-green-700',
    };
    return colors[normalizedStatus] || 'bg-control text-ink-muted';
  };

  const getMaintenanceStatusLabel = (status: string) => {
    const normalizedStatus = status === 'Resolved' || status === 'Closed' ? 'Completed' : status;
    const labels: Record<string, string> = {
      Open: t('status.open'),
      InProgress: t('documents.status.inProgress'),
      Completed: t('status.completed'),
    };
    return labels[normalizedStatus] || normalizedStatus;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Scheduled: 'bg-blue-100 text-blue-700',
      InProgress: 'bg-yellow-100 text-yellow-700',
      Completed: 'bg-green-100 text-green-700',
      Cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-control text-ink-muted';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      Scheduled: t('documents.status.scheduled'),
      InProgress: t('documents.status.inProgress'),
      Completed: t('documents.status.completed'),
      Cancelled: t('documents.status.cancelled'),
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={deleteId !== null}
        title={t('documents.deleteModal.title')}
        message={t('documents.deleteModal.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      <PageHeader
        title={t('documents.title')}
        subtitle={t('documents.subtitle')}
        search={
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('documents.searchPlaceholder')}
          />
        }
        actions={
          isAdmin && (
            <Button onClick={openUploadModal} icon={Plus} fullWidth className="sm:w-auto">
              {t('documents.newDocument')}
            </Button>
          )
        }
      />

      {/* Tabs */}
      <div className="border-b border-line">
        <div className="flex gap-1 overflow-x-auto app-scrollbar pb-1">
          {Object.entries(contextLabels)
            .filter(([key]) => isAdmin || key !== 'Unit') // Hide Unit tab for non-admin users
            .map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-ink-subtle hover:text-ink-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid - Special views for Assembly, Unit, Maintenance, and Financial tabs */}
      {activeTab === 'Assembly' || activeTab === 'Unit' || activeTab === 'Maintenance' || activeTab === 'Financial' ? (
        <div className="space-y-3">
          {loading ? (
            <Skeleton variant="list" rows={4} />
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={() => load(currentPage)} />
          ) : documents.length === 0 ? (
            <EmptyState icon={FileText} title={searchQuery ? t('documents.empty.noResults') : t('documents.empty.assembly')} />
          ) : activeTab === 'Assembly' ? (
            (() => {
              const groupedDocs = getDocumentsByAssembly();
              const assemblyIds = Array.from(groupedDocs.keys());
              
              return assemblyIds.length === 0 ? (
                <EmptyState icon={FileText} title={t('documents.empty.assembly')} />
              ) : (
                assemblyIds.map(assemblyId => {
                  const assemblyDocs = groupedDocs.get(assemblyId) || [];
                  const assembly = getAssemblyInfo(assemblyId);
                  const isExpanded = expandedAssemblies.has(assemblyId);
                  
                  return (
                    <Card key={assemblyId} className="overflow-hidden">
                      {/* Assembly Header */}
                      <button
                        onClick={() => toggleAssembly(assemblyId)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-hover transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-ink-subtle" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-ink-subtle" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-ink">
                                {assembly?.title || t('documents.assemblyFallback', { id: assemblyId.substring(0, 8) })}
                              </h3>
                              {assembly && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(assembly.status)}`}>
                                  {getStatusLabel(assembly.status)}
                                </span>
                              )}
                            </div>
                            {assembly && (
                              <div className="flex items-center gap-2 mt-1 text-xs text-ink-subtle">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{formatDate(assembly.scheduledAt, { 
                                  day: 'numeric', 
                                  month: 'long', 
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}</span>
                              </div>
                            )}
                          </div>
                          <div className="shrink-0">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 text-xs font-semibold">
                              {assemblyDocs.length}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Documents List */}
                      {isExpanded && (
                        <div className="border-t border-line bg-surface-muted">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                            {assemblyDocs.map((d) => (
                              <div key={d.id} className="bg-surface rounded-lg shadow-sm border border-line p-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 shrink-0">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-ink truncate" title={d.name}>{d.name}</p>
                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${typeColors[d.type] ?? 'bg-control text-ink-muted'}`}>
                                      {typeLabels[d.type] ?? d.type}
                                    </span>
                                    {d.description && (
                                      <p className="text-xs text-ink-subtle mt-1 line-clamp-1">{d.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-xs text-ink-subtle">
                                        {formatDate(d.uploadedAt)}
                                      </p>
                                      <span className="text-ink-subtle">•</span>
                                      <p className="text-xs text-ink-subtle">{formatFileSize(d.fileSize)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <button
                                    onClick={() => handleDownload(d.id, d.name)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                  >
                                    <Download className="w-3 h-3" />
                                    {t('documents.download')}
                                  </button>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDelete(d.id)}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      {t('common.delete')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })
              );
            })()
          ) : activeTab === 'Unit' ? (
            (() => {
              const groupedDocs = getDocumentsByUnit();
              const unitIds = Array.from(groupedDocs.keys());
              
              return unitIds.length === 0 ? (
                <EmptyState icon={FileText} title={t('documents.empty.unit')} />
              ) : (
                unitIds.map(unitId => {
                  const unitDocs = groupedDocs.get(unitId) || [];
                  const unit = getUnitInfo(unitId);
                  const isExpanded = expandedUnits.has(unitId);
                  
                  return (
                    <Card key={unitId} className="overflow-hidden">
                      {/* Unit Header */}
                      <button
                        onClick={() => toggleUnit(unitId)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-hover transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-ink-subtle" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-ink-subtle" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Home className="w-4 h-4 text-ink-muted" />
                              <h3 className="font-semibold text-ink">
                                {unit ? t('common.fraction', { number: unit.number }) : t('common.fraction', { number: unitId.substring(0, 8) })}
                              </h3>
                              {unit && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-control text-ink-muted">
                                  {t('documents.floor', { floor: unit.floor })}
                                </span>
                              )}
                              {unit?.apartmentNumber && (
                                <span className="text-xs text-ink-subtle">
                                  • {t('documents.apartment', { number: unit.apartmentNumber })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold">
                              {unitDocs.length}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Documents List */}
                      {isExpanded && (
                        <div className="border-t border-line bg-surface-muted">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                            {unitDocs.map((d) => (
                              <div key={d.id} className="bg-surface rounded-lg shadow-sm border border-line p-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 shrink-0">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-ink truncate" title={d.name}>{d.name}</p>
                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${typeColors[d.type] ?? 'bg-control text-ink-muted'}`}>
                                      {typeLabels[d.type] ?? d.type}
                                    </span>
                                    {d.description && (
                                      <p className="text-xs text-ink-subtle mt-1 line-clamp-1">{d.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-xs text-ink-subtle">
                                        {formatDate(d.uploadedAt)}
                                      </p>
                                      <span className="text-ink-subtle">•</span>
                                      <p className="text-xs text-ink-subtle">{formatFileSize(d.fileSize)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <button
                                    onClick={() => handleDownload(d.id, d.name)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                  >
                                    <Download className="w-3 h-3" />
                                    {t('documents.download')}
                                  </button>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDelete(d.id)}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      {t('common.delete')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })
              );
            })()
          ) : activeTab === 'Maintenance' ? (
            (() => {
              const groupedDocs = getDocumentsByMaintenance();
              const maintenanceIds = Array.from(groupedDocs.keys());
              
              return maintenanceIds.length === 0 ? (
                <EmptyState icon={FileText} title={t('documents.empty.maintenance')} />
              ) : (
                maintenanceIds.map(maintenanceId => {
                  const maintenanceDocs = groupedDocs.get(maintenanceId) || [];
                  const maintenance = getMaintenanceInfo(maintenanceId);
                  const isExpanded = expandedMaintenance.has(maintenanceId);
                  
                  return (
                    <Card key={maintenanceId} className="overflow-hidden">
                      {/* Maintenance Header */}
                      <button
                        onClick={() => toggleMaintenance(maintenanceId)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-hover transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-ink-subtle" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-ink-subtle" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Wrench className="w-4 h-4 text-ink-muted" />
                              <h3 className="font-semibold text-ink">
                                {maintenance?.title || t('documents.maintenanceFallback', { id: maintenanceId.substring(0, 8) })}
                              </h3>
                              {maintenance && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getMaintenanceStatusColor(maintenance.status)}`}>
                                  {getMaintenanceStatusLabel(maintenance.status)}
                                </span>
                              )}
                            </div>
                            {maintenance?.description && (
                              <div className="flex items-center gap-2 mt-1 text-xs text-ink-subtle">
                                <span className="line-clamp-1">{maintenance.description}</span>
                              </div>
                            )}
                          </div>
                          <div className="shrink-0">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-600 text-xs font-semibold">
                              {maintenanceDocs.length}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Documents List */}
                      {isExpanded && (
                        <div className="border-t border-line bg-surface-muted">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                            {maintenanceDocs.map((d) => (
                              <div key={d.id} className="bg-surface rounded-lg shadow-sm border border-line p-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-50 shrink-0">
                                    <FileText className="w-4 h-4 text-orange-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-ink truncate" title={d.name}>{d.name}</p>
                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${typeColors[d.type] ?? 'bg-control text-ink-muted'}`}>
                                      {typeLabels[d.type] ?? d.type}
                                    </span>
                                    {d.description && (
                                      <p className="text-xs text-ink-subtle mt-1 line-clamp-1">{d.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-xs text-ink-subtle">
                                        {formatDate(d.uploadedAt)}
                                      </p>
                                      <span className="text-ink-subtle">•</span>
                                      <p className="text-xs text-ink-subtle">{formatFileSize(d.fileSize)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <button
                                    onClick={() => handleDownload(d.id, d.name)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                  >
                                    <Download className="w-3 h-3" />
                                    {t('documents.download')}
                                  </button>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDelete(d.id)}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      {t('common.delete')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })
              );
            })()
          ) : (
            (() => {
              const groupedDocs = getDocumentsByYear();
              const years = Array.from(groupedDocs.keys()).sort((a, b) => b - a);
              
              return years.length === 0 ? (
                <EmptyState icon={FileText} title={t('documents.empty.financial')} />
              ) : (
                years.map(year => {
                  const yearDocs = groupedDocs.get(year) || [];
                  const isExpanded = expandedYears.has(year);
                  
                  return (
                    <Card key={year} className="overflow-hidden">
                      {/* Year Header */}
                      <button
                        onClick={() => toggleYear(year)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-hover transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-ink-subtle" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-ink-subtle" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Calendar className="w-4 h-4 text-emerald-600" />
                              <h3 className="font-semibold text-ink">
                                {t('documents.year', { year })}
                              </h3>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 text-xs font-semibold">
                              {yearDocs.length}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Documents List */}
                      {isExpanded && (
                        <div className="border-t border-line bg-surface-muted">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                            {yearDocs.map((d) => (
                              <div key={d.id} className="bg-surface rounded-lg shadow-sm border border-line p-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 shrink-0">
                                    <FileText className="w-4 h-4 text-emerald-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-ink truncate" title={d.name}>{d.name}</p>
                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${typeColors[d.type] ?? 'bg-control text-ink-muted'}`}>
                                      {typeLabels[d.type] ?? d.type}
                                    </span>
                                    {d.description && (
                                      <p className="text-xs text-ink-subtle mt-1 line-clamp-1">{d.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-xs text-ink-subtle">
                                        {formatDate(d.uploadedAt)}
                                      </p>
                                      <span className="text-ink-subtle">•</span>
                                      <p className="text-xs text-ink-subtle">{formatFileSize(d.fileSize)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <button
                                    onClick={() => handleDownload(d.id, d.name)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                  >
                                    <Download className="w-3 h-3" />
                                    {t('documents.download')}
                                  </button>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDelete(d.id)}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      {t('common.delete')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })
              );
            })()
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-ink-subtle">{t('documents.loading')}</div>
        ) : loadError ? (
          <div className="col-span-full">
            <ErrorState message={loadError} onRetry={() => load(currentPage)} />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState icon={FileText} title={searchQuery ? t('documents.empty.noResults') : t('documents.empty.category')} className="col-span-full" />
        ) : (
          documents.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink truncate" title={d.name}>{d.name}</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${typeColors[d.type] ?? 'bg-control text-ink-muted'}`}>
                    {typeLabels[d.type] ?? d.type}
                  </span>
                  {d.description && (
                    <p className="text-xs text-ink-subtle mt-1 line-clamp-2">{d.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-ink-subtle">
                      {formatDate(d.uploadedAt)}
                    </p>
                    <span className="text-ink-subtle">•</span>
                    <p className="text-xs text-ink-subtle">{formatFileSize(d.fileSize)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => handleDownload(d.id, d.name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  <Download className="w-3 h-3" />
                  {t('documents.download')}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    {t('common.delete')}
                  </button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
      )}
      
      {pagination && !loading && documents.length > 0 && (
        <Pagination
          pagination={pagination}
          currentPage={currentPage}
          onPageChange={(page) => load(page)}
        />
      )}

      {/* Upload Modal */}
      <ModalPopup
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title={t('documents.uploadModal.title')}
        maxWidthClass="max-w-2xl"
      >
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  {t('documents.form.file')}
                </label>
                <FileUpload
                  onFileSelect={setUploadFile}
                  currentFile={uploadFile}
                  removeFile={() => setUploadFile(null)}
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('documents.form.name')} *
                </label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={t('documents.form.namePlaceholder')}
                  required
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('documents.form.type')} *
                </label>
                <select
                  value={uploadForm.type}
                  onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                  disabled={uploading}
                >
                  {documentTypesByContext[activeTab].map((type) => (
                    <option key={type} value={type}>
                      {typeLabels[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('documents.form.description')}
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  placeholder={t('documents.form.descriptionPlaceholder')}
                  disabled={uploading}
                />
              </div>

              {/* Context-specific fields */}
              {activeTab === 'Unit' && (
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">
                    {t('documents.form.unit')} *
                  </label>
                  <select
                    value={uploadForm.unitId}
                    onChange={(e) => setUploadForm({ ...uploadForm, unitId: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    disabled={uploading}
                  >
                    <option value="">{t('documents.form.selectUnit')}</option>
                    {units.map(unit => (
                      <option key={unit.id} value={unit.id}>
                        {t('documents.form.unitOption', { number: unit.number, floor: unit.floor })}{unit.apartmentNumber ? t('documents.form.aptSuffix', { number: unit.apartmentNumber }) : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'Assembly' && (
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">
                    {t('documents.form.assembly')} *
                  </label>
                  <select
                    value={uploadForm.assemblyId}
                    onChange={(e) => setUploadForm({ ...uploadForm, assemblyId: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    disabled={uploading}
                  >
                    <option value="">{t('documents.form.selectAssembly')}</option>
                    {assemblies.map(assembly => (
                      <option key={assembly.id} value={assembly.id}>
                        {assembly.title} - {formatDate(assembly.scheduledAt)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'Maintenance' && (
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">
                    {t('documents.form.maintenance')} *
                  </label>
                  <select
                    value={uploadForm.maintenanceRequestId}
                    onChange={(e) => setUploadForm({ ...uploadForm, maintenanceRequestId: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    disabled={uploading}
                  >
                    <option value="">{t('documents.form.selectMaintenance')}</option>
                    {maintenanceRequests.map(maintenance => (
                      <option key={maintenance.id} value={maintenance.id}>
                        {maintenance.title} - {maintenance.status}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'Financial' && (
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">
                    {t('documents.form.year')} *
                  </label>
                  <select
                    value={uploadForm.year}
                    onChange={(e) => setUploadForm({ ...uploadForm, year: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    disabled={uploading}
                  >
                    {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() + 1 - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-line">
                <Button
                  variant="ghost"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  icon={UploadIcon}
                  loading={uploading}
                  disabled={!uploadFile}
                >
                  {t('documents.form.submit')}
                </Button>
              </div>
            </form>
      </ModalPopup>
    </div>
  );
}
