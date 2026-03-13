import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Megaphone,
  Plus,
  Clock,
  Pin,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Paperclip,
  Send,
  Eye,
  Edit,
  Trash2,
  Upload,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { announcementsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import RichTextEditor from '../components/RichTextEditor';
import RichTextDisplay from '../components/RichTextDisplay';
import type {
  AnnouncementDto,
  AnnouncementStatsDto,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
  CreateAnnouncementCommentRequest,
} from '../types';

const categoryLabels: Record<string, string> = {
  Works: 'Obras',
  Noise: 'Barulho/Perturbação',
  Mail: 'Correspondência',
  General: 'Geral',
  Urgent: 'Urgente',
  Event: 'Eventos',
};

const statusLabels: Record<string, string> = {
  Draft: 'Rascunho',
  PendingApproval: 'Aguarda aprovação',
  Published: 'Publicado',
  Rejected: 'Rejeitado',
  Archived: 'Arquivado',
};

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  PendingApproval: 'bg-yellow-100 text-yellow-700',
  Published: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Archived: 'bg-slate-100 text-slate-600',
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;

  const regex = new RegExp(`(${escapeRegExp(q)})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={index} className="bg-yellow-200 text-gray-900 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

function attachmentUrl(condominiumId: string, announcementId: string, attachmentId: string) {
  return `/api/condominiums/${condominiumId}/announcements/${announcementId}/attachments/${attachmentId}/download`;
}

export default function AnnouncementsPage() {
  const { condominiumId, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([]);
  const [stats, setStats] = useState<AnnouncementStatsDto | null>(null);
  const [allowComments, setAllowComments] = useState(true);

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<AnnouncementDto | null>(null);
  const [selected, setSelected] = useState<AnnouncementDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'All');
  const [searchText, setSearchText] = useState(searchParams.get('q') || '');
  const [debouncedSearchText, setDebouncedSearchText] = useState(searchParams.get('q') || '');

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const [form, setForm] = useState<CreateAnnouncementRequest>({
    title: '',
    content: '',
    category: 'General',
    isAnonymous: false,
    validUntil: undefined,
    publishImmediately: false,
  });

  const [comment, setComment] = useState('');
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [commenting, setCommenting] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const filteredAnnouncements = useMemo(() => {
    const query = debouncedSearchText.trim().toLowerCase();

    return announcements.filter((a) => {
      const statusMatch = statusFilter === 'All' || a.status === statusFilter;
      const categoryMatch = categoryFilter === 'All' || a.category === categoryFilter;

      if (!statusMatch || !categoryMatch) return false;
      if (!query) return true;

      const plainContent = a.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      const title = a.title.toLowerCase();
      const author = a.authorName.toLowerCase();
      const unit = (a.unitNumber || '').toLowerCase();
      const category = (categoryLabels[a.category] || a.category).toLowerCase();

      return (
        title.includes(query) ||
        plainContent.includes(query) ||
        author.includes(query) ||
        unit.includes(query) ||
        category.includes(query)
      );
    });
  }, [announcements, statusFilter, categoryFilter, debouncedSearchText]);

  const sortedAnnouncements = useMemo(
    () => [...filteredAnnouncements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filteredAnnouncements]
  );

  const loadData = async () => {
    if (!condominiumId) return;
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        announcementsApi.getAll(condominiumId),
        announcementsApi.getStats(condominiumId),
      ]);
      setAnnouncements(aRes.data);
      setStats(sRes.data);

      const cRes = await announcementsApi.getSettings(condominiumId);
      setAllowComments(cRes.data.allowAnnouncementComments);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [condominiumId]);

  useEffect(() => {
    if (!condominiumId || announcements.length === 0) return;

    const openId = searchParams.get('open');
    if (!openId) return;

    if (selected?.id === openId) return;

    const found = announcements.find((a) => a.id === openId);
    if (!found) return;

    let cancelled = false;

    // Always fetch full details when opened via URL so backend can register read status.
    announcementsApi.getById(condominiumId, openId)
      .then((res) => {
        if (!cancelled) setSelected(res.data);
      })
      .finally(async () => {
        if (!cancelled) {
          await loadData();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, announcements, condominiumId, selected?.id]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (debouncedSearchText.trim()) next.set('q', debouncedSearchText.trim());
    else next.delete('q');

    if (statusFilter !== 'All') next.set('status', statusFilter);
    else next.delete('status');

    if (categoryFilter !== 'All') next.set('category', categoryFilter);
    else next.delete('category');

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [debouncedSearchText, statusFilter, categoryFilter, searchParams, setSearchParams]);

  const resetForm = () => {
    setForm({
      title: '',
      content: '',
      category: 'General',
      isAnonymous: false,
      validUntil: undefined,
      publishImmediately: false,
    });
    setEditing(null);
    setFiles([]);
  };

  const openNew = () => {
    resetForm();
    setShowEditor(true);
  };

  const openEdit = (a: AnnouncementDto) => {
    setEditing(a);
    setForm({
      title: a.title,
      content: a.content,
      category: a.category,
      isAnonymous: a.isAnonymous,
      validUntil: a.validUntil ? a.validUntil.slice(0, 16) : undefined,
      publishImmediately: false,
    });
    setFiles([]);
    setShowEditor(true);
  };

  const submitForm = async (publishImmediately: boolean) => {
    if (!condominiumId) return;
    setSubmitting(true);
    try {
      if (editing) {
        const payload: UpdateAnnouncementRequest = {
          title: form.title,
          content: form.content,
          category: form.category,
          isAnonymous: !!form.isAnonymous,
          validUntil: form.validUntil,
        };
        await announcementsApi.update(condominiumId, editing.id, payload);
        if (publishImmediately) {
          await announcementsApi.publish(condominiumId, editing.id);
        }
      } else {
        const payload: CreateAnnouncementRequest = {
          ...form,
          publishImmediately,
        };
        const created = await announcementsApi.create(condominiumId, payload);

        if (files.length > 0) {
          setUploadingFiles(true);
          try {
            for (const file of files) {
              const fd = new FormData();
              fd.append('file', file);
              await announcementsApi.uploadAttachment(condominiumId, created.data.id, fd);
            }
          } finally {
            setUploadingFiles(false);
          }

          if (publishImmediately) {
            await announcementsApi.publish(condominiumId, created.data.id);
          }
        }
      }

      setShowEditor(false);
      resetForm();
      await loadData();
    } catch {
      alert('Não foi possível guardar o comunicado.');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = async (a: AnnouncementDto) => {
    if (!condominiumId) return;
    const res = await announcementsApi.getById(condominiumId, a.id);
    setSelected(res.data);
    const next = new URLSearchParams(searchParams);
    next.set('open', a.id);
    setSearchParams(next);
    await loadData();
  };

  const closeDetails = () => {
    setSelected(null);
    const next = new URLSearchParams(searchParams);
    next.delete('open');
    setSearchParams(next);
  };

  const approve = async (id: string) => {
    if (!condominiumId) return;
    await announcementsApi.approve(condominiumId, id, { isApproved: true });
    await loadData();
  };

  const openRejectModal = (id: string) => {
    setRejectingId(id);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const reject = async () => {
    if (!condominiumId || !rejectingId || !rejectionReason.trim()) return;
    setRejecting(true);
    try {
      await announcementsApi.approve(condominiumId, rejectingId, {
        isApproved: false,
        rejectionReason: rejectionReason.trim(),
      });
      setShowRejectModal(false);
      setRejectingId(null);
      setRejectionReason('');
      await loadData();
    } finally {
      setRejecting(false);
    }
  };

  const togglePin = async (id: string) => {
    if (!condominiumId) return;
    await announcementsApi.togglePin(condominiumId, id);
    await loadData();
  };

  const remove = async (id: string) => {
    if (!condominiumId) return;
    if (!confirm('Eliminar comunicado?')) return;
    await announcementsApi.delete(condominiumId, id);
    if (selected?.id === id) closeDetails();
    await loadData();
  };

  const addComment = async () => {
    if (!condominiumId || !selected || !comment.trim()) return;
    setCommenting(true);
    try {
      const payload: CreateAnnouncementCommentRequest = {
        content: comment,
        isAnonymous: commentAnonymous,
      };
      await announcementsApi.addComment(condominiumId, selected.id, payload);
      setComment('');
      setCommentAnonymous(false);
      const refreshed = await announcementsApi.getById(condominiumId, selected.id);
      setSelected(refreshed.data);
      await loadData();
    } finally {
      setCommenting(false);
    }
  };

  const pendingCount = stats?.pendingApproval ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comunicados</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mensagens da comunidade com moderação por administrador</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Novo comunicado
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-sm"><strong>{stats.totalAnnouncements}</strong> total</div>
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-sm"><strong>{stats.published}</strong> publicados</div>
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-sm"><strong>{stats.myDrafts}</strong> rascunhos</div>
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-sm"><strong>{stats.unread}</strong> por ler</div>
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-sm"><strong>{pendingCount}</strong> pendentes</div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Pesquisar</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Título, conteúdo, autor, fração..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="All">Todos</option>
              {Object.keys(statusLabels).map((k) => (
                <option key={k} value={k}>{statusLabels[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Categoria</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="All">Todas</option>
              {Object.keys(categoryLabels).map((k) => (
                <option key={k} value={k}>{categoryLabels[k]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchText('');
                setStatusFilter('All');
                setCategoryFilter('All');
              }}
              className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">A carregar...</div>
        ) : sortedAnnouncements.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-500">
            <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Sem comunicados ainda
          </div>
        ) : (
          sortedAnnouncements.map((a) => (
            <div key={a.id} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 truncate">{highlightText(a.title, debouncedSearchText)}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] || statusColors.Draft}`}>
                      {statusLabels[a.status] || a.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {categoryLabels[a.category] || a.category}
                    </span>
                    {a.isPinned && <Pin className="w-4 h-4 text-amber-500" />}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {highlightText(a.isAnonymous ? 'Anónimo' : a.authorName, debouncedSearchText)} • {new Date(a.createdAt).toLocaleString('pt-PT')}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {highlightText(
                      a.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180),
                      debouncedSearchText
                    )}
                    {a.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length > 180 ? '…' : ''}
                  </p>
                  <div className="text-xs text-gray-500 mt-2 flex items-center gap-4">
                    <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> {a.totalReads}</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {a.totalComments}</span>
                    <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" /> {a.totalAttachments}</span>
                    {a.validUntil && (
                      <span className="inline-flex items-center gap-1 text-amber-700"><Clock className="w-3 h-3" /> Válido até {new Date(a.validUntil).toLocaleDateString('pt-PT')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openDetails(a)} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700">Ver</button>
                  {a.status === 'Draft' && (
                    <button onClick={() => openEdit(a)} className="p-2 rounded hover:bg-blue-50 text-blue-600" title="Editar">
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  {(a.status === 'Draft' || isAdmin) && (
                    <button onClick={() => remove(a.id)} className="p-2 rounded hover:bg-red-50 text-red-600" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && a.status === 'PendingApproval' && (
                    <>
                      <button onClick={() => approve(a.id)} className="p-2 rounded hover:bg-green-50 text-green-600" title="Aprovar">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => openRejectModal(a.id)} className="p-2 rounded hover:bg-red-50 text-red-600" title="Rejeitar">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {isAdmin && a.status === 'Published' && (
                    <button onClick={() => togglePin(a.id)} className="p-2 rounded hover:bg-amber-50 text-amber-600" title="Fixar/Desafixar">
                      <Pin className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showEditor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl border border-gray-100 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Editar comunicado' : 'Novo comunicado'}</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Título"
                className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {Object.keys(categoryLabels).map((k) => (
                  <option key={k} value={k}>{categoryLabels[k]}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!form.isAnonymous} onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })} />
                Publicar em anonimato (mostrar apenas fração)
              </label>
              <input
                type="datetime-local"
                value={form.validUntil || ''}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value || undefined })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <RichTextEditor value={form.content} onChange={(v) => setForm({ ...form, content: v })} placeholder="Escreve o conteúdo do comunicado..." height="240px" />

            {!editing && (
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-800 mb-2">Anexos (máx. 5 imagens + 2 documentos)</p>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="block w-full text-sm"
                />
                {files.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">{files.length} ficheiro(s) selecionado(s)</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowEditor(false); resetForm(); }} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm">Cancelar</button>
              <button
                disabled={submitting || uploadingFiles || !form.title.trim() || !form.content.trim()}
                onClick={() => submitForm(false)}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm disabled:opacity-60"
              >
                Guardar rascunho
              </button>
              <button
                disabled={submitting || uploadingFiles || !form.title.trim() || !form.content.trim()}
                onClick={() => submitForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                Enviar para aprovação
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && condominiumId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeDetails}>
          <div className="bg-white w-full max-w-5xl rounded-xl border border-gray-100 p-5 space-y-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selected.title}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selected.isAnonymous ? 'Anónimo' : selected.authorName} • {new Date(selected.createdAt).toLocaleString('pt-PT')}
                </p>
              </div>
              <button onClick={closeDetails} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm">Fechar</button>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <RichTextDisplay content={selected.content} />
            </div>

            {selected.attachments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">Anexos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selected.attachments.map((att) => {
                    const isImage = att.type === 'Image';
                    const url = attachmentUrl(condominiumId, selected.id, att.id);
                    return (
                      <div key={att.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                          {isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          <span className="truncate">{att.fileName}</span>
                        </div>
                        {isImage ? (
                          <a href={url} target="_blank" rel="noreferrer" className="block">
                            <img src={url} alt={att.fileName} className="w-full h-36 object-cover rounded border border-gray-200" />
                          </a>
                        ) : (
                          <a href={url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-sm inline-flex items-center gap-1">
                            <Upload className="w-4 h-4" />
                            Abrir ficheiro
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selected.status === 'Published' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">Comentários</h3>

                {!allowComments ? (
                  <div className="text-sm text-gray-500">Comentários desativados neste condomínio.</div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-3">
                      {selected.comments.length === 0 ? (
                        <p className="text-sm text-gray-500">Sem comentários ainda.</p>
                      ) : (
                        selected.comments
                          .slice()
                          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                          .map((c) => (
                            <div key={c.id} className="border-b border-gray-100 pb-2 last:border-b-0">
                              <p className="text-xs text-gray-500">{c.authorName} • {new Date(c.createdAt).toLocaleString('pt-PT')}</p>
                              <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{c.content}</p>
                            </div>
                          ))
                      )}
                    </div>

                    <div className="space-y-2">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Escreve uma resposta..."
                      />
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-gray-700 inline-flex items-center gap-2">
                          <input type="checkbox" checked={commentAnonymous} onChange={(e) => setCommentAnonymous(e.target.checked)} />
                          Comentar em anonimato
                        </label>
                        <button
                          onClick={addComment}
                          disabled={commenting || !comment.trim()}
                          className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm disabled:opacity-60"
                        >
                          {commenting ? 'A enviar...' : 'Comentar'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl border border-gray-100 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Rejeitar comunicado</h3>
            <p className="text-sm text-gray-500">Indica o motivo da rejeição (obrigatório).</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ex: Conteúdo incompleto ou não conforme as regras do condomínio"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectingId(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={reject}
                disabled={rejecting || !rejectionReason.trim()}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-60"
              >
                {rejecting ? 'A rejeitar...' : 'Rejeitar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
