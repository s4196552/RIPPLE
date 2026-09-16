import { create } from 'zustand';

/**
 * Browser-style navigation history: a trail of visited paths plus a cursor.
 *
 * Expo Router gives us "back" (a stack pop) but has no concept of "forward" —
 * once a screen is popped it is gone. So the trail is kept here instead of
 * being read off the navigator, and the controls navigate by path rather than
 * by popping. Nothing is persisted: history is a property of the current
 * session, and restoring a stale trail across launches would offer a "forward"
 * into screens the user has no memory of visiting.
 *
 * KNOWN DIVERGENCE from a browser: visits are classified by comparing against
 * the immediate neighbours, because a path change alone cannot say whether the
 * user popped a screen or navigated somewhere that happens to be the previous
 * entry. So A → B → A (tapping through to A rather than going back) is read as
 * a back, leaving forward pointing at B; a browser would push a third entry and
 * disable forward. Reading the navigator's internal state could tell these
 * apart, but not without coupling this store to React Navigation's internals
 * for a distinction that costs the user nothing here.
 */

/** Bounds memory on a long session. Older entries fall off the back. */
const MAX_ENTRIES = 50;

interface NavHistoryState {
  /** Visited paths, oldest first. */
  entries: string[];
  /** Cursor into `entries`; -1 before the first visit is recorded. */
  index: number;

  /** Record that the app is now showing `path`. Idempotent per path. */
  visit: (path: string) => void;
}

export const useNavHistory = create<NavHistoryState>((set) => ({
  entries: [],
  index: -1,

  visit: (path) =>
    set((state) => {
      const { entries, index } = state;

      // Re-render of the same screen, or a param-only change we do not track.
      if (entries[index] === path) return state;

      // Stepping onto a known neighbour moves the cursor rather than rewriting
      // the trail, which is what keeps forward available after a back.
      if (index > 0 && entries[index - 1] === path) return { ...state, index: index - 1 };
      if (entries[index + 1] === path) return { ...state, index: index + 1 };

      // A genuinely new destination truncates anything ahead of the cursor:
      // that future is no longer reachable, exactly as in a browser.
      const trail = [...entries.slice(0, index + 1), path].slice(-MAX_ENTRIES);
      return { entries: trail, index: trail.length - 1 };
    }),
}));

/** True when there is an earlier entry to step back to. */
export function selectCanGoBack(state: NavHistoryState): boolean {
  return state.index > 0;
}

/** True only after a back — a fresh trail has nothing ahead of the cursor. */
export function selectCanGoForward(state: NavHistoryState): boolean {
  return state.index >= 0 && state.index < state.entries.length - 1;
}
