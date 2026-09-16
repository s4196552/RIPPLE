/**
 * Design tokens.
 *
 * A terminal crossed with a news-alert app: dense, quiet chrome, and colour
 * reserved almost entirely for source identity. So the greys are near-neutral
 * with a slight blue cast, and the only saturated elements on a feed card are
 * the source badge and the value chip. The light palette answers the same
 * brief with the values inverted rather than a different design.
 *
 * ── Why there is no `colors` export ─────────────────────────────────────────
 * There used to be one, and every screen imported it at module scope inside
 * `StyleSheet.create`. That captures the value once, at import, which means a
 * runtime theme switch cannot reach it — the app would have rendered half
 * light and half dark. Palettes are therefore reached through `useTheme()` and
 * `makeStyles()` in `./ThemeProvider`, never imported directly, and removing
 * the old export is what guarantees no screen was left behind.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Every colour role in the app. Both palettes must define all of them, so a
 * token added for one theme cannot be forgotten in the other.
 */
export interface Palette {
  /** App background. */
  bg: string;
  /** Cards and raised surfaces. */
  surface: string;
  /** Pressed / secondary surfaces. */
  surfaceAlt: string;
  /** Hairlines. Deliberately low contrast; density comes from spacing. */
  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  /** The dimmest tone still safe for text that carries information. */
  textSubtle: string;
  /** Decorative chrome only — separators, inactive glyphs. Fails AA for text. */
  textFaint: string;

  accent: string;
  up: string;
  down: string;
  warning: string;

  /** Text and icons sitting on an `accent`-filled surface. */
  onAccent: string;
  /**
   * The plate a logo is drawn on.
   *
   * The one token that does NOT invert with the theme. Logos arrive as
   * transparent artwork drawn for light backgrounds, so a dark plate turns a
   * black wordmark into a black smudge. It stays near-white in both palettes.
   */
  logoPlate: string;
  overlay: string;
}

/**
 * Contrast against `bg` (#0B0E13), WCAG AA needs 4.5:1 for normal text:
 *   text 16.5:1 · warning 10.0:1 · up 10.3:1 · textMuted 6.6:1
 *   accent 6.0:1 · down 5.7:1 · textSubtle 4.8:1
 *   textFaint 3.3:1 — BELOW AA for normal text. Use it only for decorative
 *   chrome (separators); anything informational belongs on `textSubtle` or
 *   brighter.
 *
 * These numbers are asserted in `test/theme.test.ts`, so editing a token
 * without updating this table fails the suite rather than quietly leaving
 * every accessibility note in the codebase wrong. (`text` was documented here
 * as 16.1:1 for exactly that reason — it had never been 16.1:1.)
 */
export const darkPalette: Palette = {
  bg: '#0B0E13',
  surface: '#141922',
  surfaceAlt: '#1C2230',
  border: '#252C3B',
  borderStrong: '#333C4E',

  text: '#E9EDF5',
  textMuted: '#8D97AB',
  /**
   * Exists because the hierarchy wanted a step below `textMuted` and the only
   * one available was `textFaint`, which fails AA — so timestamps, handles and
   * counts kept getting painted in a colour they were never allowed to use.
   */
  textSubtle: '#757E92',
  textFaint: '#5C6579',

  accent: '#5B8DEF',
  up: '#3FD68C',
  down: '#F2545B',
  warning: '#E8B23A',

  /**
   * Identical to `bg`, but named for the job: these were hardcoded as
   * `'#0B0E13'` in five files, so a theme change would have missed every one.
   */
  onAccent: '#0B0E13',
  logoPlate: '#F5F7FA',
  overlay: 'rgba(0,0,0,0.6)',
};

/**
 * The light palette, solved against its own background rather than inverted by
 * eye. Contrast against `bg` (#F6F8FC):
 *   text 16.4:1 · textMuted 6.6:1 · accent 5.8:1 · down 5.4:1
 *   up 5.4:1 · textSubtle 4.9:1 · warning 4.8:1
 *   textFaint 3.4:1 — BELOW AA, deliberately, so the token keeps the same
 *   decorative-only meaning it has in the dark palette. A role that is safe in
 *   one theme and unsafe in the other would make every accessibility note in
 *   the codebase conditional.
 *
 * `up`, `down` and `warning` are darker and less saturated than their dark-mode
 * counterparts: a colour bright enough to read on near-black is nowhere near
 * readable on near-white, and these three carry meaning rather than decoration.
 *
 * Asserted in `test/theme.test.ts` on the same terms as the dark table.
 */
export const lightPalette: Palette = {
  bg: '#F6F8FC',
  surface: '#FFFFFF',
  surfaceAlt: '#E9ECF3',
  border: '#DCE1EB',
  borderStrong: '#C3CAD9',

  text: '#141A26',
  textMuted: '#525967',
  textSubtle: '#646D7E',
  textFaint: '#7C879C',

  accent: '#2457D6',
  up: '#067647',
  down: '#C4262E',
  warning: '#9A6206',

  /** White on `accent` measures 6.2:1, so button labels stay AA. */
  onAccent: '#FFFFFF',
  logoPlate: '#F5F7FA',
  overlay: 'rgba(16,20,28,0.45)',
};

/** The two concrete palettes, by the name the preference stores. */
export const PALETTES = {
  dark: darkPalette,
  light: lightPalette,
} as const;

