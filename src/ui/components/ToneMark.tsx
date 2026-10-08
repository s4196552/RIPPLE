import { View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { toneColor, toneShape, type Tone } from '../tone';

interface Props {
  tone: Tone;
  size?: number;
}

/**
 * A direction as a shape: ▲ in the up colour, ▼ in the down colour, and a
 * diamond in ink for no direction.
 *
 * Drawn, not typed. A coloured glyph is a coloured icon, which the house rule
 * allows beside ink text; a coloured ▲ *character* is small text in an accent,
 * which it does not. Decorative: whatever it sits beside says the direction
 * in words for assistive tech.
 */
export function ToneMark({ tone, size = 10 }: Props) {
  const c = useTheme();
  const shape = toneShape(tone);

  if (shape === 'circle') {
    const side = Math.round(size * 0.72);
    return (
      <View
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        <View style={{ width: side, height: side, backgroundColor: c.text, transform: [{ rotate: '45deg' }] }} />
      </View>
    );
  }

  const half = size / 2;
  const color = toneColor(tone, c);
  return (
    <View
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: half,
        borderRightWidth: half,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        ...(shape === 'triangle-up'
          ? { borderBottomWidth: size * 0.9, borderBottomColor: color }
          : { borderTopWidth: size * 0.9, borderTopColor: color }),
      }}
    />
  );
}
