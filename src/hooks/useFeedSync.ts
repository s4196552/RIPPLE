import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { feedSubjects } from '@/store/defaults';
import { useFeed } from '@/store/feed';
import { useWatchlist } from '@/store/watchlist';

/**
 * How often to poll while foregrounded.
 *
 * Deliberately slower than a social feed. Every source here is disclosure-based
 * and updates at most a few times a day: the House Clerk index is regenerated
 * daily, Form 4s trickle in during market hours, the Federal Register publishes
 * on business mornings. Polling faster would burn SEC's rate limit for nothing.
 */
const POLL_INTERVAL_MS = 10 * 60_000;
/** Returning from background after this long triggers a full refresh instead. */
const STALE_AFTER_MS = 30 * 60_000;

/**
 * Owns the feed's lifecycle: first load, interval polling, and re-sync when the
 * app returns to the foreground.
 *
 * Mounted once, by the feed screen. Polling stops while backgrounded — a timer
 * firing against a suspended JS thread just produces a thundering herd of
 * requests the moment the user returns.
 */
/**
 * Refresh handle published by the single mounted `useFeedSync`.
 *
 * Module-level rather than context because there is exactly one sync in the
 * app, and threading a provider through the tab tree to carry one callback
 * would be more machinery than the problem deserves.
 */
let activeRefresh: (() => Promise<void>) | null = null;

/** Trigger a refresh from a screen that doesn't own the sync. */
export function refreshFeed(): Promise<void> {
  return activeRefresh?.() ?? Promise.resolve();
}

export function useFeedSync() {
  const load = useFeed((s) => s.load);
  const subjects = useWatchlist((s) => s.subjects);
  // Both stores, not just the watchlist. Starting a fetch before the persisted
  // feed is back from disk would race it: the fetch sees an empty list, decides
  // it has nothing to show, and rehydration lands underneath a spinner that did
  // not need to exist.
  const hydrated = useWatchlist((s) => s.hydrated) && useFeed((s) => s.hydrated);

  /**
   * What to fetch.
   *
   * `feedSubjects` substitutes the starter set when the watchlist is empty, so
   * a fresh install has a populated feed instead of four empty tabs.
   *
   * Muted subjects are excluded from fetching entirely — mute means "stop
   * spending requests on this". Source chips, by contrast, filter at render
   * time so toggling one is instant. Muting is applied after the substitution,
   * so a user who mutes everything they follow gets the empty feed they asked
   * for rather than the starter set back.
   */
  const fetchable = feedSubjects(subjects).filter((s) => !s.muted);

  // Identity of the fetch set, so the effect re-runs on add/remove/mute but not
  // on unrelated store writes.
  const signature = fetchable
    .map((s) => `${s.source}:${s.handle.toLowerCase()}`)
    .sort()
    .join(',');

  const subjectsRef = useRef(fetchable);
  subjectsRef.current = fetchable;

  const lastActiveRef = useRef(Date.now());

  // Initial load, and reload whenever the watched set changes.
  useEffect(() => {
    if (!hydrated) return;
    void load(subjectsRef.current, 'initial');
  }, [signature, hydrated, load]);

  // Interval polling.
  useEffect(() => {
    if (!hydrated || fetchable.length === 0) return;

    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      void load(subjectsRef.current, 'poll');
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [signature, hydrated, fetchable.length, load]);

  // Foreground re-sync.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        const away = Date.now() - lastActiveRef.current;
        if (subjectsRef.current.length > 0) {
          void load(subjectsRef.current, away > STALE_AFTER_MS ? 'refresh' : 'poll');
        }
      } else {
        lastActiveRef.current = Date.now();
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [load]);

  const refresh = useCallback(() => load(subjectsRef.current, 'refresh'), [load]);

  // Published so screens that don't own the sync can still trigger a refresh.
  // The hook is mounted once, by the tabs layout, so that every tab has data
  // whichever one the user lands on first — but pull-to-refresh lives on the
  // feed screen, which therefore needs a handle to it.
  useEffect(() => {
    activeRefresh = refresh;
    return () => {
      if (activeRefresh === refresh) activeRefresh = null;
    };
  }, [refresh]);

  return { refresh };
}
