import type { ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { PaginatedResponse } from '../../types';
import Pagination from '../Pagination';
import AsyncState from './AsyncState';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Hide this column entirely (also on the mobile card). */
  hideOnMobile?: boolean;
  /** Label used as the field name inside the stacked mobile card. */
  mobileLabel?: string;
  /** Enable a clickable sort control on this column header. */
  sortable?: boolean;
  /** Key reported to onSort when this header is clicked (defaults to `key`). */
  sortKey?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyState?: ReactNode;
  pagination?: PaginatedResponse<unknown>;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  /** Current sort key (controlled). Matches a column's `sortKey` or `key`. */
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  /** Called with the column's sortKey/key when a sortable header is clicked. */
  onSort?: (key: string) => void;
  /** Optional totals/footer row rendered inside <tfoot> on desktop. Provide <tr>...<td>. */
  footer?: ReactNode;
  /** Optional totals card rendered after the stacked cards on mobile. */
  mobileFooter?: ReactNode;
  className?: string;
}

const alignClass: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

const justifyClass: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'justify-start',
  right: 'justify-end',
  center: 'justify-center',
};

function SortIcon({ active, direction }: { active: boolean; direction?: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="w-3.5 h-3.5 text-ink-subtle" aria-hidden="true" />;
  return direction === 'asc' ? (
    <ArrowUp className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
  ) : (
    <ArrowDown className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
  );
}

function cellValue<T>(col: Column<T>, row: T): ReactNode {
  if (col.render) return col.render(row);
  return (row as Record<string, unknown>)[col.key] as ReactNode;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  onRetry,
  emptyState,
  pagination,
  currentPage,
  onPageChange,
  onRowClick,
  sortBy,
  sortDirection,
  onSort,
  footer,
  mobileFooter,
  className,
}: DataTableProps<T>) {
  const empty = emptyState ?? <EmptyState title="Sem resultados" />;
  const hasRows = !loading && !error && rows.length > 0;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Desktop / tablet: real table */}
      <div className="hidden sm:block bg-surface rounded-xl border border-line overflow-x-auto app-scrollbar">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted border-b border-line">
            <tr>
              {columns.map((col) => {
                const key = col.sortKey ?? col.key;
                const sortable = Boolean(col.sortable && onSort);
                const active = sortable && sortBy === key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'px-4 py-3 font-semibold text-ink-muted whitespace-nowrap',
                      alignClass[col.align ?? 'left'],
                      col.className,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort?.(key)}
                        className={cn(
                          'inline-flex items-center gap-1.5 font-semibold hover:text-ink transition-colors',
                          justifyClass[col.align ?? 'left'],
                        )}
                      >
                        {col.header}
                        <SortIcon active={active} direction={sortDirection} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          {loading ? (
            <Skeleton variant="table" rows={5} columns={columns.length} />
          ) : error || rows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <AsyncState loading={false} error={error} isEmpty={rows.length === 0} onRetry={onRetry} empty={empty}>
                    <></>
                  </AsyncState>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-line last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-surface-muted',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-4 py-3 text-ink', alignClass[col.align ?? 'left'], col.className)}
                    >
                      {cellValue(col, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
          {footer && hasRows && (
            <tfoot className="bg-surface-muted border-t border-line font-semibold text-ink">
              {footer}
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="sm:hidden">
        <AsyncState
          loading={loading}
          error={error}
          isEmpty={rows.length === 0}
          onRetry={onRetry}
          skeleton="card"
          empty={empty}
        >
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'bg-surface rounded-xl border border-line p-4 space-y-2',
                  onRowClick && 'cursor-pointer active:bg-surface-muted',
                )}
              >
                {columns
                  .filter((col) => !col.hideOnMobile)
                  .map((col) => (
                    <div key={col.key} className="flex items-start justify-between gap-3">
                      <span className="text-xs font-medium text-ink-subtle shrink-0">
                        {col.mobileLabel ?? (typeof col.header === 'string' ? col.header : '')}
                      </span>
                      <span className="text-sm text-ink text-right min-w-0">{cellValue(col, row)}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </AsyncState>
        {mobileFooter && hasRows && <div className="mt-3">{mobileFooter}</div>}
      </div>

      {pagination && currentPage !== undefined && onPageChange && !loading && !error && rows.length > 0 && (
        <Pagination pagination={pagination} currentPage={currentPage} onPageChange={onPageChange} />
      )}
    </div>
  );
}
