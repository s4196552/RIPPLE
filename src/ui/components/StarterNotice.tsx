import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { makeStyles, useTheme } from '../ThemeProvider';
import { radius, space, type } from '../theme';

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
      <View style={styles.copy}>
        <Text style={styles.title}>You're seeing a starter feed</Text>
        <Text style={styles.body} numberOfLines={2}>
          A sample from each source. Follow someone to make it yours.
        </Text>
      </View>

      {/* Says what the press does instead of a bare chevron. Part of the one
          Pressable, not a second button inside it. */}
      <View style={styles.cta}>
        <Ionicons name="add" size={15} color={c.accent} />
        <Text style={styles.ctaText}>Follow</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.md,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  pressed: {
    backgroundColor: c.surfaceAlt,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.label,
    color: c.text,
  },
  body: {
    ...type.caption,
    // `textMuted`, not `textSubtle`: this sits on `surface`, where subtle
    // drops below AA in dark.
    color: c.textMuted,
    lineHeight: 16,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    // Secondary: the header's Follow is the primary one on this screen.
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  ctaText: {
    ...type.label,
    color: c.text,
  },
}));
