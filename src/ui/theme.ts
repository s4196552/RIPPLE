/**
 * Design tokens — the "Tide Table" redesign.
 *
 * Quiet, dense chrome: neutral surfaces, ink in three steps, and colour kept
 * for meaning — the accent for things you can press, teal and orange for
 * direction, amber for warnings. Sources are told apart by icon and name, not
 * by colour.
 *
 * ── Three modes, one set of accents ─────────────────────────────────────────
 * The app has three palettes — Dark blue, True black and White — and they
 * share the SAME accents. Only the neutrals (backgrounds, cards, ink, rules)
 * change with the mode, so a buy chip or the Follow button is the same colour
 * wherever someone meets it.
 *
 * One colour cannot be dark enough for a white card and light enough for a
 * navy one at the same time, so the shared accents sit at a middle lightness
 * (relative luminance ≈0.22). What that buys and what it costs, measured:
 *
 *   accent / up / down / warning against every bg, surface and surfaceAlt in
 *   all three modes ≥ 3:1     → clears WCAG 3:1 for icons, fills, borders and
 *                                large text everywhere.
 *   `onAccent` (#050C18) on any of them ≥ 4.9:1 → AA for small text.
 *   Small text drawn IN an accent colour: 3.6–5.3:1 → NOT AA on White or on
 *                                a Dark blue card.
 *
 * Hence the house rule: small text never sits in an accent colour. A toned
 * value goes in a solid pill (`TonePill`: tone fill, `onAccent` text), a
 * warning is ink text beside a warning-coloured icon, and a link is ink text
 * with an accent icon. The accent paints shapes; ink paints words.
 *
 * Asserted in `test/theme.test.ts`.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── Why there is no `colors` export ─────────────────────────────────────────
 * There used to be one, and every screen imported it at module scope inside
 * `StyleSheet.create`. That captures the value once, at import, which means a
 * runtime theme switch cannot reach it. Palettes are therefore reached through
 * `useTheme()` and `makeStyles()` in `./ThemeProvider`, never imported
 * directly.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Every colour role in the app. Every palette must define all of them, so a
 * token added for one mode cannot be forgotten in the others.
 */
export interface Palette {
  /** App background. */
  bg: string;
  /** Cards, the tab bar and other raised surfaces. */
  surface: string;
  /** Pressed / secondary surfaces, avatar plates, segmented tracks. */
  surfaceAlt: string;
  /** The selected segment sitting on a `surfaceAlt` track. */
  raised: string;
  /** Hairlines and card borders. Deliberately low contrast. */
  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  /** The dimmest tone still safe for text that carries information. */
  textSubtle: string;
  /** Decorative chrome only — separators, inactive glyphs. Fails AA for text. */
  textFaint: string;

  /** Shared across all three modes — see the header. Shapes, not words. */
  accent: string;
  up: string;
  down: string;
  warning: string;

  /** Text and icons sitting on an accent-, up-, down- or warning-filled surface. */
  onAccent: string;
  /**
   * The plate a logo is drawn on. The one neutral that does NOT follow the
   * mode: logos arrive as transparent artwork drawn for light backgrounds.
   */
  logoPlate: string;
  overlay: string;
}

/**
 * The accents every mode shares.
 *
 * `up` and `down` here are the design's teal and orange — the pair that stays
 * apart under red-green colour blindness. `CLASSIC_TONES` swaps in green/red.
 */
export const SHARED_ACCENTS = {
  accent: '#3E78FF',
  up: '#009179',
  down: '#DF5200',
  warning: '#AA7700',
  onAccent: '#050C18',
} as const;

/**
 * Dark blue. Contrast against `bg` (#0A1222):
 *   text 16.1:1 · textMuted 10.4:1 · textSubtle 7.2:1
 *   textFaint 3.5:1 — BELOW AA, decorative only.
 */
export const darkPalette: Palette = {
  bg: '#0A1222',
  surface: '#111C33',
  surfaceAlt: '#1B2844',
  raised: '#2A3A62',
  border: '#2A3858',
  borderStrong: '#4A5B80',

  text: '#E8EEF9',
  textMuted: '#B6C2D9',
  textSubtle: '#93A1BC',
  textFaint: '#5A6A8C',

  ...SHARED_ACCENTS,
  logoPlate: '#F5F7FA',
  overlay: 'rgba(0,0,0,0.6)',
};

/**
 * True black, for OLED screens. Contrast against `bg` (#000000):
 *   text 18.9:1 · textMuted 11.1:1 · textSubtle 6.8:1
 *   textFaint 3.6:1 — BELOW AA, decorative only.
 */
export const blackPalette: Palette = {
  bg: '#000000',
  surface: '#0E0E10',
  surfaceAlt: '#18191D',
  raised: '#2A2B31',
  border: '#26282E',
  borderStrong: '#3A3D45',

  text: '#F2F3F5',
  textMuted: '#B9BCC4',
  textSubtle: '#8F939C',
  textFaint: '#62656D',

  ...SHARED_ACCENTS,
  logoPlate: '#F5F7FA',
  overlay: 'rgba(0,0,0,0.6)',
};

/**
 * White. Contrast against `bg` (#F2F5F4):
 *   text 15.6:1 · textMuted 7.7:1 · textSubtle 5.4:1
 *   textFaint 3.2:1 — BELOW AA, deliberately, so the token keeps the same
 *   decorative-only meaning in every mode.
 */
