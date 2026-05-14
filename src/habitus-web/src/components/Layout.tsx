import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { announcementsApi, notificationsApi, subscriptionsApi } from '../api/services';
import { getIsDarkMode, onThemeChanged, toggleTheme } from '../utils/theme';
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
  UserCircle,
  CreditCard,
  Settings,
  Moon,
  Sun,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  managerOnly?: boolean;
  managerOrAdminOnly?: boolean;
  residentOnly?: boolean;
  featureKey?: string;
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/maintenance', label: 'Manutenção', icon: Wrench, featureKey: 'maintenance' },
  { to: '/financial', label: 'Financeiro', icon: DollarSign, featureKey: 'financial' },
  { to: '/payments', label: 'Pagamentos', icon: CreditCard, residentOnly: true, featureKey: 'financial' },
  { to: '/notifications', label: 'Notificações', icon: Bell },
  { to: '/announcements', label: 'Comunicados', icon: Megaphone, featureKey: 'announcements' },
  { to: '/reservations', label: 'Reservas', icon: Calendar, featureKey: 'reservations' },
  { to: '/documents', label: 'Documentos', icon: FileText, featureKey: 'documents' },
  { to: '/assemblies', label: 'Assembleias', icon: ClipboardList, featureKey: 'assemblies' },
  { to: '/settings', label: 'Configurações', icon: Settings, managerOrAdminOnly: true },
  { to: '/condominiums', label: 'Condomínios', icon: Building2, managerOnly: true },
  { to: '/billing', label: 'Faturação', icon: CreditCard, managerOnly: true },
  { to: '/users', label: 'Utilizadores', icon: Users, managerOrAdminOnly: true, featureKey: 'user_registration' },
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
  '/assemblies',
  '/users',
  '/settings',
];

const residentMenuOrder = [
  '/dashboard',
  '/notifications',
  '/announcements',
  '/payments',
  '/reservations',
  '/maintenance',
  '/documents',
  '/assemblies',
  '/financial',
];

const managerMenuOrder = [
  '/dashboard',
  '/condominiums',
  '/billing',
  '/users',
  '/settings',
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin, isManager, isResident } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingAnnouncementsCount, setPendingAnnouncementsCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(getIsDarkMode());
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set());
  const [featureAccessLoaded, setFeatureAccessLoaded] = useState(false);

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

        const notificationsRes = await notificationsApi.getAll(1, 100);
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleToggleTheme = () => {
    const nextIsDark = toggleTheme();
    setIsDarkMode(nextIsDark);
  };

  const visibleNavItems = navItems.filter((item) => {
    if (item.managerOnly && !isManager) return false;
    if (item.managerOrAdminOnly && !isManager && !isAdmin) return false;
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

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-200 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Habitus</span>
            <button
              className="ml-auto lg:hidden text-gray-400 hover:text-gray-600"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {orderedNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User */}
          <div className="px-4 py-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {user?.role === 0 ? 'Gestor' : user?.role === 1 ? 'Administrador' : 'Morador'}
                </p>
              </div>
            </div>
            <NavLink
              to="/profile"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 w-full px-3 py-2 mb-2 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <UserCircle className="w-4 h-4" />
              Meu Perfil
            </NavLink>
            <button
              onClick={handleToggleTheme}
              className="flex items-center gap-2 w-full px-3 py-2 mb-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {isDarkMode ? 'Modo claro' : 'Modo escuro'}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Terminar sessão
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 mx-auto">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-gray-900">Habitus</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
