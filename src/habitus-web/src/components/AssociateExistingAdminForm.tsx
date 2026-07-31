import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { usersApi } from '../api/services';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n/I18nProvider';
import { Button, Field, Input } from './ui';

interface AssociateExistingAdminFormProps {
  condominiumId: string;
  condominiumName: string;
}

/**
 * Manager-only form to associate an already-registered user as Admin of a
 * fixed condominium (passed in via props). Calls usersApi.associateExistingAdmin,
 * surfacing the returned message via a toast.
 */
export default function AssociateExistingAdminForm({ condominiumId, condominiumName }: AssociateExistingAdminFormProps) {
  const { t } = useTranslation();
  const { success: toastSuccess, info: toastInfo } = useToast();

  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-ink-subtle">{t('associateAdmin.description', { condominiumName })}</p>
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
      {formError && (
        <p className="text-sm text-red-600" role="alert">
          {formError}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" icon={UserPlus} loading={submitting}>
          {submitting ? t('associateAdmin.submitting') : t('associateAdmin.submit')}
        </Button>
      </div>
    </form>
  );
}
