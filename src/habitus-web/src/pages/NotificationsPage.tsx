import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, CheckCheck, Trash2, LayoutDashboard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<NotificationDto> | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | 'markAll' | 'clearAll' | string>(null);
  const pageSize = 10;

  const load = useCallback((page: number = 1) => {
    if (!condominiumId) {
      setPagination(null);
      setNotifications([]);
      setCurrentPage(page);
      setLoading(false);
      return;
    }

    setLoading(true);
    notificationsApi.getAll(condominiumId, page, pageSize).then((r) => {
      setPagination(r.data);
      setNotifications(r.data.items);
      setCurrentPage(page);
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            O perfil Gestor não recebe notificações operacionais de condóminos.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-10 flex flex-col items-center gap-4 text-center">
          <LayoutDashboard className="w-12 h-12 text-indigo-300" aria-hidden="true" />
          <p className="text-gray-600 text-sm max-w-sm">
            Use o Dashboard do Gestor para acompanhamento da plataforma, billing e gestão da carteira de condomínios.
          </p>
          <Link to="/" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            Ir para o Dashboard
          </Link>
        </div>
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

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {pagination ? `${pagination.totalItems} total` : ''}
            {unreadCount > 0 ? ` • ${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : pagination?.totalItems ? ' • Todas lidas' : ''}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={() => setConfirmAction('markAll')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              <CheckCheck className="w-4 h-4" aria-hidden="true" />
              Marcar lidas
            </button>
          )}
          {pagination && pagination.totalItems > 0 && (
            <button
              onClick={() => setConfirmAction('clearAll')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Limpar todas
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse flex gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Bell className="w-12 h-12 opacity-30" aria-hidden="true" />
            <p className="text-sm font-medium">Não há notificações</p>
          </div>
        ) : (
          <>
            {notifications.map((n) => {
              const parsed = parseNotificationMessage(n.message);
              return (
                <div
                  key={n.id}
                  className={`bg-white rounded-xl shadow-sm border p-4 ${!n.isRead ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-100'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${!n.isRead ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                      {n.isRead ? (
                        <BellOff className="w-4 h-4 text-gray-400" aria-hidden="true" />
                      ) : (
                        <Bell className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-medium text-sm ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                          {n.title}
                        </p>
                        <time className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                          {new Date(n.sentAt).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{parsed.plain}</p>
                      {parsed.thumb && (
                        <a href={parsed.thumb} target="_blank" rel="noreferrer" className="inline-block mt-2">
                          <img src={parsed.thumb} alt="Pré-visualização" className="w-28 h-20 object-cover rounded border border-gray-200" />
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
                            className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
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
          </>
        )}
      </div>
    </div>
  );
}
