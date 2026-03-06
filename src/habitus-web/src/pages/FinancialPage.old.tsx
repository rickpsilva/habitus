import { useEffect, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2 } from 'lucide-react';
import { financialApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import type { FinancialRecordDto, CreateFinancialRecordRequest, PaginatedResponse } from '../types';

const categoryLabels: Record<string, string> = {
  Maintenance: 'Manutenção',
  Insurance: 'Seguros',
  Utilities: 'Utilidades',
  Fees: 'Quotas',
  Other: 'Outro',
};

export default function FinancialPage() {
  const { isAdmin, condominiumId } = useAuth();
  const [records, setRecords] = useState<FinancialRecordDto[]>([]);
  const [allRecords, setAllRecords] = useState<FinancialRecordDto[]>([]); // For totals calculation
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<FinancialRecordDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const pageSize = 10;
  const [form, setForm] = useState({
    type: 'Expense',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    category: 'Other',
    condominiumId: condominiumId || '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Update condominiumId when it changes
  useEffect(() => {
    if (condominiumId) {
      setForm(prev => ({ ...prev, condominiumId }));
    }
  }, [condominiumId]);

  const load = (page: number = 1, search: string = searchQuery) => {
    setLoading(true);
    // Load paginated records for display
    financialApi.getPaged(page, pageSize, search)
      .then((r) => {
        setPagination(r.data);
        setRecords(r.data.items);
        setCurrentPage(page);
      })
      .finally(() => setLoading(false));
    
    // Load all records for totals calculation
    financialApi.getAll().then((r) => setAllRecords(r.data));
  };

  useEffect(() => { load(1); }, []);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        load(1, searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const totalIncome = allRecords.filter((r) => r.type === 'Income').reduce((s, r) => s + r.amount, 0);
  const totalExpenses = allRecords.filter((r) => r.type === 'Expense').reduce((s, r) => s + r.amount, 0);
  const balance = totalIncome - totalExpenses;

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
        date: `${form.date}T00:00:00.000Z`, // ISO 8601 format with time
        category: form.category,
        condominiumId: form.condominiumId,
        receiptUrl: undefined,
      };
      
      console.log('Sending financial record:', requestData);
      
      await financialApi.create(requestData);
      setShowForm(false);
      setForm({ 
        type: 'Expense', 
        amount: '', 
        description: '', 
        date: new Date().toISOString().split('T')[0], 
        category: 'Other', 
        condominiumId: form.condominiumId 
      });
      load();
    } catch (error: any) {
      console.error('Erro ao criar registo financeiro:', error);
      console.error('Error response:', error.response?.data);
      alert(`Erro ao criar registo financeiro: ${error.response?.data?.message || error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este registo?')) return;
    await financialApi.delete(id);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {pagination ? `${pagination.totalItems} registos` : 'Gestão financeira do condomínio'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-64">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar registos..."
            />
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Registo
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-xl p-5 flex items-center gap-4">
          <TrendingUp className="w-8 h-8 text-green-600" />
          <div>
            <p className="text-sm text-green-600 font-medium">Receitas</p>
            <p className="text-2xl font-bold text-green-700">€{totalIncome.toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-red-50 rounded-xl p-5 flex items-center gap-4">
          <TrendingDown className="w-8 h-8 text-red-600" />
          <div>
            <p className="text-sm text-red-600 font-medium">Despesas</p>
            <p className="text-2xl font-bold text-red-700">€{totalExpenses.toFixed(2)}</p>
          </div>
        </div>
        <div className={`rounded-xl p-5 flex items-center gap-4 ${balance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
          <DollarSign className={`w-8 h-8 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
          <div>
            <p className={`text-sm font-medium ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo</p>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
              €{balance.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* New record form */}
      {showForm && isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Novo Registo Financeiro</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Income">Receita</option>
                <option value="Expense">Despesa</option>
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
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.entries(categoryLabels).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
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
        </div>
      )}

      {/* Records list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Registos</h2>
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-400">A carregar...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {searchQuery ? `Sem resultados para "${searchQuery}"` : 'Sem registos financeiros'}
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {records.map((r) => (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${r.type === 'Income' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {r.type === 'Income' ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.description}</p>
                    <p className="text-xs text-gray-500">
                      {categoryLabels[r.category] ?? r.category} · {new Date(r.date).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  <p className={`font-semibold text-sm shrink-0 ${r.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                    {r.type === 'Income' ? '+' : '-'}€{r.amount.toFixed(2)}
                  </p>
                  {isAdmin && (
                    <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-500 transition-colors">
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
                  onPageChange={(page) => load(page)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
