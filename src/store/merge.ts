import type { Signal, SourceId } from '@/providers/types';
import type { WatchedSubject } from './watchlist';

/**
 * The merge engine for the unified feed.
 *
 * Deliberately free of runtime imports — only `import type`, which compiles
 * away — so this can be unit-tested directly without a store, a network stack
 * or React Native's native modules. This is the code that decides what the user
 * actually sees, so it gets tested in isolation.
 */

/** Hard cap on retained signals, so a long session can't grow unbounded. */
export const MAX_SIGNALS = 500;

/** Watchlist entries are keyed by source + case-insensitive handle. */
export function subjectKey(source: SourceId, handle: string): string {
  return `${source}:${handle.toLowerCase()}`;
}

/**
 * Merge incoming signals into existing ones: dedupe by id, sort newest first,
 * cap.
 *
 * Incoming wins on an id collision — a re-fetched signal may carry corrected
 * figures. Ties on timestamp break on id so the order is total and stable;
 * without that, two filings on the same day can swap places between renders and
 * make the list jump. That matters more here than in a social feed, because
 * most of these sources are day-resolution: a dozen filings can share a
 * timestamp exactly.
 */
export function mergeSignals(
  existing: readonly Signal[],
  incoming: readonly Signal[],
): Signal[] {
  const byId = new Map<string, Signal>();

  for (const s of existing) byId.set(s.id, s);
  for (const s of incoming) byId.set(s.id, s);

  return [...byId.values()]
    .sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id))
    .slice(0, MAX_SIGNALS);
}

/**
 * Drop signals whose subject is no longer being fetched — unwatched or muted.
 * Runs after every merge so removing a subject clears its signals immediately
 * rather than at the next full reload.
 */
export function pruneUnwatched(
  signals: readonly Signal[],
  subjects: readonly WatchedSubject[],
): Signal[] {
  const watched = new Set(subjects.map((s) => subjectKey(s.source, s.handle)));
  return signals.filter((s) => watched.has(subjectKey(s.source, s.actor.handle)));
}

/**
 * Render-time filter. Hidden sources are removed here rather than at fetch time
 * so toggling a chip is instant and costs no API quota. Muted subjects are also
 * filtered as a belt-and-braces measure, covering the gap between a mute toggle
 * and the refetch it triggers.
 */
export function visibleSignals(
  signals: readonly Signal[],
  hiddenSources: readonly SourceId[],
  subjects: readonly WatchedSubject[],
): Signal[] {
  const muted = new Set(
    subjects.filter((s) => s.muted).map((s) => subjectKey(s.source, s.handle)),
  );
  const hidden = new Set(hiddenSources);

  return signals.filter(
    (s) => !hidden.has(s.source) && !muted.has(subjectKey(s.source, s.actor.handle)),
  );
}

/** Signal counts per source, for the filter chips. */
export function countBySource(signals: readonly Signal[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const s of signals) tally[s.source] = (tally[s.source] ?? 0) + 1;
  return tally;
}
