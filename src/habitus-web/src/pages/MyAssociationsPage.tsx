import { useCallback, useEffect, useState } from 'react';
import { Building2, Send, Link2 } from 'lucide-react';
import { associationApi, condominiumsApi } from '../api/services';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n/I18nProvider';
import {
  AssociationRequestStatus,
  AssociationRequestedRole,
  AssociationRequestSource,
} from '../types';
import type {
  AssociationRequestResponseDto,
  CondominiumPublicDto,
} from '../types';
import type { BadgeVariant } from '../components/ui';
import type { TranslationKey } from '../i18n/types';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  Field,
  Select,
  Spinner,
  EmptyState,
  ErrorState,
} from '../components/ui';

// Maps the integer request status to a colored badge + label key.
function statusMeta(status: number): { variant: BadgeVariant; labelKey: TranslationKey } {
  switch (status) {
    case AssociationRequestStatus.Approved:
      return { variant: 'success', labelKey: 'association.status.approved' };
    case AssociationRequestStatus.Rejected:
      return { variant: 'danger', labelKey: 'association.status.rejected' };
    case AssociationRequestStatus.Cancelled:
      return { variant: 'neutral', labelKey: 'association.status.cancelled' };
    default:
      return { variant: 'warning', labelKey: 'association.status.pending' };
  }
}

export default function MyAssociationsPage() {
  const { t, formatDateTime } = useTranslation();
  const { success: toastSuccess } = useToast();

  const [condominiums, setCondominiums] = useState<CondominiumPublicDto[]>([]);
  const [requests, setRequests] = useState<AssociationRequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [targetCondominiumId, setTargetCondominiumId] = useState('');
  const [requestedRole, setRequestedRole] = useState<number>(AssociationRequestedRole.Resident);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError('');
    Promise.all([condominiumsApi.getPublic(), associationApi.getMy()])
      .then(([condosRes, requestsRes]) => {
        setCondominiums(condosRes.data);
        setRequests(requestsRes.data);
      })
      .catch(() => {
        setLoadError(t('myAssociations.error.load'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [t]);

  // Initial load: only deferred promise callbacks touch state (avoids a
  // synchronous setState in the effect body).
  useEffect(() => {
    Promise.all([condominiumsApi.getPublic(), associationApi.getMy()])
      .then(([condosRes, requestsRes]) => {
        setCondominiums(condosRes.data);
        setRequests(requestsRes.data);
      })
      .catch(() => {
        setLoadError(t('myAssociations.error.load'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [t]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!targetCondominiumId) {
      setFormError(t('myAssociations.selectCondominium'));
      return;
    }
    setSubmitting(true);
    associationApi
      .create({
        targetCondominiumId,
        requestedRole,
        source: AssociationRequestSource.Manual,
      })
      .then((res) => {
        toastSuccess(t('myAssociations.submitted'));
        setRequests((prev) => [res.data, ...prev]);
        setTargetCondominiumId('');
        setRequestedRole(AssociationRequestedRole.Resident);
      })
      .catch((err) => {
        const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
        if (code === 'already_associated') {
          setFormError(t('association.error.alreadyAssociated'));
        } else if (code === 'already_pending') {
          setFormError(t('association.error.alreadyPending'));
        } else {
          setFormError(t('myAssociations.error.submit'));
        }
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  const condominiumName = (id: string) => condominiums.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <PageHeader title={t('myAssociations.title')} subtitle={t('myAssociations.subtitle')} />

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-600" />
            {t('myAssociations.newRequestHeading')}
          </h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label={t('myAssociations.condominiumLabel')} required>
              <Select
                value={targetCondominiumId}
                onChange={(e) => setTargetCondominiumId(e.target.value)}
                disabled={submitting}
              >
                <option value="">{t('myAssociations.condominiumPlaceholder')}</option>
                {condominiums.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('myAssociations.roleLabel')} required>
              <Select
                value={String(requestedRole)}
                onChange={(e) => setRequestedRole(Number(e.target.value))}
                disabled={submitting}
              >
                <option value={String(AssociationRequestedRole.Resident)}>{t('role.resident')}</option>
                <option value={String(AssociationRequestedRole.Admin)}>{t('role.admin')}</option>
              </Select>
            </Field>
            {formError && (
              <p className="sm:col-span-2 text-sm text-red-600" role="alert">
                {formError}
              </p>
            )}
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" icon={Send} loading={submitting}>
                {submitting ? t('myAssociations.submitting') : t('myAssociations.submit')}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div>
        <h2 className="text-base font-semibold text-ink mb-3">{t('myAssociations.listHeading')}</h2>
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={reload} />
        ) : requests.length === 0 ? (
          <EmptyState icon={Link2} title={t('myAssociations.empty')} />
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const meta = statusMeta(r.status);
              return (
                <Card key={r.id}>
                  <CardBody className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-ink-subtle shrink-0" />
                        {condominiumName(r.targetCondominiumId)}
                      </p>
                      <p className="text-sm text-ink-subtle mt-1">
                        {r.requestedRole === AssociationRequestedRole.Admin
                          ? t('role.admin')
                          : t('role.resident')}
                        {' · '}
                        {t('myAssociations.requestedAt')}: {formatDateTime(r.requestedAt)}
                      </p>
                    </div>
                    <Badge variant={meta.variant}>{t(meta.labelKey)}</Badge>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
