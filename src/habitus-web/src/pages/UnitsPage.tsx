import { useEffect, useState } from 'react';
import { Building2, Trash2, Pencil, Plus, X } from 'lucide-react';
import { unitsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { UnitDto, CreateUnitRequest } from '../types';

const unitTypeLabels: Record<number, string> = {
  0: 'Apartamento',
  1: 'Comercial',
  2: 'Estacionamento',
};

const DEFAULT_BUILDING_ID = '00000000-0000-0000-0000-000000000001';

const emptyForm = (): CreateUnitRequest => ({
  buildingId: DEFAULT_BUILDING_ID,
  number: '',
  floor: 0,
  type: 0,
  permillage: 0,
});

export default function UnitsPage() {
  const { isAdmin } = useAuth();
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateUnitRequest>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    unitsApi.getAll().then((r) => setUnits(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setError('');
    setShowForm(true);
  };

  const openEdit = (u: UnitDto) => {
    setEditId(u.id);
    setForm({
      buildingId: u.buildingId,
      number: u.number,
      floor: u.floor,
      type: u.type,
      permillage: u.permillage,
    });
    setError('');
    setShowForm(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'floor' || name === 'permillage' || name === 'type' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    await unitsApi.delete(id);
    load();
  };

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Frações</h1>
          <p className="text-gray-500 text-sm mt-0.5">{units.length} frações registadas</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Fração
        </button>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Número da Fração</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Piso</label>
                <input
                  type="number"
                  name="floor"
                  value={form.floor}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
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
                  Permilagem (‰)
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
        ) : units.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Sem frações registadas
          </div>
        ) : (
          units.map((u) => (
            <div key={u.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm shrink-0">
                    {u.number}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Fração {u.number}</p>
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
    </div>
  );
}
