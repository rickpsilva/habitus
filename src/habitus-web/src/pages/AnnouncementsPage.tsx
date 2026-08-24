import { useEffect, useMemo, useState, useCallback } from 'react';
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
  Image as ImageIcon,
  FileText,
  Vote,
} from 'lucide-react';
import { announcementsApi, pollsApi, subscriptionsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import RichTextEditor from '../components/RichTextEditor';
import RichTextDisplay from '../components/RichTextDisplay';
import Pagination from '../components/Pagination';
import PollCard from '../components/PollCard';
import CreatePollModal from '../components/CreatePollModal';
import { PageHeader, Button, AsyncState, EmptyState, Badge } from '../components/ui';
import type { BadgeVariant } from '../components/ui';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';
import {
  DEFAULT_MAX_UPLOAD_SIZE_BYTES,
  formatUploadSizeLabel,
  getPlatformMaxUploadSizeBytes,
  isFileSizeWithinLimit,
} from '../utils/uploadLimits';
import type {
  AnnouncementDto,
  AnnouncementAttachmentDto,
  AnnouncementStatsDto,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
  CreateAnnouncementCommentRequest,
  PaginatedResponse,
  PollDto,
} from '../types';

const POLLS_PAGE_SIZE = 6;

/**
 * Maps poll action failures to user-facing text. Backend bodies may be plain
 * strings (ArgumentException) or objects with a `message`; 403 and 409 get
 * localized overrides because the raw messages are English-only.
 */
function getPollApiErrorMessage(
  error: unknown,
  fallback: string,
  featureUnavailable: string,
  alreadyVoted: string,
): string {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response;
  if (response?.status === 403) return featureUnavailable;
  if (response?.status === 409) return alreadyVoted;

  const data: unknown = response?.data;
  if (typeof data === 'string' && data.trim()) return data;

  const message = (data as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && message.trim()) return message;

  return fallback;
}

function getCategoryLabels(t: TranslateFn): Record<string, string> {
  return {
    Works: t('announcements.category.works'),
    Noise: t('announcements.category.noise'),
    Mail: t('announcements.category.mail'),
    General: t('announcements.category.general'),
    Urgent: t('announcements.category.urgent'),
    Event: t('announcements.category.event'),
  };
}

function getStatusLabels(t: TranslateFn): Record<string, string> {
  return {
    Draft: t('announcements.status.draft'),
    PendingApproval: t('announcements.status.pendingApproval'),
    Published: t('announcements.status.published'),
    Rejected: t('announcements.status.rejected'),
    Archived: t('announcements.status.archived'),
  };
}

const statusVariants: Record<string, BadgeVariant> = {
  Draft: 'neutral',
  PendingApproval: 'warning',
  Published: 'success',
  Rejected: 'danger',
  Archived: 'neutral',
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
          <mark key={index} className="bg-yellow-200 text-[#111827] rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

export default function AnnouncementsPage() {
  const { condominiumId, isAdmin, isManager } = useAuth();
  const { error: toastError } = useToast();
  const { t, formatDate, formatDateTime } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const categoryLabels = useMemo(() => getCategoryLabels(t), [t]);
  const statusLabels = useMemo(() => getStatusLabels(t), [t]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([]);
  const [stats, setStats] = useState<AnnouncementStatsDto | null>(null);
  const [allowComments, setAllowComments] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Polls (feature "polls"). Managers bypass subscription gating, mirroring Layout.
  const [pollsEnabled, setPollsEnabled] = useState(isManager);
  const [polls, setPolls] = useState<PollDto[]>([]);
  const [pollsLoading, setPollsLoading] = useState(isManager);
  const [pollsError, setPollsError] = useState('');
  const [pollsPage, setPollsPage] = useState(1);
  const [pollsTotalItems, setPollsTotalItems] = useState(0);
  const [pollsTotalPages, setPollsTotalPages] = useState(1);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [closingPollId, setClosingPollId] = useState<string | null>(null);
  const [closingPoll, setClosingPoll] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<AnnouncementDto | null>(null);
  const [selected, setSelected] = useState<AnnouncementDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'Published');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'All');
  const [searchText, setSearchText] = useState(searchParams.get('q') || '');
  const [debouncedSearchText, setDebouncedSearchText] = useState(searchParams.get('q') || '');

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<Record<string, string>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
      setCurrentPage(1);
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
  const [maxUploadSizeBytes, setMaxUploadSizeBytes] = useState(DEFAULT_MAX_UPLOAD_SIZE_BYTES);

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

  const pagination: PaginatedResponse<AnnouncementDto> = {
    items: announcements,
    page: currentPage,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
  };

  const loadData = useCallback(async () => {
    if (!condominiumId) {
      setAnnouncements([]);
      setStats(null);
      setTotalItems(0);
      setTotalPages(1);
      setLoadError(t('announcements.error.condoNotIdentified'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    try {
      const [aRes, sRes] = await Promise.all([
        announcementsApi.getPaged(condominiumId, currentPage, pageSize, {
          status: statusFilter,
          category: categoryFilter,
          search: debouncedSearchText.trim() || undefined,
        }),
        announcementsApi.getStats(condominiumId),
      ]);
      setAnnouncements(aRes.data.items);
      setTotalItems(aRes.data.totalItems);
      setTotalPages(aRes.data.totalPages);
      setStats(sRes.data);

      const cRes = await announcementsApi.getSettings(condominiumId);
      setAllowComments(cRes.data.allowAnnouncementComments);
    } catch (error) {
      console.error('Erro ao carregar comunicados:', error);
      setLoadError(t('announcements.error.load'));
    } finally {
      setLoading(false);
    }
  }, [condominiumId, currentPage, pageSize, statusFilter, categoryFilter, debouncedSearchText, t]);

  useEffect(() => {
    loadData();
  }, [condominiumId, loadData]);

  // Feature gate for polls: same subscription lookup Layout uses for nav items.
  // Managers bypass it (state is already initialised from isManager); on lookup
  // failure polls stay hidden instead of erroring.
  useEffect(() => {
    if (isManager) return;

    let mounted = true;
    subscriptionsApi.getMy()
      .then((res) => {
        if (!mounted) return;
        setPollsEnabled(res.data.plan.features.some((f) => f.featureKey === 'polls' && f.isEnabled));
      })
      .catch(() => {
        if (mounted) setPollsEnabled(false);
      });
    return () => {
      mounted = false;
    };
  }, [isManager, condominiumId]);

  const loadPolls = useCallback(async () => {
    if (!condominiumId || !pollsEnabled) {
      setPolls([]);
      setPollsTotalItems(0);
      setPollsTotalPages(1);
      setPollsLoading(false);
      return;
    }

    setPollsLoading(true);
    setPollsError('');
    try {
      const res = await pollsApi.getPaged(condominiumId, pollsPage, POLLS_PAGE_SIZE);
      setPolls(res.data.items);
      setPollsTotalItems(res.data.totalItems);
      setPollsTotalPages(res.data.totalPages);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        // Feature turned off for this plan mid-session: hide the section quietly.
        setPollsEnabled(false);
        return;
      }
      console.error('Erro ao carregar votações:', error);
      setPollsError(t('poll.error.load'));
    } finally {
      setPollsLoading(false);
    }
  }, [condominiumId, pollsEnabled, pollsPage, t]);

  useEffect(() => {
    void loadPolls();
  }, [loadPolls]);

  const castVote = async (pollId: string, optionId: string) => {
    if (!condominiumId) return;

    try {
      await pollsApi.castVote(condominiumId, pollId, { pollOptionId: optionId });
      await loadPolls();
    } catch (error) {
      toastError(
        getPollApiErrorMessage(
          error,
          t('poll.error.vote'),
          t('poll.error.featureUnavailable'),
          t('poll.error.alreadyVoted'),
        ),
      );
    }
  };

  const confirmClosePoll = async () => {
    if (!condominiumId || !closingPollId || closingPoll) return;

    setClosingPoll(true);
    try {
      await pollsApi.close(condominiumId, closingPollId);
      await loadPolls();
    } catch (error) {
      toastError(
        getPollApiErrorMessage(
          error,
          t('poll.error.close'),
          t('poll.error.featureUnavailable'),
          t('poll.error.alreadyVoted'),
        ),
      );
    } finally {
      setClosingPoll(false);
      setClosingPollId(null);
    }
  };

  useEffect(() => {
    if (!condominiumId) return;

    const openId = searchParams.get('open');
    if (!openId) return;

    if (selected?.id === openId) return;

    let cancelled = false;

    // Always fetch full details when opened via URL so backend can register read status.
    announcementsApi.getById(condominiumId, openId)
      .then((res) => {
        if (!cancelled) setSelected(res.data);
      })
      .catch(() => {
        // Announcement not found or no access; ignore deep-link.
      })
      .finally(() => {
        if (!cancelled) {
          loadData();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, condominiumId, selected?.id, loadData]);

  useEffect(() => {
    let active = true;
    const urlsToRevoke: string[] = [];

    const loadAttachmentPreviews = async () => {
      if (!selected || !condominiumId) {
        setAttachmentPreviewUrls({});
        return;
      }

      const imageAttachments = selected.attachments.filter((att) =>
        att.type === 'Image' || (att.contentType?.startsWith('image/') ?? false)
      );

      if (imageAttachments.length === 0) {
        setAttachmentPreviewUrls({});
        return;
      }

      const entries = await Promise.all(
        imageAttachments.map(async (att) => {
          try {
            const response = await announcementsApi.downloadAttachment(condominiumId, selected.id, att.id);
            const contentType = String(response.headers['content-type'] || att.contentType || 'application/octet-stream');
            const blob = new Blob([response.data], { type: contentType });
            const blobUrl = URL.createObjectURL(blob);
            urlsToRevoke.push(blobUrl);
            return [att.id, blobUrl] as const;
          } catch {
            return [att.id, ''] as const;
          }
        })
      );

      if (!active) {
        urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setAttachmentPreviewUrls(Object.fromEntries(entries.filter(([, url]) => !!url)));
    };

    loadAttachmentPreviews();

    return () => {
      active = false;
      urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selected, condominiumId]);

  const openAttachment = async (announcementId: string, attachment: AnnouncementAttachmentDto) => {
    if (!condominiumId) return;

    try {
      const response = await announcementsApi.downloadAttachment(condominiumId, announcementId, attachment.id);
      const contentType = String(response.headers['content-type'] || attachment.contentType || 'application/octet-stream');
      const blob = new Blob([response.data], { type: contentType });
      const objectUrl = URL.createObjectURL(blob);

      const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = attachment.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      toastError(t('announcements.error.openAttachment'));
    }
  };

  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (debouncedSearchText.trim()) next.set('q', debouncedSearchText.trim());
    else next.delete('q');

    if (statusFilter !== 'Published') next.set('status', statusFilter);
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

    const oversizedFile = files.find((file) => !isFileSizeWithinLimit(file, maxUploadSizeBytes));
    if (oversizedFile) {
      toastError(t('announcements.error.fileExceedsLimit', { name: oversizedFile.name, limit: formatUploadSizeLabel(maxUploadSizeBytes) }));
      return;
    }

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

        if (files.length > 0) {
          setUploadingFiles(true);
          try {
            for (const file of files) {
              const fd = new FormData();
              fd.append('file', file);
              await announcementsApi.uploadAttachment(condominiumId, editing.id, fd);
            }
          } finally {
            setUploadingFiles(false);
          }
        }

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
      toastError(t('announcements.error.save'));
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
    setDeleteId(id);
  };

  const confirmRemove = async () => {
    if (!condominiumId || !deleteId) return;
    try {
      await announcementsApi.delete(condominiumId, deleteId);
      if (selected?.id === deleteId) closeDetails();
      await loadData();
    } catch {
      toastError(t('announcements.error.delete'));
    } finally {
      setDeleteId(null);
    }
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
      <ConfirmModal
        open={deleteId !== null}
        title={t('announcements.delete.title')}
        message={t('announcements.delete.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmRemove}
        onCancel={() => setDeleteId(null)}
      />
      <PageHeader
        title={t('announcements.title')}
        subtitle={t('announcements.subtitle')}
        actions={
          <Button icon={Plus} onClick={openNew} fullWidth className="sm:w-auto">
            {t('announcements.new')}
          </Button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-surface border border-line rounded-xl p-3 text-sm"><strong>{stats.totalAnnouncements}</strong> {t('announcements.stats.total')}</div>
          <div className="bg-surface border border-line rounded-xl p-3 text-sm"><strong>{stats.published}</strong> {t('announcements.stats.published')}</div>
          <div className="bg-surface border border-line rounded-xl p-3 text-sm"><strong>{stats.myDrafts}</strong> {t('announcements.stats.drafts')}</div>
          <div className="bg-surface border border-line rounded-xl p-3 text-sm"><strong>{stats.unread}</strong> {t('announcements.stats.unread')}</div>
          <div className="bg-surface border border-line rounded-xl p-3 text-sm"><strong>{pendingCount}</strong> {t('announcements.stats.pending')}</div>
        </div>
      )}

      {pollsEnabled && (
        <section aria-labelledby="polls-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 id="polls-heading" className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Vote className="w-5 h-5" aria-hidden="true" />
              {t('poll.title')}
            </h2>
            {isAdmin && (
              <Button icon={Plus} size="sm" onClick={() => setShowCreatePoll(true)}>
                {t('poll.new')}
              </Button>
            )}
          </div>

          <AsyncState
            loading={pollsLoading}
            error={pollsError || null}
            onRetry={loadPolls}
            isEmpty={polls.length === 0}
            skeleton="list"
            skeletonRows={2}
            empty={<EmptyState icon={Vote} title={t('poll.empty')} />}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-3">
              {polls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  onVote={castVote}
                  onClose={setClosingPollId}
                  canManage={isAdmin}
                />
              ))}
            </div>
            {pollsTotalItems > POLLS_PAGE_SIZE && (
              <div className="mt-4">
                <Pagination
                  pagination={{
                    items: [],
                    page: pollsPage,
                    pageSize: POLLS_PAGE_SIZE,
                    totalItems: pollsTotalItems,
                    totalPages: pollsTotalPages,
                    hasPreviousPage: pollsPage > 1,
                    hasNextPage: pollsPage < pollsTotalPages,
                  }}
                  currentPage={pollsPage}
                  onPageChange={setPollsPage}
                />
              </div>
            )}
          </AsyncState>
        </section>
      )}

      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-ink-subtle mb-1">{t('announcements.filter.search')}</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t('announcements.filter.searchPlaceholder')}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-ink-subtle mb-1">{t('announcements.filter.status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm"
            >
              <option value="All">{t('announcements.filter.allStatuses')}</option>
              {Object.keys(statusLabels).map((k) => (
                <option key={k} value={k}>{statusLabels[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-subtle mb-1">{t('announcements.filter.category')}</label>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm"
            >
              <option value="All">{t('announcements.filter.allCategories')}</option>
              {Object.keys(categoryLabels).map((k) => (
                <option key={k} value={k}>{categoryLabels[k]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchText('');
                setStatusFilter('Published');
                setCategoryFilter('All');
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-lg bg-control hover:bg-control-hover text-sm text-ink"
            >
              {t('announcements.filter.clear')}
            </button>
          </div>
        </div>
      </div>

      <AsyncState
        loading={loading}
        error={loadError || null}
        onRetry={loadData}
        isEmpty={announcements.length === 0}
        skeleton="list"
        empty={<EmptyState icon={Megaphone} title={t('announcements.empty')} />}
      >
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="bg-surface border border-line rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-ink truncate">{highlightText(a.title, debouncedSearchText)}</h3>
                    <Badge variant={statusVariants[a.status] ?? 'neutral'}>
                      {statusLabels[a.status] || a.status}
                    </Badge>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {categoryLabels[a.category] || a.category}
                    </span>
                    {a.isPinned && <Pin className="w-4 h-4 text-amber-500" />}
                  </div>
                  <p className="text-sm text-ink-subtle mt-1">
                    {highlightText(a.isAnonymous ? t('announcements.anonymous') : a.authorName, debouncedSearchText)} • {formatDateTime(a.createdAt)}
                  </p>
                  <p className="text-sm text-ink-muted mt-1 line-clamp-2">
                    {highlightText(
                      a.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180),
                      debouncedSearchText
                    )}
                    {a.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length > 180 ? '…' : ''}
                  </p>
                  <div className="text-xs text-ink-subtle mt-2 flex items-center gap-4">
                    <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> {a.totalReads}</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {a.totalComments}</span>
                    <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" /> {a.totalAttachments}</span>
                    {a.validUntil && (
                      <span className="inline-flex items-center gap-1 text-amber-700"><Clock className="w-3 h-3" /> {t('announcements.card.validUntil', { date: formatDate(a.validUntil) })}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openDetails(a)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-control hover:bg-control-hover text-ink">
                    <Eye className="w-3.5 h-3.5" />
                    {t('announcements.card.details')}
                  </button>
                  {a.status === 'Draft' && (
                    <button onClick={() => openEdit(a)} className="p-2 rounded hover:bg-blue-50 text-blue-600" title={t('common.edit')}>
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  {(a.status === 'Draft' || isAdmin) && (
                    <button onClick={() => remove(a.id)} className="p-2 rounded hover:bg-red-50 text-red-600" title={t('common.delete')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && a.status === 'PendingApproval' && (
                    <>
                      <button onClick={() => approve(a.id)} className="p-2 rounded hover:bg-green-50 text-green-600" title={t('announcements.action.approve')}>
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => openRejectModal(a.id)} className="p-2 rounded hover:bg-red-50 text-red-600" title={t('announcements.action.reject')}>
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {isAdmin && a.status === 'Published' && (
                    <button onClick={() => togglePin(a.id)} className="p-2 rounded hover:bg-amber-50 text-amber-600" title={t('announcements.action.togglePin')}>
                      <Pin className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {totalItems > 0 && (
          <div className="mt-4">
            <Pagination pagination={pagination} currentPage={currentPage} onPageChange={setCurrentPage} />
          </div>
        )}
      </AsyncState>

      <ModalPopup
        open={showEditor}
        onClose={() => { setShowEditor(false); resetForm(); }}
        title={editing ? t('announcements.editor.editTitle') : t('announcements.editor.newTitle')}
        maxWidthClass="max-w-4xl"
      >
          <div className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('announcements.form.titlePlaceholder')}
                className="md:col-span-2 px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm"
              />
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm"
              >
                {Object.keys(categoryLabels).map((k) => (
                  <option key={k} value={k}>{categoryLabels[k]}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <input type="checkbox" checked={!!form.isAnonymous} onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })} />
                {t('announcements.form.anonymous')}
              </label>
              <div>
                <label className="block text-xs text-ink-subtle mb-1">{t('announcements.form.validUntil')}</label>
                <input
                  type="datetime-local"
                  value={form.validUntil || ''}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value || undefined })}
                  className="px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm"
                />
              </div>
            </div>

            <RichTextEditor value={form.content} onChange={(v) => setForm({ ...form, content: v })} placeholder={t('announcements.form.contentPlaceholder')} height="240px" />

            <div className="border border-line rounded-lg p-3">
              <p className="text-sm font-medium text-ink mb-2">{t('announcements.form.attachments')}</p>
              {editing && editing.attachments.length > 0 && (
                <p className="text-xs text-ink-subtle mb-2">{t('announcements.form.currentDraftAttachments', { count: editing.attachments.length })}</p>
              )}
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt"
                onChange={(e) => {
                  const selectedFiles = Array.from(e.target.files || []);
                  const oversizedFile = selectedFiles.find((file) => !isFileSizeWithinLimit(file, maxUploadSizeBytes));

                  if (oversizedFile) {
                    toastError(t('announcements.error.fileExceedsLimit', { name: oversizedFile.name, limit: formatUploadSizeLabel(maxUploadSizeBytes) }));
                    setFiles([]);
                    return;
                  }

                  setFiles(selectedFiles);
                }}
                className="block w-full text-sm"
              />
              <p className="text-xs text-ink-subtle mt-2">
                {t('announcements.form.maxSizePerFile', { size: formatUploadSizeLabel(maxUploadSizeBytes) })}
              </p>
              {files.length > 0 && (
                <p className="text-xs text-ink-subtle mt-2">{t('announcements.form.selectedFiles', { count: files.length })}</p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => { setShowEditor(false); resetForm(); }}>{t('common.cancel')}</Button>
              <Button
                variant="secondary"
                onClick={() => submitForm(false)}
                disabled={submitting || uploadingFiles || !form.title.trim() || !form.content.trim()}
              >
                {t('announcements.form.saveDraft')}
              </Button>
              <Button
                icon={Send}
                onClick={() => submitForm(true)}
                loading={submitting || uploadingFiles}
                disabled={!form.title.trim() || !form.content.trim()}
              >
                {t('announcements.form.submitApproval')}
              </Button>
            </div>
          </div>
      </ModalPopup>

      <ModalPopup
        open={selected !== null && !!condominiumId}
        onClose={closeDetails}
        title={t('announcements.details.title')}
        maxWidthClass="max-w-5xl"
        bodyClassName="p-5 space-y-4"
      >
        {selected && condominiumId && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">{selected.title}</h2>
                <p className="text-sm text-ink-subtle mt-1">
                  {selected.isAnonymous ? t('announcements.anonymous') : selected.authorName} • {formatDateTime(selected.createdAt)}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={closeDetails}>{t('announcements.details.close')}</Button>
            </div>

            <div className="bg-surface-muted border border-line rounded-lg p-4">
              <RichTextDisplay content={selected.content} />
            </div>

            {selected.attachments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-ink">{t('announcements.details.attachments')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selected.attachments.map((att) => {
                    const isImage = att.type === 'Image' || (att.contentType?.startsWith('image/') ?? false);
                    const previewUrl = attachmentPreviewUrls[att.id];
                    return (
                      <div key={att.id} className="border border-line rounded-lg p-3">
                        <div className="flex items-center gap-2 text-sm text-ink-muted mb-2">
                          {isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          <span className="truncate">{att.fileName}</span>
                        </div>
                        {isImage && previewUrl ? (
                          <button type="button" onClick={() => openAttachment(selected.id, att)} className="block w-full text-left">
                            <img src={previewUrl} alt={att.fileName} className="w-full h-36 object-cover rounded border border-line" />
                          </button>
                        ) : isImage ? (
                          <button
                            type="button"
                            onClick={() => openAttachment(selected.id, att)}
                            className="w-full h-36 rounded border border-line bg-surface-muted text-xs text-ink-subtle flex items-center justify-center"
                          >
                            {t('announcements.details.previewUnavailable')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openAttachment(selected.id, att)}
                            className="w-full h-36 rounded border border-line bg-surface-muted text-ink-muted hover:bg-surface-hover transition-colors flex flex-col items-center justify-center gap-2"
                          >
                            <FileText className="w-7 h-7" />
                            <span className="text-sm">{t('announcements.details.openFile')}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selected.status === 'Published' && allowComments && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-ink">{t('announcements.details.comments')}</h3>

                <div className="space-y-2 max-h-64 overflow-y-auto border border-line rounded-lg p-3">
                  {selected.comments.length === 0 ? (
                    <p className="text-sm text-ink-subtle">{t('announcements.details.noComments')}</p>
                  ) : (
                    selected.comments
                      .slice()
                      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                      .map((c) => (
                        <div key={c.id} className="border-b border-line pb-2 last:border-b-0">
                          <p className="text-xs text-ink-subtle">{c.authorName} • {formatDateTime(c.createdAt)}</p>
                          <p className="text-sm text-ink mt-1 whitespace-pre-wrap">{c.content}</p>
                        </div>
                      ))
                  )}
                </div>

                <div className="space-y-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm"
                    placeholder={t('announcements.details.replyPlaceholder')}
                  />
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-ink-muted inline-flex items-center gap-2">
                      <input type="checkbox" checked={commentAnonymous} onChange={(e) => setCommentAnonymous(e.target.checked)} />
                      {t('announcements.details.commentAnonymous')}
                    </label>
                    <Button
                      onClick={addComment}
                      loading={commenting}
                      disabled={!comment.trim()}
                    >
                      {commenting ? t('announcements.details.sending') : t('announcements.details.comment')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selected.status === 'Archived' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-ink">{t('announcements.details.comments')}</h3>
                <div className="text-sm text-ink-subtle">{t('announcements.details.commentsArchived')}</div>
              </div>
            )}

            {(selected.status === 'Published' && !allowComments) && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-ink">{t('announcements.details.comments')}</h3>
                <div className="text-sm text-ink-subtle">{t('announcements.details.commentsDisabled')}</div>
              </div>
            )}
          </>
        )}
      </ModalPopup>

      <ModalPopup
        open={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectingId(null);
          setRejectionReason('');
        }}
        title={t('announcements.reject.title')}
        maxWidthClass="max-w-md"
      >
            <p className="text-sm text-ink-subtle">{t('announcements.reject.prompt')}</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg text-sm"
              placeholder={t('announcements.reject.placeholder')}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectingId(null);
                  setRejectionReason('');
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={reject}
                loading={rejecting}
                disabled={!rejectionReason.trim()}
              >
                {rejecting ? t('announcements.reject.rejecting') : t('announcements.reject.reject')}
              </Button>
            </div>
      </ModalPopup>

      <ConfirmModal
        open={closingPollId !== null}
        title={t('poll.close.title')}
        message={t('poll.close.message')}
        confirmLabel={t('poll.card.close')}
        variant="warning"
        onConfirm={() => void confirmClosePoll()}
        onCancel={() => { if (!closingPoll) setClosingPollId(null); }}
      />

      {condominiumId && (
        <CreatePollModal
          open={showCreatePoll}
          onClose={() => setShowCreatePoll(false)}
          condominiumId={condominiumId}
          announcements={announcements.filter((a) => a.status === 'Published')}
          onCreated={() => void loadPolls()}
        />
      )}
    </div>
  );
}
