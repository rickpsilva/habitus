import { useEffect, useState } from 'react';
import { Plus, Wrench, AlertCircle, Clock, CheckCircle2, ChevronDown, X, Phone, Mail, MapPin, Building } from 'lucide-react';
import { maintenanceApi, usersApi, suppliersApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { MaintenanceRequestDto, CreateMaintenanceRequest, UserDto, Supplier } from '../types';

const statusMap: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  Open: { label: 'Aberto', className: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  InProgress: { label: 'Em curso', className: 'bg-blue-100 text-blue-700', icon: Clock },
  Resolved: { label: 'Resolvido', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  Closed: { label: 'Fechado', className: 'bg-gray-100 text-gray-500', icon: AlertCircle },
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
  const { user, isAdmin, condominiumId, unitId } = useAuth();
  const [currentUser, setCurrentUser] = useState<UserDto | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('All');
  const [form, setForm] = useState<CreateMaintenanceRequest>({
    title: '',
    description: '',
    priority: 'Medium',
    condominiumId: condominiumId || '',
    unitId: unitId || '',
    createdBy: '',
    location: '',
    photos: [],
  });
  const [submitting, setSubmitting] = useState(false);

  // Status panel state
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequestDto | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [statusForm, setStatusForm] = useState({
    status: '',
    supplierId: '',
    adminComments: '',
  });

  // Load current user data to get ID
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const response = await usersApi.getMe();
        setCurrentUser(response.data);
        // Update form with user data
        setForm(prev => ({
          ...prev,
          condominiumId: response.data.condominiumId || condominiumId || '',
          unitId: response.data.unitId || unitId || '',
          createdBy: response.data.id,
        }));
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };
    if (user) {
      loadUserData();
    }
  }, [user, condominiumId, unitId]);

  // Load suppliers
  useEffect(() => {
    if (isAdmin && condominiumId) {
      suppliersApi.getAll().then((r) => {
        const filtered = r.data.filter(s => s.condominiumId === condominiumId && s.isActive);
        setSuppliers(filtered);
      }).catch(console.error);
    }
  }, [isAdmin, condominiumId]);

  const load = () => {
    setLoading(true);
    maintenanceApi.getAll().then((r) => setRequests(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.condominiumId || !form.unitId || !form.createdBy) {
      alert('Dados de utilizador incompletos. Por favor, recarregue a página.');
      return;
    }
    
    setSubmitting(true);
    try {
      await maintenanceApi.create(form);
      setShowForm(false);
      // Reset form but keep user data
      setForm({ 
        title: '', 
        description: '', 
        priority: 'Medium', 
        condominiumId: form.condominiumId,
        unitId: form.unitId, 
        createdBy: form.createdBy, 
        location: '',
        photos: [],
      });
      load();
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      alert('Erro ao criar pedido de manutenção');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenStatusPanel = (request: MaintenanceRequestDto) => {
    setSelectedRequest(request);
    setStatusForm({
      status: request.status,
      supplierId: request.supplierId || '',
      adminComments: '',
    });
    setShowStatusPanel(true);
  };

  const handleCloseStatusPanel = () => {
    setShowStatusPanel(false);
    setSelectedRequest(null);
    setStatusForm({ status: '', supplierId: '', adminComments: '' });
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setSubmitting(true);
    try {
      await maintenanceApi.updateStatus(selectedRequest.id, {
        status: statusForm.status,
        supplierId: statusForm.supplierId || undefined,
        adminComments: statusForm.adminComments || undefined,
      });
      handleCloseStatusPanel();
      load();
    } catch (error) {
      console.error('Erro ao atualizar estado:', error);
      alert('Erro ao atualizar estado da manutenção');
    } finally {
      setSubmitting(false);
    }
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
        {['All', 'Open', 'InProgress', 'Resolved', 'Closed'].map((s) => (
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
            const { label, className, icon: Icon } = statusMap[m.status] ?? statusMap['Open'];
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
                  {isAdmin && (
                    <button
                      onClick={() => handleOpenStatusPanel(m)}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
                    >
                      Gerir Estado
                    </button>
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

      {/* Status Management Slide-in Panel */}
      {showStatusPanel && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/30" onClick={handleCloseStatusPanel}></div>
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Gerir Estado da Manutenção</h2>
              <button onClick={handleCloseStatusPanel} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Request Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-900">{selectedRequest.title}</p>
                <p className="text-sm text-gray-500 mt-1">{selectedRequest.description}</p>
                {selectedRequest.location && (
                  <p className="text-xs text-gray-400 mt-2">{selectedRequest.location}</p>
                )}
              </div>

              {/* Form */}
              <form onSubmit={handleStatusUpdate} className="space-y-4">
                {/* Status Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={statusForm.status}
                    onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Object.entries(statusMap).map(([value, { label }]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Supplier Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fornecedor <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <select
                    value={statusForm.supplierId}
                    onChange={(e) => setStatusForm({ ...statusForm, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sem fornecedor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} - {s.specialty}</option>
                    ))}
                  </select>
                </div>

                {/* Supplier Contact Info */}
                {statusForm.supplierId && (
                  (() => {
                    const selectedSupplier = suppliers.find(s => s.id === statusForm.supplierId);
                    return selectedSupplier ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-medium text-blue-900 mb-2">Informações de Contato</p>
                        {selectedSupplier.phone && (
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <Phone className="w-4 h-4" />
                            <span>{selectedSupplier.phone}</span>
                          </div>
                        )}
                        {selectedSupplier.email && (
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <Mail className="w-4 h-4" />
                            <span>{selectedSupplier.email}</span>
                          </div>
                        )}
                        {selectedSupplier.address && (
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <MapPin className="w-4 h-4" />
                            <span>{selectedSupplier.address}</span>
                          </div>
                        )}
                        {selectedSupplier.contact && (
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <Building className="w-4 h-4" />
                            <span>{selectedSupplier.contact}</span>
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()
                )}

                {/* Admin Comments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comentário <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={statusForm.adminComments}
                    onChange={(e) => setStatusForm({ ...statusForm, adminComments: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Adicione um comentário sobre esta atualização..."
                  />
                </div>

                {/* Comment History */}
                {selectedRequest.adminComments && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Histórico de Comentários</label>
                    <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">{selectedRequest.adminComments}</pre>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseStatusPanel}
                    className="flex-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {submitting ? 'A guardar...' : 'Guardar Alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
