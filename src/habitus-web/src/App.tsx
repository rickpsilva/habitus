import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import MaintenancePage from './pages/MaintenancePage';
import FinancialPage from './pages/FinancialPage';
import NotificationsPage from './pages/NotificationsPage';
import ReservationsPage from './pages/ReservationsPage';
import DocumentsPage from './pages/DocumentsPage';
import AssembliesPage from './pages/AssembliesPage';
import ResidentsPage from './pages/ResidentsPage';
import UnitsPage from './pages/UnitsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/financial" element={<FinancialPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/reservations" element={<ReservationsPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/assemblies" element={<AssembliesPage />} />
            <Route path="/residents" element={<ResidentsPage />} />
            <Route path="/units" element={<UnitsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
