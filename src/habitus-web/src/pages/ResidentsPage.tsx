import { useCallback, useEffect, useState } from 'react';
import { Users, Trash2, Mail, Phone, Home, AlertCircle, RefreshCw } from 'lucide-react';
import { residentsApi, unitsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import type { ResidentDto, UnitDto } from '../types';

const roleLabels: Record<string, string> = {
  Admin: 'Administrador',
  Resident: 'Morador',
  Manager: 'Gestor',
};

const roleColors: Record<string, string> = {
  Admin: 'bg-indigo-100 text-indigo-700',
  Resident: 'bg-gray-100 text-gray-600',
  Manager: 'bg-emerald-100 text-emerald-700',
};

export default function ResidentsPage() {
  const { isAdmin, condominiumId } = useAuth();
  const { error: toastError } = useToast();
  const [residents, setResidents] = useState<ResidentDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filterUnitId, setFilterUnitId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    if (!condominiumId) {
      setResidents([]);
      setUnits([]);
      setLoadError('Condomínio não identificado.');
      setLoading(false);
      return;
    }

    Promise.all([
      residentsApi.getAll().then((r) => setResidents(r.data)),
      unitsApi.getAll(condominiumId).then((r) => setUnits(r.data)),
    ])
      .catch(() => setLoadError('Não foi possível carregar os moradores.'))
      .finally(() => setLoading(false));
  }, [condominiumId]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      load();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [load]);

  const handleDelete = async (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await residentsApi.delete(deleteId);
      load();
    } catch {
      toastError('Erro ao remover morador.');
    } finally {
      setDeleteId(null);
    }
  };

  const unitLabel = (unitId: string) => {
    const u = units.find((u) => u.id === unitId);
    return u ? `Fração ${u.number} – Piso ${u.floor}` : `${unitId.slice(0, 8)}…`;
  };

  const filtered = residents.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase());
    const matchesUnit = filterUnitId ? r.unitId === filterUnitId : true;
    return matchesSearch && matchesUnit;
  });

  if (!isAdmin) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={deleteId !== null}
        title="Remover morador"
        message="Tem a certeza que deseja remover este morador?"
        confirmLabel="Remover"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Moradores</h1>
          <p className="text-gray-500 text-sm mt-0.5">{residents.length} moradores registados</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome ou email..."
          className="flex-1 min-w-[200px] max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={filterUnitId}
          onChange={(e) => setFilterUnitId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">Todas as frações</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              Fração {u.number} – Piso {u.floor}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!loading && loadError && (
          <div className="col-span-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {loadError}
            </span>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar novamente
            </button>
          </div>
        )}
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-400">A carregar...</div>
        ) : !loadError && filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Sem moradores encontrados
          </div>
        ) : !loadError ? (
          filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm shrink-0">
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[r.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {roleLabels[r.role] ?? r.role}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{r.email}</span>
                </div>
                {r.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Phone className="w-3.5 h-3.5" />
                    {r.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Home className="w-3.5 h-3.5" />
                  {unitLabel(r.unitId)}
                </div>
              </div>
            </div>
          ))
        ) : null}
      </div>
    </div>
  );
}
