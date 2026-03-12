import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { notificationsApi } from '../api/services';
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
  UserCircle,
  Home,
  Warehouse,
  Truck,
  CreditCard,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: any;
  managerOnly?: boolean;
  managerOrAdminOnly?: boolean;
  residentOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/maintenance', label: 'Manutenção', icon: Wrench },
  { to: '/financial', label: 'Financeiro', icon: DollarSign },
  { to: '/payments', label: 'Pagamentos', icon: CreditCard, residentOnly: true },
  { to: '/notifications', label: 'Notificações', icon: Bell },
  { to: '/reservations', label: 'Reservas', icon: Calendar },
  { to: '/documents', label: 'Documentos', icon: FileText },
  { to: '/assemblies', label: 'Assembleias', icon: ClipboardList },
  { to: '/shared-spaces', label: 'Espaços Comuns', icon: Warehouse, managerOrAdminOnly: true },
  { to: '/suppliers', label: 'Fornecedores', icon: Truck, managerOrAdminOnly: true },
  { to: '/condominiums', label: 'Condomínios', icon: Building2, managerOnly: true },
  { to: '/units', label: 'Frações', icon: Home, managerOrAdminOnly: true },
  { to: '/users', label: 'Utilizadores', icon: Users, managerOrAdminOnly: true },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin, isManager, isResident } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadUnreadCount = () => {
      notificationsApi.getAll(1, 100).then((r) => {
        // Count unread from all items (fetch more to get accurate count)
        const unread = r.data.items.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
      }).catch(() => {});
    };

    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleNavItems = navItems.filter((item) => {
    if (item.managerOnly && !isManager) return false;
    if (item.managerOrAdminOnly && !isManager && !isAdmin) return false;
    if (item.residentOnly && !isResident) return false;
    return true;
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
            {visibleNavItems.map(({ to, label, icon: Icon }) => (
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
