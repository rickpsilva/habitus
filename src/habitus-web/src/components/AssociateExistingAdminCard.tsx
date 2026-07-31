import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { condominiumsApi, usersApi } from '../api/services';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n/I18nProvider';
import type { CondominiumDto } from '../types';
import { Card, CardHeader, CardBody, Button, Field, Input, Select } from './ui';

/**
 * Manager-only form to associate an already-registered user as Admin of a
 * condominium. Loads the manager's condominium list for the selector and calls
 * usersApi.associateExistingAdmin, surfacing the returned message via a toast.
 */
export default function AssociateExistingAdminCard() {
  const { t } = useTranslation();
  const { success: toastSuccess, info: toastInfo } = useToast();

  const [condominiums, setCondominiums] = useState<CondominiumDto[]>([]);
  const [email, setEmail] = useState('');
  const [condominiumId, setCondominiumId] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load the condominium options; only the deferred callback touches state.
  useEffect(() => {
    condominiumsApi
      .getAll()
      .then((res) => setCondominiums(res.data))
      .catch(() => {
        // Keep the selector empty if condominiums cannot be loaded.
      });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!condominiumId) {
      setFormError(t('associateAdmin.selectCondominium'));
      return;
    }
    setSubmitting(true);
    usersApi
      .associateExistingAdmin({ email: email.trim(), condominiumId })
      .then((res) => {
        if (res.data.wasAlreadyAdmin) {
          toastInfo(res.data.message);
        } else {
          toastSuccess(res.data.message);
        }
        setEmail('');
        setCondominiumId('');
      })
      .catch((err) => {
        const response = (err as { response?: { status?: number; data?: { error?: string } } }).response;
        if (response?.status === 404) {
          setFormError(t('associateAdmin.error.userNotFound'));
        } else {
          setFormError(response?.data?.error ?? t('associateAdmin.error.failed'));
        }
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-ink flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-600" />
          {t('associateAdmin.heading')}
        </h2>
        <p className="text-sm text-ink-subtle mt-1">{t('associateAdmin.description')}</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label={t('associateAdmin.emailLabel')} required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('associateAdmin.emailPlaceholder')}
              required
              disabled={submitting}
            />
          </Field>
          <Field label={t('associateAdmin.condominiumLabel')} required>
            <Select
              value={condominiumId}
              onChange={(e) => setCondominiumId(e.target.value)}
              disabled={submitting}
            >
              <option value="">{t('associateAdmin.condominiumPlaceholder')}</option>
              {condominiums.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          {formError && (
            <p className="sm:col-span-2 text-sm text-red-600" role="alert">
              {formError}
            </p>
          )}
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" icon={UserPlus} loading={submitting}>
              {submitting ? t('associateAdmin.submitting') : t('associateAdmin.submit')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
