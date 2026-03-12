import { useEffect, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet, PiggyBank, Trash2, Calendar, Info, ArrowDownToLine, ArrowUpFromLine, FileText, X, Upload as UploadIcon, Check, XCircle, Settings, Clock, CheckCircle } from 'lucide-react';
import { financialApi, documentsApi, paymentsApi, paymentMethodsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import FileUpload from '../components/FileUpload';
import type { FinancialRecordDto, CreateFinancialRecordRequest, PaginatedResponse, FinancialDashboardDto, ReserveFundDto, PaymentDto, PaymentMethodsDto, UpdatePaymentMethodsRequest } from '../types';

// Updated category mappings matching backend FinancialCategory enum
const incomeCategoryLabels: Record<string, string> = {
  MonthlyFees: 'Quotas Mensais',
  ExtraordinaryFees: 'Quotas Extraordinárias',
  LateFeeInterest: 'Juros de Mora',
  OtherIncome: 'Outras Receitas',
};

const expenseCategoryLabels: Record<string, string> = {
  Maintenance: 'Manutenção',
  Insurance: 'Seguros',
  Utilities: 'Utilidades (Água, Luz, Gás)',
  Administration: 'Administração',
  Services: 'Serviços (Limpeza, Elevador)',
  Property: 'IMI (Parte Comum)',
  Legal: 'Serviços Jurídicos',
  Accounting: 'Contabilista',
  OtherExpense: 'Outras Despesas',
};

const allCategoryLabels = { ...incomeCategoryLabels, ...expenseCategoryLabels };

// Financial document types
const financialDocTypeLabels: Record<string, string> = {
  FinancialBankStatement: 'Extrato Bancário',
  FinancialAnnualReport: 'Relatório Anual',
  FinancialBudget: 'Orçamento Anual',
  FinancialAudit: 'Auditoria',
  FinancialTaxDocument: 'Documentos Fiscais',
  FinancialOther: 'Outros',
};

export default function FinancialPage() {
  const { isAdmin, condominiumId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transactions' | 'cashin' | 'settings'>('transactions');
  const [dashboard, setDashboard] = useState<FinancialDashboardDto | null>(null);
  const [reserveFund, setReserveFund] = useState<ReserveFundDto | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  
  // Cash In - All payments (Admin only)
  const [allPayments, setAllPayments] = useState<PaymentDto[]>([]);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentDto | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // Payment methods configuration (Admin only)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsDto | null>(null);
  const [editingPaymentMethods, setEditingPaymentMethods] = useState(false);
  const [paymentMethodsForm, setPaymentMethodsForm] = useState<UpdatePaymentMethodsRequest>({
    iban: '',
    instructions: '',
    mbWay: '',
    mbReference: '',
    bankTransferEnabled: true,
    mbWayEnabled: false,
    cardEnabled: false,
  });
  
  // Records pagination
  const [records, setRecords] = useState<FinancialRecordDto[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<FinancialRecordDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const pageSize = 10;
  
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
    category: 'OtherExpense',
    condominiumId: condominiumId || '',
  });
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

  // Load dashboard and available years
  useEffect(() => {
    if (!condominiumId) return;
    
    setLoading(true);
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
        alert('Erro ao carregar dados financeiros');
      })
      .finally(() => setLoading(false));
  }, [condominiumId, selectedYear]);

  // Load records with pagination
  const loadRecords = (page: number = 1, search: string = searchQuery) => {
    if (!condominiumId) return;
    
    financialApi.getByYear(condominiumId, selectedYear, page, pageSize, search)
      .then((r) => {
        setPagination(r.data);
        setRecords(r.data.items);
        setCurrentPage(page);
      })
      .catch(error => {
        console.error('Erro ao carregar registos:', error);
      });
  };

  useEffect(() => {
    if (condominiumId) {
      loadRecords(1);
    }
  }, [condominiumId, selectedYear]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined && condominiumId) {
        loadRecords(1, searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.condominiumId) {
      alert('Condomínio não identificado. Por favor, recarregue a página.');
      return;
    }
    
    if (!form.description || form.description.trim() === '') {
      alert('Descrição é obrigatória.');
      return;
    }
    
    if (!form.amount || parseFloat(form.amount) <= 0) {
      alert('Valor deve ser maior que zero.');
      return;
    }
    
    setSubmitting(true);
    try {
      const requestData: CreateFinancialRecordRequest = {
        type: form.type,
        amount: parseFloat(form.amount),
        description: form.description,
        date: `${form.date}T00:00:00.000Z`,
        category: form.category,
        condominiumId: form.condominiumId,
        receiptUrl: undefined,
      };
      
      await financialApi.create(requestData);
      setShowForm(false);
      setForm({ 
        type: 'Expense', 
        amount: '', 
        description: '', 
        date: new Date().toISOString().split('T')[0], 
        category: 'OtherExpense', 
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
    } catch (error: any) {
      console.error('Erro ao criar registo financeiro:', error);
      alert(`Erro ao criar registo financeiro: ${error.response?.data?.message || error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este registo?')) return;
    
    try {
      await financialApi.delete(id);
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
      alert('Erro ao eliminar registo');
    }
  };

  const handleDownloadProof = async (documentIdOrPath: string, description: string) => {
    try {
      // Check if it's a GUID (new format) or a path (old format)
      const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (guidRegex.test(documentIdOrPath)) {
        // New format: document ID
        await documentsApi.download(documentIdOrPath, `Comprovativo - ${description}.pdf`);
      } else if (documentIdOrPath.startsWith('/uploads/')) {
        // Old format: file path - show warning
        alert('Este comprovativo usa formato antigo. Por favor, contacte o administrador para atualizar o sistema.');
        // Could open in new tab as fallback (though will fail without auth)
        // window.open(documentIdOrPath, '_blank');
      } else {
        // Unknown format
        alert('Formato de comprovativo não reconhecido.');
      }
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      alert('Erro ao fazer download do comprovativo');
    }
  };

  const handleFundOperation = async () => {
    if (!condominiumId) return;
    if (!fundAmount || parseFloat(fundAmount) <= 0) {
      alert('Valor inválido');
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
    } catch (error: any) {
      console.error('Erro na operação do fundo:', error);
      alert(error.response?.data?.message || 'Erro na operação do fundo de reserva');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDocumentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

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

      await documentsApi.upload(formData);
      setShowDocumentModal(false);
      setUploadFile(null);
      setUploadForm({
        name: '',
        type: 'FinancialBankStatement',
        description: '',
        year: new Date().getFullYear().toString(),
      });
      alert('Documento carregado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload do documento');
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
  const loadAllPayments = async () => {
    if (!isAdmin || !condominiumId) return;
    try {
      // Load all payments (up to 500)
      const response = await paymentsApi.getPaged(1, 500);
      setAllPayments(response.data.items);
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  };

  const loadPaymentMethods = async () => {
    if (!isAdmin || !condominiumId) return;
    try {
      const response = await paymentMethodsApi.get(condominiumId);
      setPaymentMethods(response.data);
      setPaymentMethodsForm({
        iban: response.data.iban || '',
        instructions: response.data.instructions || '',
        mbWay: response.data.mbWay || '',
        mbReference: response.data.mbReference || '',
        bankTransferEnabled: response.data.bankTransferEnabled ?? true,
        mbWayEnabled: response.data.mbWayEnabled ?? false,
        cardEnabled: response.data.cardEnabled ?? false,
      });
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  const handleApprovePayment = async (paymentId: string) => {
    if (!confirm('Tem certeza que deseja aprovar este pagamento?')) return;
    try {
      await paymentsApi.approve(paymentId);
      loadAllPayments();
      alert('Pagamento aprovado com sucesso!');
    } catch (error: any) {
      console.error('Error approving payment:', error);
      alert(error.response?.data?.message || 'Erro ao aprovar pagamento');
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedPayment || !rejectionReason.trim()) {
      alert('Por favor insira o motivo da rejeição');
      return;
    }
    try {
      await paymentsApi.reject(selectedPayment.id, { rejectionReason });
      setShowRejectModal(false);
      setSelectedPayment(null);
      setRejectionReason('');
      loadAllPayments();
      alert('Pagamento rejeitado');
    } catch (error: any) {
      console.error('Error rejecting payment:', error);
      alert(error.response?.data?.message || 'Erro ao rejeitar pagamento');
    }
  };

  const handleSavePaymentMethods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condominiumId) return;
    try {
      const response = await paymentMethodsApi.update(condominiumId, paymentMethodsForm);
      setPaymentMethods(response.data);
      setEditingPaymentMethods(false);
      alert('Métodos de pagamento atualizados com sucesso!');
    } catch (error: any) {
      console.error('Error saving payment methods:', error);
      alert(error.response?.data?.message || 'Erro ao salvar métodos de pagamento');
    }
  };



  const handleIssueReceipt = async (paymentId: string) => {
    if (!confirm('Emitir recibo para este pagamento?')) return;
    try {
      await paymentsApi.issueReceipt(paymentId);
      loadAllPayments();
      alert('Recibo emitido com sucesso!');
    } catch (error: any) {
      console.error('Error issuing receipt:', error);
      alert(error.response?.data?.message || 'Erro ao emitir recibo');
    }
  };

  const handleDownloadReceipt = async (payment: PaymentDto) => {
    if (!payment.receiptNumber || !payment.receiptYear) {
      alert('Este pagamento ainda não tem recibo emitido');
      return;
    }
    try {
      await paymentsApi.downloadReceipt(payment.id, payment.receiptNumber, payment.receiptYear);
    } catch (error: any) {
      console.error('Error downloading receipt:', error);
      alert(error.response?.data?.message || 'Erro ao baixar recibo');
    }
  };

  // Load payments and payment methods when switching to those tabs
  useEffect(() => {
    if (activeTab === 'cashin' && isAdmin) {
      loadAllPayments();
    } else if (activeTab === 'settings' && isAdmin) {
      loadPaymentMethods();
    }
  }, [activeTab, isAdmin, condominiumId]);

  // Filter and search payments
  const filteredPayments = allPayments.filter(payment => {
    // Status filter
    if (paymentStatusFilter !== 'All' && payment.status !== paymentStatusFilter) {
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
  };

  const currentCategories = form.type === 'Income' ? incomeCategoryLabels : expenseCategoryLabels;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão Financeira</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Conta corrente e fundo de reserva do condomínio
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>Ano Fiscal {year}</option>
            ))}
          </select>
          {isAdmin && (
            <>
              <button
                onClick={openDocumentModal}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <FileText className="w-4 h-4" />
                Adicionar Documento
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Registo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs (Admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'transactions'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Transações
            </button>
            <button
              onClick={() => setActiveTab('cashin')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'cashin'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Cash In
              {paymentCounts.pending > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {paymentCounts.pending}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Configurações
            </button>
          </div>
        </div>
      )}

      {/* Transactions Tab Content */}
      {activeTab === 'transactions' && (
        <>
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Como funciona a gestão financeira:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li><strong>Conta Corrente:</strong> Receitas e despesas do ano fiscal {selectedYear}</li>
                <li><strong>Fundo de Reserva:</strong> Acumulado obrigatório por lei para grandes obras e emergências</li>
                <li>No fim do ano, o saldo positivo da conta corrente pode ser transferido para o fundo</li>
              </ul>
            </div>
          </div>
        </>
      )}

      {activeTab === 'transactions' && loading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : activeTab === 'transactions' ? (
        <>
          {/* Dashboard Cards */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Current Account Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-indigo-600" />
                  <h2 className="font-semibold text-gray-900">Conta Corrente {selectedYear}</h2>
                </div>
                <Calendar className="w-4 h-4 text-gray-400" />
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Receitas</span>
                  </div>
                  <span className="text-lg font-bold text-green-700">
                    €{dashboard?.currentYearIncome.toFixed(2) || '0.00'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-900">Despesas</span>
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
                    Saldo do Ano
                  </span>
                  <span className={`text-xl font-bold ${
                    (dashboard?.currentYearBalance || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'
                  }`}>
                    €{dashboard?.currentYearBalance.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </div>

            {/* Reserve Fund Card */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl shadow-sm border border-emerald-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-semibold text-gray-900">Fundo de Reserva</h2>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setFundOperation('deposit');
                      setShowFundModal(true);
                    }}
                    className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Gerir Fundo
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-emerald-900 font-medium">Saldo Atual</span>
                  <span className="text-3xl font-bold text-emerald-700">
                    €{reserveFund?.closingBalance.toFixed(2) || '0.00'}
                  </span>
                </div>
                
                <div className="pt-3 border-t border-emerald-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-800 flex items-center gap-1">
                      <ArrowDownToLine className="w-3 h-3" />
                      Depósitos {selectedYear}
                    </span>
                    <span className="font-semibold text-emerald-700">
                      +€{dashboard?.reserveFundDeposits.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-800 flex items-center gap-1">
                      <ArrowUpFromLine className="w-3 h-3" />
                      Levantamentos {selectedYear}
                    </span>
                    <span className="font-semibold text-red-600">
                      -€{dashboard?.reserveFundWithdrawals.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
                
                <div className="pt-2 text-xs text-emerald-700">
                  💡 Destinado a grandes obras, reparações estruturais e emergências
                </div>
              </div>
            </div>
          </div>

          {/* New Record Form */}
          {showForm && isAdmin && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Novo Registo Financeiro</h3>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setForm({ 
                        ...form, 
                        type: newType,
                        category: newType === 'Income' ? 'MonthlyFees' : 'OtherExpense'
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Income">Receita</option>
                    <option value="Expense">Despesa</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Object.entries(currentCategories).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Pagamento quotas Janeiro 2026"
                  />
                </div>
                
                <div className="sm:col-span-2 flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowForm(false)} 
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium"
                  >
                    {submitting ? 'A guardar...' : 'Guardar Registo'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Records List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Registos de {selectedYear}</h2>
              <div className="w-64">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Pesquisar..."
                />
              </div>
            </div>
            
            {records.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                {searchQuery ? `Sem resultados para "${searchQuery}"` : `Sem registos de ${selectedYear}`}
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-50">
                  {records.map((r) => (
                    <div key={r.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
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
                        <p className="text-sm font-medium text-gray-900 truncate">{r.description}</p>
                        <p className="text-xs text-gray-500">
                          {allCategoryLabels[r.category] || r.category} · {new Date(r.date).toLocaleDateString('pt-PT')}
                        </p>
                      </div>
                      <p className={`font-semibold text-sm shrink-0 ${
                        r.type === 'Income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {r.type === 'Income' ? '+' : '-'}€{r.amount.toFixed(2)}
                      </p>
                      {isAdmin && (
                        <button 
                          onClick={() => handleDelete(r.id)} 
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pagination && pagination.totalPages > 1 && (
                  <div className="p-4 border-t border-gray-100">
                    <Pagination
                      pagination={pagination}
                      currentPage={currentPage}
                      onPageChange={loadRecords}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : null}

      {/* Fund Management Modal */}
      {showFundModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setShowFundModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Gestão do Fundo de Reserva</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Operação</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFundOperation('deposit')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      fundOperation === 'deposit'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Depósito
                  </button>
                  <button
                    onClick={() => setFundOperation('withdrawal')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      fundOperation === 'withdrawal'
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Levantamento
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.00"
                />
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                {fundOperation === 'deposit' ? (
                  <p>💡 Esta transferência reduzirá o saldo da conta corrente e aumentará o fundo de reserva.</p>
                ) : (
                  <p>⚠️ Levantamentos devem ser usados apenas para grandes obras ou emergências. Saldo disponível: €{reserveFund?.closingBalance.toFixed(2) || '0.00'}</p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowFundModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleFundOperation}
                disabled={submitting || !fundAmount || parseFloat(fundAmount) <= 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
                  fundOperation === 'deposit'
                    ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400'
                    : 'bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400'
                }`}
              >
                {submitting ? 'A processar...' : fundOperation === 'deposit' ? 'Transferir para Fundo' : 'Levantar do Fundo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showDocumentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Adicionar Documento Financeiro</h2>
              <button
                onClick={() => setShowDocumentModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleDocumentUpload} className="p-6 space-y-4">
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
                  placeholder="Ex: Extrato Bancário Janeiro 2024"
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
                  {Object.entries(financialDocTypeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowDocumentModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={uploading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploading ? (
                    <>A carregar...</>
                  ) : (
                    <>
                      <UploadIcon className="w-4 h-4" />
                      Carregar Documento
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cash In Tab - Unified Payments Management */}
      {activeTab === 'cashin' && isAdmin && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Cash In - Gestão de Pagamentos
              </h2>
              <div className="flex gap-2 text-xs text-gray-600">
                <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded">
                  Pendentes: {paymentCounts.pending}
                </span>
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded">
                  Aprovados: {paymentCounts.approved}
                </span>
                <span className="px-2 py-1 bg-red-50 text-red-700 rounded">
                  Rejeitados: {paymentCounts.rejected}
                </span>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="mb-6 flex gap-3">
              <div className="flex-1">
                <SearchBar
                  value={paymentSearchQuery}
                  onChange={setPaymentSearchQuery}
                  placeholder="Pesquisar por residente, fração, descrição ou valor..."
                />
              </div>
              <div className="min-w-[200px]">
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Pending">🟡 Pendentes</option>
                  <option value="Approved">🟢 Aprovados</option>
                  <option value="Rejected">🔴 Rejeitados</option>
                  <option value="All">📋 Todos</option>
                </select>
              </div>
            </div>

            {/* Payments List */}
            {filteredPayments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {paymentSearchQuery ? 
                  'Nenhum pagamento encontrado para a pesquisa' : 
                  `Não há pagamentos ${paymentStatusFilter === 'All' ? '' : paymentStatusFilter.toLowerCase()}`
                }
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900">
                            {payment.residentName} - {payment.unitIdentifier}
                          </h3>
                          {/* Status Badge */}
                          {payment.status === 'Pending' && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded">
                              <Clock className="w-3 h-3 mr-1" />
                              Pendente
                            </span>
                          )}
                          {payment.status === 'Approved' && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Aprovado
                            </span>
                          )}
                          {payment.status === 'Rejected' && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded">
                              <XCircle className="w-3 h-3 mr-1" />
                              Rejeitado
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{payment.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <p className="text-xs text-gray-500">
                            Criado: {new Date(payment.createdDate).toLocaleDateString('pt-PT')}
                          </p>
                          <p className="text-xs text-blue-600">
                            {payment.method === 'BankTransfer' ? 'Transferência Bancária' : 
                             payment.method === 'MBWay' ? 'MB Way' : 
                             payment.method === 'Card' ? 'Cartão' : payment.method}
                          </p>
                        </div>
                        
                        {/* Receipt Info for Approved */}
                        {payment.status === 'Approved' && payment.hasReceipt && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded">
                              ✓ Recibo Nº {payment.receiptNumber}/{payment.receiptYear}
                            </span>
                            {payment.receiptIssuedDate && (
                              <span className="text-xs text-gray-500">
                                Emitido: {new Date(payment.receiptIssuedDate).toLocaleDateString('pt-PT')}
                              </span>
                            )}
                          </div>
                        )}
                        {payment.status === 'Approved' && !payment.hasReceipt && (
                          <span className="inline-flex items-center mt-2 px-2 py-1 text-xs font-medium text-orange-800 bg-orange-100 rounded">
                            ⏳ Aguarda emissão de recibo
                          </span>
                        )}
                        
                        {/* Rejection Reason */}
                        {payment.status === 'Rejected' && payment.rejectionReason && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                            <strong>Motivo:</strong> {payment.rejectionReason}
                          </div>
                        )}

                        {/* Processed Info */}
                        {payment.processedDate && (
                          <p className="text-xs text-gray-500 mt-1">
                            Processado: {new Date(payment.processedDate).toLocaleDateString('pt-PT')}
                            {payment.processedByUserName && ` por ${payment.processedByUserName}`}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right ml-4">
                        <div className="text-xl font-bold text-gray-900">
                          €{payment.amount.toFixed(2)}
                        </div>
                        <span className="inline-block px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded mt-1">
                          {payment.type === 'MonthlyFee' ? 'Quota Mensal' :
                           payment.type === 'ExtraordinaryFee' ? 'Quota Extraordinária' :
                           payment.type === 'Reservation' ? 'Reserva' : 'Outro'}
                        </span>
                      </div>
                    </div>

                    {/* Proof of Payment */}
                    {payment.proofOfPaymentUrl && (
                      <div className="mb-3">
                        <button
                          onClick={() => handleDownloadProof(payment.proofOfPaymentUrl!, payment.description)}
                          className="text-sm text-indigo-600 hover:underline cursor-pointer"
                        >
                          📎 Ver comprovativo de pagamento
                        </button>
                      </div>
                    )}
                    {!payment.proofOfPaymentUrl && payment.method === 'BankTransfer' && payment.status === 'Pending' && (
                      <div className="mb-3">
                        <p className="text-xs text-orange-600">
                          ⚠️ Comprovativo não anexado
                        </p>
                      </div>
                    )}
                    {payment.method !== 'BankTransfer' && payment.status === 'Pending' && (
                      <div className="mb-3">
                        <p className="text-xs text-green-600">
                          ✓ Pagamento automático - sem comprovativo
                        </p>
                      </div>
                    )}

                    {/* Action Buttons - Context Dependent */}
                    <div className="flex gap-2">
                      {payment.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleApprovePayment(payment.id)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            <Check className="w-4 h-4" />
                            Aprovar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowRejectModal(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            Rejeitar
                          </button>
                        </>
                      )}
                      
                      {payment.status === 'Approved' && (
                        <>
                          {payment.hasReceipt ? (
                            <button
                              onClick={() => handleDownloadReceipt(payment)}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              <ArrowDownToLine className="w-4 h-4" />
                              Descarregar Recibo
                            </button>
                          ) : (
                            <button
                              onClick={() => handleIssueReceipt(payment.id)}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                              Emitir Recibo
                            </button>
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

      {/* Settings Tab - Payment Methods Configuration */}
      {activeTab === 'settings' && isAdmin && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Métodos de Pagamento
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Configure os métodos de pagamento disponíveis para os residentes
                </p>
              </div>
              {!editingPaymentMethods && (
                <button
                  onClick={() => setEditingPaymentMethods(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Editar
                </button>
              )}
            </div>

            {editingPaymentMethods ? (
              <form onSubmit={handleSavePaymentMethods} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IBAN
                  </label>
                  <input
                    type="text"
                    value={paymentMethodsForm.iban}
                    onChange={(e) => setPaymentMethodsForm({ ...paymentMethodsForm, iban: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="PT50 0000 0000 0000 0000 0000 0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    MB Way
                  </label>
                  <input
                    type="text"
                    value={paymentMethodsForm.mbWay}
                    onChange={(e) => setPaymentMethodsForm({ ...paymentMethodsForm, mbWay: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="+351 912 345 678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referência Multibanco
                  </label>
                  <input
                    type="text"
                    value={paymentMethodsForm.mbReference}
                    onChange={(e) => setPaymentMethodsForm({ ...paymentMethodsForm, mbReference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Entidade | Referência"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instruções Adicionais
                  </label>
                  <textarea
                    value={paymentMethodsForm.instructions}
                    onChange={(e) => setPaymentMethodsForm({ ...paymentMethodsForm, instructions: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={4}
                    placeholder="Instruções especiais para os residentes sobre como efetuar pagamentos..."
                  />
                </div>

                {/* Payment Methods Availability */}
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-900 mb-3">
                    Métodos de Pagamento Disponíveis para Residentes
                  </label>
                  <p className="text-sm text-gray-600 mb-4">
                    Selecione quais métodos de pagamento os residentes podem utilizar
                  </p>
                  
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentMethodsForm.bankTransferEnabled}
                        onChange={(e) => setPaymentMethodsForm({ ...paymentMethodsForm, bankTransferEnabled: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">Transferência Bancária / NIB</span>
                        <p className="text-xs text-gray-500 mt-0.5">Requer upload de comprovativo</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentMethodsForm.mbWayEnabled}
                        onChange={(e) => setPaymentMethodsForm({ ...paymentMethodsForm, mbWayEnabled: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">MB Way</span>
                        <p className="text-xs text-gray-500 mt-0.5">Pagamento automático (em desenvolvimento)</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentMethodsForm.cardEnabled}
                        onChange={(e) => setPaymentMethodsForm({ ...paymentMethodsForm, cardEnabled: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">Cartão (Visa/Maestro)</span>
                        <p className="text-xs text-gray-500 mt-0.5">Pagamento automático (em desenvolvimento)</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPaymentMethods(false);
                      loadPaymentMethods(); // Reset form
                    }}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Guardar Alterações
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                {/* Payment Details */}
                <div className="space-y-4">
                  {paymentMethods?.iban && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">IBAN</h4>
                      <p className="text-gray-900">{paymentMethods.iban}</p>
                    </div>
                  )}
                  {paymentMethods?.mbWay && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">MB Way</h4>
                      <p className="text-gray-900">{paymentMethods.mbWay}</p>
                    </div>
                  )}
                  {paymentMethods?.mbReference && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Referência Multibanco</h4>
                      <p className="text-gray-900">{paymentMethods.mbReference}</p>
                    </div>
                  )}
                  {paymentMethods?.instructions && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Instruções</h4>
                      <p className="text-gray-900 whitespace-pre-wrap">{paymentMethods.instructions}</p>
                    </div>
                  )}
                  {!paymentMethods?.iban && !paymentMethods?.mbWay && !paymentMethods?.mbReference && (
                    <div className="text-center py-8 text-gray-500">
                      Nenhum método de pagamento configurado
                    </div>
                  )}
                </div>

                {/* Payment Methods Status */}
                {paymentMethods && (
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Métodos Disponíveis para Residentes
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${paymentMethods.bankTransferEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-sm text-gray-700">Transferência Bancária / NIB</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${paymentMethods.bankTransferEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {paymentMethods.bankTransferEnabled ? 'Ativo' : 'Desativado'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${paymentMethods.mbWayEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-sm text-gray-700">MB Way</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${paymentMethods.mbWayEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {paymentMethods.mbWayEnabled ? 'Ativo' : 'Desativado'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${paymentMethods.cardEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-sm text-gray-700">Cartão (Visa/Maestro)</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${paymentMethods.cardEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {paymentMethods.cardEnabled ? 'Ativo' : 'Desativado'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Payment Modal */}
      {showRejectModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Rejeitar Pagamento</h2>
            <p className="text-sm text-gray-600 mb-4">
              Pagamento de <strong>{selectedPayment.residentName}</strong> no valor de{' '}
              <strong>€{selectedPayment.amount.toFixed(2)}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo da Rejeição *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={4}
                placeholder="Explique o motivo da rejeição..."
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedPayment(null);
                  setRejectionReason('');
                }}
                className="flex-1 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejectPayment}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Rejeitar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
