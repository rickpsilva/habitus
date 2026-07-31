import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from '../i18n/I18nProvider';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  if (!open) return null;

  const resolvedConfirm = confirmLabel ?? t('common.confirm');
  const resolvedCancel = cancelLabel ?? t('common.cancel');

  const iconBg =
    variant === 'danger'
      ? 'bg-red-100'
      : variant === 'warning'
        ? 'bg-amber-100'
        : 'bg-indigo-100';

  const iconColor =
    variant === 'danger'
      ? 'text-red-600'
      : variant === 'warning'
        ? 'text-amber-600'
        : 'text-indigo-600';

  const confirmBtn =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : variant === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700 text-white'
        : 'bg-indigo-600 hover:bg-indigo-700 text-white';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-surface rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-start gap-4">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${iconBg}`}>
            <AlertTriangle className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 id="confirm-title" className="font-semibold text-ink">{title}</h3>
            <p className="text-sm text-ink-subtle mt-1">{message}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('common.close')}
            className="text-ink-subtle hover:text-ink-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-ink bg-surface border border-line rounded-lg hover:bg-surface-hover transition-colors"
          >
            {resolvedCancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${confirmBtn}`}
          >
            {resolvedConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
