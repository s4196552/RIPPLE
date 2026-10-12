import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { cleanAvatarUri } from './profileValues.ts';

/**
 * The profile photo, persisted on the device.
 *
 * A store of its own rather than a preference: on web the photo is kept as a
 * data URI, and the preferences blob is rewritten on every toggle, so a few
 * hundred kilobytes of image there would be re-serialised for nothing. On
 * native it is a `file://` URI into the app's document folder (see
 * `@/lib/avatar`), which the OS does not clear the way it clears a cache.
 *
 * Nothing here leaves the device. There is no account to attach it to.
 */
interface ProfileState {
  avatarUri: string | null;
  setAvatarUri: (uri: string | null) => void;
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      avatarUri: null,
      setAvatarUri: (avatarUri) => set({ avatarUri }),
    }),
    {
      name: 'ripple.profile.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ avatarUri: s.avatarUri }),
      // Only a URI the app could have written survives a read-back.
      merge: (persisted, current) => ({ ...current, avatarUri: cleanAvatarUri(persisted) }),
    },
  ),
);
