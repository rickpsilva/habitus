import type { ElementType } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface StatCardTrend {
  /** Signed percentage/delta value. Sign drives the up/down styling. */
  value: number;
  /** Optional label shown next to the delta (e.g. "vs. mês anterior"). */
  label?: string;
  /** When true, a positive delta is shown as negative-intent (e.g. costs). */
  invertColor?: boolean;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: ElementType;
  /** Tailwind classes for the icon chip background/text (brand color). */
  color: string;
  /** When set, the whole card becomes a navigation Link. */
  to?: string;
  subtitle?: string;
  loading?: boolean;
  /** Optional trend indicator (delta with up/down arrow). */
  trend?: StatCardTrend;
  className?: string;
}

/**
 * StatCard — shared KPI card, promoted from DashboardPage. Renders as a Link
 * when `to` is provided, otherwise as a static card. Optionally shows a trend
 * delta. The default visual matches the previous DashboardPage StatCard.
 */
export default function StatCard({
  title,
  value,
  icon: Icon,
  color,
  to,
  subtitle,
  loading,
  trend,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <div
        className={cn(
          'bg-surface rounded-xl p-5 shadow-sm border border-line flex items-center gap-4 animate-pulse',
          className,
        )}
      >
        <div className="w-12 h-12 rounded-xl bg-surface-hover shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-surface-hover rounded w-3/4" />
          <div className="h-6 bg-surface-hover rounded w-1/2" />
        </div>
      </div>
    );
  }

  const positive = trend ? trend.value >= 0 : false;
  const goodTrend = trend?.invertColor ? !positive : positive;
  const TrendIcon = positive ? TrendingUp : TrendingDown;

  const content = (
    <>
      <div className={cn('flex items-center justify-center w-12 h-12 rounded-xl', color)}>
        <Icon className="w-6 h-6" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-ink-subtle leading-tight">{title}</p>
        <p className="text-2xl font-bold text-ink">{value}</p>
        {trend && (
          <p
            className={cn(
              'text-xs mt-0.5 flex items-center gap-1 leading-tight',
              goodTrend ? 'text-green-600' : 'text-red-600',
            )}
          >
            <TrendIcon className="w-3 h-3" aria-hidden="true" />
            <span>
              {positive ? '+' : ''}
              {trend.value}%
            </span>
            {trend.label && <span className="text-ink-subtle">{trend.label}</span>}
          </p>
        )}
        {subtitle && <p className="text-xs text-ink-subtle mt-0.5 leading-tight">{subtitle}</p>}
      </div>
    </>
  );

  const baseClass = cn(
    'bg-surface rounded-xl p-5 shadow-sm border border-line flex items-center gap-4',
    className,
  );

  if (to) {
    return (
      <Link to={to} className={cn(baseClass, 'hover:shadow-md transition-shadow')}>
        {content}
      </Link>
    );
  }

  return <div className={baseClass}>{content}</div>;
}
