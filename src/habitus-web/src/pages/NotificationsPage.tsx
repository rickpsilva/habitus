import { useEffect, useState } from 'react';
import { Bell, BellOff, Trash2 } from 'lucide-react';
import { notificationsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { NotificationDto } from '../types';

export default function NotificationsPage() {
  const { isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    notificationsApi.getAll().then((r) => setNotifications(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar notificação?')) return;
    await notificationsApi.delete(id);
    load();
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Todas lidas'}
          </p>
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
          notifications.map((n) => (
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
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                  <div className="flex items-center gap-3 mt-2">
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
          ))
        )}
      </div>
    </div>
  );
}
