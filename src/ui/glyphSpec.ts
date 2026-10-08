/** The icon sets the app draws from; see `components/Glyph.tsx`. */
export type GlyphFamily = 'ion' | 'mci' | 'fa6';

const FAMILIES: readonly GlyphFamily[] = ['ion', 'mci', 'fa6'];

/**
 * Reads an icon written as a plain string — `'fa6:landmark-dome'`,
 * `'mci:access-point'`, or a bare Ionicons name like `'stats-chart'`.
 *
 * Providers and screens name their icons as strings so the provider layer
 * stays free of any icon library; this is where a string becomes a family and
 * a glyph name. A bare name is Ionicons, the house set, so every icon written
 * before the other sets arrived still means what it did.
 */
export function parseGlyph(spec: string): { family: GlyphFamily; name: string } {
  const colon = spec.indexOf(':');
  if (colon > 0) {
    const family = spec.slice(0, colon) as GlyphFamily;
    if (FAMILIES.includes(family)) return { family, name: spec.slice(colon + 1) };
  }
  return { family: 'ion', name: spec };
}
