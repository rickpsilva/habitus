import { useEffect, useState } from 'react';
import { Users, Trash2, Mail, Phone, Home } from 'lucide-react';
import { residentsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { ResidentDto } from '../types';

const roleLabels: Record<string, string> = {
  Admin: 'Administrador',
  Resident: 'Morador',
};

const roleColors: Record<string, string> = {
  Admin: 'bg-indigo-100 text-indigo-700',
  Resident: 'bg-gray-100 text-gray-600',
};

export default function ResidentsPage() {
  const { isAdmin } = useAuth();
  const [residents, setResidents] = useState<ResidentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    residentsApi.getAll().then((r) => setResidents(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este morador?')) return;
    await residentsApi.delete(id);
    load();
  };

  const filtered = residents.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase())
  );

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Moradores</h1>
          <p className="text-gray-500 text-sm mt-0.5">{residents.length} moradores registados</p>
        </div>
      </div>

      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome ou email..."
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-400">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Sem moradores encontrados
          </div>
        ) : (
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
                  Fração: {r.unitId?.slice(0, 8)}…
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
