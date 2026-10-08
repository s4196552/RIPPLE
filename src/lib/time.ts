/** Compact relative timestamps for feed cards: `12m`, `4h`, `3d`, `Mar 14`. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const delta = now - timestamp;

  if (delta < 0) return 'now';
  if (delta < MINUTE) return `${Math.max(1, Math.floor(delta / 1000))}s`;
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d`;

  // UTC, to agree with the feed's day headers (`dayStartOf` in digest.ts). In
  // local time a card east of UTC printed "Sep 25" under a "Thu 24 Sep" header,
  // and a date-only filing west of UTC printed the day before it was published.
  const date = new Date(timestamp);
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const sameYear = date.getUTCFullYear() === new Date(now).getUTCFullYear();
  return sameYear
    ? `${month} ${date.getUTCDate()}`
    : `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** Full timestamp for the account-detail header and accessibility labels. */
const SPOKEN_UNITS: Record<string, string> = {
  s: 'second',
  m: 'minute',
  h: 'hour',
  d: 'day',
};

/**
 * Screen-reader phrasing for a timestamp.
 *
 * `relativeTime` is built for a cramped card corner: it returns a compact token
 * (`12m`, `3d`) inside a week and a calendar date beyond it. Appending "ago" to
 * whatever it returns produces "Aug 27 ago", which is not English — and that is
 * exactly what the card labels were announcing. This picks the right phrasing
 * for each form and expands the abbreviations, since "3 d ago" is read aloud as
 * the letter d.
 */
export function spokenTime(timestamp: number, now: number = Date.now()): string {
  const token = relativeTime(timestamp, now);
  if (token === 'now') return 'just now';

  const m = token.match(/^(\d+)([smhd])$/);
  if (!m) return `on ${token}`;

  const value = Number(m[1]);
  const unit = SPOKEN_UNITS[m[2] as string] ?? '';
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
}

export function absoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
