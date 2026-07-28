import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3',
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        <AlertCircle className="w-4 h-4" aria-hidden="true" />
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}
