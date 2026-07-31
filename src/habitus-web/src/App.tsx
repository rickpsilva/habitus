import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { I18nProvider } from './i18n/I18nProvider';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import SelectCondominiumPage from './pages/SelectCondominiumPage';
import SelectContextPage from './pages/SelectContextPage';
import ResidentRegisterPage from './pages/ResidentRegisterPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import InactiveCondominiumPage from './pages/InactiveCondominiumPage';
import DashboardPage from './pages/DashboardPage';
import MaintenancePage from './pages/MaintenancePage';
import FinancialPage from './pages/FinancialPage';
import NotificationsPage from './pages/NotificationsPage';
import ReservationsPage from './pages/ReservationsPage';
import DocumentsPage from './pages/DocumentsPage';
import AssembliesPage from './pages/AssembliesPage';
import CondominiumsPage from './pages/CondominiumsPage';
import UsersPage from './pages/UsersPage';
import UnitsPage from './pages/UnitsPage';
import ProfilePage from './pages/ProfilePage';
import SharedSpacesPage from './pages/SharedSpacesPage';
import SuppliersPage from './pages/SuppliersPage';
import UsefulContactsPage from './pages/UsefulContactsPage';
import PaymentsPage from './pages/PaymentsPage';
import CondominiumSettingsPage from './pages/CondominiumSettingsPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import BillingPage from './pages/BillingPage';
import ConsentRequiredPage from './pages/ConsentRequiredPage';

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
            <Route path="/profile" element={<ProfilePage />} />
            {/* Legacy route - redirect to users */}
            <Route path="/residents" element={<Navigate to="/users" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
      </I18nProvider>
    </AuthProvider>
  );
}
