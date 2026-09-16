import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { makeStyles, useTheme } from '../ThemeProvider';
import { radius, space, tint, type } from '../theme';

interface Props {
  /** Where "make it yours" goes — the add flow. */
  onPress: () => void;
}

/**
 * Says out loud that the feed under it is the starter set, not the user's.
 *
 * The starter feed is only defensible if it is labelled. Without this strip a
 * new user sees four sources of real filings and has no way to know that none
 * of it is anything they chose, or that the list will change the moment they
 * follow something — which reads as the app silently deciding for them.
 *
 * One Pressable wrapping the whole strip rather than a button inside it:
 * nesting Pressables renders a `<button>` inside a `<button>` on web, which is
 * invalid and swallows the inner press on some browsers.
 */
export function StarterNotice({ onPress }: Props) {
  const c = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      // The whole strip announces as one thing. Read as separate nodes it is
      // three fragments — a title, a sentence and a chevron — none of which
      // says what happens if you press it.
      accessibilityLabel="Starter feed. These are sample subjects from each public source, not a watchlist of your own. Double tap to follow your first subject."
    >
      <View style={styles.iconRing}>
        <Ionicons name="sparkles-outline" size={15} color={c.accent} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>Starter feed</Text>
        <Text style={styles.body} numberOfLines={2}>
          A sample from each source. Follow anything to make this yours.
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: tint(c.accent, 0.09),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tint(c.accent, 0.3),
  },
  pressed: {
    backgroundColor: tint(c.accent, 0.16),
  },
  iconRing: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tint(c.accent, 0.16),
  },
  copy: {
    flex: 1,
    gap: 1,
  },
  title: {
    ...type.label,
    color: c.text,
  },
  body: {
    ...type.caption,
    color: c.textMuted,
    lineHeight: 16,
  },
}));
