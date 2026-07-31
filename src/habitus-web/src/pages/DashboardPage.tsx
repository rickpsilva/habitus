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
} from 'lucide-react';
import { maintenanceApi, financialApi, notificationsApi, reservationsApi, usersApi, condominiumsApi, subscriptionsApi, platformBillingSettingsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';
import { PageHeader, ErrorState, StatCard, Badge, Card } from '../components/ui';
import type { BadgeVariant } from '../components/ui';
import type { MaintenanceRequestDto, NotificationDto, ReservationDto, CondominiumActiveUsersDto, PlatformBillingSettingsDto } from '../types';
import { UserRole } from '../types';

function statusBadge(status: string, t: TranslateFn) {
  const normalizedStatus = status === 'Resolved' || status === 'Closed' ? 'Completed' : status;
  const variants: Record<string, BadgeVariant> = {
    Open: 'warning',
    Pending: 'warning',
    InProgress: 'info',
    Completed: 'success',
    Cancelled: 'neutral',
  };
  const labels: Record<string, string> = {
    Open: t('status.open'),
    Pending: t('status.pending'),
    InProgress: t('status.inProgress'),
    Completed: t('status.completed'),
    Cancelled: t('status.cancelled'),
  };
  return (
    <Badge variant={variants[normalizedStatus] ?? 'neutral'}>
      {labels[normalizedStatus] ?? normalizedStatus}
    </Badge>
  );
}

export default function DashboardPage() {
  const { user, condominiumId, isManager } = useAuth();
  const { t, formatDate, formatDateTime, formatCurrency } = useTranslation();
  const [maintenance, setMaintenance] = useState<MaintenanceRequestDto[]>([]);
  const [maintenanceActiveCount, setMaintenanceActiveCount] = useState<number>(0);
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
      const setLoadWarning = () => setDashboardError(t('dashboard.loadError'));

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

    const setLoadWarning = () => setDashboardError(t('dashboard.loadError'));

    // Get current user ID
    usersApi.getMe().then((r) => setUserId(r.data.id)).catch(setLoadWarning);
    
    if (condominiumId) {
      maintenanceApi.getPaged(condominiumId, 1, 5).then((r) => {
        setMaintenance(r.data.items);
      }).catch(setLoadWarning);
      maintenanceApi.getStatusCounts(condominiumId).then((r) => {
        setMaintenanceActiveCount(r.data.open + r.data.inProgress);
      }).catch(setLoadWarning);
    }
    if (condominiumId) {
      notificationsApi.getAll(condominiumId, 1, 100).then((r) => setNotifications(r.data.items)).catch(setLoadWarning);
    }
    if (condominiumId) {
      reservationsApi.getPaged(condominiumId, 1, 50).then((r) => setReservations(r.data.items)).catch(setLoadWarning);
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
    const timer = setTimeout(() => setDashboardLoading(false), 800);
    return () => clearTimeout(timer);
  }, [condominiumId, isManager, t]);

  if (isManager) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('dashboard.manager.title')}
          subtitle={t('dashboard.manager.subtitle')}
        />

        {dashboardError && (
          <ErrorState message={dashboardError} onRetry={() => window.location.reload()} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title={t('dashboard.manager.condominiums')}
            value={managerCondominiumCount}
            icon={Building2}
            color="bg-blue-100 text-blue-700"
            to="/condominiums"
            subtitle={t('dashboard.manager.activePortfolio')}
          />
          <StatCard
            title={t('dashboard.manager.users')}
            value={managerUserCount}
            icon={Users}
            color="bg-indigo-100 text-indigo-700"
            to="/condominiums"
            subtitle={t('dashboard.manager.activeCount', { count: managerActiveUserCount })}
          />
          <StatCard
            title={t('dashboard.manager.requestsPerMinute')}
            value={t('common.comingSoon')}
            icon={Activity}
            color="bg-amber-100 text-amber-700"
            to="/dashboard"
            subtitle={t('dashboard.manager.platformMetric')}
          />
          <StatCard
            title={t('dashboard.manager.billingVolume')}
            value={managerMrr !== null ? formatCurrency(managerMrr) : t('status.inProgress')}
            icon={CreditCard}
            color="bg-emerald-100 text-emerald-700"
            to="/billing"
            subtitle={t('dashboard.manager.mrrMetric')}
          />
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink">{t('dashboard.manager.activeUsersByCondominium')}</h2>
            <span className="text-xs text-ink-subtle">{t('dashboard.manager.lastMonth')}</span>
          </div>
          {activeByCondominium.length === 0 ? (
            <p className="text-sm text-ink-subtle text-center py-4">{t('common.noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-subtle border-b border-line">
                    <th className="pb-2 font-medium">{t('dashboard.manager.condominium')}</th>
                    <th className="pb-2 font-medium text-right">{t('dashboard.manager.activeUsers')}</th>
                    <th className="pb-2 font-medium text-right pr-1">{t('dashboard.manager.engagement')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeByCondominium.map((row) => {
                    const maxActive = Math.max(...activeByCondominium.map((r) => r.activeUsersLastMonth), 1);
                    const barWidth = Math.round((row.activeUsersLastMonth / maxActive) * 100);
                    return (
                      <tr key={row.condominiumId} className="border-b border-line last:border-0">
                        <td className="py-2.5 text-ink font-medium">{row.condominiumName}</td>
                        <td className="py-2.5 text-right tabular-nums text-ink-muted">{row.activeUsersLastMonth}</td>
                        <td className="py-2.5 pl-4 pr-1 w-36">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-surface-hover rounded-full h-1.5">
                              <div
                                className="bg-indigo-500 h-1.5 rounded-full"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="text-xs text-ink-subtle w-8 text-right">{barWidth}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink">{t('dashboard.manager.platformPlans')}</h2>
            <a
              href="/billing"
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              {t('dashboard.manager.manageBilling')}
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-line p-4">
              <p className="text-sm font-semibold text-ink flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                {t('dashboard.manager.packFree')}
              </p>
              <p className="text-xs text-ink-subtle mt-2">{t('dashboard.manager.packFreeDesc')}</p>
            </div>
            <div className="rounded-lg border border-amber-200 p-4">
              <p className="text-sm font-semibold text-ink flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                {t('dashboard.manager.packSilver')}
              </p>
              <p className="text-xs text-ink-subtle mt-2">{t('dashboard.manager.packSilverDesc')}</p>
            </div>
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-ink flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                {t('dashboard.manager.packGold')}
              </p>
              <p className="text-xs text-ink-subtle mt-2">{t('dashboard.manager.packGoldDesc')}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-ink flex items-center gap-2">
                <Wallet className="w-4 h-4 text-indigo-600" />
                {t('dashboard.manager.platformBilling')}
              </h2>
              <p className="text-xs text-ink-subtle mt-1">
                {t('dashboard.manager.billingSummaryHint')}
              </p>
            </div>
            <Link to="/billing" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
              {t('dashboard.manager.openBilling')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-line p-4">
              <p className="text-xs text-ink-subtle">{t('dashboard.manager.currentMrr')}</p>
              <p className="text-xl font-bold text-ink mt-1">
                {managerMrr !== null ? formatCurrency(managerMrr) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-line p-4">
              <p className="text-xs text-ink-subtle">Gateway</p>
              <p className={`text-xl font-bold mt-1 ${platformBillingSettings?.gatewayEnabled ? 'text-emerald-700' : 'text-ink-muted'}`}>
                {platformBillingSettings?.gatewayEnabled ? t('common.active') : t('common.inactive')}
              </p>
              <p className="text-xs text-ink-subtle mt-1">{platformBillingSettings?.gatewayProvider || 'stripe'}</p>
            </div>
            <div className="rounded-lg border border-line p-4">
              <p className="text-xs text-ink-subtle">{t('dashboard.manager.stripeConfig')}</p>
              <p className="text-xl font-bold text-ink mt-1">
                {platformBillingSettings?.hasSecretKey && platformBillingSettings?.hasWebhookSecret ? t('common.complete') : t('common.incomplete')}
              </p>
              <p className="text-xs text-ink-subtle mt-1">{t('dashboard.manager.stripeConfigHint')}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const now = new Date();
  
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
    if (user?.role === UserRole.Resident) {
      // Morador: only their own reservations
      return r.userId === userId;
    } else if (user?.role === UserRole.Admin) {
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
      <PageHeader
        title={t('dashboard.welcome', { name: user?.name?.split(' ')[0] ?? '' })}
        subtitle={t('dashboard.resident.subtitle')}
      />

      {dashboardError && (
        <ErrorState message={dashboardError} onRetry={() => window.location.reload()} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          loading={dashboardLoading}
          title={t('dashboard.stats.activeMaintenance')}
          value={dashboardLoading ? '—' : maintenanceActiveCount}
          icon={Wrench}
          color="bg-orange-100 text-orange-600"
          to="/maintenance"
        />
        <StatCard
          loading={dashboardLoading}
          title={t('dashboard.stats.yearBalance')}
          value={dashboardLoading ? '—' : balance !== null ? `€${balance.toFixed(2)}` : '—'}
          icon={DollarSign}
          color="bg-green-100 text-green-600"
          to="/financial"
          subtitle={!dashboardLoading && reserveFundBalance !== null ? t('dashboard.stats.reserveFund', { value: reserveFundBalance.toFixed(2) }) : undefined}
        />
        <StatCard
          loading={dashboardLoading}
          title={t('dashboard.stats.unreadNotifications')}
          value={dashboardLoading ? '—' : unreadNotifications.length}
          icon={Bell}
          color="bg-indigo-100 text-indigo-600"
          to="/notifications"
        />
        <StatCard
          loading={dashboardLoading}
          title={t('dashboard.stats.activeReservations')}
          value={dashboardLoading ? '—' : activeReservations.length}
          icon={Calendar}
          color="bg-purple-100 text-purple-600"
          to="/reservations"
        />
        <StatCard
          loading={dashboardLoading}
          title={t('dashboard.stats.noiseOccurrences')}
          value={dashboardLoading ? '—' : noiseAnnouncementsCurrentYear}
          icon={Volume2}
          color="bg-amber-100 text-amber-700"
          to="/announcements?category=Noise"
          subtitle={!dashboardLoading ? t('dashboard.stats.noiseYoY', { year: dashboardYear - 1, count: noiseAnnouncementsPreviousYear, label: noiseYoYLabel }) : undefined}
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { to: '/maintenance', label: t('nav.maintenance'), icon: Wrench, bg: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
          { to: '/announcements', label: t('nav.announcements'), icon: Megaphone, bg: 'bg-pink-50 text-pink-600 hover:bg-pink-100' },
          { to: '/reservations', label: t('nav.reservations'), icon: Calendar, bg: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
          { to: '/documents', label: t('nav.documents'), icon: FileText, bg: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
          { to: '/assemblies', label: t('nav.assemblies'), icon: ClipboardList, bg: 'bg-teal-50 text-teal-600 hover:bg-teal-100' },
          { to: '/financial', label: t('nav.financial'), icon: TrendingUp, bg: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
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
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-semibold text-ink">{t('dashboard.recentMaintenance')}</h2>
          <Link to="/maintenance" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            {t('common.viewAll')}
          </Link>
        </div>
        <div className="divide-y divide-line">
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
                <p className="text-sm font-medium text-ink truncate">{m.title}</p>
                <p className="text-xs text-ink-subtle">{m.location || formatDate(m.createdAt)}</p>
              </div>
              {statusBadge(m.status, t)}
            </div>
            );
          })}
          {maintenance.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-ink-subtle">
              <Wrench className="w-8 h-8 opacity-40" aria-hidden="true" />
              <p className="text-sm">{t('dashboard.noActiveMaintenance')}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-semibold text-ink">{t('dashboard.latestNotifications')}</h2>
          <Link to="/notifications" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            {t('dashboard.viewAllNotifications')}
          </Link>
        </div>
        <div className="divide-y divide-line">
          {notifications.slice(0, 4).map((n) => (
            <div key={n.id} className={`flex items-start gap-3 px-5 py-3.5 ${!n.isRead ? 'bg-indigo-50/50' : ''}`}>
              <div className="relative mt-0.5 shrink-0">
                <Bell className={`w-4 h-4 ${!n.isRead ? 'text-indigo-500' : 'text-ink-subtle'}`} aria-hidden="true" />
                {!n.isRead && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-500" aria-label={t('common.unread')} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">{n.title}</p>
                <p className="text-xs text-ink-subtle truncate">{n.message}</p>
              </div>
              <time className="text-xs text-ink-subtle shrink-0 whitespace-nowrap">
                {formatDateTime(n.sentAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-ink-subtle">
              <Bell className="w-8 h-8 opacity-40" aria-hidden="true" />
              <p className="text-sm">{t('dashboard.noRecentNotifications')}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
