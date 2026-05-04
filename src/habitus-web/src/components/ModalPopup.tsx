import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalPopupProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  header?: ReactNode;
  children: ReactNode;
  maxWidthClass?: string;
  bodyClassName?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

export default function ModalPopup({
  open,
  onClose,
  title,
  header,
  children,
  maxWidthClass = 'max-w-md',
  bodyClassName = 'p-6',
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalPopupProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`bg-white rounded-xl shadow-xl w-full ${maxWidthClass} max-h-[92vh] overflow-y-auto`}>
        {header ? (
          header
        ) : (
          (title || closeOnBackdrop) && (
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          )
        )}

        <div className={bodyClassName}>{children}</div>
      </div>
    </div>
  );
}