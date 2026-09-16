/** Shared number and text formatting for feed cards. Pure, no imports. */

/** `$1.2M`, `$430K`, `$8,400`. Used for trade values and disclosure ranges. */
export function money(value: number): string {
  const sign = value < 0 ? '-' : '';
  const n = Math.abs(value);
  if (n >= 1_000_000_000) return `${sign}$${trim(n / 1_000_000_000)}B`;
  if (n >= 1_000_000) return `${sign}$${trim(n / 1_000_000)}M`;
  if (n >= 10_000) return `${sign}$${Math.round(n / 1_000)}K`;
  return `${sign}$${Math.round(n).toLocaleString('en-US')}`;
}

/** `3.2M`, `12K`, `950`. For share counts and volume. */
export function compact(n: number): string {
  const v = Math.abs(n);
  if (v >= 1_000_000_000) return `${trim(n / 1_000_000_000)}B`;
  if (v >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (v >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

/** Explicitly signed percentage: `+3.24%`, `-1.10%`. */
export function pct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/**
 * `sec.gov` from a full filing URL, for the in-app browser's chrome.
 *
 * The host is what says who served the document, which is the one piece of
 * provenance a title can't fake. Anything unparseable is passed through
 * unchanged rather than blanked.
 */
export function hostLabel(url: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url.trim());
  if (!match) return url.trim();

  return match[1]!.replace(/^www\./i, '').toLowerCase();
}

/** One decimal place, but drop a trailing `.0`. */
function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

/**
 * URL-safe, stable identifier for a person.
 * `Pelosi, Nancy` + `CA11` -> `nancy-pelosi-ca11`.
 */
export function slug(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => !!p && p.trim().length > 0)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `Nancy Pelosi` from `Pelosi` + `Nancy`, handling missing halves. */
export function personName(first?: string | null, last?: string | null): string {
  return [first?.trim(), last?.trim()].filter(Boolean).join(' ') || 'Unknown';
}

/**
 * `CA11` -> `CA-11`, `MO04` -> `MO-4`, `AK00` -> `AK`.
 *
 * The House Clerk zero-pads to two digits, but districts are written without
 * the padding everywhere else — including by the trade aggregators, so leaving
 * it in put `MN-03` and `MN-3` on adjacent cards for the same seat. `00` is not
 * a district at all: it marks a state with a single at-large representative.
 *
 * Anything that is not a state-district code is passed through untouched.
 */
export function district(stateDst?: string | null): string | null {
  if (!stateDst) return null;
  const m = stateDst.trim().match(/^([A-Z]{2})(\d{1,2})$/);
  if (!m) return stateDst.trim();

  const seat = Number(m[2]);
  return seat === 0 ? m[1]! : `${m[1]}-${seat}`;
}
