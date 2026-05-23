import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Building2, Mail, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { authApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const socialError = searchParams.get('error');
    const needsTwoFactor = searchParams.get('requiresTwoFactor') === 'true';
    const challenge = searchParams.get('challengeId');
    const callbackEmail = searchParams.get('email');

    if (callbackEmail) {
      setEmail(callbackEmail);
    }

    if (needsTwoFactor && challenge) {
      setRequiresTwoFactor(true);
      setChallengeId(challenge);
      setPassword('');
    }

    if (socialError) {
      const mappedError = {
        external_auth_failed: 'External authentication failed. Please try again.',
        external_login_denied: 'This account is not allowed to sign in with the selected provider.',
        external_identity_incomplete: 'The external provider did not return a valid email address.',
        unsupported_provider: 'The selected provider is not supported.',
      }[socialError] ?? 'Unable to complete sign-in.';

      setError(mappedError);
    }
  }, [searchParams]);

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
      navigate('/dashboard');
    } catch {
      setError('Email ou password incorretos.');
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
      navigate('/dashboard');
    } catch {
      setError(useRecoveryCode ? 'Invalid recovery code.' : 'Invalid authentication code.');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Habitus</h1>
          <p className="text-gray-500 mt-1">Gestão de Condomínio</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {requiresTwoFactor ? 'Two-Factor Authentication' : 'Iniciar Sessão'}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      placeholder="o.seu@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-right mt-2">
                    <Link to="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                      Esqueceu a password?
                    </Link>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  {loading ? 'A entrar...' : 'Entrar'}
                </button>
              </form>

              <div className="mt-6">
                <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-gray-400 mb-4">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span>or continue with</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => startSocialLogin('google')}
                    className="w-full py-2.5 px-4 border border-gray-300 hover:border-gray-400 text-gray-800 font-medium rounded-lg transition-colors text-sm"
                  >
                    Continue with Google
                  </button>
                  <button
                    type="button"
                    onClick={() => startSocialLogin('microsoft')}
                    className="w-full py-2.5 px-4 border border-gray-300 hover:border-gray-400 text-gray-800 font-medium rounded-lg transition-colors text-sm"
                  >
                    Continue with Microsoft
                  </button>
                </div>
              </div>

              <p className="text-center text-sm text-gray-500 mt-6">
                Não tem conta?{' '}
                <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">
                  Registar
                </Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleTwoFactorLogin} className="space-y-5">
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 flex gap-3">
                <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Additional verification required</p>
                  <p className="text-indigo-600 mt-1">Enter the code from your authenticator app or use a recovery code.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {useRecoveryCode ? 'Recovery Code' : 'Authentication Code'}
                </label>
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm tracking-widest"
                  placeholder={useRecoveryCode ? 'ABCDE-12345' : '123456'}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={useRecoveryCode}
                  onChange={(e) => setUseRecoveryCode(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Use recovery code instead
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetTwoFactorState}
                  className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg transition-colors text-sm hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  {loading ? 'A verificar...' : 'Verificar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
