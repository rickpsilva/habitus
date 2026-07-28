import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Trash2, Pencil, Plus, X, Upload, Download } from 'lucide-react';
import { unitsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import type { UnitDto, CreateUnitRequest, PaginatedResponse } from '../types';
import { PageHeader, Button, AsyncState, EmptyState } from '../components/ui';
import {
  DEFAULT_MAX_UPLOAD_SIZE_BYTES,
  formatUploadSizeLabel,
  getPlatformMaxUploadSizeBytes,
  isFileSizeWithinLimit,
} from '../utils/uploadLimits';

const unitTypeLabels: Record<number, string> = {
  0: 'Apartamento',
  1: 'Comercial',
  2: 'Estacionamento',
};

export default function UnitsPage({ embedded = false }: { embedded?: boolean }) {
  const { isAdmin, condominiumId } = useAuth();
  const navigate = useNavigate();
  const { error: toastError, success: toastSuccess } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [maxUploadSizeBytes, setMaxUploadSizeBytes] = useState(DEFAULT_MAX_UPLOAD_SIZE_BYTES);
  
  // Guard: Only Admin can access
  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
    }
  }, [isAdmin, navigate]);
  
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateUnitRequest>({
    condominiumId: condominiumId || '',
    number: '',
    building: '',
    floor: 0,
    type: 0,
    apartmentNumber: '',
    permillage: 0,
    monthlyQuota: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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
    setLoadError('');
    try {
      if (!condominiumId) {
        setPagination(null);
        setUnits([]);
        setCurrentPage(page);
        setLoadError('Condomínio não identificado.');
        return;
      }

      const unitsResponse = await unitsApi.getPaged(condominiumId, page, pageSize, debouncedSearch);
      const unitsData = unitsResponse.data.items;
      
      setPagination(unitsResponse.data);
      setUnits(unitsData);
      setCurrentPage(page);
    } catch (error) {
      console.error('Erro ao carregar frações:', error);
      setLoadError('Não foi possível carregar as frações.');
    } finally {
      setLoading(false);
    }
  }, [condominiumId, debouncedSearch]);

  useEffect(() => {
    load(1);
  }, [load]);

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

  const openCreate = () => {
    setEditId(null);
    setForm({
      condominiumId: condominiumId || '',
      number: '',
      building: '',
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
      building: u.building || '',
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

  const escapeCsvField = (value: string | number | null | undefined) => {
    const text = value == null ? '' : String(value);
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const unitTypeToCsv = (type: number) => {
    if (type === 1) return 'Commercial';
    if (type === 2) return 'Parking';
    return 'Apartment';
  };

  const handleCsvDownload = async () => {
    if (!condominiumId) {
      toastError('Condomínio não identificado. Por favor, recarregue a página.');
      return;
    }

    try {
      const response = await unitsApi.getAll(condominiumId);
      const condominiumUnits = response.data;

      const header = 'floor,number,type,apartmentNumber,permillage,monthlyQuota,building';
      let rows: string[];
      let filename: string;

      if (condominiumUnits.length === 0) {
        rows = ['1,101,Apartment,A,85.5,45.00,Bloco A'];
        filename = 'template-fracoes.csv';
      } else {
        rows = condominiumUnits.map((u) => [
          escapeCsvField(u.floor),
          escapeCsvField(u.number),
          escapeCsvField(unitTypeToCsv(u.type)),
          escapeCsvField(u.apartmentNumber || ''),
          escapeCsvField(u.permillage),
          escapeCsvField(u.monthlyQuota),
          escapeCsvField(u.building || ''),
        ].join(','));
        filename = 'fracoes-export.csv';
      }

      const content = [header, ...rows].join('\n');
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toastError('Não foi possível descarregar o CSV. Tente novamente.');
    }
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
      if (!condominiumId) {
        setError('Condomínio não identificado');
        return;
      }

      if (editId) {
        await unitsApi.update(condominiumId, editId, form);
      } else {
        await unitsApi.create(condominiumId, form);
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
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      if (!condominiumId) {
        toastError('Condomínio não identificado.');
        return;
      }

      await unitsApi.delete(condominiumId, deleteId);
      load();
    } catch (error) {
      console.error('Erro ao remover fração:', error);
      toastError('Erro ao remover fração. Pode haver utilizadores associados.');
    } finally {
      setDeleteId(null);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isFileSizeWithinLimit(file, maxUploadSizeBytes)) {
      toastError(`O ficheiro excede o limite de ${formatUploadSizeLabel(maxUploadSizeBytes)}.`);
      if (csvInputRef.current) csvInputRef.current.value = '';
      return;
    }
    
    const activeCondominiumId = condominiumId || '';
    if (!activeCondominiumId) {
      toastError('Condomínio não identificado. Por favor, recarregue a página.');
      return;
    }

    setCsvImporting(true);
    try {
      const response = await unitsApi.importCsv(activeCondominiumId, file);
      const result = response.data;
      if (result.errors && result.errors.length > 0) {
        toastError(`Importação concluída com erros: ${result.message}`);
      } else {
        toastSuccess(result.message);
      }
      load();
    } catch (err: unknown) {
      const msg = typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toastError(msg ?? 'Erro ao importar CSV. Verifique o formato do ficheiro.');
    } finally {
      setCsvImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const filteredUnits = units;

  if (!isAdmin) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={deleteId !== null}
        title="Remover fração"
        message="Tem a certeza que deseja remover esta fração? Esta ação não pode ser revertida."
        confirmLabel="Remover"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      {/* Header — standalone only */}
      {!embedded && (
        <PageHeader
          title="Frações"
          subtitle={`${filteredUnits.length} frações registadas`}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-48">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Pesquisar frações..."
          />
        </div>

        <Button
          variant="secondary"
          icon={Download}
          onClick={handleCsvDownload}
          title="Descarregar CSV (template ou exportação)"
        >
          Descarregar CSV
        </Button>

        <Button icon={Plus} onClick={openCreate}>
          Nova Fração
        </Button>

        <Button
          variant="secondary"
          icon={Upload}
          onClick={() => csvInputRef.current?.click()}
          disabled={csvImporting}
          title="Importar frações a partir de ficheiro CSV"
        >
          {csvImporting ? 'A importar...' : 'Importar CSV'}
        </Button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleCsvImport}
        />
        <span className="text-xs text-gray-500">Máx. upload: {formatUploadSizeLabel(maxUploadSizeBytes)}</span>
      </div>

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Prédio</label>
                <input
                  type="text"
                  name="building"
                  value={form.building || ''}
                  onChange={handleChange}
                  placeholder="Ex: Bloco A"
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
                <Button
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                  fullWidth
                  className="border border-gray-300"
                >
                  Cancelar
                </Button>
                <Button type="submit" loading={saving} fullWidth>
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AsyncState
        loading={loading}
        error={loadError || null}
        onRetry={() => load(currentPage)}
        isEmpty={filteredUnits.length === 0}
        skeleton="card"
        empty={<EmptyState icon={Building2} title="Sem frações registadas" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUnits.map((u) => (
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
                <div className="flex items-center justify-between">
                  <span>Prédio</span>
                  <span className="font-medium text-gray-700">{u.building || '-'}</span>
                </div>
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
          ))}
        </div>
      </AsyncState>
      
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
