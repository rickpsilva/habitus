import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n/I18nProvider';
import type { AuthResponse, UserRole } from '../types';
import { Spinner } from '../components/ui';

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login } = useAuth();

  useEffect(() => {
    const requiresTwoFactor = searchParams.get('requiresTwoFactor') === 'true';
    const challengeId = searchParams.get('challengeId');
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    const role = searchParams.get('role');
    const condominiumId = searchParams.get('condominiumId');
    const unitId = searchParams.get('unitId');
    const accessibleCondominiumsRaw = searchParams.get('accessibleCondominiums');

    if (requiresTwoFactor && challengeId && email) {
      navigate(
        `/login?requiresTwoFactor=true&challengeId=${encodeURIComponent(challengeId)}&email=${encodeURIComponent(email)}`,
        { replace: true }
      );
      return;
    }

    if (!token || !email || !name || role == null) {
      navigate('/login?error=external_auth_failed', { replace: true });
      return;
    }

    const authResponse: AuthResponse = {
      id: '', // Will be populated from JWT token after login
      token,
      email,
      name,
      role: Number(role) as UserRole,
      condominiumId: condominiumId || undefined,
      unitId: unitId || undefined,
      accessibleCondominiums: accessibleCondominiumsRaw
        ? accessibleCondominiumsRaw.split(',').filter(Boolean)
        : [],
      requiresTwoFactor: false,
    };

    login(authResponse);
    navigate('/dashboard', { replace: true });
  }, [login, navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-ink">{t('common.appName')}</h1>
        <div className="flex justify-center mt-4 text-ink-subtle">
          <Spinner label="Completing sign-in..." />
        </div>
      </div>
    </div>
  );
}