import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  DollarSign,
  Bell,
  Calendar,
  FileText,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { maintenanceApi, financialApi, notificationsApi, reservationsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { MaintenanceRequestDto, NotificationDto } from '../types';

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  to,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center gap-4"
    >
      <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </Link>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Pending: 'bg-yellow-100 text-yellow-700',
    InProgress: 'bg-blue-100 text-blue-700',
    Resolved: 'bg-green-100 text-green-700',
    Cancelled: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<string, string> = {
    Pending: 'Pendente',
    InProgress: 'Em curso',
    Resolved: 'Resolvido',
    Cancelled: 'Cancelado',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [maintenance, setMaintenance] = useState<MaintenanceRequestDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [reservationCount, setReservationCount] = useState(0);

  useEffect(() => {
    maintenanceApi.getAll().then((r) => setMaintenance(r.data)).catch(() => {});
    notificationsApi.getAll().then((r) => setNotifications(r.data)).catch(() => {});
    reservationsApi.getAll().then((r) => setReservationCount(r.data.length)).catch(() => {});
    // Financial summary requires buildingId — skip if not available
    financialApi.getAll().then((r) => {
      const income = r.data.filter((f) => f.type === 'Income').reduce((s, f) => s + f.amount, 0);
      const expenses = r.data.filter((f) => f.type === 'Expense').reduce((s, f) => s + f.amount, 0);
      setBalance(income - expenses);
    }).catch(() => {});
  }, []);

  const pendingMaintenance = maintenance.filter((m) => m.status === 'Pending' || m.status === 'InProgress');
  const unreadNotifications = notifications.filter((n) => !n.isRead);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bem-vindo, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-500 mt-1">Aqui está o resumo do seu condomínio.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Pedidos de Manutenção"
          value={pendingMaintenance.length}
          icon={Wrench}
          color="bg-orange-100 text-orange-600"
          to="/maintenance"
        />
        <StatCard
          title="Saldo Financeiro"
          value={balance !== null ? `€${balance.toFixed(2)}` : '—'}
          icon={DollarSign}
          color="bg-green-100 text-green-600"
          to="/financial"
        />
        <StatCard
          title="Notificações não lidas"
          value={unreadNotifications.length}
          icon={Bell}
          color="bg-indigo-100 text-indigo-600"
          to="/notifications"
        />
        <StatCard
          title="Reservas ativas"
          value={reservationCount}
          icon={Calendar}
          color="bg-purple-100 text-purple-600"
          to="/reservations"
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { to: '/documents', label: 'Documentos', icon: FileText, bg: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
          { to: '/assemblies', label: 'Assembleias', icon: ClipboardList, bg: 'bg-teal-50 text-teal-600 hover:bg-teal-100' },
          { to: '/financial', label: 'Relatório', icon: TrendingUp, bg: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
        ].map(({ to, label, icon: Icon, bg }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors ${bg}`}
          >
            <Icon className="w-5 h-5" />
            <span className="font-medium text-sm">{label}</span>
          </Link>
        ))}
      </div>

      {/* Recent maintenance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Pedidos de Manutenção Recentes</h2>
          <Link to="/maintenance" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Ver todos
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {maintenance.slice(0, 5).map((m) => (
            <div key={m.id} className="flex items-start gap-3 px-5 py-3.5">
              <div className="mt-0.5">
                {m.status === 'Resolved' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : m.status === 'InProgress' ? (
                  <Clock className="w-4 h-4 text-blue-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                <p className="text-xs text-gray-500">{m.location}</p>
              </div>
              {statusBadge(m.status)}
            </div>
          ))}
          {maintenance.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Sem pedidos de manutenção</p>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Últimas Notificações</h2>
          <Link to="/notifications" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Ver todas
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {notifications.slice(0, 4).map((n) => (
            <div key={n.id} className={`flex gap-3 px-5 py-3.5 ${!n.isRead ? 'bg-indigo-50/40' : ''}`}>
              <Bell className={`w-4 h-4 mt-0.5 shrink-0 ${!n.isRead ? 'text-indigo-500' : 'text-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500 truncate">{n.message}</p>
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Sem notificações</p>
          )}
        </div>
      </div>
    </div>
  );
}
