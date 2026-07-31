import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, CheckCheck, Trash2, LayoutDashboard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import { PageHeader, Button, AsyncState, EmptyState } from '../components/ui';
import { useTranslation } from '../i18n/I18nProvider';
import type { NotificationDto, PaginatedResponse } from '../types';

function parseNotificationMessage(message: string) {
  const lines = message.split('\n').map((l) => l.trim()).filter(Boolean);
  const plain = lines.filter((l) => !l.startsWith('Ver: ') && !l.startsWith('Thumb: ')).join(' ');
  const linkLine = lines.find((l) => l.startsWith('Ver: '));
  const thumbLine = lines.find((l) => l.startsWith('Thumb: '));

  return {
    plain,
    link: linkLine ? linkLine.replace('Ver: ', '').trim() : undefined,
    thumb: thumbLine ? thumbLine.replace('Thumb: ', '').trim() : undefined,
  };
}

export default function NotificationsPage() {
  const { isAdmin, isManager, condominiumId } = useAuth();
  const navigate = useNavigate();
  const { success, error } = useToast();
  const { t, formatDateTime } = useTranslation();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<NotificationDto> | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | 'markAll' | 'clearAll' | string>(null);
  const pageSize = 10;

  const load = useCallback((page: number = 1) => {
    if (!condominiumId) {
      setPagination(null);
      setNotifications([]);
      setCurrentPage(page);
      setLoadError(t('notifications.error.noCondominium'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    notificationsApi.getAll(condominiumId, page, pageSize).then((r) => {
      setPagination(r.data);
      setNotifications(r.data.items);
      setCurrentPage(page);
    }).catch(() => {
      setLoadError(t('notifications.error.load'));
    }).finally(() => setLoading(false));
  }, [condominiumId, t]);

  useEffect(() => {
    load(1);
  }, [load]);

  const markRead = async (id: string) => {
    if (!condominiumId) return;
    await notificationsApi.markRead(condominiumId, id);
    load(currentPage);
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction === 'markAll') {
        if (!condominiumId) return;
        await notificationsApi.markAllRead(condominiumId);
        success(t('notifications.toast.allMarkedRead'));
        load(currentPage);
      } else if (confirmAction === 'clearAll') {
        if (!condominiumId) return;
        await notificationsApi.clearAll(condominiumId);
        success(t('notifications.toast.allCleared'));
        load(1);
      } else {
        if (!condominiumId) return;
        await notificationsApi.delete(condominiumId, confirmAction);
        success(t('notifications.toast.deleted'));
        load(currentPage);
      }
    } catch {
      error(t('notifications.toast.error'));
    } finally {
      setConfirmAction(null);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (isManager) {
    return (
      <div className="space-y-5">
        <PageHeader
          title={t('notifications.title')}
          subtitle={t('notifications.manager.subtitle')}
        />
        <EmptyState
          icon={LayoutDashboard}
          title={t('notifications.manager.emptyTitle')}
          description={t('notifications.manager.emptyDesc')}
          action={
            <Link to="/" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              {t('notifications.manager.goToDashboard')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={confirmAction !== null}
        title={confirmAction === 'clearAll' ? t('notifications.confirmModal.clearAllTitle') : confirmAction === 'markAll' ? t('notifications.confirmModal.markAllTitle') : t('notifications.confirmModal.deleteTitle')}
        message={confirmAction === 'clearAll'
          ? t('notifications.confirmModal.clearAllMessage')
          : confirmAction === 'markAll'
          ? t('notifications.confirmModal.markAllMessage')
          : t('notifications.confirmModal.deleteMessage')}
        confirmLabel={confirmAction === 'clearAll' || (confirmAction !== null && confirmAction !== 'markAll') ? t('common.delete') : t('notifications.confirm')}
        variant={confirmAction === 'clearAll' || (confirmAction !== null && confirmAction !== 'markAll') ? 'danger' : 'default'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <PageHeader
        title={t('notifications.title')}
        subtitle={`${pagination ? t('notifications.totalCount', { count: pagination.totalItems }) : ''}${unreadCount > 0 ? ` • ${unreadCount > 1 ? t('notifications.unreadMany', { count: unreadCount }) : t('notifications.unreadOne', { count: unreadCount })}` : pagination?.totalItems ? ` • ${t('notifications.allRead')}` : ''}`}
        actions={
          <>
            {unreadCount > 0 && (
              <Button icon={CheckCheck} onClick={() => setConfirmAction('markAll')} fullWidth className="sm:w-auto">
                {t('notifications.markRead')}
              </Button>
            )}
            {pagination && pagination.totalItems > 0 && (
              <Button variant="danger" icon={Trash2} onClick={() => setConfirmAction('clearAll')} fullWidth className="sm:w-auto">
                {t('notifications.clearAll')}
              </Button>
            )}
          </>
        }
      />

      <AsyncState
        loading={loading}
        error={loadError || null}
        onRetry={() => load(currentPage)}
        isEmpty={notifications.length === 0}
        skeleton="list"
        empty={<EmptyState icon={Bell} title={t('notifications.empty')} />}
      >
        <div className="space-y-3">
          {notifications.map((n) => {
              const parsed = parseNotificationMessage(n.message);
              return (
                <div
                  key={n.id}
                  className={`bg-surface rounded-xl shadow-sm border p-4 ${!n.isRead ? 'border-indigo-200 bg-indigo-50/30' : 'border-line'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${!n.isRead ? 'bg-indigo-100' : 'bg-control'}`}>
                      {n.isRead ? (
                        <BellOff className="w-4 h-4 text-ink-subtle" aria-hidden="true" />
                      ) : (
                        <Bell className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-medium text-sm ${!n.isRead ? 'text-ink' : 'text-ink-muted'}`}>
                          {n.title}
                        </p>
                        <time className="text-xs text-ink-subtle shrink-0 whitespace-nowrap">
                          {formatDateTime(n.sentAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                      <p className="text-sm text-ink-subtle mt-0.5">{parsed.plain}</p>
                      {parsed.thumb && (
                        <a href={parsed.thumb} target="_blank" rel="noreferrer" className="inline-block mt-2">
                          <img src={parsed.thumb} alt={t('notifications.thumbAlt')} className="w-28 h-20 object-cover rounded border border-line" />
                        </a>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {parsed.link && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!n.isRead) await markRead(n.id);
                              navigate(parsed.link!);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            {t('notifications.viewAnnouncement')}
                          </button>
                        )}
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={() => markRead(n.id)}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            {t('notifications.markAsRead')}
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setConfirmAction(n.id)}
                            className="text-xs text-ink-subtle hover:text-red-500 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" aria-hidden="true" />
                            {t('common.delete')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {pagination && (
              <Pagination
                pagination={pagination as PaginatedResponse<unknown>}
                currentPage={currentPage}
                onPageChange={(p) => load(p)}
              />
            )}
        </div>
      </AsyncState>
    </div>
  );
}
