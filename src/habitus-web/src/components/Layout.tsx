import { useState, useEffect, Fragment } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/types';
import { announcementsApi, notificationsApi, subscriptionsApi, meApi } from '../api/services';
import { getIsDarkMode, onThemeChanged, toggleTheme } from '../utils/theme';
import CommandPalette from './CommandPalette';
import LanguageSwitcher from './LanguageSwitcher';
import { ImpersonationBanner } from './ImpersonationBanner';
import {
  LayoutDashboard,
  Wrench,
  DollarSign,
  Bell,
  Calendar,
  FileText,
  Users,
  LogOut,
  Menu,
  X,
  Building2,
  ClipboardList,
  Megaphone,
  Phone,
  UserCircle,
  CreditCard,
  Settings,
  ShieldCheck,
  Moon,
  Sun,
  Search,
  PanelLeftClose,
  PanelLeft,
  ArrowLeftRight,
  Link2,
  UserCheck,
  LifeBuoy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MembershipCondominiumDto } from '../types';
import { UserRole } from '../types';

interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  managerOnly?: boolean;
  managerOrAdminOnly?: boolean;
  adminOnly?: boolean;
  residentOnly?: boolean;
  featureKey?: string;
}

const navItems: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/maintenance', labelKey: 'nav.maintenance', icon: Wrench, featureKey: 'maintenance' },
  { to: '/financial', labelKey: 'nav.financial', icon: DollarSign, featureKey: 'financial' },
  { to: '/payments', labelKey: 'nav.payments', icon: CreditCard, residentOnly: true, featureKey: 'financial' },
  { to: '/notifications', labelKey: 'nav.notifications', icon: Bell },
  { to: '/announcements', labelKey: 'nav.announcements', icon: Megaphone, featureKey: 'announcements' },
  { to: '/reservations', labelKey: 'nav.reservations', icon: Calendar, featureKey: 'reservations' },
  { to: '/documents', labelKey: 'nav.documents', icon: FileText, featureKey: 'documents' },
  { to: '/useful-contacts', labelKey: 'nav.usefulContacts', icon: Phone, featureKey: 'useful_contacts' },
  { to: '/assemblies', labelKey: 'nav.assemblies', icon: ClipboardList, featureKey: 'assemblies' },
  { to: '/helpdesk', labelKey: 'nav.helpdesk', icon: LifeBuoy, managerOnly: true },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, managerOrAdminOnly: true },
  { to: '/settings/consents', labelKey: 'nav.consentAdmin', icon: ShieldCheck, managerOnly: true },
  { to: '/association-requests', labelKey: 'nav.associationRequests', icon: UserCheck, adminOnly: true },
  { to: '/my-associations', labelKey: 'nav.myAssociations', icon: Link2 },
  { to: '/condominiums', labelKey: 'nav.condominiums', icon: Building2, managerOnly: true },
  { to: '/billing', labelKey: 'nav.billing', icon: CreditCard, managerOnly: true },
  { to: '/users', labelKey: 'nav.users', icon: Users, managerOrAdminOnly: true, featureKey: 'user_registration' },
];

const fallbackFreeFeatures = new Set(['maintenance', 'announcements', 'documents']);

const adminMenuOrder = [
  '/dashboard',
  '/notifications',
  '/announcements',
  '/maintenance',
  '/financial',
  '/reservations',
  '/payments',
  '/documents',
  '/useful-contacts',
  '/assemblies',
  '/users',
  '/association-requests',
  '/settings',
  '/my-associations',
];

const residentMenuOrder = [
  '/dashboard',
  '/notifications',
  '/announcements',
  '/payments',
  '/reservations',
  '/maintenance',
  '/documents',
  '/useful-contacts',
  '/assemblies',
  '/financial',
  '/my-associations',
];

const managerMenuOrder = [
  '/dashboard',
  '/condominiums',
  '/billing',
  '/users',
  '/helpdesk',
  '/settings',
  '/settings/consents',
];

