import { useEffect, useState } from 'react';
import { Plus, Calendar, Trash2 } from 'lucide-react';
import { reservationsApi, sharedSpacesApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { ReservationDto, SharedSpaceDto } from '../types';

const statusLabels: Record<string, string> = {
  Confirmed: 'Confirmada',
  Pending: 'Pendente',
  Cancelled: 'Cancelada',
};

const statusColors: Record<string, string> = {
  Confirmed: 'bg-green-100 text-green-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  Cancelled: 'bg-gray-100 text-gray-500',
};

export default function ReservationsPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [spaces, setSpaces] = useState<SharedSpaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    sharedSpaceId: '',
    residentId: user?.name ?? '',
    startTime: '',
    endTime: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([reservationsApi.getAll(), sharedSpacesApi.getAll()]).then(([r, s]) => {
      setReservations(r.data);
      setSpaces(s.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await reservationsApi.create(form);
      setShowForm(false);
      setForm({ sharedSpaceId: '', residentId: user?.name ?? '', startTime: '', endTime: '' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: string } })?.response?.data;
      setError(msg ?? 'Conflito de horário. Tente outro período.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Cancelar esta reserva?')) return;
    await reservationsApi.delete(id);
    load();
  };

  const spaceName = (id: string) => spaces.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-gray-500 text-sm mt-0.5">Reservas dos espaços comuns</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Reserva
        </button>
      </div>

      {/* Spaces available */}
      {spaces.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {spaces.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium text-gray-900">{s.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.isAvailable ? 'Disponível' : 'Indisponível'}
                </span>
              </div>
              {s.description && <p className="text-xs text-gray-500">{s.description}</p>}
              {s.capacity > 0 && <p className="text-xs text-gray-400 mt-1">Capacidade: {s.capacity} pessoas</p>}
            </div>
          ))}
        </div>
      )}

      {/* New reservation form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Nova Reserva</h3>
          {error && <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Espaço</label>
              <select
                value={form.sharedSpaceId}
                onChange={(e) => setForm({ ...form, sharedSpaceId: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecionar espaço</option>
                {spaces.filter((s) => s.isAvailable).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
              <input
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
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
                {submitting ? 'A reservar...' : 'Reservar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reservations list */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">A carregar...</div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Sem reservas
          </div>
        ) : (
          reservations.map((r) => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{spaceName(r.sharedSpaceId)}</p>
                <p className="text-sm text-gray-500">
                  {new Date(r.startTime).toLocaleString('pt-PT')} → {new Date(r.endTime).toLocaleString('pt-PT')}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {statusLabels[r.status] ?? r.status}
              </span>
              <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
