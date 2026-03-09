import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Download, Trash2, Plus, X, Upload as UploadIcon, ChevronDown, ChevronRight, Calendar, Home, Wrench } from 'lucide-react';
import { documentsApi, assembliesApi, unitsApi, maintenanceApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import FileUpload from '../components/FileUpload';
import type { DocumentDto, PaginatedResponse, AssemblyDto, UnitDto, MaintenanceRequestDto } from '../types';

const contextLabels: Record<string, string> = {
  Condominium: 'Condomínio',
  Unit: 'Frações',
  Assembly: 'Assembleias',
  Maintenance: 'Manutenção',
  Financial: 'Financeiro',
};

const typeLabels: Record<string, string> = {
  UnitInsurance: 'Seguro da Fração',
  UnitOwnershipProof: 'Escritura',
  UnitOther: 'Outro',
  AssemblyMinutes: 'Ata',
  AssemblyConvocation: 'Convocatória',
  AssemblyAttachment: 'Anexo',
  MaintenanceInvoice: 'Fatura',
  MaintenanceQuote: 'Orçamento',
  MaintenanceReport: 'Relatório',
  FinancialBankStatement: 'Extrato Bancário',
  FinancialAnnualReport: 'Relatório Anual',
  FinancialBudget: 'Orçamento Anual',
  FinancialAudit: 'Auditoria',
  FinancialTaxDocument: 'Documentos Fiscais',
  FinancialOther: 'Outros',
  CondominiumRegulation: 'Regulamento',
  CondominiumInsurance: 'Seguro',
  CondominiumContract: 'Contrato',
  Other: 'Outro',
};

const typeColors: Record<string, string> = {
  UnitInsurance: 'bg-blue-100 text-blue-700',
  UnitOwnershipProof: 'bg-purple-100 text-purple-700',
  UnitOther: 'bg-gray-100 text-gray-600',
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
  FinancialOther: 'bg-slate-100 text-slate-600',
  CondominiumRegulation: 'bg-blue-100 text-blue-700',
  CondominiumInsurance: 'bg-cyan-100 text-cyan-700',
  CondominiumContract: 'bg-teal-100 text-teal-700',
  Other: 'bg-gray-100 text-gray-600',
};

const documentTypesByContext: Record<string, string[]> = {
  Condominium: ['CondominiumRegulation', 'CondominiumInsurance', 'CondominiumContract', 'Other'],
  Unit: ['UnitInsurance', 'UnitOwnershipProof', 'UnitOther'],
  Assembly: ['AssemblyMinutes', 'AssemblyConvocation', 'AssemblyAttachment'],
  Maintenance: ['MaintenanceInvoice', 'MaintenanceQuote', 'MaintenanceReport'],
  Financial: ['FinancialBankStatement', 'FinancialAnnualReport', 'FinancialBudget', 'FinancialAudit', 'FinancialTaxDocument', 'FinancialOther'],
};

export default function DocumentsPage() {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [assemblies, setAssemblies] = useState<AssemblyDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequestDto[]>([]);
  const [expandedAssemblies, setExpandedAssemblies] = useState<Set<string>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedMaintenance, setExpandedMaintenance] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<DocumentDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'Condominium');
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

  const load = (page: number = 1, search: string = searchQuery, context: string = activeTab) => {
    setLoading(true);
    documentsApi.getPaged(page, pageSize, search, context)
      .then((r) => {
        setPagination(r.data);
        setDocuments(r.data.items);
        setCurrentPage(page);
      })
      .finally(() => setLoading(false));
  };

  const loadAssemblies = () => {
    assembliesApi.getPaged(1, 100)
      .then((r) => setAssemblies(r.data.items))
      .catch(() => setAssemblies([]));
  };

  const loadUnits = () => {
    unitsApi.getPaged(1, 100)
      .then((r) => setUnits(r.data.items))
      .catch(() => setUnits([]));
  };

  const loadMaintenanceRequests = () => {
    maintenanceApi.getPaged(1, 100)
      .then((r) => setMaintenanceRequests(r.data.items))
      .catch(() => setMaintenanceRequests([]));
  };

  useEffect(() => { 
    load(1, '', activeTab); 
    if (activeTab === 'Assembly') {
      loadAssemblies();
    } else if (activeTab === 'Unit') {
      loadUnits();
    } else if (activeTab === 'Maintenance') {
      loadMaintenanceRequests();
    }
  }, [activeTab]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        load(1, searchQuery, activeTab);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este documento?')) return;
    await documentsApi.delete(id);
    load();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

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

      await documentsApi.upload(formData);
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
    } catch (error) {
      alert('Erro ao fazer upload do documento');
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
    const colors: Record<string, string> = {
      Open: 'bg-yellow-100 text-yellow-700',
      InProgress: 'bg-blue-100 text-blue-700',
      Resolved: 'bg-green-100 text-green-700',
      Closed: 'bg-gray-100 text-gray-500',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  const getMaintenanceStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      Open: 'Aberto',
      InProgress: 'Em Curso',
      Resolved: 'Resolvido',
      Closed: 'Fechado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Scheduled: 'bg-blue-100 text-blue-700',
      InProgress: 'bg-yellow-100 text-yellow-700',
      Completed: 'bg-green-100 text-green-700',
      Cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      Scheduled: 'Agendada',
      InProgress: 'Em Curso',
      Completed: 'Concluída',
      Cancelled: 'Cancelada',
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          <p className="text-gray-500 text-sm mt-0.5">Documentos e arquivos do condomínio</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-80">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar documentos..."
            />
          </div>
          {isAdmin && (
            <button
              onClick={openUploadModal}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Novo Documento
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {Object.entries(contextLabels)
            .filter(([key]) => isAdmin || key !== 'Unit') // Hide Unit tab for non-admin users
            .map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
              A carregar...
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              {searchQuery ? 'Nenhum documento encontrado' : 'Sem documentos de assembleias'}
            </div>
          ) : activeTab === 'Assembly' ? (
            (() => {
              const groupedDocs = getDocumentsByAssembly();
              const assemblyIds = Array.from(groupedDocs.keys());
              
              return assemblyIds.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Sem documentos de assembleias
                </div>
              ) : (
                assemblyIds.map(assemblyId => {
                  const assemblyDocs = groupedDocs.get(assemblyId) || [];
                  const assembly = getAssemblyInfo(assemblyId);
                  const isExpanded = expandedAssemblies.has(assemblyId);
                  
                  return (
                    <div key={assemblyId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* Assembly Header */}
                      <button
                        onClick={() => toggleAssembly(assemblyId)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900">
                                {assembly?.title || `Assembleia ${assemblyId.substring(0, 8)}`}
                              </h3>
                              {assembly && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(assembly.status)}`}>
                                  {getStatusLabel(assembly.status)}
                                </span>
                              )}
                            </div>
                            {assembly && (
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{new Date(assembly.scheduledAt).toLocaleDateString('pt-PT', { 
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
                        <div className="border-t border-gray-100 bg-gray-50/50">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                            {assemblyDocs.map((d) => (
                              <div key={d.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 shrink-0">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-gray-900 truncate" title={d.name}>{d.name}</p>
                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${typeColors[d.type] ?? 'bg-gray-100 text-gray-600'}`}>
                                      {typeLabels[d.type] ?? d.type}
                                    </span>
                                    {d.description && (
                                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{d.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-xs text-gray-400">
                                        {new Date(d.uploadedAt).toLocaleDateString('pt-PT')}
                                      </p>
                                      <span className="text-gray-300">•</span>
                                      <p className="text-xs text-gray-400">{formatFileSize(d.fileSize)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <a
                                    href={documentsApi.download(d.id)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                  >
                                    <Download className="w-3 h-3" />
                                    Descarregar
                                  </a>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDelete(d.id)}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              );
            })()
          ) : activeTab === 'Unit' ? (
            (() => {
              const groupedDocs = getDocumentsByUnit();
              const unitIds = Array.from(groupedDocs.keys());
              
              return unitIds.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Sem documentos de frações
                </div>
              ) : (
                unitIds.map(unitId => {
                  const unitDocs = groupedDocs.get(unitId) || [];
                  const unit = getUnitInfo(unitId);
                  const isExpanded = expandedUnits.has(unitId);
                  
                  return (
                    <div key={unitId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* Unit Header */}
                      <button
                        onClick={() => toggleUnit(unitId)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Home className="w-4 h-4 text-gray-600" />
                              <h3 className="font-semibold text-gray-900">
                                {unit ? `Fração ${unit.number}` : `Fração ${unitId.substring(0, 8)}`}
                              </h3>
                              {unit && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                  Piso {unit.floor}
                                </span>
                              )}
                              {unit?.apartmentNumber && (
                                <span className="text-xs text-gray-500">
                                  • Apt {unit.apartmentNumber}
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
                        <div className="border-t border-gray-100 bg-gray-50/50">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                            {unitDocs.map((d) => (
                              <div key={d.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 shrink-0">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-gray-900 truncate" title={d.name}>{d.name}</p>
                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${typeColors[d.type] ?? 'bg-gray-100 text-gray-600'}`}>
                                      {typeLabels[d.type] ?? d.type}
                                    </span>
                                    {d.description && (
                                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{d.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-xs text-gray-400">
                                        {new Date(d.uploadedAt).toLocaleDateString('pt-PT')}
                                      </p>
                                      <span className="text-gray-300">•</span>
                                      <p className="text-xs text-gray-400">{formatFileSize(d.fileSize)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <a
                                    href={documentsApi.download(d.id)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                  >
                                    <Download className="w-3 h-3" />
                                    Descarregar
                                  </a>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDelete(d.id)}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              );
            })()
          ) : activeTab === 'Maintenance' ? (
            (() => {
              const groupedDocs = getDocumentsByMaintenance();
              const maintenanceIds = Array.from(groupedDocs.keys());
              
              return maintenanceIds.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Sem documentos de manutenções
                </div>
              ) : (
                maintenanceIds.map(maintenanceId => {
                  const maintenanceDocs = groupedDocs.get(maintenanceId) || [];
                  const maintenance = getMaintenanceInfo(maintenanceId);
                  const isExpanded = expandedMaintenance.has(maintenanceId);
                  
                  return (
                    <div key={maintenanceId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* Maintenance Header */}
                      <button
                        onClick={() => toggleMaintenance(maintenanceId)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Wrench className="w-4 h-4 text-gray-600" />
                              <h3 className="font-semibold text-gray-900">
                                {maintenance?.title || `Manutenção ${maintenanceId.substring(0, 8)}`}
                              </h3>
                              {maintenance && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getMaintenanceStatusColor(maintenance.status)}`}>
                                  {getMaintenanceStatusLabel(maintenance.status)}
                                </span>
                              )}
                            </div>
                            {maintenance?.description && (
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
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
                        <div className="border-t border-gray-100 bg-gray-50/50">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                            {maintenanceDocs.map((d) => (
                              <div key={d.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-50 shrink-0">
                                    <FileText className="w-4 h-4 text-orange-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-gray-900 truncate" title={d.name}>{d.name}</p>
                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${typeColors[d.type] ?? 'bg-gray-100 text-gray-600'}`}>
                                      {typeLabels[d.type] ?? d.type}
                                    </span>
                                    {d.description && (
                                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{d.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-xs text-gray-400">
                                        {new Date(d.uploadedAt).toLocaleDateString('pt-PT')}
                                      </p>
                                      <span className="text-gray-300">•</span>
                                      <p className="text-xs text-gray-400">{formatFileSize(d.fileSize)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <a
                                    href={documentsApi.download(d.id)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                  >
                                    <Download className="w-3 h-3" />
                                    Descarregar
                                  </a>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDelete(d.id)}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              );
            })()
          ) : (
            (() => {
              const groupedDocs = getDocumentsByYear();
              const years = Array.from(groupedDocs.keys()).sort((a, b) => b - a);
              
              return years.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Sem documentos financeiros
                </div>
              ) : (
                years.map(year => {
                  const yearDocs = groupedDocs.get(year) || [];
                  const isExpanded = expandedYears.has(year);
                  
                  return (
                    <div key={year} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* Year Header */}
                      <button
                        onClick={() => toggleYear(year)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Calendar className="w-4 h-4 text-emerald-600" />
                              <h3 className="font-semibold text-gray-900">
                                Ano {year}
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
                        <div className="border-t border-gray-100 bg-gray-50/50">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                            {yearDocs.map((d) => (
                              <div key={d.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 shrink-0">
                                    <FileText className="w-4 h-4 text-emerald-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-gray-900 truncate" title={d.name}>{d.name}</p>
                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${typeColors[d.type] ?? 'bg-gray-100 text-gray-600'}`}>
                                      {typeLabels[d.type] ?? d.type}
                                    </span>
                                    {d.description && (
                                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{d.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-xs text-gray-400">
                                        {new Date(d.uploadedAt).toLocaleDateString('pt-PT')}
                                      </p>
                                      <span className="text-gray-300">•</span>
                                      <p className="text-xs text-gray-400">{formatFileSize(d.fileSize)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <a
                                    href={documentsApi.download(d.id)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                  >
                                    <Download className="w-3 h-3" />
                                    Descarregar
                                  </a>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDelete(d.id)}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              );
            })()
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-400">A carregar...</div>
        ) : documents.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            {searchQuery ? 'Nenhum documento encontrado' : 'Sem documentos nesta categoria'}
          </div>
        ) : (
          documents.map((d) => (
            <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate" title={d.name}>{d.name}</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${typeColors[d.type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {typeLabels[d.type] ?? d.type}
                  </span>
                  {d.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{d.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-400">
                      {new Date(d.uploadedAt).toLocaleDateString('pt-PT')}
                    </p>
                    <span className="text-gray-300">•</span>
                    <p className="text-xs text-gray-400">{formatFileSize(d.fileSize)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <a
                  href={documentsApi.download(d.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Descarregar
                </a>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Eliminar
                  </button>
                )}
              </div>
            </div>
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
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Carregar Documento</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arquivo
                </label>
                <FileUpload
                  onFileSelect={setUploadFile}
                  currentFile={uploadFile}
                  removeFile={() => setUploadFile(null)}
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Documento *
                </label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Ex: Seguro Multi-risco 2024"
                  required
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo *
                </label>
                <select
                  value={uploadForm.type}
                  onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição (opcional)
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  placeholder="Adicione notas ou detalhes sobre o documento..."
                  disabled={uploading}
                />
              </div>

              {/* Context-specific fields */}
              {activeTab === 'Unit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fração *
                  </label>
                  <select
                    value={uploadForm.unitId}
                    onChange={(e) => setUploadForm({ ...uploadForm, unitId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    disabled={uploading}
                  >
                    <option value="">Selecione uma fração</option>
                    {units.map(unit => (
                      <option key={unit.id} value={unit.id}>
                        Fração {unit.number} - Piso {unit.floor}{unit.apartmentNumber ? ` - Apt ${unit.apartmentNumber}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'Assembly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assembleia *
                  </label>
                  <select
                    value={uploadForm.assemblyId}
                    onChange={(e) => setUploadForm({ ...uploadForm, assemblyId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    disabled={uploading}
                  >
                    <option value="">Selecione uma assembleia</option>
                    {assemblies.map(assembly => (
                      <option key={assembly.id} value={assembly.id}>
                        {assembly.title} - {new Date(assembly.scheduledAt).toLocaleDateString('pt-PT')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'Maintenance' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pedido de Manutenção *
                  </label>
                  <select
                    value={uploadForm.maintenanceRequestId}
                    onChange={(e) => setUploadForm({ ...uploadForm, maintenanceRequestId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    disabled={uploading}
                  >
                    <option value="">Selecione um pedido de manutenção</option>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ano *
                  </label>
                  <select
                    value={uploadForm.year}
                    onChange={(e) => setUploadForm({ ...uploadForm, year: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    disabled={uploading}
                  >
                    {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() + 1 - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={uploading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploading ? (
                    <>A carregar...</>
                  ) : (
                    <>
                      <UploadIcon className="w-4 h-4" />
                      Carregar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
