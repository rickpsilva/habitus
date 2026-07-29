import { cn } from '../../lib/cn';

export interface SkeletonProps {
  variant?: 'text' | 'card' | 'list' | 'table';
  /** Number of repeated rows/blocks. */
  rows?: number;
  /** Number of columns — only used by the `table` variant. */
  columns?: number;
  className?: string;
}

function Line({ className }: { className?: string }) {
  return <div className={cn('bg-surface-hover rounded animate-pulse', className)} />;
}

export default function Skeleton({ variant = 'list', rows = 4, columns = 4, className }: SkeletonProps) {
  if (variant === 'text') {
    return (
      <div className={cn('space-y-2', className)} aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <Line key={i} className={cn('h-3.5', i === rows - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <tbody aria-hidden="true">
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r} className="border-b border-line">
            {Array.from({ length: columns }).map((_, c) => (
              <td key={c} className="px-4 py-3">
                <Line className="h-3.5 w-full" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  }

  // 'list' and 'card' share a card-based shell.
  return (
    <div className={cn('space-y-3', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-surface rounded-xl border border-line p-4 flex gap-3">
          <div className="w-9 h-9 rounded-full bg-surface-hover shrink-0 animate-pulse" />
          <div className="flex-1 space-y-2">
            <Line className="h-3.5 w-2/3" />
            <Line className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
