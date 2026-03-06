import { useEffect, useState } from 'react';
import { Plus, ClipboardList, Trash2, Pencil, X, FileText, Ban, CheckCircle2, Calendar } from 'lucide-react';
import { assembliesApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import RichTextEditor from '../components/RichTextEditor';
import RichTextDisplay from '../components/RichTextDisplay';
import type { AssemblyDto, CreateAssemblyRequest, UpdateAssemblyRequest, PaginatedResponse } from '../types';

const statusLabels: Record<string, string> = {
  Scheduled: 'Agendada',
  InProgress: 'Em Curso',
  Completed: 'Concluída',
  Cancelled: 'Cancelada',
};

const statusColors: Record<string, string> = {
  Scheduled: 'bg-blue-100 text-blue-700',
  InProgress: 'bg-yellow-100 text-yellow-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-gray-100 text-gray-500',
};

export default function AssembliesPage() {
  const { isAdmin, condominiumId } = useAuth();
  const [assemblies, setAssemblies] = useState<AssemblyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateAssemblyRequest>({
    title: '',
    description: '',
    scheduledAt: '',
    location: '',
    condominiumId: condominiumId || '',
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('All');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<AssemblyDto> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const pageSize = 10;

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAssembly, setSelectedAssembly] = useState<AssemblyDto | null>(null);

  // Notes modal state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesAutoSaving, setNotesAutoSaving] = useState(false);
  const [notesLastSaved, setNotesLastSaved] = useState<Date | null>(null);

  // Minutes modal state
  const [showMinutesModal, setShowMinutesModal] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [minutesAutoSaving, setMinutesAutoSaving] = useState(false);
  const [minutesLastSaved, setMinutesLastSaved] = useState<Date | null>(null);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const load = (page: number = 1, search: string = searchQuery) => {
    setLoading(true);
    assembliesApi.getPaged(page, pageSize, search)
      .then((r) => {
        // Sort by most recent scheduled date first
        const sorted = r.data.items.sort((a, b) => 
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
        );
        setPagination(r.data);
        setAssemblies(sorted);
        setCurrentPage(page);
      })
      .finally(() => setLoading(false));
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
  
  // Filter assemblies by status
  const filteredAssemblies = statusFilter === 'All' 
    ? assemblies 
    : assemblies.filter(a => a.status === statusFilter);

  const openNew = () => {
    setEditId(null);
    setForm({
      title: '',
      description: '',
      scheduledAt: '',
      location: '',
      condominiumId: condominiumId || '',
    });
    setShowForm(true);
  };

  const openEdit = (a: AssemblyDto) => {
    setEditId(a.id);
    const updateForm: UpdateAssemblyRequest = {
      title: a.title,
      description: a.description,
      scheduledAt: a.scheduledAt ? new Date(a.scheduledAt).toISOString().slice(0, 16) : '',
      location: a.location,
    };
    setForm({ 
      condominiumId: a.condominiumId,
      title: updateForm.title || '',
      description: updateForm.description || '',
      scheduledAt: updateForm.scheduledAt || '',
      location: updateForm.location || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) {
        const updateData: UpdateAssemblyRequest = {
          title: form.title,
          description: form.description,
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
          location: form.location,
        };
        await assembliesApi.update(editId, updateData);
      } else {
        const createData: CreateAssemblyRequest = {
          ...form,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
        };
        await assembliesApi.create(createData);
      }
      setShowForm(false);
      load();
    } catch (error) {
      console.error('Erro ao guardar assembleia:', error);
      alert('Erro ao guardar assembleia');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta assembleia?')) return;
    await assembliesApi.delete(id);
    load();
  };

  const openDetails = (assembly: AssemblyDto) => {
    setSelectedAssembly(assembly);
    setShowDetailModal(true);
  };

  const openNotes = (assembly: AssemblyDto) => {
    setSelectedAssembly(assembly);
    setNotes(assembly.notes || '');
    setNotesLastSaved(null);
    setShowNotesModal(true);
  };

  // Auto-save notes
  useEffect(() => {
    if (!showNotesModal || !selectedAssembly || notes === (selectedAssembly.notes || '')) {
      return;
    }

    const timer = setTimeout(async () => {
      setNotesAutoSaving(true);
      try {
        await assembliesApi.updateNotes(selectedAssembly.id, notes);
        setNotesLastSaved(new Date());
        // Update selectedAssembly to reflect new saved state
        setSelectedAssembly({ ...selectedAssembly, notes });
      } catch (error) {
        console.error('Erro no auto-save das notas:', error);
      } finally {
        setNotesAutoSaving(false);
      }
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(timer);
  }, [notes, showNotesModal, selectedAssembly]);

  const handleSaveNotes = async () => {
    if (!selectedAssembly) return;
    setSubmitting(true);
    try {
      await assembliesApi.updateNotes(selectedAssembly.id, notes);
      setShowNotesModal(false);
      load();
    } catch (error) {
      console.error('Erro ao guardar notas:', error);
      alert('Erro ao guardar notas');
    } finally {
      setSubmitting(false);
    }
  };

  const openMinutes = (assembly: AssemblyDto) => {
    setSelectedAssembly(assembly);
    setMinutes(assembly.minutes || '');
    setMinutesLastSaved(null);
    setShowMinutesModal(true);
  };

  // Auto-save minutes draft (sem completar a assembleia)
  useEffect(() => {
    if (!showMinutesModal || !selectedAssembly || minutes === (selectedAssembly.minutes || '')) {
      return;
    }

    const timer = setTimeout(async () => {
      setMinutesAutoSaving(true);
      try {
        await assembliesApi.updateMinutesDraft(selectedAssembly.id, minutes);
        setMinutesLastSaved(new Date());
        // Update selectedAssembly to reflect new saved state
        setSelectedAssembly({ ...selectedAssembly, minutes });
      } catch (error) {
        console.error('Erro no auto-save das atas:', error);
      } finally {
        setMinutesAutoSaving(false);
      }
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(timer);
  }, [minutes, showMinutesModal, selectedAssembly]);

  const handleSaveDraftMinutes = async () => {
    if (!selectedAssembly) return;
    setSubmitting(true);
    try {
      await assembliesApi.updateMinutesDraft(selectedAssembly.id, minutes);
      setMinutesLastSaved(new Date());
      alert('Draft das atas guardado com sucesso!');
    } catch (error) {
      console.error('Erro ao guardar draft das atas:', error);
      alert('Erro ao guardar draft das atas');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteAssembly = async () => {
    if (!selectedAssembly) return;
    if (!minutes.trim()) {
      alert('Por favor insira as atas da assembleia antes de concluir.');
      return;
    }
    
    const confirmed = window.confirm(
      'Tem certeza que deseja concluir esta assembleia?\n\nIsso irá:\n' +
      '- Marcar a assembleia como Concluída\n' +
      '- Enviar notificações a todos os utilizadores\n' +
      '- As atas ficarão disponíveis publicamente'
    );
    
    if (!confirmed) return;
    
    setSubmitting(true);
    try {
      await assembliesApi.updateMinutes(selectedAssembly.id, minutes);
      setShowMinutesModal(false);
      load();
      alert('Assembleia concluída! As atas foram publicadas e notificações enviadas.');
    } catch (error) {
      console.error('Erro ao concluir assembleia:', error);
      alert('Erro ao concluir assembleia');
    } finally {
      setSubmitting(false);
    }
  };

  const openCancel = (assembly: AssemblyDto) => {
    setSelectedAssembly(assembly);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const handleCancel = async () => {
    if (!selectedAssembly) return;
    if (!cancellationReason.trim()) {
      alert('Por favor insira o motivo do cancelamento');
      return;
    }
    setSubmitting(true);
    try {
      await assembliesApi.cancel(selectedAssembly.id, cancellationReason);
      setShowCancelModal(false);
      load();
    } catch (error) {
      console.error('Erro ao cancelar assembleia:', error);
      alert('Erro ao cancelar assembleia');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assembleias</h1>
          <p className="text-gray-500 text-sm mt-0.5">Reuniões e assembleias de condóminos</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-80">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Pesquisar assembleias..."
            />
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
                placeholder="Ex: Assembleia Geral Ordinária 2026"
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
                placeholder="Ordem de trabalhos e outras informações relevantes..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Salão comum do condomínio"
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

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Scheduled', 'InProgress', 'Completed', 'Cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === status 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {status === 'All' ? 'Todas' : statusLabels[status] ?? status}
            {status !== 'All' && (
              <span className="ml-1.5 text-xs opacity-75">
                ({assemblies.filter(a => a.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">A carregar...</div>
        ) : filteredAssemblies.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            {statusFilter === 'All' ? 'Sem assembleias agendadas' : `Sem assembleias com estado "${statusLabels[statusFilter] ?? statusFilter}"`}
          </div>
        ) : (
          <>
            {filteredAssemblies.map((a) => (
              <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 shrink-0">
                      <ClipboardList className="w-5 h-5 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <button 
                        onClick={() => openDetails(a)}
                        className="font-medium text-gray-900 hover:text-indigo-600 text-left"
                      >
                        {a.title}
                      </button>
                      {a.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{a.description}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {statusLabels[a.status] ?? a.status}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(a.scheduledAt).toLocaleString('pt-PT')}
                        </span>
                        {a.location && (
                          <span className="text-xs text-gray-400">{a.location}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    {isAdmin && a.status === 'InProgress' && (
                      <button 
                        onClick={() => openNotes(a)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                        title="Editar Notas"
                      >
                        Notas
                      </button>
                    )}
                    {isAdmin && (a.status === 'InProgress' || a.status === 'Scheduled') && (
                      <button 
                        onClick={() => openMinutes(a)}
                        className="px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 border border-green-200 rounded-lg transition-colors"
                        title="Inserir Atas (marca como concluída)"
                      >
                        Atas
                      </button>
                    )}
                    {isAdmin && a.status !== 'Cancelled' && a.status !== 'Completed' && (
                      <button 
                        onClick={() => openCancel(a)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                        title="Cancelar Assembleia"
                      >
                        Cancelar
                      </button>
                    )}
                    {isAdmin && a.status === 'Scheduled' && (
                      <>
                        <button onClick={() => openEdit(a)} className="text-gray-400 hover:text-indigo-500">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {pagination && (
              <Pagination
                pagination={pagination}
                currentPage={currentPage}
                onPageChange={(page) => load(page)}
              />
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedAssembly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Detalhes da Assembleia</h2>
              <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Título</label>
                <p className="text-gray-900 mt-1">{selectedAssembly.title}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Descrição</label>
                <p className="text-gray-700 mt-1 whitespace-pre-wrap">{selectedAssembly.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Data e Hora</label>
                  <p className="text-gray-900 mt-1">{new Date(selectedAssembly.scheduledAt).toLocaleString('pt-PT')}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Local</label>
                  <p className="text-gray-900 mt-1">{selectedAssembly.location}</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Estado</label>
                <p className="mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[selectedAssembly.status]}`}>
                    {statusLabels[selectedAssembly.status]}
                  </span>
                </p>
              </div>
              {selectedAssembly.notes && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Notas</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <RichTextDisplay content={selectedAssembly.notes} className="text-sm" />
                  </div>
                </div>
              )}
              {selectedAssembly.minutes && (selectedAssembly.status === 'Completed' || (selectedAssembly.status === 'InProgress' && isAdmin)) && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">
                    Atas {selectedAssembly.status === 'InProgress' && '(Draft em edição)'}
                  </label>
                  <div className={`mt-1 p-3 rounded-lg border ${
                    selectedAssembly.status === 'Completed' 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <RichTextDisplay content={selectedAssembly.minutes} className="text-sm" />
                  </div>
                </div>
              )}
              {selectedAssembly.cancellationReason && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Motivo do Cancelamento</label>
                  <div className="mt-1 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-gray-700">{selectedAssembly.cancellationReason}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && selectedAssembly && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setShowNotesModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Notas da Assembleia
                </h2>
                {notesAutoSaving && (
                  <span className="text-xs text-gray-500 animate-pulse">A guardar...</span>
                )}
                {!notesAutoSaving && notesLastSaved && (
                  <span className="text-xs text-green-600">✓ Guardado</span>
                )}
              </div>
              <button onClick={() => setShowNotesModal(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-500 mb-3">Utilize este espaço para tirar notas durante a assembleia em curso.</p>
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="Adicione notas sobre a assembleia..."
                height="350px"
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium"
              >
                {submitting ? 'A guardar...' : 'Guardar Notas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minutes Modal */}
      {showMinutesModal && selectedAssembly && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setShowMinutesModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Atas da Assembleia
                </h2>
                {minutesAutoSaving && (
                  <span className="text-xs text-gray-500 animate-pulse">A guardar...</span>
                )}
                {!minutesAutoSaving && minutesLastSaved && (
                  <span className="text-xs text-green-600">✓ Guardado</span>
                )}
              </div>
              <button onClick={() => setShowMinutesModal(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-800">
                  💾 <strong>Auto-save ativo:</strong> As suas alterações são guardadas automaticamente.<br />
                  Clique em <strong>"Guardar Draft"</strong> para salvar manualmente ou <strong>"Concluir Assembleia"</strong> quando terminar.
                </p>
              </div>
              <RichTextEditor
                value={minutes}
                onChange={setMinutes}
                placeholder="Insira as atas da assembleia..."
                height="350px"
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between gap-3">
              <button
                onClick={() => setShowMinutesModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Fechar
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveDraftMinutes}
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium"
                >
                  {submitting ? 'A guardar...' : 'Guardar Draft'}
                </button>
                <button
                  onClick={handleCompleteAssembly}
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium"
                >
                  Concluir Assembleia
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedAssembly && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-600" />
                Cancelar Assembleia
              </h2>
              <button onClick={() => setShowCancelModal(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 mb-3">
                Por favor indique o motivo do cancelamento desta assembleia.
              </p>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                placeholder="Motivo do cancelamento..."
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Voltar
              </button>
              <button
                onClick={handleCancel}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium"
              >
                {submitting ? 'A cancelar...' : 'Cancelar Assembleia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
