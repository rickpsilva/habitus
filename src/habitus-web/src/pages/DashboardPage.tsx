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
import { maintenanceApi, financialApi, notificationsApi, reservationsApi, usersApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { MaintenanceRequestDto, NotificationDto, ReservationDto } from '../types';

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  to,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  to: string;
  subtitle?: string;
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
        {subtitle && (
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
    </Link>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Open: 'bg-yellow-100 text-yellow-700',
    Pending: 'bg-yellow-100 text-yellow-700',
    InProgress: 'bg-blue-100 text-blue-700',
    Resolved: 'bg-green-100 text-green-700',
    Closed: 'bg-gray-100 text-gray-500',
    Cancelled: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<string, string> = {
    Open: 'Aberto',
    Pending: 'Pendente',
    InProgress: 'Em curso',
    Resolved: 'Resolvido',
    Closed: 'Fechado',
    Cancelled: 'Cancelado',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function DashboardPage() {
  const { user, condominiumId } = useAuth();
  const [maintenance, setMaintenance] = useState<MaintenanceRequestDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [reserveFundBalance, setReserveFundBalance] = useState<number | null>(null);
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get current user ID
    usersApi.getMe().then((r) => setUserId(r.data.id)).catch(() => {});
    
    maintenanceApi.getAll().then((r) => setMaintenance(r.data)).catch(() => {});
    notificationsApi.getAll(1, 100).then((r) => setNotifications(r.data.items)).catch(() => {});
    reservationsApi.getAll().then((r) => setReservations(r.data)).catch(() => {});
    // Load financial dashboard for current year
    if (condominiumId) {
      const currentYear = new Date().getFullYear();
      financialApi.getDashboard(condominiumId, currentYear).then((r) => {
        setBalance(r.data.currentYearBalance);
        setReserveFundBalance(r.data.reserveFundBalance);
      }).catch(() => {});
    }
  }, [condominiumId]);

  const now = new Date();
  
  const pendingMaintenance = maintenance.filter((m) => m.status === 'Open');
  const inProgressMaintenance = maintenance.filter((m) => m.status === 'InProgress');
  
  // Filter reservations based on user role and end date
  const activeReservations = reservations.filter((r) => {
    // Filter by status (Pending or Approved)
    const isRelevantStatus = r.status === 'Pending' || r.status === 'Approved';
    if (!isRelevantStatus) return false;
    
    // Filter by end date (must be >= current date)
    const endDate = new Date(r.endTime);
    const isNotPast = endDate >= now;
    if (!isNotPast) return false;
    
    // Filter by user role
    if (user?.role === 2) {
      // Morador: only their own reservations
      return r.userId === userId;
    } else if (user?.role === 1) {
      // Admin: all reservations in their condominium
      return r.condominiumId === condominiumId;
    }
    
    return false;
  });
  
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
          value={pendingMaintenance.length + inProgressMaintenance.length}
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
          subtitle={reserveFundBalance !== null ? `Fundo de Reserva: €${reserveFundBalance.toFixed(2)}` : undefined}
        />
        <StatCard
          title="Notificações não lidas"
          value={unreadNotifications.length}
          icon={Bell}
          color="bg-indigo-100 text-indigo-600"
          to="/notifications"
        />
        <StatCard
          title="Reservas"
          value={activeReservations.length}
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
