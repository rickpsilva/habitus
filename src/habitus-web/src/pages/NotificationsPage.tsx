import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, CheckCheck, Trash2, LayoutDashboard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import { PageHeader, Button, AsyncState, EmptyState } from '../components/ui';
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
      setLoadError('Condomínio não identificado.');
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
      setLoadError('Não foi possível carregar as notificações.');
    }).finally(() => setLoading(false));
  }, [condominiumId]);

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
        success('Todas as notificações marcadas como lidas.');
        load(currentPage);
      } else if (confirmAction === 'clearAll') {
        if (!condominiumId) return;
        await notificationsApi.clearAll(condominiumId);
        success('Notificações eliminadas.');
        load(1);
      } else {
        if (!condominiumId) return;
        await notificationsApi.delete(condominiumId, confirmAction);
        success('Notificação eliminada.');
        load(currentPage);
      }
    } catch {
      error('Ocorreu um erro. Tente novamente.');
    } finally {
      setConfirmAction(null);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (isManager) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Notificações"
          subtitle="O perfil Gestor não recebe notificações operacionais de condóminos."
        />
        <EmptyState
          icon={LayoutDashboard}
          title="Sem notificações para o perfil Gestor"
          description="Use o Dashboard do Gestor para acompanhamento da plataforma, billing e gestão da carteira de condomínios."
          action={
            <Link to="/" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              Ir para o Dashboard
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
        title={confirmAction === 'clearAll' ? 'Eliminar todas as notificações' : confirmAction === 'markAll' ? 'Marcar todas como lidas' : 'Eliminar notificação'}
        message={confirmAction === 'clearAll'
          ? 'Esta ação elimina permanentemente todas as notificações e não pode ser revertida.'
          : confirmAction === 'markAll'
          ? 'Todas as notificações serão marcadas como lidas.'
          : 'Esta notificação será eliminada permanentemente.'}
        confirmLabel={confirmAction === 'clearAll' || (confirmAction !== null && confirmAction !== 'markAll') ? 'Eliminar' : 'Confirmar'}
        variant={confirmAction === 'clearAll' || (confirmAction !== null && confirmAction !== 'markAll') ? 'danger' : 'default'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <PageHeader
        title="Notificações"
        subtitle={`${pagination ? `${pagination.totalItems} total` : ''}${unreadCount > 0 ? ` • ${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : pagination?.totalItems ? ' • Todas lidas' : ''}`}
        actions={
          <>
            {unreadCount > 0 && (
              <Button icon={CheckCheck} onClick={() => setConfirmAction('markAll')} fullWidth className="sm:w-auto">
                Marcar lidas
              </Button>
            )}
            {pagination && pagination.totalItems > 0 && (
              <Button variant="danger" icon={Trash2} onClick={() => setConfirmAction('clearAll')} fullWidth className="sm:w-auto">
                Limpar todas
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
        empty={<EmptyState icon={Bell} title="Não há notificações" />}
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
                          {new Date(n.sentAt).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                      <p className="text-sm text-ink-subtle mt-0.5">{parsed.plain}</p>
                      {parsed.thumb && (
                        <a href={parsed.thumb} target="_blank" rel="noreferrer" className="inline-block mt-2">
                          <img src={parsed.thumb} alt="Pré-visualização" className="w-28 h-20 object-cover rounded border border-line" />
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
                            Ver comunicado
                          </button>
                        )}
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={() => markRead(n.id)}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            Marcar como lida
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setConfirmAction(n.id)}
                            className="text-xs text-ink-subtle hover:text-red-500 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" aria-hidden="true" />
                            Eliminar
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
