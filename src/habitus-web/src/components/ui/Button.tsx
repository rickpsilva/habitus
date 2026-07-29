import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import Spinner from './Spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children?: ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  secondary: 'bg-control hover:bg-control-hover text-ink',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  warning: 'bg-amber-600 hover:bg-amber-700 text-white',
  ghost: 'bg-transparent hover:bg-control text-ink',
};

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

const iconSize: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const renderIcon = () => {
    if (loading) return <Spinner size="sm" />;
    if (Icon) return <Icon className={iconSize[size]} aria-hidden="true" />;
    return null;
  };

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {iconPosition === 'left' && renderIcon()}
      {children}
      {iconPosition === 'right' && !loading && renderIcon()}
    </button>
  );
}
