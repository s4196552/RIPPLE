import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * The user's own settings, persisted to the device.
 *
 * Separate from the watchlist store rather than folded into it: the watchlist
 * is content and this is chrome, they change on completely different schedules,
 * and a corrupt preference should never be able to take a watchlist down with
 * it when the persisted blob fails to parse.
 *
 * Nothing here syncs anywhere. There is no account, so "profile" means the way
 * this install is set up, not an identity on a server.
 */

export type {
  LinkTarget,
  Preferences,
  RefreshInterval,
  StartTab,
  ThemePreference,
} from './preferenceValues.ts';
export { DEFAULT_PREFERENCES, pollIntervalMs, sanitize } from './preferenceValues.ts';

import { DEFAULT_PREFERENCES, sanitize, type Preferences } from './preferenceValues.ts';

interface PreferencesState extends Preferences {
  /** Set once the persisted state has been read back from disk. */
  hydrated: boolean;

  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
  setHydrated: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      hydrated: false,

      set: (key, value) => set({ [key]: value } as Pick<Preferences, typeof key>),
      reset: () => set({ ...DEFAULT_PREFERENCES }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'ripple.preferences.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        theme: state.theme,
        haptics: state.haptics,
        refreshInterval: state.refreshInterval,
        startTab: state.startTab,
        linkTarget: state.linkTarget,
        dailyDigest: state.dailyDigest,
      }),
      /**
       * A stored value that is no longer valid — a preference removed in a
       * later version, or a hand-edited blob — falls back to the default rather
       * than reaching a screen as `undefined` and rendering a blank row.
       */
      merge: (persisted, current) => ({
        ...current,
        ...sanitize(persisted),
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

