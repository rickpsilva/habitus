import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ChevronRight, Search } from 'lucide-react';
import { condominiumsApi } from '../api/services';
import type { CondominiumPublicDto } from '../types';
import { AsyncState, EmptyState } from '../components/ui';
import { useTranslation } from '../i18n/I18nProvider';

export default function SelectCondominiumPage() {
  const { t } = useTranslation();
  const [condominiums, setCondominiums] = useState<CondominiumPublicDto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadCondominiums = useCallback(() => {
    setLoading(true);
    setError('');
    condominiumsApi.getPublic()
      .then((r) => setCondominiums(r.data))
      .catch(() => setError(t('selectCondominium.error.load')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    loadCondominiums();
  }, [loadCondominiums]);

  const filtered = condominiums.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-ink">{t('common.appName')}</h1>
          <p className="text-ink-subtle mt-1">{t('common.appTagline')}</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-ink mb-2">{t('selectCondominium.title')}</h2>
          <p className="text-sm text-ink-subtle mb-6">
            {t('selectCondominium.subtitle')}
          </p>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
            <input
              type="text"
              placeholder={t('selectCondominium.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>

          <AsyncState
            loading={loading}
            error={error}
            onRetry={loadCondominiums}
            isEmpty={filtered.length === 0}
            skeleton="list"
            skeletonRows={4}
            empty={
              <EmptyState
                icon={Building2}
                title={t('selectCondominium.empty')}
                description={t('selectCondominium.emptyHint')}
              />
            }
          >
            <ul className="divide-y divide-line max-h-72 overflow-y-auto rounded-lg border border-line">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => navigate(`/user/register/${c.id}/resident`)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{c.name}</p>
                      <p className="text-xs text-ink-subtle">{c.address}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink-subtle flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </AsyncState>

          <p className="text-center text-sm text-ink-subtle mt-6">
            {t('selectCondominium.haveAccount')}{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              {t('selectCondominium.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
