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
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';
import {
  DEFAULT_MAX_UPLOAD_SIZE_BYTES,
  formatUploadSizeLabel,
  getPlatformMaxUploadSizeBytes,
  isFileSizeWithinLimit,
} from '../utils/uploadLimits';

function getApiErrorMessage(error: unknown, fallback: string, t: TranslateFn): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const responseData = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
    if (responseData?.message) {
      return responseData.message;
    }

    if (responseData?.errors) {
      const errorMessages = Object.values(responseData.errors).flat();
      if (errorMessages.length > 0) {
        return t('payments.error.validation', { errors: errorMessages.join('\n') });
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
  const { t, formatDate, formatDateTime } = useTranslation();
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
      setLoadError(t('payments.error.noCondominium'));
      setLoading(false);
      return;
    }

    try {
      const response = await paymentsApi.getMyPayments(condominiumId);
      setPayments(response.data);
    } catch (error) {
      console.error('Error loading payments:', error);
      setLoadError(t('payments.error.load'));
    } finally {
      setLoading(false);
    }
  }, [condominiumId, t]);

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
    MonthlyFee: t('payments.type.monthlyFee'),
    ExtraordinaryFee: t('payments.type.extraordinaryFee'),
    Reservation: t('payments.type.reservation'),
    Other: t('payments.type.other'),
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
      toastError(t('payments.error.noCondominium'));
      return;
    }
    
    // Validate amount
    if (!form.amount || form.amount <= 0) {
      toastError(t('payments.error.invalidAmount'));
      return;
    }

    // Validate description
    if (!form.description || form.description.trim() === '') {
      toastError(t('payments.error.descriptionRequired'));
      return;
    }

    // Proof is required only for Bank Transfer
    const requiresProof = form.method === 'BankTransfer';
    if (requiresProof && !proofFile) {
      toastError(t('payments.error.proofRequired'));
      return;
    }

    if (proofFile && !isFileSizeWithinLimit(proofFile, maxUploadSizeBytes)) {
      toastError(t('payments.error.proofTooLarge', { limit: formatUploadSizeLabel(maxUploadSizeBytes) }));
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
          throw new Error(t('payments.error.noUnit'));
        }
        
        console.log('Uploading proof document...');
        const formData = new FormData();
        formData.append('file', proofFile);
        formData.append('name', t('payments.proofDocName', { description: form.description ?? '' }));
        formData.append('type', 'UnitOther');  // Changed to Unit context type
        formData.append('context', 'Unit');    // Changed to Unit context (Resident has permission)
        formData.append('unitId', unitId);     // Required for Unit context
        formData.append('description', t('payments.proofDocDescription', { description: form.description ?? '' }));
        
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
      
      success(t('payments.success.created'));
    } catch (error: unknown) {
      console.error('Error creating payment:', error);
      toastError(getApiErrorMessage(error, t('payments.error.create'), t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (paymentId: string) => {
    if (!condominiumId) {
      toastError(t('payments.error.noCondominium'));
      return;
    }

    try {
      await paymentsApi.cancel(condominiumId, paymentId);
      loadPayments();
      setSelectedPayment(null);
      setCancelPaymentId(null);
      success(t('payments.success.cancelled'));
    } catch (error) {
      console.error('Error cancelling payment:', error);
      toastError(t('payments.error.cancel'));
      setCancelPaymentId(null);
    }
  };

  const handleDownloadProof = async (paymentId: string, description: string) => {
    if (!condominiumId) {
      toastError(t('payments.error.noCondominium'));
      return;
    }

    try {
      await paymentsApi.downloadProof(condominiumId, paymentId, description);
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toastError(t('payments.error.downloadProof'));
    }
  };

  const handleDownloadReceipt = async (payment: PaymentDto) => {
    if (!condominiumId) {
      toastError(t('payments.error.noCondominium'));
      return;
    }

    if (!payment.receiptNumber || !payment.receiptYear) {
      toastError(t('payments.error.noReceipt'));
      return;
    }
    try {
      await paymentsApi.downloadReceipt(condominiumId, payment.id, payment.receiptNumber, payment.receiptYear);
    } catch (error: unknown) {
      console.error('Error downloading receipt:', error);
      toastError(getApiErrorMessage(error, t('payments.error.downloadReceipt'), t));
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      Pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: t('status.pending') },
      Approved: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: t('payments.status.approved') },
      Rejected: { icon: XCircle, color: 'bg-red-100 text-red-800', label: t('payments.status.rejected') },
      Cancelled: { icon: XCircle, color: 'bg-control text-ink-muted', label: t('status.cancelled') },
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
      MonthlyFee: t('payments.type.monthlyFee'),
      ExtraordinaryFee: t('payments.type.extraordinaryFee'),
      Reservation: t('payments.type.reservation'),
      Other: t('payments.type.other'),
    };
    return types[type] || type;
  };

  const getMethodName = (method: string) => {
    const methods: Record<string, string> = {
      BankTransfer: t('payments.method.bankTransfer'),
      MBWay: t('payments.method.mbway'),
      Card: t('payments.method.card'),
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
        title={t('payments.cancel.title')}
        message={t('payments.cancel.message')}
        confirmLabel={t('payments.cancel.title')}
        variant="danger"
        onConfirm={() => cancelPaymentId && handleCancel(cancelPaymentId)}
        onCancel={() => setCancelPaymentId(null)}
      />

      {/* Header */}
      <PageHeader
        title={t('payments.title')}
        subtitle={t('payments.subtitle')}
        actions={
          <Button onClick={() => setShowCreateModal(true)} icon={Plus} fullWidth className="sm:w-auto">
            {t('payments.new')}
          </Button>
        }
      />

      {/* Payments List */}
      <div className="bg-surface rounded-lg shadow">
        <div className="p-4 border-b border-line flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">{t('payments.history')}</h2>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => loadPayments()}>
              {t('payments.refresh')}
            </Button>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <FilterBar>
              <FilterChip label={t('payments.filter.all')} count={statusCounts.All} active={statusFilter === 'All'} onClick={() => handleStatusFilter('All')} />
              <FilterChip label={t('status.pending')} icon={Clock} count={statusCounts.Pending} active={statusFilter === 'Pending'} onClick={() => handleStatusFilter('Pending')} />
              <FilterChip label={t('payments.status.approved')} icon={CheckCircle} count={statusCounts.Approved} active={statusFilter === 'Approved'} onClick={() => handleStatusFilter('Approved')} />
              <FilterChip label={t('payments.status.rejected')} icon={XCircle} count={statusCounts.Rejected} active={statusFilter === 'Rejected'} onClick={() => handleStatusFilter('Rejected')} />
              <FilterChip label={t('status.cancelled')} icon={XCircle} count={statusCounts.Cancelled} active={statusFilter === 'Cancelled'} onClick={() => handleStatusFilter('Cancelled')} />
            </FilterBar>
            <div className="lg:w-64">
              <SearchBar
                value={searchQuery}
                onChange={handleSearch}
                placeholder={t('payments.searchPlaceholder')}
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
              title={t('payments.empty.title')}
              description={t('payments.empty.description')}
            />
          ) : !loadError && filteredPayments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title={t('payments.noResults.title')}
              description={t('payments.noResults.description')}
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
                        {t('payments.card.created', { date: formatDate(payment.createdDate) })}
                      </p>
                      {payment.proofOfPaymentUrl && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded" title={t('payments.proofAvailable')}>
                          <Download className="w-3 h-3" />
                          {t('payments.proof')}
                        </span>
                      )}
                      {payment.status === 'Approved' && payment.hasReceipt && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded" title={t('payments.receiptAvailable')}>
                          <FileText className="w-3 h-3" />
                          {t('payments.receipt')}
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
        title={t('payments.new')}
        maxWidthClass="max-w-lg"
      >
        <div className="p-6">
          <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('payments.form.type')}
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as CreatePaymentRequest['type'] })}
                  className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2"
                  required
                >
                  <option value="MonthlyFee">{t('payments.type.monthlyFee')}</option>
                  <option value="Reservation">{t('payments.type.reservation')}</option>
                  <option value="Other">{t('payments.type.other')}</option>
                </select>
              </div>

              {/* Quota Periodicity Selector */}
              {form.type === 'MonthlyFee' && (
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">
                    {t('payments.form.periodicity')}
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
                        {p === 'Monthly' ? t('payments.periodicity.monthly') : p === 'Quarterly' ? t('payments.periodicity.quarterly') : t('payments.periodicity.annual')}
                      </button>
                    ))}
                  </div>
                  {quotaPeriodicity === 'Monthly' && (
                    <p className="text-xs text-ink-subtle mt-2 bg-surface-muted px-3 py-2 rounded">
                      {t('payments.form.period')} <strong>{PT_MONTHS[currentMonth]}</strong> {currentYear}
                    </p>
                  )}
                  {quotaPeriodicity === 'Quarterly' && (
                    <div className="mt-2">
                      <select
                        value={trimestralStart}
                        onChange={(e) => setTrimestralStart(Number(e.target.value))}
                        className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2 text-sm"
                      >
                        <option value={1}>{t('payments.form.quarter1')}</option>
                        <option value={5}>{t('payments.form.quarter2')}</option>
                        <option value={9}>{t('payments.form.quarter3')}</option>
                      </select>
                    </div>
                  )}
                  {quotaPeriodicity === 'Annual' && (
                    <p className="text-xs text-ink-subtle mt-2 bg-surface-muted px-3 py-2 rounded">
                      {t('payments.form.period')} <strong>{t('payments.form.periodAnnual')}</strong> {currentYear}
                    </p>
                  )}
                </div>
              )}
              
              {/* Payment Method Selection */}
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('payments.form.method')}
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
                    <option value="BankTransfer">{t('payments.method.bankTransferNib')}</option>
                  )}
                  {paymentMethods?.mbWayEnabled && (
                    <option value="MBWay">{t('payments.method.mbway')}</option>
                  )}
                  {paymentMethods?.cardEnabled && (
                    <option value="Card">{t('payments.method.cardVisa')}</option>
                  )}
                  {!paymentMethods?.bankTransferEnabled && !paymentMethods?.mbWayEnabled && !paymentMethods?.cardEnabled && (
                    <option value="" disabled>{t('payments.method.none')}</option>
                  )}
                </select>
                {form.method !== 'BankTransfer' && form.method && (
                  <p className="text-xs text-blue-600 mt-1">
                    {t('payments.form.autoPayment')}
                  </p>
                )}
                {(!paymentMethods?.bankTransferEnabled && !paymentMethods?.mbWayEnabled && !paymentMethods?.cardEnabled) && (
                  <p className="text-xs text-orange-600 mt-1">
                    {t('payments.form.noMethodWarning')}
                  </p>
                )}
              </div>

              {/* Conditional Payment Method Details */}
              {form.method === 'BankTransfer' && paymentMethods?.bankTransferIban && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900 mb-1">{t('payments.form.transferData')}</p>
                  {paymentMethods.bankTransferAccountHolder && (
                    <p className="text-sm text-blue-800">
                      <strong>{t('payments.form.accountHolder')}</strong> {paymentMethods.bankTransferAccountHolder}
                    </p>
                  )}
                  <p className="text-sm text-blue-800">
                    <strong>IBAN:</strong> {paymentMethods.bankTransferIban}
                  </p>
                </div>
              )}
              
              {form.method === 'MBWay' && paymentMethods?.mbWayPhoneNumber && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900 mb-1">{t('payments.form.mbwayData')}</p>
                  <p className="text-sm text-blue-800">
                    <strong>{t('payments.form.phoneNumber')}</strong> {paymentMethods.mbWayPhoneNumber}
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('payments.form.amount')}
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
                  placeholder={t('payments.form.amountPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('common.description')}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-line bg-surface text-ink rounded-lg px-3 py-2"
                  rows={3}
                  required
                  placeholder={t('payments.form.descriptionPlaceholder')}
                />
              </div>
              
              {/* Proof of Payment Upload - Only for Bank Transfer */}
              {form.method === 'BankTransfer' && (
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">
                    {t('payments.form.proof')} <span className="text-red-500">*</span>
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
                            toastError(t('payments.error.proofTooLarge', { limit: formatUploadSizeLabel(maxUploadSizeBytes) }));
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
                          <p className="font-medium">{t('payments.form.clickToSelect')}</p>
                          <p className="text-xs text-ink-subtle">{t('payments.form.fileHint', { limit: formatUploadSizeLabel(maxUploadSizeBytes) })}</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-blue-800 bg-blue-50 p-3 rounded border border-blue-200">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                <strong>{t('payments.form.important')}</strong> {form.method === 'BankTransfer' 
                  ? t('payments.form.importantBank') 
                  : t('payments.form.importantAuto')}
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
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  disabled={form.method === 'BankTransfer' && !proofFile}
                  fullWidth
                  className="flex-1"
                >
                  {t('payments.form.submit')}
                </Button>
              </div>
            </form>
        </div>
      </ModalPopup>

      {/* Payment Details Modal */}
      <ModalPopup
        open={selectedPayment !== null}
        onClose={() => setSelectedPayment(null)}
        title={t('payments.details.title')}
        maxWidthClass="max-w-lg"
      >
        {selectedPayment && (
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-ink-muted">{t('payments.details.status')}</span>
              {getStatusBadge(selectedPayment.status)}
              </div>
              <div className="flex justify-between">
              <span className="text-ink-muted">{t('payments.details.type')}</span>
              <span className="font-medium">{getTypeName(selectedPayment.type)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">{t('payments.details.method')}</span>
              <span className="font-medium">{getMethodName(selectedPayment.method)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">{t('payments.details.amount')}</span>
              <span className="font-bold text-lg">€{selectedPayment.amount.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-ink-muted block mb-1">{t('payments.details.description')}</span>
              <p className="text-sm">{selectedPayment.description}</p>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">{t('payments.details.createdAt')}</span>
              <span>{formatDateTime(selectedPayment.createdDate)}</span>
            </div>
            {selectedPayment.processedDate && (
              <div className="flex justify-between">
                <span className="text-ink-muted">{t('payments.details.processedAt')}</span>
                <span>{formatDateTime(selectedPayment.processedDate)}</span>
              </div>
            )}
            {selectedPayment.processedByUserName && (
              <div className="flex justify-between">
                <span className="text-ink-muted">{t('payments.details.processedBy')}</span>
                <span>{selectedPayment.processedByUserName}</span>
              </div>
            )}
            {selectedPayment.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <span className="text-red-900 font-semibold block mb-1">{t('payments.details.rejectionReason')}</span>
                <p className="text-sm text-red-800">{selectedPayment.rejectionReason}</p>
              </div>
            )}
            
            {/* Receipt Information */}
            {selectedPayment.status === 'Approved' && selectedPayment.hasReceipt && (
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <span className="text-green-900 font-semibold block mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {t('payments.details.receiptIssued')}
                </span>
                <p className="text-sm text-green-800">
                  {t('payments.details.receiptNumber', { number: selectedPayment.receiptNumber ?? '', year: selectedPayment.receiptYear ?? '' })}
                </p>
                {selectedPayment.receiptIssuedDate && (
                  <p className="text-xs text-green-700 mt-1">
                    {t('payments.details.issuedOn', { date: formatDate(selectedPayment.receiptIssuedDate) })}
                  </p>
                )}
                {selectedPayment.receiptIssuedByUserName && (
                  <p className="text-xs text-green-700">
                    {t('payments.details.by', { name: selectedPayment.receiptIssuedByUserName })}
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Document Actions */}
          {(selectedPayment.proofOfPaymentUrl || (selectedPayment.status === 'Approved' && selectedPayment.hasReceipt)) && (
            <div className="mt-4 pt-4 border-t border-line">
              <h3 className="text-sm font-semibold text-ink mb-2">{t('payments.details.documents')}</h3>
              <div className="flex flex-col gap-2">
                {selectedPayment.proofOfPaymentUrl && (
                  <Button
                    icon={Download}
                    onClick={() => handleDownloadProof(selectedPayment.id, selectedPayment.description)}
                    fullWidth
                  >
                    {t('payments.details.downloadProof')}
                  </Button>
                )}
                {selectedPayment.status === 'Approved' && selectedPayment.hasReceipt && (
                  <Button
                    variant="success"
                    icon={FileText}
                    onClick={() => handleDownloadReceipt(selectedPayment)}
                    fullWidth
                  >
                    {t('payments.details.downloadReceipt')}
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
                {t('payments.details.cancelPayment')}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setSelectedPayment(null)}
              fullWidth
              className={selectedPayment.status === 'Pending' ? 'flex-1' : 'w-full'}
            >
              {t('payments.close')}
            </Button>
          </div>
        </div>
        )}
      </ModalPopup>
    </div>
  );
}
