import { useEffect, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet, PiggyBank, Trash2, Calendar, Info, ArrowDownToLine, ArrowUpFromLine, FileText, X, Upload as UploadIcon } from 'lucide-react';
import { financialApi, documentsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import FileUpload from '../components/FileUpload';
import type { FinancialRecordDto, CreateFinancialRecordRequest, PaginatedResponse, FinancialDashboardDto, ReserveFundDto } from '../types';

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
  const [dashboard, setDashboard] = useState<FinancialDashboardDto | null>(null);
  const [reserveFund, setReserveFund] = useState<ReserveFundDto | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  
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

      {loading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : (
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
      )}

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
    </div>
  );
}
