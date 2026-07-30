import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional custom illustration rendered instead of the default icon. */
  illustration?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  illustration,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 py-16 px-4 text-center text-ink-subtle bg-surface rounded-xl border border-line',
        className,
      )}
    >
      {illustration ? (
        <div className="mb-1" aria-hidden="true">{illustration}</div>
      ) : (
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-surface-hover">
          <Icon className="w-8 h-8 opacity-40" aria-hidden="true" />
        </div>
      )}
      <p className="text-sm font-medium text-ink-muted">{title}</p>
      {description && <p className="text-sm max-w-sm">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