// Visual grouping only. Sections are contiguous within every role menu order
// above, so headers never reorder or hide any item.
const navSections: { id: string; labelKey: TranslationKey; routes: string[] }[] = [
  { id: 'general', labelKey: 'section.general', routes: ['/dashboard', '/notifications', '/announcements'] },
  {
    id: 'operations',
    labelKey: 'section.operations',
    routes: ['/maintenance', '/financial', '/reservations', '/payments', '/documents', '/useful-contacts', '/assemblies', '/my-associations'],
  },
  { id: 'admin', labelKey: 'section.admin', routes: ['/helpdesk', '/users', '/association-requests', '/settings', '/settings/consents', '/condominiums', '/billing'] },
];

const sectionIdForRoute = (to: string): string =>
  navSections.find((section) => section.routes.includes(to))?.id ?? 'operations';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin, isManager, isResident } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingAnnouncementsCount, setPendingAnnouncementsCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(getIsDarkMode());
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set());
  const [featureAccessLoaded, setFeatureAccessLoaded] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [canSwitchContext, setCanSwitchContext] = useState(false);
  const [memberships, setMemberships] = useState<MembershipCondominiumDto[]>([]);
  const [multilanguageEnabled, setMultilanguageEnabled] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('habitus.sidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const loadFeatureAccess = async () => {
      if (isManager) {
        setEnabledFeatures(new Set());
        setFeatureAccessLoaded(true);
        return;
      }

      try {
        const subscription = await subscriptionsApi.getMy();
        const featureSet = new Set(
          subscription.data.plan.features
            .filter((f) => f.isEnabled)
            .map((f) => f.featureKey)
        );
        setEnabledFeatures(featureSet);
      } catch {
        setEnabledFeatures(new Set(fallbackFreeFeatures));
      } finally {
        setFeatureAccessLoaded(true);
      }
    };

    loadFeatureAccess();
  }, [isManager, user?.condominiumId]);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        if (isManager) {
          setUnreadCount(0);
          setPendingAnnouncementsCount(0);
          return;
        }

        if (!user?.condominiumId) {
          setUnreadCount(0);
          setPendingAnnouncementsCount(0);
          return;
        }

        const notificationsRes = await notificationsApi.getAll(user.condominiumId, 1, 100);
        const unread = notificationsRes.data.items.filter((n) => !n.isRead).length;
        setUnreadCount(unread);

        if (isAdmin && user?.condominiumId) {
          const statsRes = await announcementsApi.getStats(user.condominiumId);
          setPendingAnnouncementsCount(statsRes.data.pendingApproval ?? 0);
        } else {
          setPendingAnnouncementsCount(0);
        }
      } catch {
        // Ignore menu counter errors to keep navigation responsive.
      }
    };

    loadCounts();
    const interval = setInterval(loadCounts, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [isAdmin, isManager, user?.condominiumId]);

  useEffect(() => {
    return onThemeChanged(() => {
      setIsDarkMode(getIsDarkMode());
    });
  }, []);

  // Determine whether the user holds more than one condominium/unit membership,
  // so the "switch context" entry can stay hidden for single-membership users.
  useEffect(() => {
    if (isManager) return;
    meApi.getMemberships()
      .then((r) => {
        const condos = r.data.condominiums ?? [];
        const totalUnits = condos.reduce((sum, c) => sum + Math.max(c.units.length, 1), 0);
        setMemberships(condos);
        setCanSwitchContext(condos.length > 1 || totalUnits > 1);
      })
      .catch(() => {
        // Keep the entry hidden if memberships cannot be loaded.
      });
  }, [isManager]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Whether the language selector should be shown, gated by the active
  // condominium's multilanguage flag (REQ-I18N-002). Setters run inside .then.
  useEffect(() => {
    meApi.getLocalization()
      .then((r) => {
        setMultilanguageEnabled(r.data.multilanguageEnabled);
      })
      .catch(() => {
        // Keep the selector hidden if localization settings cannot be loaded.
      });
  }, [user?.condominiumId]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleToggleTheme = () => {
    const nextIsDark = toggleTheme();
    setIsDarkMode(nextIsDark);
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('habitus.sidebarCollapsed', next ? '1' : '0');
      } catch {
        // Ignore persistence failures; collapse still works for the session.
      }
      return next;
    });
  };

  const visibleNavItems = navItems.filter((item) => {
    if (item.managerOnly && !isManager) return false;
    if (item.managerOrAdminOnly && !isManager && !isAdmin) return false;
    if (item.adminOnly && !isAdmin) return false;
      // Allow residents OR admins with a unit assigned (internal admins)
      if (item.residentOnly && !isResident && !(isAdmin && user?.unitId)) return false;
    if (!isManager && item.featureKey && featureAccessLoaded && !enabledFeatures.has(item.featureKey)) return false;
    // Manager only sees items explicitly in the manager menu order
    if (isManager && !managerMenuOrder.includes(item.to)) return false;
    return true;
  });

  const roleMenuOrder = isManager ? managerMenuOrder : isAdmin ? adminMenuOrder : residentMenuOrder;

  const orderedNavItems = [...visibleNavItems].sort((a, b) => {
    const indexA = roleMenuOrder.indexOf(a.to);
    const indexB = roleMenuOrder.indexOf(b.to);

    const safeIndexA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const safeIndexB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;

    return safeIndexA - safeIndexB;
  });

  // Attach a section header to the first item of each section (visual only).
  const navWithSections = orderedNavItems.reduce<{ item: NavItem; header: string | null }[]>(
    (acc, item) => {
      const sectionId = sectionIdForRoute(item.to);
      const previous = acc[acc.length - 1];
      const previousSectionId = previous ? sectionIdForRoute(previous.item.to) : null;
      const sectionLabelKey =
        sectionId !== previousSectionId
          ? navSections.find((section) => section.id === sectionId)?.labelKey ?? null
          : null;
      acc.push({ item, header: sectionLabelKey ? t(sectionLabelKey) : null });
      return acc;
    },
    [],
  );

  // Active fraction number for multi-fraction users, derived from the loaded
  // memberships and the auth-context active unit (shown next to the name).
  const activeFractionNumber = canSwitchContext
    ? memberships
        .find((c) => c.condominiumId === user?.condominiumId)
        ?.units.find((u) => u.unitId === user?.unitId)?.unitNumber
    : undefined;

  const commandItems = [
    ...orderedNavItems.map(({ to, labelKey, icon }) => ({
      to,
      label: t(labelKey),
      icon,
      section: navSections.find((section) => section.routes.includes(to))?.labelKey
        ? t(navSections.find((section) => section.routes.includes(to))!.labelKey)
        : undefined,
    })),
    { to: '/profile', label: t('layout.myProfile'), icon: UserCircle, section: undefined },
  ];

  return (
    <div className="flex h-screen bg-surface-muted overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-surface shadow-lg transform transition-all duration-200 lg:relative lg:translate-x-0 ${
          collapsed ? 'lg:w-16' : 'lg:w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`flex items-center gap-3 py-5 border-b border-line ${collapsed ? 'lg:justify-center lg:px-3 px-6' : 'px-6'}`}>
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className={`text-lg font-bold text-ink ${collapsed ? 'lg:hidden' : ''}`}>Habitus</span>
            <button
              className="ml-auto hidden lg:flex text-ink-subtle hover:text-ink-muted"
              onClick={toggleCollapsed}
              title={collapsed ? t('layout.expandMenu') : t('layout.collapseMenu')}
              aria-label={collapsed ? t('layout.expandMenu') : t('layout.collapseMenu')}
            >
              {collapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
            <button
              className="ml-auto lg:hidden text-ink-subtle hover:text-ink-muted"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick search */}
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              title={t('layout.searchTitle')}
              className={`flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink-subtle transition-colors hover:bg-surface-hover ${
                collapsed ? 'lg:justify-center lg:px-2' : ''
              }`}
            >
              <Search className="w-4 h-4 shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>{t('layout.search')}</span>
              <kbd className={`ml-auto rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-subtle ${collapsed ? 'lg:hidden' : ''}`}>
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navWithSections.map(({ item: { to, labelKey, icon: Icon }, header }) => {
              const label = t(labelKey);
              return (
              <Fragment key={to}>
                {header && (
                  <p className={`px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle first:pt-1 ${collapsed ? 'lg:hidden' : ''}`}>
                    {header}
                  </p>
                )}
                <NavLink
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                      collapsed ? 'lg:justify-center' : ''
                    } ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
                    }`
                  }
                >
                  <div className="relative">
                    <Icon className={`w-5 h-5 shrink-0 ${to === '/notifications' && unreadCount > 0 ? 'animate-bell-ring' : ''}`} />
                    {to === '/notifications' && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                    {to === '/announcements' && isAdmin && pendingAnnouncementsCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                        {pendingAnnouncementsCount > 9 ? '9+' : pendingAnnouncementsCount}
                      </span>
                    )}
                  </div>
                  <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
                </NavLink>
              </Fragment>
              );
            })}
          </nav>

          {/* User */}
          <div className="px-4 py-4 border-t border-line">
            <div className={`flex items-center gap-3 mb-3 ${collapsed ? 'lg:justify-center' : ''}`}>
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm shrink-0">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className={`flex-1 min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
                <p className="text-sm font-medium text-ink truncate">{user?.name}</p>
                <p className="text-xs text-ink-subtle truncate capitalize">
                  {user?.role === UserRole.Manager ? t('role.manager') : user?.role === UserRole.Admin ? t('role.admin') : t('role.resident')}
                </p>
                {activeFractionNumber && (
                  <span className="mt-1 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                    {t('common.fraction', { number: activeFractionNumber })}
                  </span>
                )}
              </div>
            </div>
            {multilanguageEnabled && (
              <div className={collapsed ? 'mb-2 lg:flex lg:justify-center' : 'mb-2'}>
                <LanguageSwitcher variant={collapsed ? 'icon' : 'menu'} />
              </div>
            )}
            <NavLink
              to="/profile"
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? t('layout.myProfile') : undefined}
              className={({ isActive }) =>
                `flex items-center gap-2 w-full px-3 py-2 mb-2 text-sm rounded-lg transition-colors ${
                  collapsed ? 'lg:justify-center' : ''
                } ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-ink-muted hover:bg-surface-hover'
                }`
              }
            >
              <UserCircle className="w-4 h-4 shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>{t('layout.myProfile')}</span>
            </NavLink>
            {canSwitchContext && (
              <button
                onClick={() => { setSidebarOpen(false); navigate('/select-context'); }}
                title={collapsed ? t('layout.switchContext') : undefined}
                className={`flex items-center gap-2 w-full px-3 py-2 mb-2 text-sm text-ink-muted hover:bg-surface-hover rounded-lg transition-colors ${collapsed ? 'lg:justify-center' : ''}`}
              >
                <ArrowLeftRight className="w-4 h-4 shrink-0" />
                <span className={collapsed ? 'lg:hidden' : ''}>{t('layout.switchContext')}</span>
              </button>
            )}
            <button
              onClick={handleToggleTheme}
              title={collapsed ? (isDarkMode ? t('layout.lightMode') : t('layout.darkMode')) : undefined}
              className={`flex items-center gap-2 w-full px-3 py-2 mb-2 text-sm text-ink-muted hover:bg-surface-hover rounded-lg transition-colors ${collapsed ? 'lg:justify-center' : ''}`}
            >
              {isDarkMode ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
              <span className={collapsed ? 'lg:hidden' : ''}>{isDarkMode ? t('layout.lightMode') : t('layout.darkMode')}</span>
            </button>
            <button
              onClick={handleLogout}
              title={collapsed ? t('layout.logout') : undefined}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors ${collapsed ? 'lg:justify-center' : ''}`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>{t('layout.logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center px-4 py-3 bg-surface border-b border-line shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-ink-subtle hover:text-ink"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 mx-auto">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-ink">Habitus</span>
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="text-ink-subtle hover:text-ink"
            aria-label={t('layout.search')}
          >
            <Search className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
        {/*
          Impersonation banner - shown at the top of main content when a Manager
          is impersonating another user. This is a global indicator that persists
          across all pages during the impersonation session.
        */}
        <ImpersonationBanner />
        {children}
      </main>
      </div>

      {paletteOpen && (
        <CommandPalette
          items={commandItems}
          onNavigate={(to) => {
            navigate(to);
            setSidebarOpen(false);
          }}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
