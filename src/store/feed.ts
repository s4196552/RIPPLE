import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getProvider } from '@/providers/registry';
import type { Signal, SourceId } from '@/providers/types';
import { isAbort } from '@/lib/http';
import { mergeSignals, pruneUnwatched, subjectKey } from './merge';
import type { WatchedSubject } from './watchlist';

/**
 * The unified feed store: fan out to every watched subject, then hand the
 * results to the merge engine in `./merge`.
 *
 * Signals are kept in one flat, always-sorted array. Source filtering is a
 * render-time concern (`visibleSignals`) rather than a refetch, so toggling a
 * chip is instant and doesn't burn API quota.
 */

export { visibleSignals, countBySource } from './merge';

/** Per-subject fetch size. Keeps a busy subject from crowding out a quiet one. */
const SIGNALS_PER_SUBJECT = 15;

/**
 * How many signals survive a relaunch.
 *
 * Fewer than the 500 the merge engine retains in memory: this slice is parsed
 * synchronously on the launch path, and the user is going to see the first
 * screenful. Anything past that is re-fetched within seconds anyway.
 */
const PERSISTED_SIGNALS = 250;

export interface FeedError {
  source: SourceId;
  handle: string;
  message: string;
}

export type LoadMode = 'initial' | 'refresh' | 'poll';

interface FeedState {
  signals: Signal[];
  /** Full reload — shows the spinner instead of the list. */
  loading: boolean;
  /** Pull-to-refresh — keeps existing signals on screen. */
  refreshing: boolean;
  lastUpdated: number | null;
  /** Per-subject failures from the last run. Surfaced as a dismissible banner. */
  errors: FeedError[];
  /** Signals found by polling that the user hasn't scrolled up to yet. */
  newSincePeek: number;
  /** Set once the persisted feed has been read back from disk. */
  hydrated: boolean;

  load: (subjects: WatchedSubject[], mode: LoadMode) => Promise<void>;
  clearNewCount: () => void;
  reset: () => void;
  setHydrated: () => void;
}

let inFlight: AbortController | null = null;

/**
 * The feed is persisted so a relaunch opens on the last signals the user saw
 * rather than a spinner.
 *
 * Only `signals` and `lastUpdated` are stored. The flags are not: `loading`
 * restored as `true` would show a spinner for a fetch nobody started, and
 * restored errors would blame a run that happened yesterday. `newSincePeek` is
 * a "since you last looked" count, which a relaunch resets by definition.
 */
export const useFeed = create<FeedState>()(
  persist(
    (set, get) => ({
      signals: [],
      loading: false,
      refreshing: false,
      lastUpdated: null,
      errors: [],
      newSincePeek: 0,
      hydrated: false,

      setHydrated: () => set({ hydrated: true }),

      load: async (subjects, mode) => {
        // A newer request supersedes whatever is running.
        inFlight?.abort();
        const controller = new AbortController();
        inFlight = controller;

        if (subjects.length === 0) {
          set({ signals: [], loading: false, refreshing: false, errors: [], lastUpdated: Date.now() });
          return;
        }

        set({
          loading: mode === 'initial',
          refreshing: mode === 'refresh',
          // A poll that fails shouldn't clear a banner the user hasn't read yet.
          ...(mode !== 'poll' ? { errors: [] } : {}),
        });

        // Polling asks each subject only for what's newer than what we already hold.
        const newestBySubject = new Map<string, number>();
        if (mode === 'poll') {
          for (const s of get().signals) {
            const key = subjectKey(s.source, s.actor.handle);
            const seen = newestBySubject.get(key) ?? 0;
            if (s.timestamp > seen) newestBySubject.set(key, s.timestamp);
          }
        }

        const results = await Promise.allSettled(
          subjects.map((subject) =>
            getProvider(subject.source).getSignals(subject.handle, {
              limit: SIGNALS_PER_SUBJECT,
              since:
                mode === 'poll'
                  ? newestBySubject.get(subjectKey(subject.source, subject.handle))
                  : undefined,
              signal: controller.signal,
            }),
          ),
        );

        if (controller.signal.aborted) return;

        const incoming: Signal[] = [];
        const errors: FeedError[] = [];

        results.forEach((result, i) => {
          const subject = subjects[i]!;
          if (result.status === 'fulfilled') {
            incoming.push(...result.value);
          } else if (!isAbort(result.reason)) {
            // One source failing must never blank the feed — record it and move on.
            errors.push({
              source: subject.source,
              handle: subject.displayName || subject.handle,
              message: result.reason instanceof Error ? result.reason.message : String(result.reason),
            });
          }
        });

        const previousIds = new Set(get().signals.map((s) => s.id));
        const merged = pruneUnwatched(mergeSignals(get().signals, incoming), subjects);
        const freshCount = merged.reduce((n, s) => (previousIds.has(s.id) ? n : n + 1), 0);

        set((state) => ({
          signals: merged,
          loading: false,
          refreshing: false,
          lastUpdated: Date.now(),
          errors,
          // Only polling produces the "N new" pill; an explicit refresh means the
          // user is already looking at the top of the list.
          newSincePeek: mode === 'poll' ? state.newSincePeek + freshCount : 0,
        }));

        if (inFlight === controller) inFlight = null;
      },

      clearNewCount: () => set({ newSincePeek: 0 }),

      reset: () => {
        inFlight?.abort();
        inFlight = null;
        set({
          signals: [],
          loading: false,
          refreshing: false,
          errors: [],
          lastUpdated: null,
          newSincePeek: 0,
        });
      },
    }),
    {
      name: 'ripple-feed-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Only what is worth seeing again on launch. See the note above.
      partialize: (state) => ({
        signals: state.signals.slice(0, PERSISTED_SIGNALS),
        lastUpdated: state.lastUpdated,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
