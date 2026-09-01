import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Mail, ArrowLeft } from 'lucide-react';
import { authApi } from '../api/services';
import { Button } from '../components/ui';
import { useTranslation } from '../i18n/I18nProvider';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSuccess(t('forgotPassword.success'));
      setEmail('');
    } catch {
      setError(t('forgotPassword.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-ink">{t('common.appName')}</h1>
          <p className="text-ink-subtle mt-1">{t('forgotPassword.subtitle')}</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-ink mb-2">{t('login.forgotPassword')}</h2>
          <p className="text-ink-muted text-sm mb-6">
            {t('forgotPassword.description')}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-600 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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

            <Button type="submit" loading={loading} fullWidth>
              {loading ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
            </Button>
          </form>

          <div className="flex items-center justify-center mt-6">
            <Link to="/login" className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              <ArrowLeft className="w-4 h-4" />
              {t('forgotPassword.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