/** A resolved theme name — never 'system', which is a preference, not a theme. */
export type ThemeName = keyof typeof PALETTES;

/**
 * Which pair of colours carries direction.
 *
 * DEF: 'classic' is the green/red every finance product uses. 'accessible'
 * keeps the same semantics on a hue axis that survives colour-vision
 * deficiency.
 */
export type ToneMode = 'classic' | 'accessible';

/**
 * ── Why an alternative tone pair exists ─────────────────────────────────────
 * Red and green sit on the axis that the two common deficiencies compress, and
 * roughly one man in twelve has one of them. Simulating the shipped palette
 * (Viénot–Brettel–Mollon) shows how thin the margin is: in the light palette
 * under protanopia, `up` #067647 and `down` #C4262E resolve to #756c44 and
 * #59502c — two olive-browns, ΔE 11.3 apart, separated by lightness alone.
 *
 * The replacement does NOT invert or reassign the convention, which would be
 * its own usability bug. It rotates both colours off the confusion axis while
 * keeping their direction: teal is green shifted toward blue, vermillion is red
 * shifted toward orange. Someone with normal colour vision still reads
 * green-ish for up and red-ish for down.
 *
 * Measured separation of the pair below (ΔE*ab, higher is better):
 *   dark  — deuteranopia 58.3 · protanopia 41.1   (was 19.1 / 34.2)
 *   light — deuteranopia 62.7 · protanopia 46.9   (was 27.3 / 11.3)
 *
 * Teal rather than blue for `up` because blue would collide with `accent`:
 * a sky-blue `up` measured ΔE 18.8 against the accent under deuteranopia,
 * where teal measures 55.1.
 *
 * NOTE: in this mode `down` and `warning` land close together under
 * deuteranopia (light: ΔE 4.4). That is tolerated rather than designed around,
 * because `warning` never appears as a bare tone chip — every use of it in the
 * app carries an icon or a word ("OFFLINE SAMPLE") beside the colour — and it
 * never sits next to a `down` chip. Distorting `warning` to fix a collision
 * that cannot occur on screen would cost more than it buys.
 *
 * Asserted in `test/theme.test.ts`, which simulates all three dichromacies and
 * fails if a future palette edit narrows the gap.
 * ────────────────────────────────────────────────────────────────────────────
 */
const ACCESSIBLE_TONES: Record<ThemeName, Pick<Palette, 'up' | 'down'>> = {
  // Contrast on #0B0E13: up 10.4:1 · down 6.9:1
  dark: { up: '#2DD4BF', down: '#FF6B47' },
  // Contrast on #F6F8FC: up 5.2:1 · down 4.9:1
  light: { up: '#0F766E', down: '#C2410C' },
};

/**
 * Built once, at module scope, rather than composed per render.
 *
 * `makeStyles` caches on palette identity, so a palette spread into a new
 * object on every render would miss the cache every time and rebuild every
 * stylesheet in the app. There are four possible palettes; these are them.
 */
export const ACCESSIBLE_PALETTES: Record<ThemeName, Palette> = {
  dark: { ...darkPalette, ...ACCESSIBLE_TONES.dark },
  light: { ...lightPalette, ...ACCESSIBLE_TONES.light },
};

/** The palette for a resolved theme and tone preference. */
export function paletteFor(theme: ThemeName, tone: ToneMode): Palette {
  return tone === 'accessible' ? ACCESSIBLE_PALETTES[theme] : PALETTES[theme];
}

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const type = {
  title: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21 },
  bodyTight: { fontSize: 14, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12 },
  micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.3 },
  /**
   * Dense uppercase tags — MUTED, TRADE DISCLOSURE, LIVE · KEYED.
   *
   * The floor of the scale at 10pt. Three components had each independently
   * inlined this at 9pt, which is below both platforms' smallest legible size
   * (iOS HIG 11pt, Material 10sp) and was never going to survive a user with
   * larger text turned on.
   */
  tag: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.4 },
} as const;

/**
 * Slop needed to grow a `size`-square control to the ~44pt minimum target.
 *
 * Icon buttons here run 32–38pt for visual density, so every one of them needs
 * padding out. Computing it beats eyeballing a number per call site and then
 * having to re-eyeball it when the icon size changes.
 */
export function tapSlop(size: number, min = 44): number {
  return Math.max(0, Math.round((min - size) / 2));
}

/**
 * Lift for the few genuinely floating surfaces (FAB, the "new signals" pill).
 *
 * `shadow*` is iOS, `elevation` is Android; both are needed for the same
 * effect, which is exactly the kind of pairing that drifts when copy-pasted.
 */
export const shadow = {
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
} as const;

/** Translucent tint of a platform colour, for badge and chip backgrounds. */
/**
 * Alpha for a chip tinted in its own tone colour.
 *
 * 0.12 is the ceiling that keeps the label above 4.5:1 against the tinted
 * surface in both palettes. A red value chip measured 4.33:1 before this
 * existed, which `test/theme.test.ts` now fails on.
 */
export const TONE_TINT_ALPHA = 0.12;

/** Background for a chip whose label is drawn in `color`. */
export function toneChip(color: string): string {
  return tint(color, TONE_TINT_ALPHA);
}

export function tint(hex: string, alpha = 0.14): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
