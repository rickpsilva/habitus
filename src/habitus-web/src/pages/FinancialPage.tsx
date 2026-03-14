import { useEffect, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet, PiggyBank, Trash2, Calendar, Info, ArrowDownToLine, ArrowUpFromLine, FileText, X, Upload as UploadIcon, Check, XCircle, Clock, CheckCircle, Edit2, Eye, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { financialApi, documentsApi, paymentsApi, unitsApi, quotaPlansApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import FileUpload from '../components/FileUpload';
import type { FinancialRecordDto, CreateFinancialRecordRequest, PaginatedResponse, FinancialDashboardDto, ReserveFundDto, PaymentDto, UnitDto, QuotaPlanDto } from '../types';

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
  const [activeTab, setActiveTab] = useState<'transactions' | 'cashin' | 'quota-plans'>('transactions');
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

  // Load payments when switching to cashin tab
  useEffect(() => {
    if (activeTab === 'cashin' && isAdmin) {
      loadAllPayments();
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
              onClick={() => setActiveTab('quota-plans')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'quota-plans'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Planos de Quotas
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

      {/* Quota Plans Section (Admin Only) */}
      {activeTab === 'quota-plans' && isAdmin && <FinancialPlansContent />}
    </div>
  );
}

// ========== Financial Plans Content Component ==========
function FinancialPlansContent() {
  const { condominiumId } = useAuth();
  const currentYear = new Date().getFullYear();
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [quotaPlans, setQuotaPlans] = useState<QuotaPlanDto[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<QuotaPlanDto | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'view'>('list');
  const [isQuotasPanelExpanded, setIsQuotasPanelExpanded] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    year: currentYear,
    inflationRate: 0,
    extraordinaryQuota: 0
  });

  useEffect(() => {
    loadData();
  }, [condominiumId]);

  const loadData = async () => {
    try {
      const [unitsRes, plansRes] = await Promise.all([
        unitsApi.getAll(),
        quotaPlansApi.getAll(condominiumId!)
      ]);

      // Filter units by condominium
      const condoUnits = unitsRes.data.filter(u => u.condominiumId === condominiumId);
      setUnits(condoUnits);

      // Filter plans by condominium and sort by year desc
      const condoPlans = plansRes.data
        .filter(p => p.condominiumId === condominiumId)
        .sort((a, b) => b.year - a.year);
      setQuotaPlans(condoPlans);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

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
      alert('Erro ao criar plano');
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
      alert('Erro ao atualizar plano');
    }
  };

  const handleApplyPlan = async (planId: string) => {
    if (!confirm('Tem a certeza que deseja aplicar este plano? Esta ação irá atualizar os valores das quotas de todas as frações.')) {
      return;
    }
    try {
      await quotaPlansApi.apply(condominiumId!, planId);
      await loadData();
      alert('Plano aplicado com sucesso!');
    } catch (error) {
      console.error('Error applying plan:', error);
      alert('Erro ao aplicar plano');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Tem a certeza que deseja eliminar este plano?')) {
      return;
    }
    try {
      await quotaPlansApi.delete(condominiumId!, planId);
      await loadData();
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Erro ao eliminar plano');
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
          unitsApi.update(unit.id, {
            ...unit,
            monthlyQuota: unit.monthlyQuota || 0
          })
        )
      );
      alert('Quotas atualizadas com sucesso!');
      setIsQuotasPanelExpanded(false);
    } catch (error) {
      console.error('Error saving quotas:', error);
      alert('Erro ao guardar quotas');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      Draft: 'bg-gray-100 text-gray-800',
      Active: 'bg-blue-100 text-blue-800',
      Applied: 'bg-green-100 text-green-800',
      Archived: 'bg-yellow-100 text-yellow-800'
    };
    const labels = {
      Draft: 'Rascunho',
      Active: 'Ativo',
      Applied: 'Aplicado',
      Archived: 'Arquivado'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[status as keyof typeof badges] || badges.Draft}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  // ========== LIST VIEW ==========
  if (view === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Planos Financeiros</h2>
            <p className="text-gray-600 mt-1">Gerir planos de quotas por ano</p>
          </div>
          <button
            onClick={() => setView('create')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Plano
          </button>
        </div>

        {/* Unit Monthly Quotas Panel */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Valores Base das Quotas Mensais por Fração</h3>
              <p className="text-sm text-gray-600 mt-1">
                Defina os valores mensais base para cada fração. Estes valores serão usados nos cálculos dos planos.
              </p>
            </div>
            <button
              onClick={() => setIsQuotasPanelExpanded(!isQuotasPanelExpanded)}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isQuotasPanelExpanded ? (
                <>
                  <ChevronUp className="w-5 h-5" />
                  Ocultar
                </>
              ) : (
                <>
                  <ChevronDown className="w-5 h-5" />
                  Expandir
                </>
              )}
            </button>
          </div>

          {isQuotasPanelExpanded && (
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {units.map(unit => (
                  <div key={unit.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <label className="flex-1 text-sm font-medium text-gray-700">
                      {unit.number}
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 text-sm">€</span>
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
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveUnitQuotas}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Guardar Quotas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Plans List */}
        <div className="space-y-4">
          {quotaPlans.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Nenhum plano criado ainda</p>
              <p className="text-gray-500 text-sm mt-1">Clique em "Novo Plano" para começar</p>
            </div>
          ) : (
            quotaPlans.map(plan => (
              <div key={plan.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-gray-900">Plano {plan.year}</h3>
                      {getStatusBadge(plan.status)}
                    </div>
                    <div className="flex gap-6 mt-3 text-sm">
                      <div>
                        <span className="text-gray-600">Inflação:</span>
                        <span className="ml-2 font-semibold text-gray-900">{plan.inflationRate}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Quota Extraordinária:</span>
                        <span className="ml-2 font-semibold text-gray-900">€{plan.extraordinaryQuota.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewPlan(plan)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Ver detalhes"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {plan.status === 'Draft' && (
                      <>
                        <button
                          onClick={() => handleEditPlan(plan)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {plan.status === 'Draft' && (
                  <button
                    onClick={() => handleApplyPlan(plan.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Aplicar Plano de Quota {plan.year}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ========== CREATE/EDIT FORM ==========
  if (view === 'create' || view === 'edit') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {view === 'create' ? 'Criar Novo Plano' : 'Editar Plano'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ano *
              </label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                min={currentYear}
                required
                disabled={view === 'edit'}
              />
              {view === 'edit' && (
                <p className="text-xs text-gray-500 mt-1">
                  O ano não pode ser alterado após a criação do plano
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Percentagem de Inflação (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.inflationRate}
                onChange={(e) => setFormData({ ...formData, inflationRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Este valor será aplicado sobre a quota mensal base de cada fração
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quota Extraordinária (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.extraordinaryQuota}
                onChange={(e) => setFormData({ ...formData, extraordinaryQuota: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Valor adicional que será dividido igualmente por todas as frações
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setView('list');
                setSelectedPlan(null);
                setFormData({
                  year: currentYear,
                  inflationRate: 0,
                  extraordinaryQuota: 0
                });
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={view === 'create' ? handleCreatePlan : handleUpdatePlan}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {view === 'create' ? 'Criar Plano' : 'Guardar Alterações'}
            </button>
          </div>
        </div>
      </div>
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
            Voltar
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-2xl font-bold text-gray-900">Plano {selectedPlan.year}</h2>
                {getStatusBadge(selectedPlan.status)}
              </div>
              <div className="grid grid-cols-3 gap-6 text-sm">
                <div>
                  <span className="text-gray-600">Inflação:</span>
                  <span className="ml-2 font-semibold text-gray-900">{selectedPlan.inflationRate}%</span>
                </div>
                <div>
                  <span className="text-gray-600">Quota Extraordinária Total:</span>
                  <span className="ml-2 font-semibold text-gray-900">€{selectedPlan.extraordinaryQuota.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Extraordinária por Fração:</span>
                  <span className="ml-2 font-semibold text-gray-900">€{extraordinaryPerUnit.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calculations Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fração
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quota Base
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inflação ({selectedPlan.inflationRate}%)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quota Extraordinária
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mensal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trimestral
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Anual
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {units.map(unit => {
                  const baseQuota = unit.monthlyQuota || 0;
                  const inflationAmount = baseQuota * (selectedPlan.inflationRate / 100);
                  const quotaWithInflation = baseQuota + inflationAmount;
                  const monthlyTotal = quotaWithInflation + extraordinaryPerUnit;
                  const quarterlyTotal = monthlyTotal * 3;
                  const annualTotal = monthlyTotal * 12;

                  return (
                    <tr key={unit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {unit.number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        €{baseQuota.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                        €{inflationAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                        €{extraordinaryPerUnit.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                        €{monthlyTotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        €{quarterlyTotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        €{annualTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                {/* Totals Row */}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    €{units.reduce((sum, u) => sum + (u.monthlyQuota || 0), 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    €{units.reduce((sum, u) => sum + ((u.monthlyQuota || 0) * (selectedPlan.inflationRate / 100)), 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    €{selectedPlan.extraordinaryQuota.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    €{units.reduce((sum, u) => {
                      const base = u.monthlyQuota || 0;
                      const inflation = base * (selectedPlan.inflationRate / 100);
                      return sum + base + inflation + extraordinaryPerUnit;
                    }, 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    €{(units.reduce((sum, u) => {
                      const base = u.monthlyQuota || 0;
                      const inflation = base * (selectedPlan.inflationRate / 100);
                      return sum + base + inflation + extraordinaryPerUnit;
                    }, 0) * 3).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    €{(units.reduce((sum, u) => {
                      const base = u.monthlyQuota || 0;
                      const inflation = base * (selectedPlan.inflationRate / 100);
                      return sum + base + inflation + extraordinaryPerUnit;
                    }, 0) * 12).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {selectedPlan.status === 'Draft' && (
          <div className="mt-6">
            <button
              onClick={() => handleApplyPlan(selectedPlan.id)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <CheckCircle className="w-5 h-5" />
              Aplicar Plano de Quota {selectedPlan.year}
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
