import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Building2, Mail, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { authApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n/I18nProvider';
import { Button } from '../components/ui';
import { getCookieConsent, setCookieConsent } from '../utils/cookieConsent';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(
    () => searchParams.get('requiresTwoFactor') === 'true' && !!searchParams.get('challengeId'),
  );
  const [challengeId, setChallengeId] = useState(() => searchParams.get('challengeId') ?? '');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState(() => {
    const socialError = searchParams.get('error');
    if (!socialError) return '';
    return ({
      external_auth_failed: t('login.errorExternalAuthFailed'),
      external_login_denied: t('login.errorExternalLoginDenied'),
      external_identity_incomplete: t('login.errorExternalIdentityIncomplete'),
      unsupported_provider: t('login.errorUnsupportedProvider'),
    } as Record<string, string>)[socialError] ?? t('login.errorSignInFailed');
  });
  const [loading, setLoading] = useState(false);
  // Lazy initializer reads localStorage once so the banner visibility does not
  // rely on a setState-in-effect (F5).
  const [showCookieBanner, setShowCookieBanner] = useState(
    () => getCookieConsent() === null,
  );
  const { login } = useAuth();
  const navigate = useNavigate();

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login({ email, password });
      if (data.requiresTwoFactor && data.challengeId) {
        setRequiresTwoFactor(true);
        setChallengeId(data.challengeId);
        setTwoFactorCode('');
        setUseRecoveryCode(false);
        return;
      }

      login(data);
      navigate(data.requiresContextSelection ? '/select-context' : '/dashboard');
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 429) {
        setError(t('login.errorRateLimit'));
      } else {
        setError(t('login.errorCredentials'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await authApi.completeTwoFactorLogin({
        challengeId,
        code: twoFactorCode,
        useRecoveryCode,
      });

      login(data);
      navigate(data.requiresContextSelection ? '/select-context' : '/dashboard');
    } catch {
      setError(useRecoveryCode ? t('login.2faInvalidRecovery') : t('login.2faInvalidCode'));
    } finally {
      setLoading(false);
    }
  };

  const startSocialLogin = (provider: 'google' | 'microsoft') => {
    window.location.href = `/api/platform/auth/external/${provider}/start`;
  };

  const resetTwoFactorState = () => {
    setRequiresTwoFactor(false);
    setChallengeId('');
    setTwoFactorCode('');
    setUseRecoveryCode(false);
    setError('');
    navigate('/login', { replace: true });
  };

  const handleCookieDecision = (value: 'accepted' | 'rejected') => {
    setCookieConsent(value);
    setShowCookieBanner(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-ink">Habitus</h1>
          <p className="text-ink-subtle mt-1">{t('common.appTagline')}</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-ink mb-6">
            {requiresTwoFactor ? t('login.twoFactorTitle') : t('login.title')}
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          {!requiresTwoFactor ? (
            <>
              <form onSubmit={handlePasswordLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1.5">{t('login.email')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      placeholder={t('login.emailPlaceholder')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1.5">{t('login.password')}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink-muted"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-right mt-2">
                    <Link to="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                      {t('login.forgotPassword')}
                    </Link>
                  </div>
                </div>

                <Button type="submit" loading={loading} fullWidth>
                  {loading ? t('login.submitting') : t('login.submit')}
                </Button>
              </form>

              <div className="mt-6">
                <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-subtle mb-4">
                  <div className="h-px flex-1 bg-line" />
                  <span>{t('login.orContinue')}</span>
                  <div className="h-px flex-1 bg-line" />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    onClick={() => startSocialLogin('google')}
                    className="border border-line text-ink"
                  >
                    {t('login.continueGoogle')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    onClick={() => startSocialLogin('microsoft')}
                    className="border border-line text-ink"
                  >
                    {t('login.continueMicrosoft')}
                  </Button>
                </div>
              </div>

              <p className="text-center text-sm text-ink-subtle mt-6">
                {t('login.noAccount')}{' '}
                <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">
                  {t('login.register')}
                </Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleTwoFactorLogin} className="space-y-5">
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 flex gap-3">
                <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{t('login.2faVerificationTitle')}</p>
                  <p className="text-indigo-600 mt-1">{t('login.2faVerificationDescription')}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1.5">
                  {useRecoveryCode ? t('login.2faRecoveryCode') : t('login.2faAuthCode')}
                </label>
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm tracking-widest"
                  placeholder={useRecoveryCode ? 'ABCDE-12345' : '123456'}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={useRecoveryCode}
                  onChange={(e) => setUseRecoveryCode(e.target.checked)}
                  className="rounded border-line text-indigo-600 focus:ring-indigo-500"
                />
                {t('login.2faUseRecovery')}
              </label>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetTwoFactorState}
                  className="flex-1 border border-line text-ink hover:bg-surface-hover"
                >
                  {t('login.2faBack')}
                </Button>
                <Button type="submit" loading={loading} className="flex-1">
                  {loading ? t('login.2faVerifying') : t('login.2faVerify')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {showCookieBanner && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4">
          <div className="mx-auto max-w-3xl bg-surface border border-line rounded-xl shadow-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-muted">
              {t('cookie.message')}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="border border-line text-ink"
                onClick={() => handleCookieDecision('rejected')}
              >
                {t('cookie.reject')}
              </Button>
              <Button size="sm" onClick={() => handleCookieDecision('accepted')}>
                {t('cookie.accept')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
