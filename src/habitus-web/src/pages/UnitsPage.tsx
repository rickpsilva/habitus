import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Trash2, Pencil, Plus, X } from 'lucide-react';
import { unitsApi, condominiumsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import type { UnitDto, CreateUnitRequest, CondominiumDto, PaginatedResponse } from '../types';

const unitTypeLabels: Record<number, string> = {
  0: 'Apartamento',
  1: 'Comercial',
  2: 'Estacionamento',
};

export default function UnitsPage({ embedded = false }: { embedded?: boolean }) {
  const { isAdmin, isManager, condominiumId } = useAuth();
  const navigate = useNavigate();
  
  // Guard: Only Manager and Admin can access
  useEffect(() => {
    if (!isManager && !isAdmin) {
      navigate('/dashboard');
    }
  }, [isManager, isAdmin, navigate]);
  
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [condominiums, setCondominiums] = useState<CondominiumDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateUnitRequest>({
    condominiumId: condominiumId || '',
    number: '',
    floor: 0,
    type: 0,
    apartmentNumber: '',
    permillage: 0,
    monthlyQuota: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterCondominiumId, setFilterCondominiumId] = useState(condominiumId || '');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<UnitDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const load = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const unitsResponse = await unitsApi.getPaged(page, pageSize, debouncedSearch);
      let unitsData = unitsResponse.data.items;
      
      // Filter by condominium if user is Admin
      if (isAdmin && condominiumId) {
        unitsData = unitsData.filter(u => u.condominiumId === condominiumId);
      }
      
      setPagination(unitsResponse.data);
      setUnits(unitsData);
      setCurrentPage(page);
      
      // Load condominiums for Manager
      if (isManager) {
        const condosResponse = await condominiumsApi.getAll();
        setCondominiums(condosResponse.data);
      }
    } catch (error) {
      console.error('Erro ao carregar frações:', error);
    } finally {
      setLoading(false);
    }
  }, [condominiumId, isAdmin, isManager, debouncedSearch]);

  useEffect(() => {
    load(1);
  }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm({
      condominiumId: isAdmin ? condominiumId || '' : '',
      number: '',
      floor: 0,
      type: 0,
      apartmentNumber: '',
      permillage: 0,
      monthlyQuota: 0,
    });
    setError('');
    setShowForm(true);
  };

  const openEdit = (u: UnitDto) => {
    setEditId(u.id);
    setForm({
      condominiumId: u.condominiumId,
      number: u.number,
      floor: u.floor,
      type: u.type,
      apartmentNumber: u.apartmentNumber || '',
      permillage: u.permillage,
      monthlyQuota: u.monthlyQuota || 0,
    });
    setError('');
    setShowForm(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'floor' || name === 'permillage' || name === 'type' || name === 'monthlyQuota' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.condominiumId) {
      setError('Selecione um condomínio');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await unitsApi.update(editId, form);
      } else {
        await unitsApi.create(form);
      }
      setShowForm(false);
      load();
    } catch {
      setError('Não foi possível guardar a fração. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta fração?')) return;
    try {
      await unitsApi.delete(id);
      load();
    } catch (error) {
      console.error('Erro ao remover fração:', error);
      alert('Erro ao remover fração. Pode haver utilizadores associados.');
    }
  };

  const condominiumLabel = (condoId: string) => {
    const c = condominiums.find(c => c.id === condoId);
    return c ? c.name : condoId.slice(0, 8) + '…';
  };

  const filteredUnits = filterCondominiumId 
    ? units.filter(u => u.condominiumId === filterCondominiumId)
    : units;

  if (!isManager && !isAdmin) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>Acesso restrito a gestores e administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Frações</h1>
            <p className="text-gray-500 text-sm mt-0.5">{filteredUnits.length} frações registadas</p>
          </div>
        )}
        <div className="flex items-center gap-3 ml-auto">
          <div className="w-80">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar frações..."
            />
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Fração
          </button>
        </div>
      </div>

      {/* Filter by condominium (Manager only) */}
      {isManager && condominiums.length > 0 && (
        <div className="flex gap-3">
          <select
            value={filterCondominiumId}
            onChange={(e) => setFilterCondominiumId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">Todos os condomínios</option>
            {condominiums.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {editId ? 'Editar Fração' : 'Nova Fração'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isManager && !editId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condomínio *</label>
                  <select
                    name="condominiumId"
                    value={form.condominiumId}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Selecione...</option>
                    {condominiums.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número da Fração *</label>
                <input
                  type="text"
                  name="number"
                  value={form.number}
                  onChange={handleChange}
                  required
                  placeholder="Ex: 101"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Piso *</label>
                <input
                  type="number"
                  name="floor"
                  value={form.floor}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {form.type === 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apartamento</label>
                  <input
                    type="text"
                    name="apartmentNumber"
                    value={form.apartmentNumber || ''}
                    onChange={handleChange}
                    placeholder="Ex: A, B, Esq, Dto"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value={0}>Apartamento</option>
                  <option value={1}>Comercial</option>
                  <option value={2}>Estacionamento</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permilagem (‰) *
                </label>
                <input
                  type="number"
                  name="permillage"
                  value={form.permillage}
                  onChange={handleChange}
                  required
                  min={0}
                  step={0.01}
                  placeholder="Ex: 85.50"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quota Mensal Base (€)
                </label>
                <input
                  type="number"
                  name="monthlyQuota"
                  value={form.monthlyQuota}
                  onChange={handleChange}
                  min={0}
                  step={0.01}
                  placeholder="Ex: 45.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Valor mensal da quota desta fração</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {saving ? 'A guardar...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-400">A carregar...</div>
        ) : filteredUnits.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Sem frações registadas
          </div>
        ) : (
          filteredUnits.map((u) => (
            <div key={u.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm shrink-0">
                    {u.number}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Fração {u.number}{u.apartmentNumber && u.type === 0 ? ` - ${u.apartmentNumber}` : ''}
                    </p>
                    <span className="text-xs text-gray-500">Piso {u.floor}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(u)} className="text-gray-300 hover:text-indigo-500 transition-colors p-1">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(u.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-gray-500">
                {isManager && (
                  <div className="flex items-center justify-between">
                    <span>Condomínio</span>
                    <span className="font-medium text-gray-700">{condominiumLabel(u.condominiumId)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Tipo</span>
                  <span className="font-medium text-gray-700">{unitTypeLabels[u.type] ?? u.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Permilagem</span>
                  <span className="font-medium text-gray-700">{u.permillage.toFixed(2)} ‰</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {pagination && !loading && filteredUnits.length > 0 && (
        <Pagination
          pagination={pagination}
          currentPage={currentPage}
          onPageChange={(page) => load(page)}
        />
      )}
    </div>
  );
}
