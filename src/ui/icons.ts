import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { GlyphSpec } from './components/Glyph';
import { parseGlyph } from './glyphSpec';

/** Every glyph name Ionicons will actually render. */
export type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Narrows a runtime string to an Ionicons glyph name.
 *
 * The provider registry types `icon` as a plain `string`, because the provider
 * layer has no business depending on an icon library. That left four
 * components each writing `name={icon as never}` — a cast that silences the
 * error without checking anything, so a typo'd glyph reached the device as a
 * blank space. This checks, and says so when it fails.
 */
export function iconName(name: string): IconName {
  if (name in Ionicons.glyphMap) return name as IconName;
  if (__DEV__) {
    console.warn(`[icons] "${name}" is not an Ionicons glyph — falling back to help-circle.`);
  }
  return 'help-circle-outline';
}

/**
 * `iconName` for any of the app's icon sets: turns `'fa6:scale-balanced'`,
 * `'mci:access-point'` or a bare Ionicons name into something `<Glyph>` draws.
 *
 * Ionicons and MaterialCommunity names are checked here, with the same
 * fallback as `iconName`. FontAwesome6 ships its icon set typed as `any`, with
 * no glyph map to check against at runtime, so its names are checked by
 * `test/glyphSpec.test.ts` instead.
 */
export function glyph(spec: string): GlyphSpec {
  const { family, name } = parseGlyph(spec);
  if (family === 'fa6') return { family, name };
  if (family === 'mci') {
    if (name in MaterialCommunityIcons.glyphMap) {
      return { family, name: name as keyof typeof MaterialCommunityIcons.glyphMap };
    }
    if (__DEV__) {
      console.warn(`[icons] "${name}" is not a MaterialCommunityIcons glyph — falling back to help-circle.`);
    }
    return { family: 'ion', name: 'help-circle-outline' };
  }
  return { family: 'ion', name: iconName(name) };
}
