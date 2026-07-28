import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 py-16 px-4 text-center text-gray-400 bg-white rounded-xl border border-gray-100',
        className,
      )}
    >
      <Icon className="w-12 h-12 opacity-30" aria-hidden="true" />
      <p className="text-sm font-medium text-gray-600">{title}</p>
      {description && <p className="text-sm max-w-sm">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
