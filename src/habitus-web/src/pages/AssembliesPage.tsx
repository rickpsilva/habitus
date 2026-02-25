import { useEffect, useState } from 'react';
import { Plus, ClipboardList, Trash2, Pencil } from 'lucide-react';
import { assembliesApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { AssemblyDto } from '../types';

const statusLabels: Record<string, string> = {
  Scheduled: 'Agendada',
  Completed: 'Concluída',
  Cancelled: 'Cancelada',
};

const statusColors: Record<string, string> = {
  Scheduled: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-gray-100 text-gray-500',
};

export default function AssembliesPage() {
  const { isAdmin } = useAuth();
  const [assemblies, setAssemblies] = useState<AssemblyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', scheduledAt: '', status: 'Scheduled', buildingId: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    assembliesApi.getAll().then((r) => setAssemblies(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditId(null);
    setForm({ title: '', description: '', scheduledAt: '', status: 'Scheduled', buildingId: '' });
    setShowForm(true);
  };

  const openEdit = (a: AssemblyDto) => {
    setEditId(a.id);
    setForm({
      title: a.title,
      description: a.description,
      scheduledAt: a.scheduledAt ? a.scheduledAt.slice(0, 16) : '',
      status: a.status,
      buildingId: a.buildingId,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) {
        await assembliesApi.update(editId, form);
      } else {
        await assembliesApi.create(form as Omit<AssemblyDto, 'id'>);
      }
      setShowForm(false);
      load();
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta assembleia?')) return;
    await assembliesApi.delete(id);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assembleias</h1>
          <p className="text-gray-500 text-sm mt-0.5">Reuniões e assembleias de condóminos</p>
        </div>
        {isAdmin && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Assembleia
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editId ? 'Editar Assembleia' : 'Nova Assembleia'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data e hora</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.entries(statusLabels).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
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

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">A carregar...</div>
        ) : assemblies.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Sem assembleias
          </div>
        ) : (
          assemblies.map((a) => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 shrink-0">
                    <ClipboardList className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{a.title}</p>
                    {a.description && <p className="text-sm text-gray-500 mt-0.5">{a.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[a.status] ?? a.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(a.scheduledAt).toLocaleString('pt-PT')}
                      </span>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => openEdit(a)} className="text-gray-400 hover:text-indigo-500">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
