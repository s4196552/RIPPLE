import { FontAwesome6, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

/**
 * An icon from any of the three sets the app draws from.
 *
 * Ionicons stays the house set; the other two are here for marks it doesn't
 * have — a Capitol dome, the party marks, a radiating signal. Names are checked
 * against each set's glyph map, except FontAwesome6, whose package ships its
 * icon set typed as `any`; those names are covered by `test/glyphSpec.test.ts`
 * and `test/groupGlyph.test.ts` instead.
 */
export type GlyphSpec =
  | { family: 'ion'; name: keyof typeof Ionicons.glyphMap }
  | { family: 'mci'; name: keyof typeof MaterialCommunityIcons.glyphMap }
  | { family: 'fa6'; name: string };

interface Props {
  glyph: GlyphSpec;
  size: number;
  color: ColorValue;
}

export function Glyph({ glyph, size, color }: Props) {
  switch (glyph.family) {
    case 'ion':
      return <Ionicons name={glyph.name} size={size} color={color} />;
    case 'mci':
      return <MaterialCommunityIcons name={glyph.name} size={size} color={color} />;
    case 'fa6':
      // FontAwesome6 defaults to its regular style, which has no dome or party
      // marks; `solid` selects the set that does.
      return <FontAwesome6 name={glyph.name} size={size} color={color} solid />;
  }
}
