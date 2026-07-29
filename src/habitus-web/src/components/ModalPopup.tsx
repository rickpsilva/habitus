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
  const fallbackTitle = title?.trim() || 'Detalhes';

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
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`bg-surface rounded-xl shadow-xl w-full ${maxWidthClass} max-h-[92vh] overflow-hidden flex flex-col`}>
        {header ? (
          header
        ) : (
          <div className="sticky top-0 z-10 bg-surface border-b border-line px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">{fallbackTitle}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5 text-ink-subtle" />
            </button>
          </div>
        )}

        <div className={`${bodyClassName} app-scrollbar overflow-y-auto`}>{children}</div>
      </div>
    </div>
  );
}