import { useEffect, useState, useCallback } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet, PiggyBank, Trash2, Calendar, Info, ArrowDownToLine, ArrowUpFromLine, FileText, Upload as UploadIcon, Check, XCircle, Clock, CheckCircle, Edit2, Eye, ChevronDown, ChevronUp, Save, BarChart3 } from 'lucide-react';
import { financialApi, documentsApi, paymentsApi, unitsApi, quotaPlansApi, expenseCategoriesApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import AnnualReportModal from '../components/AnnualReportModal';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import FileUpload from '../components/FileUpload';
import { PageHeader, Button, Skeleton, ErrorState, DataTable, Card, FilterBar, FilterChip, Autocomplete, Badge } from '../components/ui';
import type { FinancialRecordDto, CreateFinancialRecordRequest, PaginatedResponse, FinancialDashboardDto, ReserveFundDto, PaymentDto, UnitDto, QuotaPlanDto, ExpenseCategoryDto } from '../types';

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

// Updated category mappings matching backend FinancialCategory enum
const incomeCategoryLabels = (t: TranslateFn): Record<string, string> => ({
  MonthlyFees: t('financial.category.MonthlyFees'),
  ExtraordinaryFees: t('financial.category.ExtraordinaryFees'),
  LateFeeInterest: t('financial.category.LateFeeInterest'),
  OtherIncome: t('financial.category.OtherIncome'),
});

const expenseCategoryLabels = (t: TranslateFn): Record<string, string> => ({
  Maintenance: t('financial.category.Maintenance'),
  Insurance: t('financial.category.Insurance'),
  Utilities: t('financial.category.Utilities'),
  Administration: t('financial.category.Administration'),
  Services: t('financial.category.Services'),
  Property: t('financial.category.Property'),
  Legal: t('financial.category.Legal'),
  Accounting: t('financial.category.Accounting'),
  OtherExpense: t('financial.category.OtherExpense'),
});

// Financial document types
const financialDocTypeLabels = (t: TranslateFn): Record<string, string> => ({
  FinancialBankStatement: t('financial.docType.FinancialBankStatement'),
  FinancialAnnualReport: t('financial.docType.FinancialAnnualReport'),
  FinancialBudget: t('financial.docType.FinancialBudget'),
  FinancialAudit: t('financial.docType.FinancialAudit'),
  FinancialTaxDocument: t('financial.docType.FinancialTaxDocument'),
  FinancialOther: t('financial.docType.FinancialOther'),
});

export default function FinancialPage() {
  const { isAdmin, condominiumId } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const { t, formatDate } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [dashboardLoadError, setDashboardLoadError] = useState('');
  const [recordsLoadError, setRecordsLoadError] = useState('');
  const [paymentsLoadError, setPaymentsLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<'transactions' | 'cashin' | 'quota-plans'>('transactions');
  const [dashboard, setDashboard] = useState<FinancialDashboardDto | null>(null);
  const [reserveFund, setReserveFund] = useState<ReserveFundDto | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  
  // Confirm modals state
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [approvePaymentId, setApprovePaymentId] = useState<string | null>(null);
  const [issueReceiptId, setIssueReceiptId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Cash In - All payments (Admin only)
  const [allPayments, setAllPayments] = useState<PaymentDto[]>([]);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected' | 'AwaitingReceipt'>('Pending');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentDto | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // Records pagination
  const [records, setRecords] = useState<FinancialRecordDto[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<FinancialRecordDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Income' | 'Expense'>('All');
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Form states
  const [showForm, setShowForm] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundOperation, setFundOperation] = useState<'deposit' | 'withdrawal'>('deposit');
  const [fundAmount, setFundAmount] = useState('');
  const [form, setForm] = useState({
    type: 'Expense',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    incomeCategory: 'OtherIncome',
    expenseCategoryId: '',
    condominiumId: condominiumId || '',
  });
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryDto[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Document upload states
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    type: 'FinancialBankStatement',
    description: '',
    year: new Date().getFullYear().toString(),
  });
  const [uploading, setUploading] = useState(false);

  // Update condominiumId when it changes
  useEffect(() => {
    if (condominiumId) {
      setForm(prev => ({ ...prev, condominiumId }));
    }
  }, [condominiumId]);

  // Load active expense categories for the autocomplete (Admin only - Residents don't need expense categories)
  useEffect(() => {
    if (!condominiumId || !isAdmin) return;
    setCategoriesLoading(true);
    expenseCategoriesApi.getActive(condominiumId)
      .then((r) => setExpenseCategories(r.data))
      .catch((error) => {
        console.error('Error loading expense categories:', error);
        toastError(t('financial.error.loadCategories'));
      })
      .finally(() => setCategoriesLoading(false));
  }, [condominiumId, isAdmin, t, toastError]);

  // Load dashboard and available years
  useEffect(() => {
    if (!condominiumId) return;
    
    setLoading(true);
    setDashboardLoadError('');
    Promise.all([
      financialApi.getDashboard(condominiumId, selectedYear),
      financialApi.getCurrentReserveFund(condominiumId),
      financialApi.getFiscalYears(condominiumId),
    ])
      .then(([dashboardRes, fundRes, yearsRes]) => {
        setDashboard(dashboardRes.data);
        setReserveFund(fundRes.data);
        setAvailableYears(yearsRes.data);
      })
      .catch(error => {
        console.error('Erro ao carregar dados financeiros:', error);
        setDashboardLoadError(t('financial.error.loadDashboard'));
        toastError(t('financial.error.loadDashboardToast'));
      })
      .finally(() => setLoading(false));
  }, [condominiumId, selectedYear, toastError, t]);

  // Load records with pagination
  const loadRecords = useCallback((page: number = 1) => {
    if (!condominiumId) return;
    setRecordsLoadError('');

    financialApi.getByYear(condominiumId, selectedYear, page, pageSize, debouncedSearch, typeFilter === 'All' ? undefined : typeFilter)
      .then((r) => {
        setPagination(r.data);
        setRecords(r.data.items);
        setCurrentPage(page);
      })
      .catch(error => {
        console.error('Erro ao carregar registos:', error);
        setRecordsLoadError(t('financial.error.loadRecords'));
      });
  }, [condominiumId, selectedYear, pageSize, debouncedSearch, typeFilter, t]);

  useEffect(() => {
    if (condominiumId) {
      loadRecords(1);
    }
  }, [condominiumId, selectedYear, loadRecords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!condominiumId) {
      toastError(t('financial.error.noCondominium'));
      return;
    }
    
    if (!form.condominiumId) {
      toastError(t('financial.error.noCondominium'));
      return;
    }
    
    if (!form.description || form.description.trim() === '') {
      toastError(t('financial.error.descriptionRequired'));
      return;
    }
    
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toastError(t('financial.error.amountPositive'));
      return;
    }

    if (form.type === 'Expense' && !form.expenseCategoryId) {
      toastError(t('financial.error.expenseCategoryRequired'));
      return;
    }
    
    setSubmitting(true);
    try {
      const requestData: CreateFinancialRecordRequest = {
        type: form.type,
        amount: parseFloat(form.amount),
        description: form.description,
        date: `${form.date}T00:00:00.000Z`,
        condominiumId: form.condominiumId,
        ...(form.type === 'Income'
          ? { incomeCategory: form.incomeCategory }
          : { expenseCategoryId: form.expenseCategoryId || undefined }),
        receiptUrl: undefined,
      };
      
      await financialApi.create(condominiumId, requestData);
      setShowForm(false);
      setForm({ 
        type: 'Expense', 
        amount: '', 
        description: '', 
        date: new Date().toISOString().split('T')[0], 
        incomeCategory: 'OtherIncome',
        expenseCategoryId: '',
        condominiumId: form.condominiumId 
      });
      
      // Reload data
      if (condominiumId) {
        const [dashboardRes, fundRes] = await Promise.all([
          financialApi.getDashboard(condominiumId, selectedYear),
          financialApi.getCurrentReserveFund(condominiumId),
        ]);
        setDashboard(dashboardRes.data);
        setReserveFund(fundRes.data);
      }
      loadRecords();
    } catch (error: unknown) {
      console.error('Erro ao criar registo financeiro:', error);
      toastError(t('financial.error.createRecord', { message: getApiErrorMessage(error, t('financial.error.unknown')) }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteRecordId(id);
  };

  const confirmDeleteRecord = async () => {
    if (!deleteRecordId || !condominiumId) return;
    try {
      await financialApi.delete(condominiumId, deleteRecordId);
      if (condominiumId) {
        const [dashboardRes, fundRes] = await Promise.all([
          financialApi.getDashboard(condominiumId, selectedYear),
          financialApi.getCurrentReserveFund(condominiumId),
        ]);
        setDashboard(dashboardRes.data);
        setReserveFund(fundRes.data);
      }
      loadRecords();
    } catch (error) {
      console.error('Erro ao eliminar registo:', error);
      toastError(t('financial.error.deleteRecord'));
    } finally {
      setDeleteRecordId(null);
    }
  };

  const handleDownloadProof = async (paymentId: string, description: string) => {
    if (!condominiumId) {
      toastError(t('financial.error.noCondominiumSelected'));
      return;
    }

    try {
      await paymentsApi.downloadProof(condominiumId, paymentId, description);
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toastError(t('financial.error.downloadProof'));
    }
  };

  const handleFundOperation = async () => {
    if (!condominiumId) return;
    if (!fundAmount || parseFloat(fundAmount) <= 0) {
      toastError(t('financial.error.invalidAmount'));
      return;
    }

    setSubmitting(true);
    try {
      const amount = parseFloat(fundAmount);
      if (fundOperation === 'deposit') {
        await financialApi.addDeposit(condominiumId, amount);
      } else {
        await financialApi.addWithdrawal(condominiumId, amount);
      }
      
      // Reload data
      const [dashboardRes, fundRes] = await Promise.all([
        financialApi.getDashboard(condominiumId, selectedYear),
        financialApi.getCurrentReserveFund(condominiumId),
      ]);
      setDashboard(dashboardRes.data);
      setReserveFund(fundRes.data);
      
      setShowFundModal(false);
      setFundAmount('');
      loadRecords();
    } catch (error: unknown) {
      console.error('Erro na operação do fundo:', error);
      toastError(getApiErrorMessage(error, t('financial.error.fundOperation')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDocumentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !condominiumId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', uploadForm.name);
      formData.append('type', uploadForm.type);
      formData.append('context', 'Financial');
      formData.append('year', uploadForm.year);
      
      if (uploadForm.description) {
        formData.append('description', uploadForm.description);
      }

      await documentsApi.upload(condominiumId, formData);
      setShowDocumentModal(false);
      setUploadFile(null);
      setUploadForm({
        name: '',
        type: 'FinancialBankStatement',
        description: '',
        year: new Date().getFullYear().toString(),
      });
      toastSuccess(t('financial.success.documentUploaded'));
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toastError(t('financial.error.uploadDocument'));
    } finally {
      setUploading(false);
    }
  };

  const openDocumentModal = () => {
    setUploadForm({
      name: '',
      type: 'FinancialBankStatement',
      description: '',
      year: selectedYear.toString(),
    });
    setUploadFile(null);
    setShowDocumentModal(true);
  };

  // Payment functions
  const loadAllPayments = useCallback(async () => {
    if (!isAdmin || !condominiumId) return;
    setPaymentsLoadError('');
    try {
      // Load all payments (up to 500)
      const response = await paymentsApi.getPaged(condominiumId, 1, 500);
      setAllPayments(response.data.items);
    } catch (error) {
      console.error('Error loading payments:', error);
      setPaymentsLoadError(t('financial.error.loadPayments'));
    }
  }, [isAdmin, condominiumId, t]);

  const handleApprovePayment = async (paymentId: string) => {
    setApprovePaymentId(paymentId);
  };

  const confirmApprovePayment = async () => {
    if (!approvePaymentId || !condominiumId) return;
    try {
      await paymentsApi.approve(condominiumId, approvePaymentId);
      loadAllPayments();
      toastSuccess(t('financial.success.paymentApproved'));
    } catch (error: unknown) {
      console.error('Error approving payment:', error);
      toastError(getApiErrorMessage(error, t('financial.error.approvePayment')));
    } finally {
      setApprovePaymentId(null);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedPayment || !rejectionReason.trim() || !condominiumId) {
      toastError(t('financial.error.rejectionReasonRequired'));
      return;
    }
    try {
      await paymentsApi.reject(condominiumId, selectedPayment.id, { rejectionReason });
      setShowRejectModal(false);
      setSelectedPayment(null);
      setRejectionReason('');
      loadAllPayments();
      toastSuccess(t('financial.success.paymentRejected'));
    } catch (error: unknown) {
      console.error('Error rejecting payment:', error);
      toastError(getApiErrorMessage(error, t('financial.error.rejectPayment')));
    }
  };

  const handleIssueReceipt = async (paymentId: string) => {
    setIssueReceiptId(paymentId);
  };

  const confirmIssueReceipt = async () => {
    if (!issueReceiptId || !condominiumId) return;
    try {
      await paymentsApi.issueReceipt(condominiumId, issueReceiptId);
      loadAllPayments();
      toastSuccess(t('financial.success.receiptIssued'));
    } catch (error: unknown) {
      console.error('Error issuing receipt:', error);
      toastError(getApiErrorMessage(error, t('financial.error.issueReceipt')));
    } finally {
      setIssueReceiptId(null);
    }
  };

  const handleDownloadReceipt = async (payment: PaymentDto) => {
    if (!condominiumId) {
      toastError(t('financial.error.noCondominiumSelected'));
      return;
    }

    if (!payment.receiptNumber || !payment.receiptYear) {
      toastError(t('financial.error.noReceiptYet'));
      return;
    }
    try {
      await paymentsApi.downloadReceipt(condominiumId, payment.id, payment.receiptNumber, payment.receiptYear);
    } catch (error: unknown) {
      console.error('Error downloading receipt:', error);
      toastError(getApiErrorMessage(error, t('financial.error.downloadReceipt')));
    }
  };

  // Load payments up-front (admin only) so the "Cash In" badge reflects
  // pending payments as soon as the page opens, not only after the tab is clicked.
  useEffect(() => {
    if (isAdmin) {
      loadAllPayments();
    }
  }, [isAdmin, condominiumId, loadAllPayments]);

  // Filter and search payments
  const filteredPayments = allPayments.filter(payment => {
    // Status filter
    if (paymentStatusFilter === 'AwaitingReceipt') {
      if (!(payment.status === 'Approved' && !payment.hasReceipt)) {
        return false;
      }
    } else if (paymentStatusFilter !== 'All' && payment.status !== paymentStatusFilter) {
      return false;
    }
    
    // Search query
    if (paymentSearchQuery.trim()) {
      const query = paymentSearchQuery.toLowerCase();
      return (
        payment.residentName.toLowerCase().includes(query) ||
        payment.unitIdentifier.toLowerCase().includes(query) ||
        payment.description.toLowerCase().includes(query) ||
        payment.amount.toString().includes(query)
      );
    }
    
    return true;
  });

  // Count by status
  const paymentCounts = {
    all: allPayments.length,
    pending: allPayments.filter(p => p.status === 'Pending').length,
    approved: allPayments.filter(p => p.status === 'Approved').length,
    rejected: allPayments.filter(p => p.status === 'Rejected').length,
    awaitingReceipt: allPayments.filter(p => p.status === 'Approved' && !p.hasReceipt).length,
  };

  const allCategoryLabels = { ...incomeCategoryLabels(t), ...expenseCategoryLabels(t) };

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={deleteRecordId !== null}
        title={t('financial.confirm.deleteRecord.title')}
        message={t('financial.confirm.deleteRecord.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDeleteRecord}
        onCancel={() => setDeleteRecordId(null)}
      />
      <ConfirmModal
        open={approvePaymentId !== null}
        title={t('financial.confirm.approvePayment.title')}
        message={t('financial.confirm.approvePayment.message')}
        confirmLabel={t('financial.action.approve')}
        variant="default"
        onConfirm={confirmApprovePayment}
        onCancel={() => setApprovePaymentId(null)}
      />
      <ConfirmModal
        open={issueReceiptId !== null}
        title={t('financial.confirm.issueReceipt.title')}
        message={t('financial.confirm.issueReceipt.message')}
        confirmLabel={t('financial.action.issue')}
        variant="default"
        onConfirm={confirmIssueReceipt}
        onCancel={() => setIssueReceiptId(null)}
      />
      <AnnualReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        condominiumId={condominiumId}
        year={selectedYear}
      />
      {/* Header */}
      <PageHeader
        title={t('financial.title')}
        subtitle={t('financial.subtitle')}
        actions={
          <>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{t('financial.fiscalYear', { year })}</option>
              ))}
            </select>
            {isAdmin && (
              <>
                <Button variant="secondary" onClick={() => setShowReportModal(true)} icon={BarChart3}>
                  {t('financial.report.open')}
                </Button>
                <Button variant="secondary" onClick={openDocumentModal} icon={FileText}>
                  {t('financial.addDocument')}
                </Button>
                <Button onClick={() => setShowForm(true)} icon={Plus}>
                  {t('financial.newRecord')}
                </Button>
              </>
            )}
          </>
        }
      />

      {/* Tabs (Admin only) */}
      {isAdmin && (
        <div className="bg-surface rounded-lg shadow-sm border border-line">
          <div className="flex border-b border-line">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'transactions'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-ink-subtle hover:text-ink-muted'
              }`}
            >
              {t('financial.tab.transactions')}
            </button>
            <button
              onClick={() => setActiveTab('cashin')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'cashin'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-ink-subtle hover:text-ink-muted'
              }`}
            >
              {t('financial.tab.cashin')}
              {paymentCounts.pending > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {paymentCounts.pending}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('quota-plans')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'quota-plans'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-ink-subtle hover:text-ink-muted'
              }`}
            >
              {t('financial.tab.quotaPlans')}
            </button>
          </div>
        </div>
      )}

      {/* Transactions Tab Content */}
      {activeTab === 'transactions' && (
        <>
          {dashboardLoadError && (
            <ErrorState
              message={dashboardLoadError}
              onRetry={() => {
                if (condominiumId) {
                  setLoading(true);
                  setDashboardLoadError('');
                  Promise.all([
                    financialApi.getDashboard(condominiumId, selectedYear),
                    financialApi.getCurrentReserveFund(condominiumId),
                    financialApi.getFiscalYears(condominiumId),
                  ])
                    .then(([dashboardRes, fundRes, yearsRes]) => {
                      setDashboard(dashboardRes.data);
                      setReserveFund(fundRes.data);
                      setAvailableYears(yearsRes.data);
                    })
                    .catch(() => setDashboardLoadError(t('financial.error.loadDashboard')))
                    .finally(() => setLoading(false));
                }
              }}
            />
          )}

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">{t('financial.info.title')}</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li><strong>{t('financial.info.currentAccount')}</strong> {t('financial.info.currentAccountDesc', { year: selectedYear })}</li>
                <li><strong>{t('financial.info.reserveFund')}</strong> {t('financial.info.reserveFundDesc')}</li>
                <li>{t('financial.info.yearEnd')}</li>
              </ul>
            </div>
          </div>
        </>
      )}

      {activeTab === 'transactions' && loading ? (
        <Skeleton variant="card" rows={4} />
      ) : activeTab === 'transactions' ? (
        <>
          {/* Dashboard Cards */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Current Account Card */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-indigo-600" />
                  <h2 className="font-semibold text-ink">{t('financial.currentAccount', { year: selectedYear })}</h2>
                </div>
                <Calendar className="w-4 h-4 text-ink-subtle" />
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900">{t('financial.income')}</span>
                  </div>
                  <span className="text-lg font-bold text-green-700">
                    €{dashboard?.currentYearIncome.toFixed(2) || '0.00'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-900">{t('financial.expenses')}</span>
                  </div>
                  <span className="text-lg font-bold text-red-700">
                    €{dashboard?.currentYearExpenses.toFixed(2) || '0.00'}
                  </span>
                </div>
                
                <div className={`flex justify-between items-center p-3 rounded-lg border-2 ${
                  (dashboard?.currentYearBalance || 0) >= 0 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <span className={`text-sm font-semibold ${
                    (dashboard?.currentYearBalance || 0) >= 0 ? 'text-blue-900' : 'text-orange-900'
                  }`}>
                    {t('financial.yearBalance')}
                  </span>
                  <span className={`text-xl font-bold ${
                    (dashboard?.currentYearBalance || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'
                  }`}>
                    €{dashboard?.currentYearBalance.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Reserve Fund Card */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl shadow-sm border border-emerald-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-semibold text-ink">{t('financial.reserveFund')}</h2>
                </div>
                {isAdmin && (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => {
                      setFundOperation('deposit');
                      setShowFundModal(true);
                    }}
                  >
                    {t('financial.manageFund')}
                  </Button>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-emerald-900 font-medium">{t('financial.currentBalance')}</span>
                  <span className="text-3xl font-bold text-emerald-700">
                    €{reserveFund?.closingBalance.toFixed(2) || '0.00'}
                  </span>
                </div>
                
                <div className="pt-3 border-t border-emerald-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-800 flex items-center gap-1">
                      <ArrowDownToLine className="w-3 h-3" />
                      {t('financial.deposits', { year: selectedYear })}
                    </span>
                    <span className="font-semibold text-emerald-700">
                      +€{dashboard?.reserveFundDeposits.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-800 flex items-center gap-1">
                      <ArrowUpFromLine className="w-3 h-3" />
                      {t('financial.withdrawals', { year: selectedYear })}
                    </span>
                    <span className="font-semibold text-red-600">
                      -€{dashboard?.reserveFundWithdrawals.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
                
                <div className="pt-2 text-xs text-emerald-700">
                  {t('financial.reserveFundHint')}
                </div>
              </div>
            </div>
          </div>

          {/* Records List */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-ink">{t('financial.records', { year: selectedYear })}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <FilterBar>
                  <FilterChip label={t('financial.filter.all')} active={typeFilter === 'All'} onClick={() => setTypeFilter('All')} />
                  <FilterChip label={t('financial.income')} icon={TrendingUp} active={typeFilter === 'Income'} onClick={() => setTypeFilter('Income')} />
                  <FilterChip label={t('financial.expenses')} icon={TrendingDown} active={typeFilter === 'Expense'} onClick={() => setTypeFilter('Expense')} />
                </FilterBar>
                <div className="w-64">
                  <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder={t('financial.searchPlaceholder')}
                  />
                </div>
              </div>
            </div>
            {recordsLoadError && (
              <ErrorState
                message={recordsLoadError}
                onRetry={() => loadRecords(currentPage)}
                className="mx-5 mt-4"
              />
            )}
            
            {!recordsLoadError && records.length === 0 ? (
              <div className="text-center py-12 text-ink-subtle">
                {searchQuery ? t('financial.noResultsFor', { query: searchQuery }) : t('financial.noRecords', { year: selectedYear })}
              </div>
            ) : !recordsLoadError ? (
              <>
                <div className="divide-y divide-line">
                  {records.map((r) => (
                    <div key={r.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-hover transition-colors">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        r.type === 'Income' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {r.type === 'Income' ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{r.description}</p>
                        <p className="text-xs text-ink-subtle">
                          {r.categoryType === 'Income' ? (allCategoryLabels[r.category] || r.category) : r.category} · {formatDate(r.date)}
                        </p>
                        {r.hashtags && r.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.hashtags.map((tag) => (
                              <Badge key={tag} variant="info" size="sm">#{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className={`font-semibold text-sm shrink-0 ${
                        r.type === 'Income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {r.type === 'Income' ? '+' : '-'}€{r.amount.toFixed(2)}
                      </p>
                      {isAdmin && (
                        <button 
                          onClick={() => handleDelete(r.id)} 
                          className="text-ink-subtle hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pagination && records.length > 0 && (
                  <div className="p-4 border-t border-line">
                    <Pagination
                      pagination={pagination}
                      currentPage={currentPage}
                      onPageChange={loadRecords}
                    />
                  </div>
                )}
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {/* New Record Modal */}
      <ModalPopup
        open={showForm && isAdmin}
        onClose={() => setShowForm(false)}
        title={t('financial.form.title')}
        maxWidthClass="max-w-2xl"
      >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">{t('financial.form.type')}</label>
                  <select
                    value={form.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setForm({
                        ...form,
                        type: newType,
                        incomeCategory: newType === 'Income' ? 'MonthlyFees' : form.incomeCategory,
                        expenseCategoryId: newType === 'Expense' ? '' : form.expenseCategoryId,
                      });
                    }}
                    className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Income">{t('financial.type.income')}</option>
                    <option value="Expense">{t('financial.type.expense')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">{t('financial.form.category')}</label>
                  {form.type === 'Income' ? (
                    <select
                      value={form.incomeCategory}
                      onChange={(e) => setForm({ ...form, incomeCategory: e.target.value })}
                      className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {Object.entries(incomeCategoryLabels(t)).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <Autocomplete
                      value={form.expenseCategoryId || null}
                      onChange={(id) => setForm({ ...form, expenseCategoryId: id ?? '' })}
                      options={expenseCategories.map((c) => ({
                        id: c.id,
                        label: c.name,
                        hashtags: c.hashtags,
                      }))}
                      loading={categoriesLoading}
                      placeholder={t('financial.form.categoryPlaceholder')}
                      emptyMessage={t('financial.form.noCategories')}
                      showSelectedHashtags
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">{t('financial.form.amount')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">{t('common.date')}</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('common.description')}</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('financial.form.descriptionPlaceholder')}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-line">
                <Button
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={submitting}>
                  {t('financial.form.save')}
                </Button>
              </div>
            </form>
      </ModalPopup>

      {/* Fund Management Modal */}
      <ModalPopup
        open={showFundModal && isAdmin}
        onClose={() => setShowFundModal(false)}
        title={t('financial.fund.title')}
        maxWidthClass="max-w-md"
      >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">{t('financial.fund.operation')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFundOperation('deposit')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      fundOperation === 'deposit'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-control text-ink-muted hover:bg-control-hover'
                    }`}
                  >
                    {t('financial.fund.deposit')}
                  </button>
                  <button
                    onClick={() => setFundOperation('withdrawal')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      fundOperation === 'withdrawal'
                        ? 'bg-orange-600 text-white'
                        : 'bg-control text-ink-muted hover:bg-control-hover'
                    }`}
                  >
                    {t('financial.fund.withdrawal')}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('financial.form.amount')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.00"
                />
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                {fundOperation === 'deposit' ? (
                  <p>{t('financial.fund.depositHint')}</p>
                ) : (
                  <p>{t('financial.fund.withdrawalHint', { balance: reserveFund?.closingBalance.toFixed(2) || '0.00' })}</p>
                )}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-line flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowFundModal(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant={fundOperation === 'deposit' ? 'success' : 'warning'}
                onClick={handleFundOperation}
                loading={submitting}
                disabled={!fundAmount || parseFloat(fundAmount) <= 0}
              >
                {fundOperation === 'deposit' ? t('financial.fund.transferToFund') : t('financial.fund.withdrawFromFund')}
              </Button>
            </div>
      </ModalPopup>

      {/* Document Upload Modal */}
      <ModalPopup
        open={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        title={t('financial.document.title')}
        maxWidthClass="max-w-2xl"
      >
            <form onSubmit={handleDocumentUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  {t('financial.document.file')}
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
                  {t('financial.document.name')}
                </label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={t('financial.document.namePlaceholder')}
                  required
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('financial.document.type')}
                </label>
                <select
                  value={uploadForm.type}
                  onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                  disabled={uploading}
                >
                  {Object.entries(financialDocTypeLabels(t)).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('financial.document.description')}
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  placeholder={t('financial.document.descriptionPlaceholder')}
                  disabled={uploading}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-line">
                <Button
                  variant="ghost"
                  onClick={() => setShowDocumentModal(false)}
                  disabled={uploading}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  icon={UploadIcon}
                  loading={uploading}
                  disabled={!uploadFile}
                >
                  {t('financial.document.upload')}
                </Button>
              </div>
            </form>
      </ModalPopup>

      {/* Cash In Tab - Unified Payments Management */}
      {activeTab === 'cashin' && isAdmin && (
        <div className="bg-surface rounded-lg shadow-sm border border-line">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-ink">
                {t('financial.cashin.title')}
              </h2>
              <div className="flex gap-2 text-xs text-ink-muted">
                <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded">
                  {t('financial.cashin.pending', { count: paymentCounts.pending })}
                </span>
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded">
                  {t('financial.cashin.approved', { count: paymentCounts.approved })}
                </span>
                <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded">
                  {t('financial.cashin.awaitingReceipt', { count: paymentCounts.awaitingReceipt })}
                </span>
                <span className="px-2 py-1 bg-red-50 text-red-700 rounded">
                  {t('financial.cashin.rejected', { count: paymentCounts.rejected })}
                </span>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="mb-6 flex gap-3">
              <div className="flex-1">
                <SearchBar
                  value={paymentSearchQuery}
                  onChange={setPaymentSearchQuery}
                  placeholder={t('financial.cashin.searchPlaceholder')}
                />
              </div>
              <div className="min-w-[200px]">
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value as 'All' | 'Pending' | 'Approved' | 'Rejected' | 'AwaitingReceipt')}
                  className="w-full px-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Pending">{t('financial.cashin.filterPending')}</option>
                  <option value="Approved">{t('financial.cashin.filterApproved')}</option>
                  <option value="AwaitingReceipt">{t('financial.cashin.filterAwaitingReceipt')}</option>
                  <option value="Rejected">{t('financial.cashin.filterRejected')}</option>
                  <option value="All">{t('financial.cashin.filterAll')}</option>
                </select>
              </div>
            </div>

            {/* Payments List */}
            {paymentsLoadError ? (
              <ErrorState message={paymentsLoadError} onRetry={loadAllPayments} />
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12 text-ink-subtle">
                {paymentSearchQuery ? 
                  t('financial.cashin.noSearchResults') : 
                  paymentStatusFilter === 'AwaitingReceipt'
                    ? t('financial.cashin.noAwaitingReceipt')
                    : t('financial.cashin.noPayments', { status: paymentStatusFilter === 'All' ? '' : paymentStatusFilter.toLowerCase() })
                }
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="border border-line rounded-lg p-4 hover:bg-surface-hover"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-ink">
                            {payment.residentName} - {payment.unitIdentifier}
                          </h3>
                          {/* Status Badge */}
                          {payment.status === 'Pending' && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded">
                              <Clock className="w-3 h-3 mr-1" />
                              {t('status.pending')}
                            </span>
                          )}
                          {payment.status === 'Approved' && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {t('financial.status.approved')}
                            </span>
                          )}
                          {payment.status === 'Rejected' && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded">
                              <XCircle className="w-3 h-3 mr-1" />
                              {t('financial.status.rejected')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-ink-muted mt-1">{payment.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <p className="text-xs text-ink-subtle">
                            {t('financial.payment.created', { date: formatDate(payment.createdDate) })}
                          </p>
                          <p className="text-xs text-blue-600">
                            {payment.method === 'BankTransfer' ? t('financial.method.bankTransfer') : 
                             payment.method === 'MBWay' ? t('financial.method.mbway') : 
                             payment.method === 'Card' ? t('financial.method.card') : payment.method}
                          </p>
                        </div>
                        
                        {/* Receipt Info for Approved */}
                        {payment.status === 'Approved' && payment.hasReceipt && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded">
                              {t('financial.payment.receiptNumber', { number: payment.receiptNumber ?? '', year: payment.receiptYear ?? '' })}
                            </span>
                            {payment.receiptIssuedDate && (
                              <span className="text-xs text-ink-subtle">
                                {t('financial.payment.issued', { date: formatDate(payment.receiptIssuedDate) })}
                              </span>
                            )}
                          </div>
                        )}
                        {payment.status === 'Approved' && !payment.hasReceipt && (
                          <span className="inline-flex items-center mt-2 px-2 py-1 text-xs font-medium text-orange-800 bg-orange-100 rounded">
                            {t('financial.payment.awaitingReceipt')}
                          </span>
                        )}
                        
                        {/* Rejection Reason */}
                        {payment.status === 'Rejected' && payment.rejectionReason && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                            <strong>{t('financial.payment.reason')}</strong> {payment.rejectionReason}
                          </div>
                        )}

                        {/* Processed Info */}
                        {payment.processedDate && (
                          <p className="text-xs text-ink-subtle mt-1">
                            {t('financial.payment.processed', { date: formatDate(payment.processedDate) })}
                            {payment.processedByUserName && t('financial.payment.processedBy', { name: payment.processedByUserName })}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right ml-4">
                        <div className="text-xl font-bold text-ink">
                          €{payment.amount.toFixed(2)}
                        </div>
                        <span className="inline-block px-2 py-1 text-xs font-medium text-ink-muted bg-control rounded mt-1">
                          {payment.type === 'MonthlyFee' ? t('financial.payType.monthlyFee') :
                           payment.type === 'ExtraordinaryFee' ? t('financial.payType.extraordinaryFee') :
                           payment.type === 'Reservation' ? t('financial.payType.reservation') : t('financial.payType.other')}
                        </span>
                      </div>
                    </div>

                    {/* Proof of Payment */}
                    {payment.proofOfPaymentUrl && (
                      <div className="mb-3">
                        <button
                          onClick={() => handleDownloadProof(payment.id, payment.description)}
                          className="text-sm text-indigo-600 hover:underline cursor-pointer"
                        >
                          {t('financial.payment.viewProof')}
                        </button>
                      </div>
                    )}
                    {!payment.proofOfPaymentUrl && payment.method === 'BankTransfer' && payment.status === 'Pending' && (
                      <div className="mb-3">
                        <p className="text-xs text-orange-600">
                          {t('financial.payment.proofNotAttached')}
                        </p>
                      </div>
                    )}
                    {payment.method !== 'BankTransfer' && payment.status === 'Pending' && (
                      <div className="mb-3">
                        <p className="text-xs text-green-600">
                          {t('financial.payment.autoPayment')}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons - Context Dependent */}
                    <div className="flex flex-wrap gap-2">
                      {payment.status === 'Pending' && (
                        <>
                          <Button
                            variant="success"
                            icon={Check}
                            onClick={() => handleApprovePayment(payment.id)}
                            fullWidth
                            className="flex-1"
                          >
                            {t('financial.action.approve')}
                          </Button>
                          <Button
                            variant="danger"
                            icon={XCircle}
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowRejectModal(true);
                            }}
                            fullWidth
                            className="flex-1"
                          >
                            {t('financial.action.reject')}
                          </Button>
                        </>
                      )}
                      
                      {payment.status === 'Approved' && (
                        <>
                          {payment.hasReceipt ? (
                            <Button
                              icon={ArrowDownToLine}
                              onClick={() => handleDownloadReceipt(payment)}
                              fullWidth
                              className="flex-1"
                            >
                              {t('financial.action.downloadReceipt')}
                            </Button>
                          ) : (
                            <Button
                              variant="success"
                              icon={FileText}
                              onClick={() => handleIssueReceipt(payment.id)}
                              fullWidth
                              className="flex-1"
                            >
                              {t('financial.action.issueReceipt')}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Payment Modal */}
      <ModalPopup
        open={showRejectModal && selectedPayment !== null}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedPayment(null);
          setRejectionReason('');
        }}
        title={t('financial.reject.title')}
        maxWidthClass="max-w-md"
      >
        {selectedPayment && (
          <>
            <p className="text-sm text-ink-muted mb-4">
              {t('financial.reject.paymentFrom')} <strong>{selectedPayment.residentName}</strong> {t('financial.reject.amountOf')}{' '}
              <strong>€{selectedPayment.amount.toFixed(2)}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-ink-muted mb-1">
                {t('financial.reject.reasonLabel')}
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={4}
                placeholder={t('financial.reject.reasonPlaceholder')}
                required
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedPayment(null);
                  setRejectionReason('');
                }}
                fullWidth
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleRejectPayment}
                disabled={!rejectionReason.trim()}
                fullWidth
                className="flex-1"
              >
                {t('financial.reject.submit')}
              </Button>
            </div>
          </>
        )}
      </ModalPopup>

      {/* Quota Plans Section (Admin Only) */}
      {activeTab === 'quota-plans' && isAdmin && <FinancialPlansContent />}
    </div>
  );
}

// ========== Financial Plans Content Component ==========
function FinancialPlansContent() {
  const { condominiumId } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [quotaPlans, setQuotaPlans] = useState<QuotaPlanDto[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<QuotaPlanDto | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'view'>('list');
  const [isQuotasPanelExpanded, setIsQuotasPanelExpanded] = useState(false);
  const [applyPlanId, setApplyPlanId] = useState<string | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    year: currentYear,
    inflationRate: 0,
    extraordinaryQuota: 0
  });

  const loadData = useCallback(async () => {
    try {
      const [unitsRes, plansRes] = await Promise.all([
        unitsApi.getAll(condominiumId!),
        quotaPlansApi.getAll(condominiumId!)
      ]);

      // Units are already scoped by condominium in API
      const condoUnits = unitsRes.data;
      setUnits(condoUnits);

      // Filter plans by condominium and sort by year desc
      const condoPlans = plansRes.data
        .filter(p => p.condominiumId === condominiumId)
        .sort((a, b) => b.year - a.year);
      setQuotaPlans(condoPlans);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, [condominiumId]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [condominiumId, loadData]);

  const handleCreatePlan = async () => {
    try {
      await quotaPlansApi.create(condominiumId!, {
        year: formData.year,
        inflationRate: formData.inflationRate,
        extraordinaryQuota: formData.extraordinaryQuota
      });
      await loadData();
      setView('list');
      setFormData({
        year: currentYear,
        inflationRate: 0,
        extraordinaryQuota: 0
      });
    } catch (error) {
      console.error('Error creating plan:', error);
      toastError(t('financial.error.createPlan'));
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedPlan) return;
    try {
      await quotaPlansApi.update(condominiumId!, selectedPlan.id, {
        inflationRate: formData.inflationRate,
        extraordinaryQuota: formData.extraordinaryQuota
      });
      await loadData();
      setView('list');
      setSelectedPlan(null);
    } catch (error) {
      console.error('Error updating plan:', error);
      toastError(t('financial.error.updatePlan'));
    }
  };

  const handleApplyPlan = async (planId: string) => {
    setApplyPlanId(planId);
  };

  const confirmApplyPlan = async () => {
    if (!applyPlanId) return;
    try {
      await quotaPlansApi.apply(condominiumId!, applyPlanId);
      await loadData();
      toastSuccess(t('financial.success.planApplied'));
    } catch (error) {
      console.error('Error applying plan:', error);
      toastError(t('financial.error.applyPlan'));
    } finally {
      setApplyPlanId(null);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    setDeletePlanId(planId);
  };

  const confirmDeletePlan = async () => {
    if (!deletePlanId) return;
    try {
      await quotaPlansApi.delete(condominiumId!, deletePlanId);
      await loadData();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toastError(t('financial.error.deletePlan'));
    } finally {
      setDeletePlanId(null);
    }
  };

  const handleViewPlan = async (plan: QuotaPlanDto) => {
    setSelectedPlan(plan);
    setView('view');
  };

  const handleEditPlan = (plan: QuotaPlanDto) => {
    setSelectedPlan(plan);
    setFormData({
      year: plan.year,
      inflationRate: plan.inflationRate,
      extraordinaryQuota: plan.extraordinaryQuota
    });
    setView('edit');
  };

  const handleSaveUnitQuotas = async () => {
    try {
      // Save all unit monthly quotas
      await Promise.all(
        units.map(unit =>
          unitsApi.update(condominiumId!, unit.id, {
            ...unit,
            monthlyQuota: unit.monthlyQuota || 0
          })
        )
      );
      toastSuccess(t('financial.success.quotasSaved'));
      setIsQuotasPanelExpanded(false);
    } catch (error) {
      console.error('Error saving quotas:', error);
      toastError(t('financial.error.saveQuotas'));
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      Draft: 'bg-control text-ink-muted',
      Active: 'bg-blue-100 text-blue-800',
      Applied: 'bg-green-100 text-green-800',
      Archived: 'bg-yellow-100 text-yellow-800'
    };
    const labels = {
      Draft: t('financial.plan.status.draft'),
      Active: t('common.active'),
      Applied: t('financial.plan.status.applied'),
      Archived: t('financial.plan.status.archived')
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[status as keyof typeof badges] || badges.Draft}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  // ========== LIST VIEW ==========
  if (view === 'list' || view === 'create' || view === 'edit') {
    return (
      <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-ink">{t('financial.plan.title')}</h2>
            <p className="text-ink-muted mt-1">{t('financial.plan.subtitle')}</p>
          </div>
          <Button icon={Plus} onClick={() => setView('create')}>
            {t('financial.plan.new')}
          </Button>
        </div>

        {/* Unit Monthly Quotas Panel */}
        <div className="bg-surface rounded-lg shadow-sm border border-line">
          <div className="p-4 border-b border-line flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-ink">{t('financial.plan.baseQuotasTitle')}</h3>
              <p className="text-sm text-ink-muted mt-1">
                {t('financial.plan.baseQuotasDesc')}
              </p>
            </div>
            <button
              onClick={() => setIsQuotasPanelExpanded(!isQuotasPanelExpanded)}
              className="flex items-center gap-2 px-3 py-2 text-ink-muted hover:bg-surface-hover rounded-lg transition-colors"
            >
              {isQuotasPanelExpanded ? (
                <>
                  <ChevronUp className="w-5 h-5" />
                  {t('financial.plan.hide')}
                </>
              ) : (
                <>
                  <ChevronDown className="w-5 h-5" />
                  {t('financial.plan.expand')}
                </>
              )}
            </button>
          </div>

          {isQuotasPanelExpanded && (
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {units.map(unit => (
                  <div key={unit.id} className="flex items-center gap-3 p-3 border border-line rounded-lg">
                    <label className="flex-1 text-sm font-medium text-ink-muted">
                      {unit.number}
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-ink-subtle text-sm">€</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={unit.monthlyQuota || 0}
                        onChange={(e) => {
                          const newUnits = units.map(u =>
                            u.id === unit.id ? { ...u, monthlyQuota: parseFloat(e.target.value) || 0 } : u
                          );
                          setUnits(newUnits);
                        }}
                        className="w-24 px-2 py-1 border border-line bg-surface text-ink rounded text-right text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="success" icon={Save} onClick={handleSaveUnitQuotas}>
                  {t('financial.plan.saveQuotas')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Plans List */}
        <div className="space-y-4">
          {quotaPlans.length === 0 ? (
            <div className="text-center py-12 bg-surface rounded-lg border border-line">
              <TrendingUp className="w-12 h-12 text-ink-subtle mx-auto mb-3" />
              <p className="text-ink-muted">{t('financial.plan.empty')}</p>
              <p className="text-ink-subtle text-sm mt-1">{t('financial.plan.emptyHint')}</p>
            </div>
          ) : (
            quotaPlans.map(plan => (
              <div key={plan.id} className="bg-surface rounded-lg shadow-sm border border-line p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-ink">{t('financial.plan.planYear', { year: plan.year })}</h3>
                      {getStatusBadge(plan.status)}
                    </div>
                    <div className="flex gap-6 mt-3 text-sm">
                      <div>
                        <span className="text-ink-muted">{t('financial.plan.inflation')}</span>
                        <span className="ml-2 font-semibold text-ink">{plan.inflationRate}%</span>
                      </div>
                      <div>
                        <span className="text-ink-muted">{t('financial.plan.extraordinaryQuota')}</span>
                        <span className="ml-2 font-semibold text-ink">€{plan.extraordinaryQuota.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewPlan(plan)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title={t('financial.plan.viewDetails')}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {plan.status === 'Draft' && (
                      <>
                        <button
                          onClick={() => handleEditPlan(plan)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={t('common.edit')}
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {plan.status === 'Draft' && (
                  <Button
                    variant="success"
                    icon={CheckCircle}
                    onClick={() => handleApplyPlan(plan.id)}
                    fullWidth
                  >
                    {t('financial.plan.applyQuotaPlan', { year: plan.year })}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <ModalPopup
        open={view === 'create' || view === 'edit'}
        onClose={() => {
          setView('list');
          setSelectedPlan(null);
          setFormData({
            year: currentYear,
            inflationRate: 0,
            extraordinaryQuota: 0
          });
        }}
        title={view === 'create' ? t('financial.plan.createTitle') : t('financial.plan.editTitle')}
        maxWidthClass="max-w-2xl"
      >

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('financial.plan.year')}
                </label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-surface-muted disabled:cursor-not-allowed"
                  min={currentYear}
                  required
                  disabled={view === 'edit'}
                />
                {view === 'edit' && (
                  <p className="text-xs text-ink-subtle mt-1">
                    {t('financial.plan.yearLocked')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('financial.plan.inflationRate')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.inflationRate}
                  onChange={(e) => setFormData({ ...formData, inflationRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-ink-subtle mt-1">
                  {t('financial.plan.inflationHint')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('financial.plan.extraordinaryQuotaField')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.extraordinaryQuota}
                  onChange={(e) => setFormData({ ...formData, extraordinaryQuota: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-ink-subtle mt-1">
                  {t('financial.plan.extraordinaryHint')}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setView('list');
                  setSelectedPlan(null);
                  setFormData({
                    year: currentYear,
                    inflationRate: 0,
                    extraordinaryQuota: 0
                  });
                }}
                fullWidth
                className="flex-1 border border-line"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={view === 'create' ? handleCreatePlan : handleUpdatePlan}
                fullWidth
                className="flex-1"
              >
                {view === 'create' ? t('financial.plan.createSubmit') : t('financial.plan.saveChanges')}
              </Button>
            </div>
      </ModalPopup>
      <ConfirmModal
        open={applyPlanId !== null}
        title={t('financial.confirm.applyPlan.title')}
        message={t('financial.confirm.applyPlan.message')}
        confirmLabel={t('financial.action.apply')}
        variant="warning"
        onConfirm={confirmApplyPlan}
        onCancel={() => setApplyPlanId(null)}
      />
      <ConfirmModal
        open={deletePlanId !== null}
        title={t('financial.confirm.deletePlan.title')}
        message={t('financial.confirm.deletePlan.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDeletePlan}
        onCancel={() => setDeletePlanId(null)}
      />
    </>
    );
  }

  // ========== VIEW PLAN DETAILS ==========
  if (view === 'view' && selectedPlan) {
    const extraordinaryPerUnit = selectedPlan.extraordinaryQuota / (units.length || 1);

    return (
      <div>
        <div className="mb-6">
          <button
            onClick={() => {
              setView('list');
              setSelectedPlan(null);
            }}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
          >
            <ChevronDown className="w-5 h-5 rotate-90" />
            {t('financial.plan.back')}
          </button>
        </div>

        <div className="bg-surface rounded-lg shadow-sm border border-line p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-2xl font-bold text-ink">{t('financial.plan.planYear', { year: selectedPlan.year })}</h2>
                {getStatusBadge(selectedPlan.status)}
              </div>
              <div className="grid grid-cols-3 gap-6 text-sm">
                <div>
                  <span className="text-ink-muted">{t('financial.plan.inflation')}</span>
                  <span className="ml-2 font-semibold text-ink">{selectedPlan.inflationRate}%</span>
                </div>
                <div>
                  <span className="text-ink-muted">{t('financial.plan.extraordinaryTotal')}</span>
                  <span className="ml-2 font-semibold text-ink">€{selectedPlan.extraordinaryQuota.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-ink-muted">{t('financial.plan.extraordinaryPerUnit')}</span>
                  <span className="ml-2 font-semibold text-ink">€{extraordinaryPerUnit.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calculations Table */}
        <DataTable<UnitDto>
          columns={[
            { key: 'number', header: t('financial.plan.unit'), mobileLabel: t('financial.plan.unit') },
            {
              key: 'baseQuota',
              header: t('financial.plan.baseQuota'),
              align: 'right',
              render: (u) => `€${(u.monthlyQuota || 0).toFixed(2)}`,
            },
            {
              key: 'inflation',
              header: t('financial.plan.inflationColumn', { rate: selectedPlan.inflationRate }),
              align: 'right',
              render: (u) => `€${((u.monthlyQuota || 0) * (selectedPlan.inflationRate / 100)).toFixed(2)}`,
            },
            {
              key: 'extra',
              header: t('financial.plan.extraordinaryColumn'),
              align: 'right',
              render: () => `€${extraordinaryPerUnit.toFixed(2)}`,
            },
            {
              key: 'monthly',
              header: t('financial.plan.monthly'),
              align: 'right',
              className: 'font-semibold text-ink',
              render: (u) => {
                const base = u.monthlyQuota || 0;
                const inflation = base * (selectedPlan.inflationRate / 100);
                return `€${(base + inflation + extraordinaryPerUnit).toFixed(2)}`;
              },
            },
            {
              key: 'quarterly',
              header: t('financial.plan.quarterly'),
              align: 'right',
              render: (u) => {
                const base = u.monthlyQuota || 0;
                const inflation = base * (selectedPlan.inflationRate / 100);
                return `€${((base + inflation + extraordinaryPerUnit) * 3).toFixed(2)}`;
              },
            },
            {
              key: 'annual',
              header: t('financial.plan.annual'),
              align: 'right',
              render: (u) => {
                const base = u.monthlyQuota || 0;
                const inflation = base * (selectedPlan.inflationRate / 100);
                return `€${((base + inflation + extraordinaryPerUnit) * 12).toFixed(2)}`;
              },
            },
          ]}
          rows={units}
          rowKey={(u) => u.id}
          footer={
            <tr>
              <td className="px-4 py-3">{t('financial.plan.total')}</td>
              <td className="px-4 py-3 text-right">
                €{units.reduce((sum, u) => sum + (u.monthlyQuota || 0), 0).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right">
                €{units
                  .reduce((sum, u) => sum + ((u.monthlyQuota || 0) * (selectedPlan.inflationRate / 100)), 0)
                  .toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right">€{selectedPlan.extraordinaryQuota.toFixed(2)}</td>
              <td className="px-4 py-3 text-right">
                €{units
                  .reduce((sum, u) => {
                    const base = u.monthlyQuota || 0;
                    const inflation = base * (selectedPlan.inflationRate / 100);
                    return sum + base + inflation + extraordinaryPerUnit;
                  }, 0)
                  .toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right">
                €{(units.reduce((sum, u) => {
                  const base = u.monthlyQuota || 0;
                  const inflation = base * (selectedPlan.inflationRate / 100);
                  return sum + base + inflation + extraordinaryPerUnit;
                }, 0) * 3).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right">
                €{(units.reduce((sum, u) => {
                  const base = u.monthlyQuota || 0;
                  const inflation = base * (selectedPlan.inflationRate / 100);
                  return sum + base + inflation + extraordinaryPerUnit;
                }, 0) * 12).toFixed(2)}
              </td>
            </tr>
          }
          mobileFooter={
            <div className="bg-surface-muted rounded-xl border border-line p-4 space-y-2 font-semibold text-ink">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-ink-subtle">{t('financial.plan.totalMonthly')}</span>
                <span className="text-sm">
                  €{units
                    .reduce((sum, u) => {
                      const base = u.monthlyQuota || 0;
                      const inflation = base * (selectedPlan.inflationRate / 100);
                      return sum + base + inflation + extraordinaryPerUnit;
                    }, 0)
                    .toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-ink-subtle">{t('financial.plan.totalAnnual')}</span>
                <span className="text-sm">
                  €{(units.reduce((sum, u) => {
                    const base = u.monthlyQuota || 0;
                    const inflation = base * (selectedPlan.inflationRate / 100);
                    return sum + base + inflation + extraordinaryPerUnit;
                  }, 0) * 12).toFixed(2)}
                </span>
              </div>
            </div>
          }
        />

        {selectedPlan.status === 'Draft' && (
          <div className="mt-6">
            <Button
              variant="success"
              icon={CheckCircle}
              onClick={() => handleApplyPlan(selectedPlan.id)}
              fullWidth
            >
              {t('financial.plan.applyQuotaPlan', { year: selectedPlan.year })}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
