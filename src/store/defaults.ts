import type { SourceId } from '@/providers/types';
import type { WatchedSubject } from './watchlist';

/**
 * The starter feed: what Ripple shows before the user has followed anything.
 *
 * An empty watchlist used to mean an empty app — four tabs of "nothing here
 * yet" behind a button. That is the worst possible first impression for
 * something whose entire argument is that this data is public and already
 * interesting: it asks the user to take on faith that following a subject will
 * produce anything worth reading.
 *
 * So the feed falls back to a small curated set until the user follows a
 * subject of their own.
 *
 * ── What this deliberately is NOT ───────────────────────────────────────────
 * These are not written into the watchlist. Seeding someone's watchlist on
 * first launch would mean they open the manage screen to four things they never
 * chose and have to remove them one by one, and every "following" count in the
 * app would be a lie. The watchlist stays exactly what the user picked; this is
 * a fallback the feed reaches for when that list is empty, and the feed says so
 * on screen.
 *
 * Because they are never persisted, the moment the user follows their first
 * real subject the starter signals are pruned and the feed becomes theirs.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Only `import type`, so this is unit-tested with no store, no network and no
 * React Native.
 */

export interface DefaultSubject {
  source: SourceId;
  /** Canonical handle, exactly as the provider's own search would return it. */
  handle: string;
  displayName: string;
  subtitle: string;
}

/**
 * One starter subject per source, chosen for breadth and for cost.
 *
 * Breadth: every registered source is represented, so a new user sees all four
 * filter chips with something behind them rather than discovering the other
 * three by accident.
 *
 * Cost: this set is fetched on every cold start by every install, so it is kept
 * to the cheapest handle that still shows what the source does. The insider
 * entry is the expensive one — each ticker costs roughly nine SEC requests
 * behind a 120ms queue — which is why there is exactly one of it. The congress
 * index is cached for six hours and the price series for thirty minutes, so
 * those two are close to free after the first fetch.
 *
 * Typed as `Record<SourceId, ...>` on purpose: registering a new source fails
 * the build here until someone decides what its starter subject should be. An
 * empty array is a valid answer, but it has to be a deliberate one.
 */
const BY_SOURCE: Record<SourceId, DefaultSubject[]> = {
  congress: [
    {
      source: 'congress',
      handle: 'all',
      displayName: 'All members',
      subtitle: 'Every disclosed trade, any party',
    },
  ],
  insider: [
    {
      source: 'insider',
      handle: 'NVDA',
      displayName: 'NVIDIA Corporation',
      subtitle: '$NVDA · SEC Form 4',
    },
  ],
  policy: [
    {
      source: 'policy',
      handle: 'type:executive_order',
      displayName: 'Executive Orders',
      subtitle: 'Signed executive orders',
    },
  ],
  stocks: [
    {
      source: 'stocks',
      handle: 'SPY',
      displayName: 'SPDR S&P 500 ETF Trust',
      subtitle: 'NYSE Arca',
    },
  ],
  funds: [
    {
      source: 'funds',
      handle: '1067983',
      displayName: 'Berkshire Hathaway',
      subtitle: 'Warren Buffett · CIK 0001067983',
    },
  ],
};

/**
 * The starter set, in the shape the fetch pipeline already speaks.
 *
 * `addedAt` is 0 rather than `Date.now()` because it is the honest value: no
 * one added these. Nothing sorts by it here — the manage screen, which does, is
 * never handed this list.
 *
 * `avatarUrl` is null because the only screen that reads it is the manage
 * screen. Feed cards take their avatar from the signal's own actor, which the
 * provider fills in, so the starter feed still shows real portraits and logos.
 */
export const DEFAULT_SUBJECTS: readonly WatchedSubject[] = Object.values(BY_SOURCE)
  .flat()
  .map((d) => ({
    source: d.source,
    handle: d.handle,
    displayName: d.displayName,
    subtitle: d.subtitle,
    avatarUrl: null,
    addedAt: 0,
    muted: false,
  }));

/**
 * What the feed should actually fetch and filter against.
 *
 * Keyed on the watchlist being *empty*, not on the fetchable set being empty:
 * a user who follows two subjects and mutes both has said "show me nothing",
 * and resurrecting the starter feed there would override a deliberate choice
 * with a default. Muting is applied by the caller, after this.
 */
export function feedSubjects(watched: readonly WatchedSubject[]): readonly WatchedSubject[] {
  return watched.length > 0 ? watched : DEFAULT_SUBJECTS;
}

/** True when the feed on screen is the starter set rather than the user's own. */
export function isStarterFeed(watched: readonly WatchedSubject[]): boolean {
  return watched.length === 0;
}
