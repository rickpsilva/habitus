import { useState } from 'react';
import { UserCog } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { UserRole } from '../types';
import { useTranslation } from '../i18n/I18nProvider';
import { Button } from './ui';
import ConfirmModal from './ConfirmModal';

export function ImpersonationBanner() {
  const { impersonation, endImpersonation } = useAuth();
  const { error: toastError } = useToast();
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);

  if (!impersonation.isImpersonating) {
    return null;
  }

  const roleLabel = impersonation.impersonatedRole === UserRole.Admin
    ? t('role.admin')
    : t('role.resident');

  const handleConfirmEnd = async () => {
    try {
      await endImpersonation();
      setShowConfirm(false);
    } catch (err) {
      console.error('Failed to end impersonation:', err);
      toastError(t('impersonation.endFailed'));
    }
  };

  const expiryTime = impersonation.expiresAt
    ? new Date(parseInt(impersonation.expiresAt) * 1000).toLocaleTimeString()
    : null;

  return (
    <>
      <div
        className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm"
        role="alert"
        aria-live="polite"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-lg text-indigo-700"
              aria-hidden="true"
            >
              🎭
            </span>
            <div className="text-sm text-indigo-900">
              <p className="font-medium">
                {t('impersonation.activeAs')}{' '}
                <span className="font-semibold">{impersonation.impersonatedUserName}</span>
                <span className="ml-1 text-indigo-700">({roleLabel})</span>
              </p>
              {impersonation.condominiumName && (
                <p className="mt-0.5 text-indigo-800">
                  {t('impersonation.inCondominium')}{' '}
                  <span className="font-medium">{impersonation.condominiumName}</span>
                  {impersonation.unitIdentifier && (
                    <span className="ml-1">
                      — {t('impersonation.unitLabel')} {impersonation.unitIdentifier}
                    </span>
                  )}
                </p>
              )}
              {expiryTime && (
                <p className="mt-1 text-xs text-indigo-700">
                  {t('impersonation.expiresAt')} {expiryTime}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={UserCog}
            iconPosition="left"
            onClick={() => setShowConfirm(true)}
            className="shrink-0"
          >
            {t('impersonation.returnToManager')}
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={showConfirm}
        title={t('impersonation.confirmEndTitle')}
        message={t('impersonation.confirmEndMessage')}
        variant="warning"
        confirmLabel={t('impersonation.returnToManager')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleConfirmEnd}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}