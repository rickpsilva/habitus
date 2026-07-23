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
  Wallet,
  ArrowRight,
  Megaphone,
  RefreshCw,
} from 'lucide-react';
import { maintenanceApi, financialApi, notificationsApi, reservationsApi, usersApi, condominiumsApi, subscriptionsApi, platformBillingSettingsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { MaintenanceRequestDto, NotificationDto, ReservationDto, CondominiumActiveUsersDto, PlatformBillingSettingsDto } from '../types';

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  to,
  subtitle,
  loading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  to: string;
  subtitle?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 animate-pulse">
        <div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-100 rounded w-3/4" />
          <div className="h-6 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    );
  }
  return (
    <Link
      to={to}
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center gap-4"
    >
      <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${color}`}>
        <Icon className="w-6 h-6" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 leading-tight">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-0.5 leading-tight">{subtitle}</p>
        )}
      </div>
    </Link>
  );
}

function statusBadge(status: string) {
  const normalizedStatus = status === 'Resolved' || status === 'Closed' ? 'Completed' : status;
  const map: Record<string, string> = {
    Open: 'bg-yellow-100 text-yellow-700',
    Pending: 'bg-yellow-100 text-yellow-700',
    InProgress: 'bg-blue-100 text-blue-700',
    Completed: 'bg-green-100 text-green-700',
    Cancelled: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<string, string> = {
    Open: 'Aberto',
    Pending: 'Pendente',
    InProgress: 'Em curso',
    Completed: 'Concluído',
    Cancelled: 'Cancelado',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[normalizedStatus] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[normalizedStatus] ?? normalizedStatus}
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
  const [platformBillingSettings, setPlatformBillingSettings] = useState<PlatformBillingSettingsDto | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    if (isManager) {
      const setLoadWarning = () => setDashboardError('Alguns dados do dashboard não puderam ser carregados.');

      condominiumsApi.getAll().then((r) => setManagerCondominiumCount(r.data.length)).catch(setLoadWarning);
      usersApi.getAll().then((r) => {
        setManagerUserCount(r.data.length);
        setManagerActiveUserCount(r.data.filter((u) => u.isActive).length);
      }).catch(setLoadWarning);
      subscriptionsApi.getStats().then((r) => setManagerMrr(r.data.monthlyBillingVolume)).catch(setLoadWarning);
      usersApi.getActiveLastMonthByCondominium().then((r) => setActiveByCondominium(r.data)).catch(setLoadWarning);
      platformBillingSettingsApi.get().then((r) => setPlatformBillingSettings(r.data)).catch(setLoadWarning);
      const tManager = setTimeout(() => setDashboardLoading(false), 800);
      return () => clearTimeout(tManager);
    }

    const setLoadWarning = () => setDashboardError('Alguns dados do dashboard não puderam ser carregados.');

    // Get current user ID
    usersApi.getMe().then((r) => setUserId(r.data.id)).catch(setLoadWarning);
    
    if (condominiumId) {
      maintenanceApi.getAll(condominiumId).then((r) => {
        setMaintenance(r.data);
      }).catch(setLoadWarning);
    }
    if (condominiumId) {
      notificationsApi.getAll(condominiumId, 1, 100).then((r) => setNotifications(r.data.items)).catch(setLoadWarning);
    }
    if (condominiumId) {
      reservationsApi.getAll(condominiumId).then((r) => setReservations(r.data)).catch(setLoadWarning);
    }
    // Load financial dashboard for current year
    if (condominiumId) {
      const currentYear = new Date().getFullYear();
      financialApi.getDashboard(condominiumId, currentYear).then((r) => {
        setDashboardYear(r.data.currentYear);
        setBalance(r.data.currentYearBalance);
        setReserveFundBalance(r.data.reserveFundBalance);
        setNoiseAnnouncementsCurrentYear(r.data.noiseAnnouncementsCurrentYear ?? 0);
        setNoiseAnnouncementsPreviousYear(r.data.noiseAnnouncementsPreviousYear ?? 0);
      }).catch(setLoadWarning);
    }

    // Mark dashboard as loaded after a short delay to allow parallel calls to settle
    const t = setTimeout(() => setDashboardLoading(false), 800);
    return () => clearTimeout(t);
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

        {dashboardError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>{dashboardError}</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recarregar
            </button>
          </div>
        )}

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

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-indigo-600" />
                Faturação da Plataforma
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Tens um resumo imediato aqui; a gestão detalhada continua na página de Faturação.
              </p>
            </div>
            <Link to="/billing" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
              Abrir Faturação
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">MRR atual</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {managerMrr !== null ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(managerMrr) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Gateway</p>
              <p className={`text-xl font-bold mt-1 ${platformBillingSettings?.gatewayEnabled ? 'text-emerald-700' : 'text-gray-700'}`}>
                {platformBillingSettings?.gatewayEnabled ? 'Ativo' : 'Inativo'}
              </p>
              <p className="text-xs text-gray-400 mt-1">{platformBillingSettings?.gatewayProvider || 'stripe'}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Configuração Stripe</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {platformBillingSettings?.hasSecretKey && platformBillingSettings?.hasWebhookSecret ? 'Completa' : 'Incompleta'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Configurações editáveis em Faturação</p>
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

      {dashboardError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{dashboardError}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recarregar
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          loading={dashboardLoading}
          title="Manutenção ativa"
          value={dashboardLoading ? '—' : pendingMaintenance.length + inProgressMaintenance.length}
          icon={Wrench}
          color="bg-orange-100 text-orange-600"
          to="/maintenance"
        />
        <StatCard
          loading={dashboardLoading}
          title="Saldo do ano"
          value={dashboardLoading ? '—' : balance !== null ? `€${balance.toFixed(2)}` : '—'}
          icon={DollarSign}
          color="bg-green-100 text-green-600"
          to="/financial"
          subtitle={!dashboardLoading && reserveFundBalance !== null ? `Fundo de Reserva: €${reserveFundBalance.toFixed(2)}` : undefined}
        />
        <StatCard
          loading={dashboardLoading}
          title="Notificações não lidas"
          value={dashboardLoading ? '—' : unreadNotifications.length}
          icon={Bell}
          color="bg-indigo-100 text-indigo-600"
          to="/notifications"
        />
        <StatCard
          loading={dashboardLoading}
          title="Reservas ativas"
          value={dashboardLoading ? '—' : activeReservations.length}
          icon={Calendar}
          color="bg-purple-100 text-purple-600"
          to="/reservations"
        />
        <StatCard
          loading={dashboardLoading}
          title="Ocorrências de barulho"
          value={dashboardLoading ? '—' : noiseAnnouncementsCurrentYear}
          icon={Volume2}
          color="bg-amber-100 text-amber-700"
          to="/announcements?category=Noise"
          subtitle={!dashboardLoading ? `Homólogo (${dashboardYear - 1}): ${noiseAnnouncementsPreviousYear} • ${noiseYoYLabel}` : undefined}
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { to: '/maintenance', label: 'Manutenção', icon: Wrench, bg: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
          { to: '/announcements', label: 'Comunicados', icon: Megaphone, bg: 'bg-pink-50 text-pink-600 hover:bg-pink-100' },
          { to: '/reservations', label: 'Reservas', icon: Calendar, bg: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
          { to: '/documents', label: 'Documentos', icon: FileText, bg: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
          { to: '/assemblies', label: 'Assembleias', icon: ClipboardList, bg: 'bg-teal-50 text-teal-600 hover:bg-teal-100' },
          { to: '/financial', label: 'Financeiro', icon: TrendingUp, bg: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
        ].map(({ to, label, icon: Icon, bg }) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl transition-colors text-center ${bg}`}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium text-xs leading-tight">{label}</span>
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
          {maintenance.slice(0, 5).map((m) => {
            const normalizedStatus = m.status === 'Resolved' || m.status === 'Closed' ? 'Completed' : m.status;

            return (
            <div key={m.id} className="flex items-start gap-3 px-5 py-3.5">
              <div className="mt-0.5">
                {normalizedStatus === 'Completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" aria-hidden="true" />
                ) : normalizedStatus === 'InProgress' ? (
                  <Clock className="w-4 h-4 text-blue-500" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-orange-500" aria-hidden="true" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                <p className="text-xs text-gray-500">{m.location || new Date(m.createdAt).toLocaleDateString('pt-PT')}</p>
              </div>
              {statusBadge(m.status)}
            </div>
            );
          })}
          {maintenance.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
              <Wrench className="w-8 h-8 opacity-40" aria-hidden="true" />
              <p className="text-sm">Sem pedidos de manutenção ativos</p>
            </div>
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
            <div key={n.id} className={`flex items-start gap-3 px-5 py-3.5 ${!n.isRead ? 'bg-indigo-50/50' : ''}`}>
              <div className="relative mt-0.5 shrink-0">
                <Bell className={`w-4 h-4 ${!n.isRead ? 'text-indigo-500' : 'text-gray-400'}`} aria-hidden="true" />
                {!n.isRead && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-500" aria-label="Não lida" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500 truncate">{n.message}</p>
              </div>
              <time className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                {new Date(n.sentAt).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
              <Bell className="w-8 h-8 opacity-40" aria-hidden="true" />
              <p className="text-sm">Sem notificações recentes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
