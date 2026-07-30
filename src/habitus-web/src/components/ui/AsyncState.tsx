import type { ReactNode } from 'react';
import Skeleton from './Skeleton';
import type { SkeletonProps } from './Skeleton';
import ErrorState from './ErrorState';

export interface AsyncStateProps {
  loading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  onRetry?: () => void;
  /** Skeleton variant shown while loading. Defaults to 'list'. */
  skeleton?: SkeletonProps['variant'];
  skeletonRows?: number;
  /** Rendered when not loading, no error and `isEmpty` is true. */
  empty?: ReactNode;
  children: ReactNode;
}

/**
 * Single source of truth for async UI states.
 * Precedence: loading -> Skeleton, error -> ErrorState, isEmpty -> empty, else children.
 */
export default function AsyncState({
  loading,
  error,
  isEmpty,
  onRetry,
  skeleton = 'list',
  skeletonRows,
  empty,
  children,
}: AsyncStateProps) {
  if (loading) {
    return <Skeleton variant={skeleton} rows={skeletonRows} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (isEmpty) {
    return <>{empty}</>;
  }

  return <>{children}</>;
}
