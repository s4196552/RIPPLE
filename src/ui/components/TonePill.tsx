import { Text, View } from 'react-native';
import { makeStyles, useTheme } from '../ThemeProvider';
import { font, type } from '../theme';
import { markedLabel, toneColor, type Tone } from '../tone';

interface Props {
  tone: Tone;
  label: string;
  /**
   * 'value' for figures (+$50K, −6.20%), set in mono; 'tag' for words
   * (BUY, SOLD HIGH), set in the uppercase tag face.
   */
  variant?: 'value' | 'tag';
}

/**
 * A direction, as a solid pill: the tone colour behind `onAccent` text.
 *
 * The one way toned text is drawn. The tone colours are shared by all three
 * modes, and at their middle lightness small text written *in* them misses AA
 * on White and on Dark blue cards (3.6–4.3:1). Text written *on* them is
 * ≈5:1 everywhere, so the colour goes behind the words instead.
 *
 * Decorative to assistive tech only in the sense that callers fold the spoken
 * form (`spokenLabel`) into their own label; on its own it reads the label.
 */
export function TonePill({ tone, label, variant = 'value' }: Props) {
  const c = useTheme();
  const styles = useStyles();
  const neutral = tone === 'neutral';

  return (
    <View style={[styles.pill, { backgroundColor: neutral ? c.surfaceAlt : toneColor(tone, c) }]}>
      <Text
        style={[variant === 'value' ? styles.value : styles.tag, { color: neutral ? c.text : c.onAccent }]}
        numberOfLines={1}
      >
        {variant === 'tag' ? markedLabel(tone, label).toUpperCase() : markedLabel(tone, label)}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  value: {
    ...type.mono,
    fontFamily: font.monoSemibold,
  },
  tag: {
    ...type.micro,
    fontFamily: font.bold,
    letterSpacing: 0.6,
  },
}));
