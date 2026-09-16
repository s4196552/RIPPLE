import { Ionicons } from '@expo/vector-icons';

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
