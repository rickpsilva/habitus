import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ExternalLink, BookOpen } from 'lucide-react';
import { meApi } from '../api/services';
import { AsyncState, Button } from '../components/ui';
import ModalPopup from '../components/ModalPopup';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/types';
import { ConsentDecision } from '../types';
import type { ConsentItem } from '../types';

// Per-key i18n overrides for well-known consents. Unknown keys fall back to the
// DB-provided title/description.
const consentDescriptionKeys: Record<string, TranslationKey> = {
  terms: 'consent.descTerms',
  privacy: 'consent.descPrivacy',
};

const consentTitleKeys: Record<string, TranslationKey> = {
  terms: 'consent.terms.title',
  privacy: 'consent.privacy.title',
};

export default function ConsentRequiredPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const describe = (consent: ConsentItem): string => {
    const key = consentDescriptionKeys[consent.key];
    return key ? t(key) : t('consent.descDefault');
  };

  const titleFor = (consent: ConsentItem): string => {
    const key = consentTitleKeys[consent.key];
    return key ? t(key) : consent.title;
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<ConsentItem[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [detailConsent, setDetailConsent] = useState<ConsentItem | null>(null);

  useEffect(() => {
    meApi
      .getConsents()
      .then((res) => {
        if (res.data.allMandatoryAccepted) {
          navigate('/dashboard', { replace: true });
          return;
        }
        const missing = res.data.consents.filter(
          (c) => c.isMandatory && c.decision !== ConsentDecision.Accepted,
        );
        setPending(missing);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        setError(t('consent.errorLoad'));
        setLoading(false);
      });
  }, [navigate, reloadKey, t]);

  const allChecked = pending.length > 0 && pending.every((c) => checked[c.key]);

  const toggle = (key: string) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAccept = () => {
    setSubmitting(true);
    setSubmitError(null);
    Promise.all(
      pending.map((c) =>
        meApi.recordConsent({ key: c.key, version: c.version, accepted: true }),
      ),
    )
      .then((responses) => {
        const last = responses[responses.length - 1];
        if (last?.data.allMandatoryAccepted) {
          navigate('/dashboard', { replace: true });
        } else {
          setSubmitError(t('consent.errorStillPending'));
          setReloadKey((k) => k + 1);
        }
        setSubmitting(false);
      })
      .catch(() => {
        setSubmitError(t('consent.errorRecord'));
        setSubmitting(false);
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-surface rounded-2xl shadow-xl border border-line p-6 sm:p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink">{t('consent.requiredTitle')}</h1>
          <p className="text-ink-muted leading-relaxed mt-2">
            {t('consent.requiredSubtitle')}
          </p>
        </div>

        <div className="mt-6">
          <AsyncState
            loading={loading}
            error={error}
            onRetry={() => {
              setLoading(true);
              setError(null);
              setReloadKey((k) => k + 1);
            }}
            skeleton="list"
            skeletonRows={2}
          >
            <div className="space-y-3">
              {pending.map((consent) => (
                <label
                  key={consent.key}
                  className="flex items-start gap-3 p-4 border border-line rounded-lg bg-surface hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!checked[consent.key]}
                    onChange={() => toggle(consent.key)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-line text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{titleFor(consent)}</p>
                    <p className="text-sm text-ink-muted mt-1">{describe(consent)}</p>
                    {consent.body ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          setDetailConsent(consent);
                        }}
                        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 mt-2"
                      >
                        {t('consent.readDetails')}
                        <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    ) : consent.url ? (
                      <a
                        href={consent.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 mt-2"
                      >
                        {t('consent.readDetails')}
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </label>
              ))}
            </div>

            {submitError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {submitError}
              </div>
            )}

            <div className="mt-6">
              <Button
                fullWidth
                onClick={handleAccept}
                loading={submitting}
                disabled={!allChecked}
              >
                {t('consent.acceptContinue')}
              </Button>
            </div>
          </AsyncState>
        </div>
      </div>

      <ModalPopup
        open={detailConsent !== null}
        onClose={() => setDetailConsent(null)}
        title={detailConsent ? titleFor(detailConsent) : t('consent.detailsTitle')}
        maxWidthClass="max-w-2xl"
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-muted">
          {detailConsent?.body}
        </div>
      </ModalPopup>
    </div>
  );
}
