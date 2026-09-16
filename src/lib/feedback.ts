import * as Haptics from 'expo-haptics';
import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { usePreferences } from '@/store/preferences.ts';
import type { Palette } from '@/ui/theme.ts';

/**
 * The two things a preference had to reach into every screen to change:
 * whether a press buzzes, and where a filing opens.
 *
 * Both were previously inlined at each call site — three haptics calls and
 * seven browser calls — which is exactly the shape that makes a preference
 * impossible to add without touching ten files and missing one. Reading the
 * store imperatively via `getState()` rather than a hook is deliberate: these
 * are called from event handlers, not from render.
 */

/** A light tap: opening something, committing a choice. */
export function tapFeedback(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  // Web has no haptics API at all, and calling through throws rather than
  // no-opping.
  if (Platform.OS === 'web') return;
  if (!usePreferences.getState().haptics) return;

  void Haptics.impactAsync(style);
}

/** Something succeeded — a subject added, a watch created. */
export function successFeedback() {
  if (Platform.OS === 'web') return;
  if (!usePreferences.getState().haptics) return;

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * Open a source document.
 *
 * In-app keeps the user inside Ripple, which is the better default for reading
 * one filing and coming back. The system browser is the right answer for anyone
 * who wants their own extensions, reader mode, or a real tab they can keep.
 */
export async function openLink(url: string, palette: Palette): Promise<void> {
  if (usePreferences.getState().linkTarget === 'system') {
    await Linking.openURL(url);
    return;
  }

  await WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    toolbarColor: palette.bg,
    controlsColor: palette.accent,
  });
}
