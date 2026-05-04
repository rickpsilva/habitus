import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
              variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'
            }`}
          >
            <AlertTriangle
              className={`w-5 h-5 ${variant === 'danger' ? 'text-red-600' : 'text-amber-600'}`}
            />
          </div>
          <p className="text-gray-900 text-sm font-medium leading-snug">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 text-white text-sm font-semibold rounded-lg transition-colors ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
