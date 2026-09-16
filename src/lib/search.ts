import type { Signal } from '@/providers/types';

/**
 * Finding things in a feed that holds 500 signals.
 *
 * The source chips answer "which kind", which is the only question the feed
 * could answer until now. This answers the ones people actually arrive with:
 * what did this person do, who touched this ticker, what sold last week.
 *
 * Everything here runs over signals already in memory, so it costs no request
 * and no quota — the same reasoning that keeps source filtering at render time.
 * Only `import type`, so it is unit-tested with no store and no network.
 */

const DAY = 86_400_000;

/** How far back to look. Days, or every signal held. */
export type SearchWindow = 'all' | 7 | 30 | 90;

/**
 * Which side of a trade to keep.
 *
 * 'buy' and 'sell' mean *decisions*: a share grant or a tax withholding is
 * neither, so neither shows under them. Filtering to Buys and being handed
 * seven vesting events is the same bug the Trades table already had.
 */
export type ActionFilter = 'all' | 'buy' | 'sell';

export interface FeedFilter {
  /** Free text. Empty means no text constraint. */
  query: string;
  action: ActionFilter;
  window: SearchWindow;
}

export const NO_FILTER: FeedFilter = { query: '', action: 'all', window: 'all' };

/** True when the filter would remove anything at all. */
export function isFiltering(filter: FeedFilter): boolean {
  return filter.query.trim() !== '' || filter.action !== 'all' || filter.window !== 'all';
}

/**
 * Everything about a signal a person might reasonably type.
 *
 * Deliberately wide: someone searching "pelosi" is thinking of a person,
 * "NVDA" of a ticker, "proclamation" of a kind of document, and none of them
 * should have to know which field the app keeps that in.
 */
function haystack(signal: Signal): string {
  const trade = signal.trade;

  return [
    signal.actor.displayName,
    signal.actor.subtitle,
    signal.actor.handle,
    signal.text,
    signal.ticker,
    signal.source,
    signal.accent?.label,
    trade?.traderName,
    trade?.traderTitle,
    trade?.assetName,
    trade?.kindLabel,
    ...(signal.badges ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Does this signal match the typed text?
 *
 * Every whitespace-separated term has to appear somewhere, so "pelosi nvda"
 * narrows rather than widens — typing more words getting you more results is
 * the behaviour people find surprising. A leading `$` is stripped so both
 * `$NVDA` and `NVDA` work, since the app itself writes tickers both ways.
 */
export function matchesQuery(signal: Signal, query: string): boolean {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/^\$/, ''))
    .filter(Boolean);

  if (terms.length === 0) return true;

  const text = haystack(signal);
  return terms.every((term) => text.includes(term));
}

/** Does this signal match the buy/sell constraint? */
export function matchesAction(signal: Signal, action: ActionFilter): boolean {
  if (action === 'all') return true;

  // A signal with no trade — an executive order, a price move — is not a buy
  // and not a sell, so it belongs under neither.
  const trade = signal.trade;
  if (!trade || !trade.discretionary) return false;

  return trade.action === action;
}

/** Is this signal inside the window, measured back from `now`? */
export function withinWindow(signal: Signal, window: SearchWindow, now: number): boolean {
  if (window === 'all') return true;
  return signal.timestamp >= now - window * DAY;
}

/**
 * The filtered feed, in the order it arrived.
 *
 * Order is never changed here. The merge engine owns it, and a search that
 * silently re-sorted by relevance would make the newest thing hard to find
 * precisely when someone is scanning for it.
 */
export function applyFilter(
  signals: readonly Signal[],
  filter: FeedFilter,
  now: number = Date.now(),
): Signal[] {
  if (!isFiltering(filter)) return [...signals];

  const query = filter.query.trim();

  return signals.filter(
    (signal) =>
      withinWindow(signal, filter.window, now) &&
      matchesAction(signal, filter.action) &&
      matchesQuery(signal, query),
  );
}

/** `12 of 340` — what the filter did, for the bar above the list. */
export function filterSummary(matched: number, total: number): string {
  if (matched === total) return `${total} signal${total === 1 ? '' : 's'}`;
  return `${matched} of ${total}`;
}

/**
 * Tickers and people worth offering before anything is typed.
 *
 * Drawn from what is actually loaded rather than a fixed list, so the
 * suggestions are things that will genuinely return results. Ranked by how
 * often each appears, because the busiest subject is the likeliest search.
 */
export function suggestions(signals: readonly Signal[], limit = 6): string[] {
  const counts = new Map<string, number>();

  for (const signal of signals) {
    const ticker = signal.ticker?.toUpperCase();
    if (ticker) counts.set(ticker, (counts.get(ticker) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([ticker]) => ticker);
}
