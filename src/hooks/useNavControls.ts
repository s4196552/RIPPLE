import { type Href, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { selectCanGoBack, selectCanGoForward, useNavHistory } from '@/store/navHistory';

/** Where the home button goes: the Signals tab, the app's root route. */
const HOME: Href = '/';

/**
 * Feeds the visited path into the history store. Mount this exactly once, at
 * the root layout — mounting it per screen would record a screen only while it
 * happens to be alive, which is the opposite of what a history needs.
 */
export function useNavHistoryRecorder(): void {
  const pathname = usePathname();
  const visit = useNavHistory((s) => s.visit);

  useEffect(() => {
    visit(pathname);
  }, [pathname, visit]);
}

export interface NavControls {
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  goHome: () => void;
}

/**
 * Back / forward / home, driven by the recorded trail rather than the
 * navigator's own stack.
 *
 * `goBack` still prefers the navigator's `back()` when it can: that pops the
 * screen properly — running its exit animation and releasing it — where
 * navigating to the previous path by href would leave the popped screen on the
 * stack and grow it on every step. `goForward` has no such option, since the
 * screen it wants no longer exists, so it navigates by href. Either way the
 * recorder reconciles the cursor from whatever path actually results, so a
 * navigation that lands somewhere unexpected self-corrects instead of leaving
 * the trail wrong.
 */
export function useNavControls(): NavControls {
  const router = useRouter();
  const entries = useNavHistory((s) => s.entries);
  const index = useNavHistory((s) => s.index);
  const canGoBack = useNavHistory(selectCanGoBack);
  const canGoForward = useNavHistory(selectCanGoForward);

  return {
    canGoBack,
    canGoForward,

    goBack: () => {
      if (!canGoBack) return;
      if (router.canGoBack()) {
        router.back();
        return;
      }
      // No navigator history to pop — e.g. the previous entry was a tab switch
      // that the stack itself never saw. Go by path instead.
      router.navigate(entries[index - 1] as Href);
    },

    goForward: () => {
      if (!canGoForward) return;
      router.navigate(entries[index + 1] as Href);
    },

    goHome: () => router.navigate(HOME),
  };
}
