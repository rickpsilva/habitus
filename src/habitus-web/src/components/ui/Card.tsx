import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface CardProps {
  children: ReactNode;
  className?: string;
  /** Adds hover elevation (useful for clickable cards). */
  interactive?: boolean;
}

/**
 * Card — the shared surface primitive. Encapsulates the recurring
 * `bg-surface rounded-xl border border-line shadow-sm` pattern so surfaces
 * share a single elevation/radius definition. Adoption is incremental.
 */
export function Card({ children, className, interactive = false }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface rounded-xl border border-line shadow-sm',
        interactive && 'transition-shadow hover:shadow-md',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface CardSectionProps {
  children: ReactNode;
  className?: string;
}

/** Header row of a Card (title/actions). Bottom border divides from the body. */
export function CardHeader({ children, className }: CardSectionProps) {
  return (
    <div className={cn('px-5 py-4 border-b border-line', className)}>{children}</div>
  );
}

/** Main content region of a Card. */
export function CardBody({ children, className }: CardSectionProps) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

/** Footer region of a Card (actions/summary). Top border divides from the body. */
export function CardFooter({ children, className }: CardSectionProps) {
  return (
    <div className={cn('px-5 py-4 border-t border-line', className)}>{children}</div>
  );
}
