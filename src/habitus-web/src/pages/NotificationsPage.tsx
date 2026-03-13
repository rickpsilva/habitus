import { useEffect, useState } from 'react';
import { Bell, BellOff, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { notificationsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
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
  const { isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedResponse<NotificationDto> | null>(null);
  const pageSize = 10;

  const load = (page: number = 1) => {
    setLoading(true);
    notificationsApi.getAll(page, pageSize).then((r) => {
      setPagination(r.data);
      setNotifications(r.data.items);
      setCurrentPage(page);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, []);

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id);
    load(currentPage);
  };

  const markAllRead = async () => {
    if (!confirm('Marcar todas as notificações como lidas?')) return;
    await notificationsApi.markAllRead();
    load(currentPage);
  };

  const clearAll = async () => {
    if (!confirm('Eliminar TODAS as notificações permanentemente? Esta ação não pode ser revertida.')) return;
    await notificationsApi.clearAll();
    load(1); // Go back to page 1 after clearing
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar notificação?')) return;
    await notificationsApi.delete(id);
    load(currentPage);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const goToPage = (page: number) => {
    if (page >= 1 && pagination && page <= pagination.totalPages) {
      load(page);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {pagination ? `${pagination.totalItems} total` : ''} 
            {unreadCount > 0 ? ` • ${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : unreadCount === 0 && pagination?.totalItems ? ' • Todas lidas' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              Marcar todas como lidas
            </button>
          )}
          {pagination && pagination.totalItems > 0 && (
            <button
              onClick={clearAll}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Limpar todas
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">A carregar...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Sem notificações
          </div>
        ) : (
          <>
            {notifications.map((n) => (
              (() => {
                const parsed = parseNotificationMessage(n.message);
                return (
              <div
                key={n.id}
                className={`bg-white rounded-xl shadow-sm border p-4 ${!n.isRead ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-100'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${!n.isRead ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                    {n.isRead ? (
                      <BellOff className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Bell className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium text-sm ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                        {n.title}
                      </p>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(n.sentAt).toLocaleDateString('pt-PT')}
                      </span>
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
                          onClick={async () => {
                            if (!n.isRead) {
                              await markRead(n.id);
                            }
                            window.location.href = parsed.link!;
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Ver comunicado
                        </button>
                      )}
                      {!n.isRead && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          Marcar como lida
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(n.id)}
                          className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
                );
              })()
            ))}

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3">
                <div className="text-sm text-gray-600">
                  Página {pagination.page} de {pagination.totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={!pagination.hasPreviousPage}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:hover:bg-gray-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  
                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        // Show first page, last page, current page, and pages around current
                        return page === 1 || 
                               page === pagination.totalPages || 
                               Math.abs(page - currentPage) <= 1;
                      })
                      .map((page, idx, arr) => {
                        // Add ellipsis
                        const prevPage = arr[idx - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;
                        
                        return (
                          <div key={page} className="flex items-center gap-1">
                            {showEllipsis && <span className="px-2 text-gray-400">...</span>}
                            <button
                              onClick={() => goToPage(page)}
                              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                page === currentPage
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {page}
                            </button>
                          </div>
                        );
                      })}
                  </div>

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:hover:bg-gray-100"
                  >
                    Seguinte
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
