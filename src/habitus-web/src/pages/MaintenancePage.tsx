import { useEffect, useState } from 'react';
import { Plus, Wrench, AlertCircle, Clock, CheckCircle2, ChevronDown } from 'lucide-react';
import { maintenanceApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { MaintenanceRequestDto, CreateMaintenanceRequest } from '../types';

const statusMap: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  Pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  InProgress: { label: 'Em curso', className: 'bg-blue-100 text-blue-700', icon: Clock },
  Resolved: { label: 'Resolvido', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  Cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-500', icon: AlertCircle },
};

const priorityMap: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-600',
  Medium: 'bg-yellow-100 text-yellow-700',
  High: 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
};

const priorityLabels: Record<string, string> = {
  Low: 'Baixa',
  Medium: 'Média',
  High: 'Alta',
  Critical: 'Crítica',
};

export default function MaintenancePage() {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<MaintenanceRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('All');
  const [form, setForm] = useState<CreateMaintenanceRequest>({
    title: '',
    description: '',
    priority: 'Medium',
    unitId: '',
    createdBy: user?.name ?? '',
    location: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    maintenanceApi.getAll().then((r) => setRequests(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await maintenanceApi.create(form);
      setShowForm(false);
      setForm({ title: '', description: '', priority: 'Medium', unitId: '', createdBy: user?.name ?? '', location: '' });
      load();
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await maintenanceApi.update(id, { status });
    load();
  };

  const filtered = filter === 'All' ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manutenção</h1>
          <p className="text-gray-500 text-sm mt-0.5">Pedidos de manutenção do condomínio</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Pedido
        </button>
      </div>

      {/* New request form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Novo Pedido de Manutenção</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Torneira avariada na cozinha"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localização</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Fração 3A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.keys(priorityLabels).map((p) => (
                  <option key={p} value={p}>{priorityLabels[p]}</option>
                ))}
              </select>
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

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Pending', 'InProgress', 'Resolved'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s === 'All' ? 'Todos' : statusMap[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Sem pedidos de manutenção
          </div>
        ) : (
          filtered.map((m) => {
            const { label, className, icon: Icon } = statusMap[m.status] ?? statusMap['Pending'];
            return (
              <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon className="w-5 h-5 mt-0.5 shrink-0 text-gray-400" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{m.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{m.description}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>{label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityMap[m.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                          {priorityLabels[m.priority] ?? m.priority}
                        </span>
                        {m.location && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{m.location}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isAdmin && m.status !== 'Resolved' && (
                    <div className="relative shrink-0">
                      <select
                        value={m.status}
                        onChange={(e) => handleStatusChange(m.id, e.target.value)}
                        className="pl-2 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none appearance-none bg-white cursor-pointer"
                      >
                        {Object.entries(statusMap).map(([v, { label }]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(m.createdAt).toLocaleDateString('pt-PT')}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
