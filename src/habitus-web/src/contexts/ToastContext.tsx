import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useTranslation } from '../i18n/I18nProvider';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const typeConfig: Record<
  ToastType,
  { icon: React.ElementType; border: string; iconColor: string; progress: string }
> = {
  success: {
    icon: CheckCircle2,
    border: 'border-l-green-500',
    iconColor: 'text-green-500',
    progress: 'bg-green-500',
  },
  error: {
    icon: XCircle,
    border: 'border-l-red-500',
    iconColor: 'text-red-500',
    progress: 'bg-red-500',
  },
  warning: {
    icon: AlertCircle,
    border: 'border-l-amber-500',
    iconColor: 'text-amber-500',
    progress: 'bg-amber-500',
  },
  info: {
    icon: Info,
    border: 'border-l-blue-500',
    iconColor: 'text-blue-500',
    progress: 'bg-blue-500',
  },
};

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const { t } = useTranslation();
  const { icon: Icon, border, iconColor } = typeConfig[item.type];
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 bg-surface rounded-xl shadow-lg border border-l-4 border-line ${border} px-4 py-3 min-w-[280px] max-w-sm`}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor}`} aria-hidden="true" />
      <p className="flex-1 text-sm font-medium text-ink">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={t('common.close')}
        className="text-ink-subtle hover:text-ink-muted transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType) => {
      const id = String(++counterRef.current);
      setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const success = useCallback((msg: string) => addToast(msg, 'success'), [addToast]);
  const error = useCallback((msg: string) => addToast(msg, 'error'), [addToast]);
  const warning = useCallback((msg: string) => addToast(msg, 'warning'), [addToast]);
  const info = useCallback((msg: string) => addToast(msg, 'info'), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, warning, info }}>
      {children}
      <div
        aria-live="polite"
        aria-label={t('toast.notifications')}
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <Toast key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