export const lightPalette: Palette = {
  bg: '#F2F5F4',
  surface: '#FFFFFF',
  surfaceAlt: '#E7EDEB',
  raised: '#FFFFFF',
  border: '#D3DCD9',
  borderStrong: '#A6B3C9',

  text: '#0F1E1D',
  textMuted: '#41504D',
  textSubtle: '#586764',
  textFaint: '#7F8C89',

  ...SHARED_ACCENTS,
  logoPlate: '#F5F7FA',
  overlay: 'rgba(12,19,19,0.45)',
};

/** The concrete palettes, by the name the preference stores. */
export const PALETTES = {
  dark: darkPalette,
  black: blackPalette,
  light: lightPalette,
} as const;

/** A resolved theme name — never 'system', which is a preference, not a theme. */
export type ThemeName = keyof typeof PALETTES;

/** True for the two dark modes. Most "is this dark?" questions want this. */
export function isDark(theme: ThemeName): boolean {
  return theme !== 'light';
}

/**
 * Which pair of colours carries direction.
 *
 * DEF: 'accessible' is the design's teal/orange and the default. 'classic' is
 * the green/red every finance product uses, for anyone who wants the
 * convention.
 */
export type ToneMode = 'classic' | 'accessible';

/**
 * ── Why two tone pairs ──────────────────────────────────────────────────────
 * Red and green sit on the axis that the two common colour-vision deficiencies
 * compress, and roughly one man in twelve has one of them. Teal/orange rotates
 * both colours off that axis while keeping their direction: teal is green
 * shifted toward blue, orange is red shifted toward yellow.
 *
 * Both pairs are shared across modes like the other accents and sit at the
 * same middle lightness, so each clears 3:1 on every surface and carries
 * `onAccent` text at AA.
 *
 * Teal rather than blue for `up` because blue would collide with `accent`.
 *
 * NOTE: `down` (orange) and `warning` (amber) land close together under
 * deuteranopia. Tolerated: `warning` never appears as a bare tone chip — it
 * always carries an icon or a word — and never sits next to a `down` chip.
 *
 * Asserted in `test/theme.test.ts`, which simulates all three dichromacies.
 * ────────────────────────────────────────────────────────────────────────────
 */
const CLASSIC_TONES: Pick<Palette, 'up' | 'down'> = {
  up: '#1F9A48',
  down: '#E5484D',
};

/**
 * Built once, at module scope, rather than composed per render.
 *
 * `makeStyles` caches on palette identity, so a palette spread into a new
 * object on every render would miss the cache every time. The base palettes
 * already carry the accessible pair, so they are used as they are.
 */
export const ACCESSIBLE_PALETTES: Record<ThemeName, Palette> = PALETTES;

export const CLASSIC_PALETTES: Record<ThemeName, Palette> = {
  dark: { ...darkPalette, ...CLASSIC_TONES },
  black: { ...blackPalette, ...CLASSIC_TONES },
  light: { ...lightPalette, ...CLASSIC_TONES },
};

/** The palette for a resolved theme and tone preference. */
export function paletteFor(theme: ThemeName, tone: ToneMode): Palette {
  return tone === 'classic' ? CLASSIC_PALETTES[theme] : ACCESSIBLE_PALETTES[theme];
}

/**
 * Font families, one per weight.
 *
 * Instrument Sans for everything, IBM Plex Mono for tickers, prices and
 * counts. Each weight is its own family because a custom font with a
 * `fontWeight` on top gets a synthesised bold on Android — so styles set
 * `fontFamily` and never `fontWeight`. Loaded in `app/_layout.tsx`.
 */
export const font = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoSemibold: 'IBMPlexMono_600SemiBold',
} as const;

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
  /** Screen titles in the tab headers: "Signals", "Watchlist". */
  display: { fontSize: 28, lineHeight: 34, fontFamily: font.bold, letterSpacing: -0.3 },
  title: { fontSize: 20, lineHeight: 26, fontFamily: font.bold, letterSpacing: -0.2 },
  heading: { fontSize: 16, lineHeight: 21, fontFamily: font.semibold },
  body: { fontSize: 15, lineHeight: 21, fontFamily: font.regular },
  bodyTight: { fontSize: 14, lineHeight: 20, fontFamily: font.regular },
  label: { fontSize: 13, lineHeight: 18, fontFamily: font.semibold },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: font.regular },
  micro: { fontSize: 11, lineHeight: 14, fontFamily: font.semibold, letterSpacing: 0.3 },
  /**
   * The uppercase kicker over a card or a day: "STOCKS · VOLUME SPIKE",
   * "TODAY · WED 7 OCT". Pair with `textTransform: 'uppercase'`.
   */
  eyebrow: { fontSize: 11, lineHeight: 14, fontFamily: font.semibold, letterSpacing: 0.9 },
  /**
   * Dense uppercase tags — MUTED, TRADE DISCLOSURE, BUY.
   *
   * The floor of the scale at 10pt. Three components had each independently
   * inlined this at 9pt, which is below both platforms' smallest legible size
   * (iOS HIG 11pt, Material 10sp) and was never going to survive a user with
   * larger text turned on.
   */
  tag: { fontSize: 10, lineHeight: 13, fontFamily: font.bold, letterSpacing: 0.5 },
  /** Tickers, prices, counts. Tabular so columns of figures line up. */
  mono: { fontSize: 13, lineHeight: 18, fontFamily: font.monoSemibold, fontVariant: ['tabular-nums'] as ['tabular-nums'] },
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
