import type { Palette } from './theme';

/**
 * How direction is drawn.
 *
 * DEF: a **tone** is the direction a signal points — a purchase, a sale, a
 * well-timed trade. Ripple paints it green or red, which is the convention and
 * is staying.
 *
 * ── Why colour is not allowed to be the only cue ────────────────────────────
 * WCAG 1.4.1 (Level A — stricter than the AA contrast the palette already
 * meets) says colour must not be the only visual means of conveying
 * information. Ripple was close but not clean:
 *
 *   - Chips and returns already carried a sign: `+$50K`, `-6.20%`. Technically
 *     a second cue, but `+` and `−` differ by one short stroke at 10px in a
 *     mono face, which is a thin thing to hang a buy/sell distinction on.
 *   - `qualityLabel` already says "Sold high" or "Bought early" in words, so
 *     that one was genuinely fine and is left alone — a mark there would
 *     restate the sentence next to it.
 *   - The timeline dots were the real failure: a coloured circle, no text,
 *     nothing else to read. Those become triangles, which is what `shape`
 *     below is for.
 *
 * So the mark is added where it strengthens a weak cue or supplies a missing
 * one, and not where the label already says the word.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Pure on purpose — no React, no palette import beyond the type — so the
 * marking rules are unit-tested without a renderer.
 */

export type Tone = 'up' | 'down' | 'neutral';

/** The palette colour for a tone. Plain function: a helper cannot call a hook. */
export function toneColor(tone: Tone, c: Palette): string {
  if (tone === 'up') return c.up;
  if (tone === 'down') return c.down;
  return c.textMuted;
}

/**
 * The glyph that carries direction without colour.
 *
 * Geometric triangles rather than arrows (↑ ↓) because they hold their shape
 * at 10px where an arrow's stem and head blur together, and because the
 * timeline draws the same two shapes — one vocabulary for direction across the
 * whole app.
 */
export function toneMark(tone: Tone): string {
  if (tone === 'up') return '▲';
  if (tone === 'down') return '▼';
  return '';
}

/** `▲ +$50K`. Falls back to the bare label when there is no direction to mark. */
export function markedLabel(tone: Tone, label: string): string {
  const mark = toneMark(tone);
  return mark ? `${mark} ${label}` : label;
}

/**
 * The same thing in words.
 *
 * A screen reader renders `▲` as "black up-pointing triangle", which is worse
 * than silence, so anything spoken uses this instead of the marked label.
 */
export function toneWord(tone: Tone): string {
  if (tone === 'up') return 'Up';
  if (tone === 'down') return 'Down';
  return '';
}

/** `Up, +$50K` — what a screen reader should hear in place of the glyph. */
export function spokenLabel(tone: Tone, label: string): string {
  const word = toneWord(tone);
  return word ? `${word}, ${label}` : label;
}

/**
 * Non-colour encoding for a mark that has no room for text.
 *
 * The timeline's clusters are 12px dots on a shared axis. There is nowhere to
 * put a glyph, so the dot itself becomes the glyph: it points the way the tone
 * points, and a tone with no direction stays a circle.
 */
export type ToneShape = 'triangle-up' | 'triangle-down' | 'circle';

export function toneShape(tone: Tone): ToneShape {
  if (tone === 'up') return 'triangle-up';
  if (tone === 'down') return 'triangle-down';
  return 'circle';
}
