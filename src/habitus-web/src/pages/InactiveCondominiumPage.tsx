import { Building2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n/I18nProvider';

export default function InactiveCondominiumPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-rose-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-surface rounded-2xl shadow-xl border border-amber-100 p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 shadow-lg mb-4">
          <AlertTriangle className="w-8 h-8 text-white" />
        </div>

        <div className="flex items-center justify-center gap-2 text-ink mb-2">
          <Building2 className="w-5 h-5" />
          <h1 className="text-2xl font-bold">{t('inactiveCondominium.title')}</h1>
        </div>

        <p className="text-ink-muted leading-relaxed">
          {t('inactiveCondominium.message')}
        </p>

        <p className="text-ink-muted leading-relaxed mt-3">
          {t('inactiveCondominium.contactAdmin')}
        </p>

        <div className="mt-7">
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
          >
            {t('inactiveCondominium.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}
