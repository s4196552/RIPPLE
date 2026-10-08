import type { Signal } from '@/providers/types';

/**
 * Small readings of a signal that the member page and the filing view share.
 *
 * Only `import type`, so it is unit-tested with no React and no network.
 */

const DAY = 86_400_000;

/** The STOCK Act's limit, in days, between a member's trade and its disclosure. */
export const DISCLOSURE_LIMIT_DAYS = 45;

/** Days from the trade to its disclosure, when the source gave both dates. */
export function disclosureLag(signal: Signal): number | null {
  const traded = signal.trade?.tradedAt;
  if (traded == null || !Number.isFinite(traded)) return null;
  return Math.max(0, Math.round((signal.timestamp - traded) / DAY));
}

/** Filed past the deadline — by the provider's badge, or by the dates. */
export function isLate(signal: Signal): boolean {
  if (signal.badges?.includes('LATE FILING')) return true;
  const lag = disclosureLag(signal);
  return signal.source === 'congress' && lag !== null && lag > DISCLOSURE_LIMIT_DAYS;
}

export type PartyTag = 'DEM' | 'REP' | 'IND';

/**
 * The party as a three-letter tag, read from a subtitle like `CA-11 · Democrat`.
 *
 * Shown as a neutral outlined tag — never a party colour, which in this app
 * would read as direction.
 */
export function partyTag(subtitle?: string | null): PartyTag | null {
  if (!subtitle) return null;
  // A whole `·`-separated part, so a sentence like "Trades filed by
  // Republican members" — a party's own subtitle — is not read as a member's.
  for (const part of subtitle.split('·').map((p) => p.trim().toLowerCase())) {
    if (part === 'democrat') return 'DEM';
    if (part === 'republican') return 'REP';
    if (part === 'independent') return 'IND';
  }
  return null;
}

/** `CA-11 · Democrat` without the party, which the tag beside it already says. */
export function withoutParty(subtitle?: string | null): string {
  if (!subtitle) return '';
  return subtitle
    .split('·')
    .map((part) => part.trim())
    .filter((part) => part && !/^(Democrat|Republican|Independent)$/i.test(part))
    .join(' · ');
}

/** `2026-07-24` — the form filings print dates in, read as written. */
export function isoDate(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

/** The company or asset, when the trade names more than its ticker. */
export function assetName(signal: Signal): string | null {
  const name = signal.trade?.assetName;
  if (name && name.toUpperCase() !== (signal.ticker ?? '').toUpperCase()) return name;
  // Congress trades carry the company in the sentence: "bought BE · Bloom Energy (…".
  const m = signal.text.match(/ · ([^(.]+?)(?: \(|\.| on )/);
  return m?.[1]?.trim() ?? null;
}
