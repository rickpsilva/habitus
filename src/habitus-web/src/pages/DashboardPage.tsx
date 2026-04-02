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
  Volume2,
  Building2,
  Users,
  Activity,
  CreditCard,
  Shield,
  Layers,
} from 'lucide-react';
import { maintenanceApi, financialApi, notificationsApi, reservationsApi, usersApi, condominiumsApi, subscriptionsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { MaintenanceRequestDto, NotificationDto, ReservationDto, CondominiumActiveUsersDto } from '../types';

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
  const { user, condominiumId, isManager } = useAuth();
  const [maintenance, setMaintenance] = useState<MaintenanceRequestDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [reserveFundBalance, setReserveFundBalance] = useState<number | null>(null);
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [noiseAnnouncementsCurrentYear, setNoiseAnnouncementsCurrentYear] = useState<number>(0);
  const [noiseAnnouncementsPreviousYear, setNoiseAnnouncementsPreviousYear] = useState<number>(0);
  const [dashboardYear, setDashboardYear] = useState<number>(new Date().getFullYear());
  const [managerCondominiumCount, setManagerCondominiumCount] = useState<number>(0);
  const [managerUserCount, setManagerUserCount] = useState<number>(0);
  const [managerActiveUserCount, setManagerActiveUserCount] = useState<number>(0);
  const [managerMrr, setManagerMrr] = useState<number | null>(null);
  const [activeByCondominium, setActiveByCondominium] = useState<CondominiumActiveUsersDto[]>([]);

  useEffect(() => {
    if (isManager) {
      condominiumsApi.getAll().then((r) => setManagerCondominiumCount(r.data.length)).catch(() => {});
      usersApi.getAll().then((r) => {
        setManagerUserCount(r.data.length);
        setManagerActiveUserCount(r.data.filter((u) => u.isActive).length);
      }).catch(() => {});
      subscriptionsApi.getStats().then((r) => setManagerMrr(r.data.monthlyBillingVolume)).catch(() => {});
        usersApi.getActiveLastMonthByCondominium().then((r) => setActiveByCondominium(r.data)).catch(() => {});
        subscriptionsApi.getStats().then((r) => setManagerMrr(r.data.monthlyBillingVolume)).catch(() => {});
      return;
    }

    // Get current user ID
    usersApi.getMe().then((r) => setUserId(r.data.id)).catch(() => {});
    
    maintenanceApi.getAll().then((r) => {
      const scoped = condominiumId
        ? r.data.filter((m) => m.condominiumId === condominiumId)
        : [];
      setMaintenance(scoped);
    }).catch(() => {});
    notificationsApi.getAll(1, 100).then((r) => setNotifications(r.data.items)).catch(() => {});
    reservationsApi.getAll().then((r) => setReservations(r.data)).catch(() => {});
    // Load financial dashboard for current year
    if (condominiumId) {
      const currentYear = new Date().getFullYear();
      financialApi.getDashboard(condominiumId, currentYear).then((r) => {
        setDashboardYear(r.data.currentYear);
        setBalance(r.data.currentYearBalance);
        setReserveFundBalance(r.data.reserveFundBalance);
        setNoiseAnnouncementsCurrentYear(r.data.noiseAnnouncementsCurrentYear ?? 0);
        setNoiseAnnouncementsPreviousYear(r.data.noiseAnnouncementsPreviousYear ?? 0);
      }).catch(() => {});
    }
  }, [condominiumId, isManager]);

  if (isManager) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Painel do Gestor
          </h1>
          <p className="text-gray-500 mt-1">
            Visão de plataforma para gestão global da carteira de condomínios.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Condomínios"
            value={managerCondominiumCount}
            icon={Building2}
            color="bg-blue-100 text-blue-700"
            to="/condominiums"
            subtitle="Carteira ativa"
          />
          <StatCard
            title="Utilizadores"
            value={managerUserCount}
            icon={Users}
            color="bg-indigo-100 text-indigo-700"
            to="/condominiums"
            subtitle={`Ativos: ${managerActiveUserCount}`}
          />
          <StatCard
            title="Requests por minuto"
            value="Em breve"
            icon={Activity}
            color="bg-amber-100 text-amber-700"
            to="/dashboard"
            subtitle="Métrica de plataforma"
          />
          <StatCard
            title="Volume de faturação (MRR)"
            value={managerMrr !== null ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(managerMrr) : 'Em curso'}
            icon={CreditCard}
            color="bg-emerald-100 text-emerald-700"
            to="/billing"
            subtitle="Métrica mensal recorrente"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Utilizadores ativos por condomínio</h2>
            <span className="text-xs text-gray-400">Último mês</span>
          </div>
          {activeByCondominium.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sem dados disponíveis.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Condomínio</th>
                    <th className="pb-2 font-medium text-right">Utilizadores ativos</th>
                    <th className="pb-2 font-medium text-right pr-1">Engajamento</th>
                  </tr>
                </thead>
                <tbody>
                  {activeByCondominium.map((row) => {
                    const maxActive = Math.max(...activeByCondominium.map((r) => r.activeUsersLastMonth), 1);
                    const barWidth = Math.round((row.activeUsersLastMonth / maxActive) * 100);
                    return (
                      <tr key={row.condominiumId} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 text-gray-800 font-medium">{row.condominiumName}</td>
                        <td className="py-2.5 text-right tabular-nums text-gray-700">{row.activeUsersLastMonth}</td>
                        <td className="py-2.5 pl-4 pr-1 w-36">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-indigo-500 h-1.5 rounded-full"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-8 text-right">{barWidth}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Planos da Plataforma</h2>
            <a
              href="/billing"
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              Gerir Faturação →
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Pack Free
              </p>
              <p className="text-xs text-gray-500 mt-2">Base operacional, features essenciais e limites reduzidos.</p>
            </div>
            <div className="rounded-lg border border-amber-200 p-4">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                Pack Silver — 29,90€/mês
              </p>
              <p className="text-xs text-gray-500 mt-2">Mais automações, reservas, relatórios e suporte prioritário.</p>
            </div>
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Pack Gold — 59,90€/mês
              </p>
              <p className="text-xs text-gray-500 mt-2">Analytics avançado, WhatsApp e acesso à API REST.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  const noiseYoYLabel = (() => {
    if (noiseAnnouncementsPreviousYear === 0) {
      if (noiseAnnouncementsCurrentYear === 0) return '0%';
      return 'n/a';
    }

    const change = ((noiseAnnouncementsCurrentYear - noiseAnnouncementsPreviousYear) / noiseAnnouncementsPreviousYear) * 100;
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  })();

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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
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
        <StatCard
          title="Comunicados Barulho/Perturbação"
          value={noiseAnnouncementsCurrentYear}
          icon={Volume2}
          color="bg-amber-100 text-amber-700"
          to="/announcements?category=Noise"
          subtitle={`Ano homólogo (${dashboardYear - 1}): ${noiseAnnouncementsPreviousYear} • Variação: ${noiseYoYLabel}`}
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
