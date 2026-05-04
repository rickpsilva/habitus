import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

let idCounter = 0;

const toastConfig: Record<ToastType, { icon: React.ElementType; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'bg-green-50 border-green-200 text-green-800' },
  error: { icon: XCircle, classes: 'bg-red-50 border-red-200 text-red-800' },
  warning: { icon: AlertTriangle, classes: 'bg-amber-50 border-amber-200 text-amber-800' },
  info: { icon: Info, classes: 'bg-blue-50 border-blue-200 text-blue-800' },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { icon: Icon, classes } = toastConfig[toast.type];
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto max-w-sm w-full ${classes}`}
      role="alert"
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
