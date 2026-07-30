import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export type BadgeVariant =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'attention'
  | 'danger'
  | 'brand';

export interface BadgeProps {
  /** Semantic status color. Mirrors the inline pill colors used across pages. */
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  /** Optional leading icon. */
  icon?: LucideIcon;
  /** Show a small leading status dot instead of an icon. */
  dot?: boolean;
  className?: string;
  children?: ReactNode;
}

/* Color pairs intentionally match the existing inline badges (e.g.
   `bg-green-100 text-green-700`) so migrated pages keep the same look.
   Dark mode is handled by the colored-tint compat layer in index.css. */
const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-control text-ink-muted',
  info: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  attention: 'bg-orange-100 text-orange-700',
  danger: 'bg-red-100 text-red-700',
  brand: 'bg-indigo-100 text-indigo-700',
};

const sizes: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

const iconSizes: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
};

/**
 * Badge / StatusPill — a small, rounded status label with semantic color
 * variants. Centralizes the status-pill pattern that was previously duplicated
 * as inline colored utilities across pages, keeping identical colors/labels.
 */
export default function Badge({
  variant = 'neutral',
  size = 'sm',
  icon: Icon,
  dot = false,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />}
      {Icon && <Icon className={iconSizes[size]} aria-hidden="true" />}
      {children}
    </span>
  );
}
