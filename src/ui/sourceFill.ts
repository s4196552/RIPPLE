import type { SourceId } from '@/providers/types';
import type { ThemeName } from './theme';

/**
 * The fill for a chip painted in a source's own colour.
 *
 * ── Why the source colour is not simply used as-is ──────────────────────────
 * Every `SourceDescriptor.color` was picked to be *drawn on* the dark ground —
 * congress #C084FC, insiders #F59E0B, policy #5B8DEF, stocks #3FD68C. They are
 * bright by construction, which is right for a glyph or a lane label and wrong
 * for a solid fill on a near-white page. Measured against the light background
 * (#F6F8FC) they have almost no presence at all:
 *
 *   stocks 1.76:1 · insiders 2.02:1 · congress 2.49:1 · policy 3.04:1
 *
 * WCAG 1.4.11 asks 3:1 for the boundary of a UI component, so three of the
 * four fail outright and the fourth only just clears it. A solid mint chip on
 * white reads as a smudge rather than a control.
 *
 * So the light theme gets its own darker fill per source. These are not
 * algorithmic darkenings of the originals — they were picked and measured, and
 * they hold the same hue identity while carrying white text:
 *
 *   fill vs page   congress 5.23 · insiders 4.72 · policy 5.79 · stocks 5.35
 *   white on fill  congress 5.56 · insiders 5.02 · policy 6.16 · stocks 5.69
 *
 * The dark theme needs none of this: the bright originals sit at 5.98–10.32:1
 * against #0B0E13 and carry the dark `onAccent` text at the same ratios.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * NOTE: the text on either fill is `palette.onAccent`, which is already defined
 * as "text and icons sitting on an accent-filled surface" and resolves to the
 * near-black in dark and white in light — exactly the two directions needed.
 * White text on the *bright* originals would measure 1.87–3.23:1 and fail
 * everywhere, which is the trap this module exists to avoid.
 *
 * Typed `Record<SourceId, string>` so registering a new source fails the build
 * here until someone picks a fill for it, the same gate `src/store/defaults.ts`
 * and `src/legal/privacy.ts` use.
 */
const LIGHT_FILL: Record<SourceId, string> = {
  congress: '#7E3AF2',
  insider: '#B45309',
  policy: '#2457D6',
  stocks: '#067647',
};

/**
 * Solid fill for `source` in the current theme.
 *
 * `brand` is the source's own descriptor colour, passed in rather than looked
 * up so this module stays free of the provider registry — the registry pulls
 * in all four providers, and nothing in the UI layer needs that weight to
 * paint a chip.
 */
export function sourceFill(source: SourceId, brand: string, theme: ThemeName): string {
  return theme === 'light' ? LIGHT_FILL[source] : brand;
}

/** Exposed for the contrast tests; not meant for rendering. */
export { LIGHT_FILL };
