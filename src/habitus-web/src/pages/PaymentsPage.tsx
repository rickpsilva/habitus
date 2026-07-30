import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, CheckCircle, XCircle, Clock, AlertCircle, Upload, FileText, Download, RefreshCw, CreditCard } from 'lucide-react';
import { paymentsApi, paymentMethodsApi, documentsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import type { PaymentDto, CreatePaymentRequest, PaymentMethodsDto } from '../types';
import { PageHeader, Button, Skeleton, EmptyState, ErrorState, FilterBar, FilterChip } from '../components/ui';
import {
  DEFAULT_MAX_UPLOAD_SIZE_BYTES,
  formatUploadSizeLabel,
  getPlatformMaxUploadSizeBytes,
  isFileSizeWithinLimit,
} from '../utils/uploadLimits';

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const responseData = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
    if (responseData?.message) {
      return responseData.message;
    }

    if (responseData?.errors) {
      const errorMessages = Object.values(responseData.errors).flat();
      if (errorMessages.length > 0) {
        return `Erro de validação:\n${errorMessages.join('\n')}`;
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export default function PaymentsPage() {
  const { condominiumId, unitId } = useAuth();
  const { success, error: toastError } = useToast();
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDto | null>(null);
  const [cancelPaymentId, setCancelPaymentId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreatePaymentRequest>({
    type: 'MonthlyFee',
    method: 'BankTransfer',
    amount: 0,
    description: '',
  });
  const [quotaPeriodicity, setQuotaPeriodicity] = useState<'Monthly' | 'Quarterly' | 'Annual'>('Monthly');
  const [trimestralStart, setTrimestralStart] = useState<number>(1);
  const [maxUploadSizeBytes, setMaxUploadSizeBytes] = useState(DEFAULT_MAX_UPLOAD_SIZE_BYTES);

  const PT_MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const currentMonth = new Date().getMonth(); // 0-indexed
  const currentYear = new Date().getFullYear();

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    if (!condominiumId) {
      setPayments([]);
      setLoadError('Condomínio não selecionado.');
      setLoading(false);
      return;
    }

    try {
      const response = await paymentsApi.getMyPayments(condominiumId);
      setPayments(response.data);
    } catch (error) {
      console.error('Error loading payments:', error);
      setLoadError('Não foi possível carregar os pagamentos.');
    } finally {
      setLoading(false);
    }
  }, [condominiumId]);

  const loadPaymentMethods = useCallback(async () => {
    if (!condominiumId) return;
    try {
      const response = await paymentMethodsApi.get(condominiumId);
      setPaymentMethods(response.data);
      
      // Set default payment method to the first available one
      if (response.data.bankTransferEnabled) {
        setForm(prev => ({ ...prev, method: 'BankTransfer' }));
      } else if (response.data.mbWayEnabled) {
        setForm(prev => ({ ...prev, method: 'MBWay' }));
      } else if (response.data.cardEnabled) {
        setForm(prev => ({ ...prev, method: 'Card' }));
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  }, [condominiumId]);

  useEffect(() => {
    loadPayments();
    if (condominiumId) {
      loadPaymentMethods();
    }
  }, [condominiumId, loadPaymentMethods, loadPayments]);

  useEffect(() => {
    let mounted = true;

    getPlatformMaxUploadSizeBytes().then((value) => {
      if (!mounted) return;
      setMaxUploadSizeBytes(value);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const typeNames: Record<string, string> = {
    MonthlyFee: 'Quotas',
    ExtraordinaryFee: 'Quota Extraordinária',
    Reservation: 'Reservas',
    Other: 'Outros',
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: payments.length, Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 };
    for (const p of payments) {
      if (counts[p.status] !== undefined) counts[p.status] += 1;
    }
    return counts;
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      const typeLabel = (typeNames[p.type] || p.type).toLowerCase();
      return typeLabel.includes(query) || (p.description ?? '').toLowerCase().includes(query);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, searchQuery, statusFilter]);

  const handleStatusFilter = (status: typeof statusFilter) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const totalItems = filteredPayments.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedPayments = filteredPayments.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
  const pagination = {
    items: paginatedPayments,
    page: safeCurrentPage,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: safeCurrentPage > 1,
    hasNextPage: safeCurrentPage < totalPages,
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!condominiumId) {
      toastError('Condomínio não selecionado.');
      return;
    }
    
    // Validate amount
    if (!form.amount || form.amount <= 0) {
      toastError('Por favor, insira um valor válido maior que zero.');
      return;
    }

    // Validate description
    if (!form.description || form.description.trim() === '') {
      toastError('Por favor, insira uma descrição.');
      return;
    }

    // Proof is required only for Bank Transfer
    const requiresProof = form.method === 'BankTransfer';
    if (requiresProof && !proofFile) {
      toastError('Por favor, anexe o comprovativo de pagamento para transferências bancárias.');
      return;
    }

    if (proofFile && !isFileSizeWithinLimit(proofFile, maxUploadSizeBytes)) {
      toastError(`O comprovativo excede o limite de ${formatUploadSizeLabel(maxUploadSizeBytes)}.`);
      return;
    }

    setSubmitting(true);
    try {
      console.log('Creating payment with data:', form);
      
      // 1. Create the payment first
      // Build quota period payload when type is MonthlyFee
      let periodPayload: Partial<CreatePaymentRequest> = {};
      if (form.type === 'MonthlyFee') {
        if (quotaPeriodicity === 'Monthly') {
          periodPayload = { quotaPeriodicity: 'Monthly', quotaMonthStart: currentMonth + 1, quotaMonthEnd: currentMonth + 1, quotaYear: currentYear };
        } else if (quotaPeriodicity === 'Quarterly') {
          periodPayload = { quotaPeriodicity: 'Quarterly', quotaMonthStart: trimestralStart, quotaMonthEnd: trimestralStart + 3, quotaYear: currentYear };
        } else {
          periodPayload = { quotaPeriodicity: 'Annual', quotaMonthStart: 1, quotaMonthEnd: 12, quotaYear: currentYear };
        }
      }
      const paymentResponse = await paymentsApi.create(condominiumId, { ...form, ...periodPayload });
      const paymentId = paymentResponse.data.id;

      // 2. Upload proof if provided (required for BankTransfer)
      if (proofFile) {
        if (!unitId) {
          throw new Error('UnitId não disponível. Por favor, faça login novamente.');
        }
        
        console.log('Uploading proof document...');
        const formData = new FormData();
        formData.append('file', proofFile);
        formData.append('name', `Comprovativo - ${form.description}`);
        formData.append('type', 'UnitOther');  // Changed to Unit context type
        formData.append('context', 'Unit');    // Changed to Unit context (Resident has permission)
        formData.append('unitId', unitId);     // Required for Unit context
        formData.append('description', `Comprovativo de pagamento - ${form.description}`);
        
        try {
          const uploadResponse = await documentsApi.upload(condominiumId, formData);
          console.log('Upload response:', uploadResponse.data);
          // Store the document ID instead of filePath
          const proofUrl = uploadResponse.data.id;
          await paymentsApi.uploadProof(condominiumId, paymentId, proofUrl);
        } catch (uploadError: unknown) {
          if (typeof uploadError === 'object' && uploadError !== null && 'response' in uploadError) {
            console.error('Upload error details:', (uploadError as { response?: { data?: unknown } }).response?.data);
          }
          throw uploadError;
        }
      }

      // Reset form and close modal
      setShowCreateModal(false);
      setForm({ type: 'MonthlyFee', method: 'BankTransfer', amount: 0, description: '' });
      setQuotaPeriodicity('Monthly');
      setTrimestralStart(1);
      setProofFile(null);
      
      // Reload payments after a short delay to ensure backend has processed
      setTimeout(() => {
        loadPayments();
      }, 500);
      
      success('Pagamento criado com sucesso! Aguarde aprovação do administrador.');
    } catch (error: unknown) {
      console.error('Error creating payment:', error);
      toastError(getApiErrorMessage(error, 'Erro ao criar pagamento. Tente novamente.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (paymentId: string) => {
    if (!condominiumId) {
      toastError('Condomínio não selecionado.');
      return;
    }

    try {
      await paymentsApi.cancel(condominiumId, paymentId);
      loadPayments();
      setSelectedPayment(null);
      setCancelPaymentId(null);
      success('Pagamento cancelado com sucesso.');
    } catch (error) {
      console.error('Error cancelling payment:', error);
      toastError('Erro ao cancelar pagamento. Tente novamente.');
      setCancelPaymentId(null);
    }
  };

  const handleDownloadProof = async (paymentId: string, description: string) => {
    if (!condominiumId) {
      toastError('Condomínio não selecionado.');
      return;
    }

    try {
      await paymentsApi.downloadProof(condominiumId, paymentId, description);
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toastError('Erro ao descarregar o comprovativo. Tente novamente.');
    }
  };

  const handleDownloadReceipt = async (payment: PaymentDto) => {
    if (!condominiumId) {
      toastError('Condomínio não selecionado.');
      return;
    }

    if (!payment.receiptNumber || !payment.receiptYear) {
      toastError('Este pagamento ainda não tem recibo emitido.');
      return;
    }
    try {
      await paymentsApi.downloadReceipt(condominiumId, payment.id, payment.receiptNumber, payment.receiptYear);
    } catch (error: unknown) {
      console.error('Error downloading receipt:', error);
      toastError(getApiErrorMessage(error, 'Erro ao descarregar o recibo.'));
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      Pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: 'Pendente' },
      Approved: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: 'Aprovado' },
      Rejected: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Rejeitado' },
      Cancelled: { icon: XCircle, color: 'bg-control text-ink-muted', label: 'Cancelado' },
    };
    const badge = badges[status as keyof typeof badges] || badges.Pending;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const getTypeName = (type: string) => {
    const types: Record<string, string> = {
      MonthlyFee: 'Quotas',
      ExtraordinaryFee: 'Quota Extraordinária',
      Reservation: 'Reservas',
      Other: 'Outros',
    };
    return types[type] || type;
  };

  const getMethodName = (method: string) => {
    const methods: Record<string, string> = {
      BankTransfer: 'Transferência Bancária',
      MBWay: 'MB Way',
      Card: 'Cartão',
    };
    return methods[method] || method;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="list" rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={cancelPaymentId !== null}
        title="Cancelar pagamento"
        message="Tem a certeza que deseja cancelar este pagamento? Esta ação não pode ser revertida."
        confirmLabel="Cancelar pagamento"
        variant="danger"
        onConfirm={() => cancelPaymentId && handleCancel(cancelPaymentId)}
        onCancel={() => setCancelPaymentId(null)}
      />

      {/* Header */}
      <PageHeader
        title="Pagamentos"
        subtitle="Gerencie os seus pagamentos ao condomínio"
        actions={
          <Button onClick={() => setShowCreateModal(true)} icon={Plus} fullWidth className="sm:w-auto">
            Novo Pagamento
          </Button>
        }
      />

      {/* Payments List */}
      <div className="bg-surface rounded-lg shadow">
        <div className="p-4 border-b border-line flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Histórico de Pagamentos</h2>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => loadPayments()}>
              Atualizar
            </Button>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <FilterBar>
              <FilterChip label="Todos" count={statusCounts.All} active={statusFilter === 'All'} onClick={() => handleStatusFilter('All')} />
              <FilterChip label="Pendente" icon={Clock} count={statusCounts.Pending} active={statusFilter === 'Pending'} onClick={() => handleStatusFilter('Pending')} />
              <FilterChip label="Aprovado" icon={CheckCircle} count={statusCounts.Approved} active={statusFilter === 'Approved'} onClick={() => handleStatusFilter('Approved')} />
              <FilterChip label="Rejeitado" icon={XCircle} count={statusCounts.Rejected} active={statusFilter === 'Rejected'} onClick={() => handleStatusFilter('Rejected')} />
              <FilterChip label="Cancelado" icon={XCircle} count={statusCounts.Cancelled} active={statusFilter === 'Cancelled'} onClick={() => handleStatusFilter('Cancelled')} />
            </FilterBar>
            <div className="lg:w-64">
              <SearchBar
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Pesquisar..."
              />
            </div>
          </div>
        </div>
        {!loading && loadError && (
          <div className="mx-4 mt-4">
            <ErrorState message={loadError} onRetry={loadPayments} />
          </div>
        )}
        <div className="divide-y divide-line">
          {!loadError && payments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Nenhum pagamento registado"
              description='Clique em "Novo Pagamento" para submeter o seu primeiro pagamento.'
            />
          ) : !loadError && filteredPayments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Sem resultados"
              description="Nenhum pagamento corresponde aos filtros aplicados."
            />
          ) : !loadError ? (
            paginatedPayments.map((payment) => (
              <div
                key={payment.id}
                className="p-4 hover:bg-surface-hover cursor-pointer"
                onClick={() => setSelectedPayment(payment)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-ink">{getTypeName(payment.type)}</h3>
                      {getStatusBadge(payment.status)}
                    </div>
                    <p className="text-sm text-ink-muted">{payment.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-xs text-ink-subtle">
                        Criado: {new Date(payment.createdDate).toLocaleDateString('pt-PT')}
                      </p>
                      {payment.proofOfPaymentUrl && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded" title="Comprovativo disponível">
                          <Download className="w-3 h-3" />
                          Comprovativo
                        </span>
                      )}
                      {payment.status === 'Approved' && payment.hasReceipt && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded" title="Recibo disponível">
                          <FileText className="w-3 h-3" />
                          Recibo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-ink">€{payment.amount.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))
          ) : null}
        </div>
        {!loadError && !loading && filteredPayments.length > 0 && (
          <div className="p-4 border-t border-line">
            <Pagination
              pagination={pagination}
              currentPage={safeCurrentPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Create Payment Modal */}
      <ModalPopup
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setProofFile(null); }}
        title="Novo Pagamento"
        maxWidthClass="max-w-lg"
      >
        <div className="p-6">
          <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  Tipo de Pagamento
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as CreatePaymentRequest['type'] })}
                  className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2"
                  required
                >
                  <option value="MonthlyFee">Quotas</option>
                  <option value="Reservation">Reservas</option>
                  <option value="Other">Outros</option>
                </select>
              </div>

              {/* Quota Periodicity Selector */}
              {form.type === 'MonthlyFee' && (
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">
                    Periodicidade
                  </label>
                  <div className="flex gap-2">
                    {(['Monthly', 'Quarterly', 'Annual'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setQuotaPeriodicity(p)}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          quotaPeriodicity === p
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-surface text-ink-muted border-line hover:border-indigo-400'
                        }`}
                      >
                        {p === 'Monthly' ? 'Mensal' : p === 'Quarterly' ? 'Trimestral' : 'Anual'}
                      </button>
                    ))}
                  </div>
                  {quotaPeriodicity === 'Monthly' && (
                    <p className="text-xs text-ink-subtle mt-2 bg-surface-muted px-3 py-2 rounded">
                      Período: <strong>{PT_MONTHS[currentMonth]}</strong> {currentYear}
                    </p>
                  )}
                  {quotaPeriodicity === 'Quarterly' && (
                    <div className="mt-2">
                      <select
                        value={trimestralStart}
                        onChange={(e) => setTrimestralStart(Number(e.target.value))}
                        className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2 text-sm"
                      >
                        <option value={1}>Janeiro – Abril</option>
                        <option value={5}>Maio – Agosto</option>
                        <option value={9}>Setembro – Dezembro</option>
                      </select>
                    </div>
                  )}
                  {quotaPeriodicity === 'Annual' && (
                    <p className="text-xs text-ink-subtle mt-2 bg-surface-muted px-3 py-2 rounded">
                      Período: <strong>Janeiro a Dezembro</strong> {currentYear}
                    </p>
                  )}
                </div>
              )}
              
              {/* Payment Method Selection */}
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  Método de Pagamento
                </label>
                <select
                  value={form.method}
                  onChange={(e) => {
                    setForm({ ...form, method: e.target.value as CreatePaymentRequest['method'] });
                    // Clear proof file if switching away from BankTransfer
                    if (e.target.value !== 'BankTransfer') {
                      setProofFile(null);
                    }
                  }}
                  className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2"
                  required
                >
                  {paymentMethods?.bankTransferEnabled && (
                    <option value="BankTransfer">Transferência Bancária / NIB</option>
                  )}
                  {paymentMethods?.mbWayEnabled && (
                    <option value="MBWay">MB Way</option>
                  )}
                  {paymentMethods?.cardEnabled && (
                    <option value="Card">Cartão Visa/Maestro</option>
                  )}
                  {!paymentMethods?.bankTransferEnabled && !paymentMethods?.mbWayEnabled && !paymentMethods?.cardEnabled && (
                    <option value="" disabled>Nenhum método disponível</option>
                  )}
                </select>
                {form.method !== 'BankTransfer' && form.method && (
                  <p className="text-xs text-blue-600 mt-1">
                    ✓ Pagamento automático - não requer comprovativo
                  </p>
                )}
                {(!paymentMethods?.bankTransferEnabled && !paymentMethods?.mbWayEnabled && !paymentMethods?.cardEnabled) && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ Nenhum método de pagamento está disponível. Contacte a administração.
                  </p>
                )}
              </div>

              {/* Conditional Payment Method Details */}
              {form.method === 'BankTransfer' && paymentMethods?.bankTransferIban && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900 mb-1">Dados para Transferência:</p>
                  {paymentMethods.bankTransferAccountHolder && (
                    <p className="text-sm text-blue-800">
                      <strong>Titular:</strong> {paymentMethods.bankTransferAccountHolder}
                    </p>
                  )}
                  <p className="text-sm text-blue-800">
                    <strong>IBAN:</strong> {paymentMethods.bankTransferIban}
                  </p>
                </div>
              )}
              
              {form.method === 'MBWay' && paymentMethods?.mbWayPhoneNumber && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900 mb-1">Dados para MB Way:</p>
                  <p className="text-sm text-blue-800">
                    <strong>Número:</strong> {paymentMethods.mbWayPhoneNumber}
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  Valor (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setForm({ ...form, amount: isNaN(value) ? 0 : value });
                  }}
                  className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2"
                  required
                  placeholder="Ex: 50.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  Descrição
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2"
                  rows={3}
                  required
                  placeholder="Ex: Pagamento quota Janeiro 2026"
                />
              </div>
              
              {/* Proof of Payment Upload - Only for Bank Transfer */}
              {form.method === 'BankTransfer' && (
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">
                    Comprovativo de Pagamento <span className="text-red-500">*</span>
                  </label>
                  <div className="border-2 border-dashed border-line rounded-lg p-4 text-center hover:border-indigo-500 transition-colors">
                    <input
                      type="file"
                      id="proof-upload"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!isFileSizeWithinLimit(file, maxUploadSizeBytes)) {
                            toastError(`O comprovativo excede o limite de ${formatUploadSizeLabel(maxUploadSizeBytes)}.`);
                            setProofFile(null);
                            return;
                          }
                          setProofFile(file);
                        }
                      }}
                      className="hidden"
                      required={form.method === 'BankTransfer'}
                    />
                    <label
                      htmlFor="proof-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="w-8 h-8 text-ink-subtle" />
                      {proofFile ? (
                        <div className="text-sm">
                          <p className="text-green-600 font-medium">{proofFile.name}</p>
                          <p className="text-xs text-ink-subtle">
                            {(proofFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      ) : (
                        <div className="text-sm text-ink-muted">
                          <p className="font-medium">Clique para selecionar</p>
                          <p className="text-xs text-ink-subtle">PDF ou Imagem (máx. {formatUploadSizeLabel(maxUploadSizeBytes)})</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-blue-800 bg-blue-50 p-3 rounded border border-blue-200">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                <strong>Importante:</strong> {form.method === 'BankTransfer' 
                  ? 'Efetue a transferência bancária e anexe o comprovativo antes de criar o pagamento.' 
                  : 'Para MB Way e Cartão, o processo de pagamento será automático após a criação do registo.'}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCreateModal(false);
                    setProofFile(null);
                  }}
                  disabled={submitting}
                  fullWidth
                  className="flex-1 border border-line"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  disabled={form.method === 'BankTransfer' && !proofFile}
                  fullWidth
                  className="flex-1"
                >
                  Criar Pagamento
                </Button>
              </div>
            </form>
        </div>
      </ModalPopup>

      {/* Payment Details Modal */}
      <ModalPopup
        open={selectedPayment !== null}
        onClose={() => setSelectedPayment(null)}
        title="Detalhes do Pagamento"
        maxWidthClass="max-w-lg"
      >
        {selectedPayment && (
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-ink-muted">Estado:</span>
              {getStatusBadge(selectedPayment.status)}
              </div>
              <div className="flex justify-between">
              <span className="text-ink-muted">Tipo:</span>
              <span className="font-medium">{getTypeName(selectedPayment.type)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Método:</span>
              <span className="font-medium">{getMethodName(selectedPayment.method)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Valor:</span>
              <span className="font-bold text-lg">€{selectedPayment.amount.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-ink-muted block mb-1">Descrição:</span>
              <p className="text-sm">{selectedPayment.description}</p>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Data de Criação:</span>
              <span>{new Date(selectedPayment.createdDate).toLocaleString('pt-PT')}</span>
            </div>
            {selectedPayment.processedDate && (
              <div className="flex justify-between">
                <span className="text-ink-muted">Data de Processamento:</span>
                <span>{new Date(selectedPayment.processedDate).toLocaleString('pt-PT')}</span>
              </div>
            )}
            {selectedPayment.processedByUserName && (
              <div className="flex justify-between">
                <span className="text-ink-muted">Processado por:</span>
                <span>{selectedPayment.processedByUserName}</span>
              </div>
            )}
            {selectedPayment.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <span className="text-red-900 font-semibold block mb-1">Motivo da Rejeição:</span>
                <p className="text-sm text-red-800">{selectedPayment.rejectionReason}</p>
              </div>
            )}
            
            {/* Receipt Information */}
            {selectedPayment.status === 'Approved' && selectedPayment.hasReceipt && (
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <span className="text-green-900 font-semibold block mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Recibo Emitido
                </span>
                <p className="text-sm text-green-800">
                  Recibo Nº {selectedPayment.receiptNumber}/{selectedPayment.receiptYear}
                </p>
                {selectedPayment.receiptIssuedDate && (
                  <p className="text-xs text-green-700 mt-1">
                    Emitido em: {new Date(selectedPayment.receiptIssuedDate).toLocaleDateString('pt-PT')}
                  </p>
                )}
                {selectedPayment.receiptIssuedByUserName && (
                  <p className="text-xs text-green-700">
                    Por: {selectedPayment.receiptIssuedByUserName}
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Document Actions */}
          {(selectedPayment.proofOfPaymentUrl || (selectedPayment.status === 'Approved' && selectedPayment.hasReceipt)) && (
            <div className="mt-4 pt-4 border-t border-line">
              <h3 className="text-sm font-semibold text-ink mb-2">Documentos</h3>
              <div className="flex flex-col gap-2">
                {selectedPayment.proofOfPaymentUrl && (
                  <Button
                    icon={Download}
                    onClick={() => handleDownloadProof(selectedPayment.id, selectedPayment.description)}
                    fullWidth
                  >
                    Descarregar Comprovativo de Pagamento
                  </Button>
                )}
                {selectedPayment.status === 'Approved' && selectedPayment.hasReceipt && (
                  <Button
                    variant="success"
                    icon={FileText}
                    onClick={() => handleDownloadReceipt(selectedPayment)}
                    fullWidth
                  >
                    Descarregar Recibo
                  </Button>
                )}
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 mt-4">
            {selectedPayment.status === 'Pending' && (
              <Button
                variant="danger"
                onClick={() => { setCancelPaymentId(selectedPayment.id); setSelectedPayment(null); }}
                fullWidth
                className="flex-1"
              >
                Cancelar Pagamento
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setSelectedPayment(null)}
              fullWidth
              className={selectedPayment.status === 'Pending' ? 'flex-1' : 'w-full'}
            >
              Fechar
            </Button>
          </div>
        </div>
        )}
      </ModalPopup>
    </div>
  );
}
