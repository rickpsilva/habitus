/**
 * Minimal className combiner. Filters out falsy values and joins with a space.
 * Keeps the bundle dependency-free (no clsx/cva).
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
