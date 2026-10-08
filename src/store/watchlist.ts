import type { BackupSubject } from '@/lib/backup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SourceId, SubjectResult } from '@/providers/types';
import { liftExpiredMutes, subjectKey } from './merge';

export { subjectKey };

/**
 * The user's watchlist, persisted to device storage.
 *
 * v1 has no auth and no sync — everything lives in AsyncStorage. When accounts
 * arrive, this store is the only thing that needs to become server-backed; the
 * feed reads it through selectors and doesn't care where it came from.
 */

export interface WatchedSubject {
  source: SourceId;
  /** Canonical handle, no sigil. `nancy-pelosi-ca11`, `AAPL`, `type:executive_order`. */
  handle: string;
  displayName: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  addedAt: number;
  /** Muted subjects stay on the watchlist but are excluded from fetching. */
  muted: boolean;
  /**
   * When a timed mute lifts, epoch ms. Absent or null while muted means
   * "until I unmute". Lifted by `expireMutes`, which runs at launch and on each
   * feed poll.
   */
  mutedUntil?: number | null;
}

interface WatchlistState {
  subjects: WatchedSubject[];
  /** Sources currently hidden from the feed. Empty === show everything. */
  hiddenSources: SourceId[];
  /** Set once the persisted state has been read back from disk. */
  hydrated: boolean;

  add: (result: SubjectResult) => void;
  /** Merge a backup in. Additive: returns how many were actually new. */
  restore: (incoming: readonly BackupSubject[]) => number;
  remove: (source: SourceId, handle: string) => void;
  toggleMute: (source: SourceId, handle: string) => void;
  /** Mute until a time, mute until unmuted (`null`), or unmute (`false`). */
  setMute: (source: SourceId, handle: string, until: number | null | false) => void;
  /** Lift every timed mute whose time has passed. */
  expireMutes: (now?: number) => void;
  /** Replace the hidden set. The feed's chips use it to show one source or all. */
  setHiddenSources: (sources: SourceId[]) => void;
  isWatched: (source: SourceId, handle: string) => boolean;
  setHydrated: () => void;
}

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      subjects: [],
      hiddenSources: [],
      hydrated: false,

      add: (result) =>
        set((state) => {
          const key = subjectKey(result.source, result.handle);
          if (state.subjects.some((s) => subjectKey(s.source, s.handle) === key)) return state;

          const subject: WatchedSubject = {
            source: result.source,
            handle: result.handle,
            displayName: result.displayName,
            subtitle: result.subtitle ?? null,
            avatarUrl: result.avatarUrl ?? null,
            addedAt: Date.now(),
            muted: false,
          };
          return { subjects: [subject, ...state.subjects] };
        }),

      restore: (incoming) => {
        let added = 0;

        set((state) => {
          const have = new Set(state.subjects.map((s) => subjectKey(s.source, s.handle)));
          const fresh: WatchedSubject[] = [];
          const now = Date.now();

          for (const entry of incoming) {
            const key = subjectKey(entry.source, entry.handle);
            if (have.has(key)) continue;
            have.add(key);
            added++;

            fresh.push({
              source: entry.source,
              handle: entry.handle,
              displayName: entry.displayName,
              subtitle: entry.subtitle ?? null,
              // Re-derived by the provider on the first fetch; a URL baked into
              // a backup would outlive the endpoint that served it.
              avatarUrl: null,
              addedAt: now,
              // A timed mute that ran out while the backup sat in a note is
              // simply over.
              muted: entry.muted === true && !(entry.mutedUntil != null && entry.mutedUntil <= now),
              mutedUntil:
                entry.muted === true && entry.mutedUntil != null && entry.mutedUntil > now
                  ? entry.mutedUntil
                  : null,
            });
          }

          return fresh.length > 0 ? { subjects: [...fresh, ...state.subjects] } : state;
        });

        return added;
      },

      remove: (source, handle) =>
        set((state) => ({
          subjects: state.subjects.filter(
            (s) => subjectKey(s.source, s.handle) !== subjectKey(source, handle),
          ),
        })),

      toggleMute: (source, handle) =>
        set((state) => ({
          subjects: state.subjects.map((s) =>
            subjectKey(s.source, s.handle) === subjectKey(source, handle)
              ? { ...s, muted: !s.muted, mutedUntil: null }
              : s,
          ),
        })),

      setMute: (source, handle, until) =>
        set((state) => ({
          subjects: state.subjects.map((s) =>
            subjectKey(s.source, s.handle) === subjectKey(source, handle)
              ? { ...s, muted: until !== false, mutedUntil: until === false ? null : until }
              : s,
          ),
        })),

      expireMutes: (now = Date.now()) => {
        const lifted = liftExpiredMutes(get().subjects, now);
        if (lifted) set({ subjects: lifted });
      },

      setHiddenSources: (sources) => set({ hiddenSources: [...sources] }),

      isWatched: (source, handle) =>
        get().subjects.some((s) => subjectKey(s.source, s.handle) === subjectKey(source, handle)),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'ripple.watchlist.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        subjects: state.subjects,
        hiddenSources: state.hiddenSources,
      }),
      // `hydrated` is deliberately outside `partialize` — it describes this
      // session, not saved data. The feed waits on it so a cold start doesn't
      // flash the empty state before the saved watchlist loads.
      onRehydrateStorage: () => (state) => {
        state?.expireMutes();
        state?.setHydrated();
      },
    },
  ),
);

/** Watchlist grouped by source, for the manage screen. */
export function groupBySource(subjects: WatchedSubject[]): Map<SourceId, WatchedSubject[]> {
  const groups = new Map<SourceId, WatchedSubject[]>();
  for (const subject of subjects) {
    const bucket = groups.get(subject.source);
    if (bucket) bucket.push(subject);
    else groups.set(subject.source, [subject]);
  }
  return groups;
}
