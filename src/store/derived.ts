import type { Signal, SourceId } from '@/providers/types';
import type { WatchedSubject } from './watchlist';

/**
 * Subjects the feed fetches on the user's behalf, derived from a followed party.
 *
 * Following "Republicans" says "show me what this group trades". The Congress
 * cards answer half of that; the other half is what those companies' own
 * insiders did and what the stocks did, which live in the Insiders and Stocks
 * sources. So the tickers a party traded most are fetched there too.
 *
 * ── What this deliberately is NOT ───────────────────────────────────────────
 * These never enter the watchlist. The user followed a party, not six tickers,
 * and writing them in would leave entries behind after an unfollow that the
 * user never chose and would have to remove one by one — the same reasoning as
 * the starter feed in `./defaults.ts`. They exist only for the length of a
 * fetch, and unfollowing or muting the party makes them disappear with it.
 *
 * They depend on ticker-level trades: the keyed aggregators, or the trades
 * read from the Clerk's PDFs (`providers/congress/scraped.ts`), which ship with
 * the app — so this runs for every party follower, key or not, on every
 * refresh and poll. Only filings that were never read carry no ticker. That
 * load is what `MAX_DERIVED_TICKERS` is sized for.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Only `import type`, so this is unit-tested with no store, no network and no
 * React Native — the same constraint as `./merge.ts`.
 */

/** Tickers taken from each followed party. Each costs an Insiders and a Stocks fetch. */
export const DERIVED_TICKERS_PER_GROUP = 3;

/**
 * Ceiling across all followed parties.
 *
 * Every insider ticker is several SEC requests (submissions, then the Form 4
 * XML for each filing), and SEC's fair-access limit is per user agent. Two
 * parties at three each is the most that stays polite on a refresh.
 */
export const MAX_DERIVED_TICKERS = 6;

/** One extra fetch the feed makes because of a followed group. */
export interface DerivedSubject extends WatchedSubject {
  /** Display names of the groups that put this ticker here, e.g. `['Republicans']`. */
  via: string[];
}

/** Whether a Congress handle is a party scope (`party:republican`). */
export function isPartyHandle(source: SourceId, handle: string): boolean {
  return source === 'congress' && handle.toLowerCase().startsWith('party:');
}

/**
 * SEC tickers are plain letters. Crypto pairs (`BTC-USD`) and share classes
 * written with a dot have no Form 4 history to fetch, so they only go to Stocks.
 */
const INSIDER_TICKER = /^[A-Z]{1,5}$/;

/** The badge a derived card carries, naming the group that put it in the feed. */
export function viaBadge(via: readonly string[]): string {
  return `VIA ${via.join(' & ').toUpperCase()}`;
}

/**
 * The most-traded tickers of a group, busiest first.
 *
 * Ranked by how many of the group's trades name the ticker, ties broken by the
 * most recent trade, then alphabetically so the order is total and a refresh
 * never reshuffles an equal pair.
 */
export function topTickers(signals: readonly Signal[], limit: number): string[] {
  const stats = new Map<string, { count: number; latest: number }>();

  for (const s of signals) {
    const ticker = s.ticker?.trim().toUpperCase();
    if (!ticker) continue;
    const entry = stats.get(ticker) ?? { count: 0, latest: 0 };
    entry.count++;
    entry.latest = Math.max(entry.latest, s.timestamp);
    stats.set(ticker, entry);
  }

  return [...stats.entries()]
    .sort(([a, x], [b, y]) => y.count - x.count || y.latest - x.latest || a.localeCompare(b))
    .slice(0, limit)
    .map(([ticker]) => ticker);
}

/**
 * The Insiders and Stocks subjects to fetch for the parties in `subjects`.
 *
 * `signals` is everything the feed holds, including what the Congress fetch
 * just returned. `isWatched` reports subjects already on the watchlist, which
 * are fetched in their own right and so are never duplicated here.
 */
export function derivedTickerSubjects(
  subjects: readonly WatchedSubject[],
  signals: readonly Signal[],
  isWatched: (source: SourceId, handle: string) => boolean,
): DerivedSubject[] {
  const viaByTicker = new Map<string, string[]>();

  for (const group of subjects) {
    if (group.muted || !isPartyHandle(group.source, group.handle)) continue;

    const own = signals.filter(
      (s) =>
        s.source === 'congress' && s.actor.handle.toLowerCase() === group.handle.toLowerCase(),
    );

    for (const ticker of topTickers(own, DERIVED_TICKERS_PER_GROUP)) {
      const via = viaByTicker.get(ticker);
      if (via) {
        if (!via.includes(group.displayName)) via.push(group.displayName);
      } else if (viaByTicker.size < MAX_DERIVED_TICKERS) {
        viaByTicker.set(ticker, [group.displayName]);
      }
    }
  }

  const derived: DerivedSubject[] = [];
  for (const [ticker, via] of viaByTicker) {
    const targets: SourceId[] = INSIDER_TICKER.test(ticker) ? ['insider', 'stocks'] : ['stocks'];
    for (const source of targets) {
      if (isWatched(source, ticker)) continue;
      derived.push({
        source,
        handle: ticker,
        displayName: ticker,
        subtitle: `Traded by ${via.join(' & ')}`,
        avatarUrl: null,
        // Never added by anyone; see the note at the top of this file.
        addedAt: 0,
        muted: false,
        via,
      });
    }
  }
  return derived;
}
