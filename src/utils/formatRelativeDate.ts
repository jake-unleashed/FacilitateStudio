/**
 * Time constants for relative date formatting (in milliseconds).
 */
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/**
 * Formats an ISO date string to a human-readable relative time.
 *
 * @param dateString - ISO 8601 date string
 * @returns Formatted relative time string (e.g., "Just now", "5m ago", "2d ago")
 *
 * @example
 * ```ts
 * formatRelativeDate(new Date().toISOString()) // "Just now"
 * formatRelativeDate(new Date(Date.now() - 300000).toISOString()) // "5m ago"
 * ```
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const diffMins = Math.floor(diffMs / MS_PER_MINUTE);
  const diffHours = Math.floor(diffMs / MS_PER_HOUR);
  const diffDays = Math.floor(diffMs / MS_PER_DAY);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
