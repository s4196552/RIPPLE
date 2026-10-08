/**
 * Preference values and the rules for reading them back.
 *
 * Split from `./preferences.ts` for the same reason `./merge.ts` is split from
 * `./feed.ts`: this half has no store, no AsyncStorage and no React, so it can
 * be unit-tested directly. The half that cannot be is then only wiring.
 */

/** What the user picked, which is not the same as the theme being rendered. */
export type ThemePreference = 'system' | 'dark' | 'black' | 'light';

/**
 * Which colour pair carries direction.
 *
 * Mirrors `ToneMode` in `@/ui/theme`, redeclared here so the pure half of the
 * preferences stays free of UI imports and testable on its own.
 */
export type TonePreference = 'classic' | 'accessible';

/** Minutes between background polls, or 'off' to only refresh on demand. */
export type RefreshInterval = 5 | 10 | 30 | 'off';

/** Which tab the app opens on. */
export type StartTab = 'index' | 'trades' | 'timeline' | 'watchlist';

/** Where a filing opens when tapped. */
export type LinkTarget = 'in-app' | 'system';

export interface Preferences {
  theme: ThemePreference;
  /**
   * Teal/orange (colour-vision-safe, the default) or green/red.
   *
   * Orthogonal to `theme` on purpose: someone can want White and green/red,
   * or any other combination.
   */
  tones: TonePreference;
  /** Haptic feedback on press. Ignored on web, which has no haptics. */
  haptics: boolean;
  refreshInterval: RefreshInterval;
  startTab: StartTab;
  linkTarget: LinkTarget;
  /**
   * Group the feed into day sections with a headline, versus one flat list.
   * The digest is the better default; a flat list is denser for a heavy
   * watchlist where every day has a header and the headers cost more than
   * they explain.
   */
  dailyDigest: boolean;
  /**
   * The introduction has been seen. Set when it is finished or skipped, and
   * cleared from Settings to show it again.
   */
  onboarded: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  // 'system' rather than 'dark': the app was dark-only for its whole life, so
  // defaulting to the device setting is the only choice that does not override
  // something the user already told their phone.
  theme: 'system',
  // Teal/orange by default: it is the redesign's pair, shared by all three
  // modes, and it stays readable with red-green colour blindness. Green/red is
  // one tap away in Settings for anyone who wants the convention.
  tones: 'accessible',
  haptics: true,
  refreshInterval: 10,
  startTab: 'index',
  linkTarget: 'in-app',
  dailyDigest: true,
  onboarded: false,
};

/** Milliseconds for a refresh interval, or null when polling is off. */
export function pollIntervalMs(interval: RefreshInterval): number | null {
  return interval === 'off' ? null : interval * 60_000;
}

const THEMES: ThemePreference[] = ['system', 'dark', 'black', 'light'];
const TONES: TonePreference[] = ['classic', 'accessible'];
const INTERVALS: RefreshInterval[] = [5, 10, 30, 'off'];
const START_TABS: StartTab[] = ['index', 'trades', 'timeline', 'watchlist'];
const LINK_TARGETS: LinkTarget[] = ['in-app', 'system'];

/**
 * Keep only values this version still recognises.
 *
 * Persisted preferences outlive the code that wrote them: an install that used
 * a 60-minute refresh, or a tab that has since been removed, must not be able
 * to put the app in a state no screen can render.
 */
export function sanitize(stored: unknown): Partial<Preferences> {
  if (!stored || typeof stored !== 'object') return {};
  const raw = stored as Record<string, unknown>;
  const clean: Partial<Preferences> = {};

  if (THEMES.includes(raw.theme as ThemePreference)) clean.theme = raw.theme as ThemePreference;
  if (TONES.includes(raw.tones as TonePreference)) clean.tones = raw.tones as TonePreference;
  if (typeof raw.haptics === 'boolean') clean.haptics = raw.haptics;
  if (INTERVALS.includes(raw.refreshInterval as RefreshInterval)) {
    clean.refreshInterval = raw.refreshInterval as RefreshInterval;
  }
  if (START_TABS.includes(raw.startTab as StartTab)) clean.startTab = raw.startTab as StartTab;
  if (LINK_TARGETS.includes(raw.linkTarget as LinkTarget)) {
    clean.linkTarget = raw.linkTarget as LinkTarget;
  }
  if (typeof raw.dailyDigest === 'boolean') clean.dailyDigest = raw.dailyDigest;
  if (typeof raw.onboarded === 'boolean') clean.onboarded = raw.onboarded;

  return clean;
}
