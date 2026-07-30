import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned actions (e.g. primary buttons). */
  actions?: ReactNode;
  /** Typically a <SearchBar />. Rendered full width on mobile. */
  search?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, subtitle, actions, search, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="text-ink-subtle text-sm mt-0.5">{subtitle}</p>}
      </div>
      {(search || actions) && (
        <div className="flex w-full sm:w-auto items-center justify-end gap-3 flex-wrap sm:flex-nowrap">
          {search && <div className="w-full sm:w-80">{search}</div>}
          {actions}
        </div>
      )}
    </div>
  );
}
