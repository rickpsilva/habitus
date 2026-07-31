import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { I18nProvider } from './i18n/I18nProvider';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Spinner from './components/ui/Spinner';
import LoginPage from './pages/LoginPage';

const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const SelectCondominiumPage = lazy(() => import('./pages/SelectCondominiumPage'));
const SelectContextPage = lazy(() => import('./pages/SelectContextPage'));
const ResidentRegisterPage = lazy(() => import('./pages/ResidentRegisterPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const InactiveCondominiumPage = lazy(() => import('./pages/InactiveCondominiumPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const FinancialPage = lazy(() => import('./pages/FinancialPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ReservationsPage = lazy(() => import('./pages/ReservationsPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const AssembliesPage = lazy(() => import('./pages/AssembliesPage'));
const CondominiumsPage = lazy(() => import('./pages/CondominiumsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const UnitsPage = lazy(() => import('./pages/UnitsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SharedSpacesPage = lazy(() => import('./pages/SharedSpacesPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const UsefulContactsPage = lazy(() => import('./pages/UsefulContactsPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const CondominiumSettingsPage = lazy(() => import('./pages/CondominiumSettingsPage'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const ConsentAdminPage = lazy(() => import('./pages/ConsentAdminPage'));
const ConsentRequiredPage = lazy(() => import('./pages/ConsentRequiredPage'));

// Centered, text-less fallback shown while a lazy route chunk downloads.
function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

// Full-screen consent gate: authenticated but rendered without the app Layout so
// it stays reachable even while the user is blocked by the global 451 gate.
function ConsentGateRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <ConsentRequiredPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <I18nProvider>
      <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          {/* Public registration flow: select condominium → resident registration */}
          <Route path="/register" element={<SelectCondominiumPage />} />
          <Route path="/user/register/:condominiumId/resident" element={<ResidentRegisterPage />} />
          {/* Admin registration (internal, via manager invite link) */}
          <Route path="/user/register/:condominiumId/admin" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/condominium-inactive" element={<InactiveCondominiumPage />} />
          {/* RGPD/GDPR consent gate (HTTP 451). Authenticated, no Layout. */}
          <Route path="/consent-required" element={<ConsentGateRoute />} />
          {/* Post-login active-context picker (bare interstitial, no Layout) */}
          <Route path="/select-context" element={<SelectContextPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/financial" element={<FinancialPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/reservations" element={<ReservationsPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/assemblies" element={<AssembliesPage />} />
            <Route path="/shared-spaces" element={<SharedSpacesPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/useful-contacts" element={<UsefulContactsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/condominiums" element={<CondominiumsPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/units" element={<UnitsPage />} />
            <Route path="/settings" element={<CondominiumSettingsPage />} />
            <Route path="/settings/consents" element={<ConsentAdminPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            {/* Legacy route - redirect to users */}
            <Route path="/residents" element={<Navigate to="/users" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </ToastProvider>
      </I18nProvider>
    </AuthProvider>
  );
}
