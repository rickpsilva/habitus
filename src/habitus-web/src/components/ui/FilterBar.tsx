import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

/* ------------------------------------------------------------------ */
/* FilterBar — responsive container for search + filters + actions.   */
/* ------------------------------------------------------------------ */

export interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
  );
}

/* ------------------------------------------------------------------ */
/* FilterChip — single toggleable filter (with optional count badge). */
/* ------------------------------------------------------------------ */

export interface FilterChipProps {
  label: string;
  active: boolean;
  count?: number;
  icon?: LucideIcon;
  onClick: () => void;
}

export function FilterChip({ label, active, count, icon: Icon, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors border',
        active
          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
          : 'bg-surface border-line text-ink-muted hover:bg-surface-hover',
      )}
    >
      {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
      {label}
      {typeof count === 'number' && (
        <span
          className={cn(
            'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-semibold',
            active ? 'bg-indigo-600 text-white' : 'bg-control text-ink-muted',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented — mutually-exclusive option toggle (e.g. view switcher).  */
/* ------------------------------------------------------------------ */

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  icon?: LucideIcon;
}

export interface SegmentedProps<V extends string> {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  ariaLabel?: string;
  className?: string;
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedProps<V>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-1 bg-control rounded-lg p-1', className)}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={selected}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              selected ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
