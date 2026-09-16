import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ALL_DESCRIPTORS } from '@/providers/registry';
import type { SourceId } from '@/providers/types';
import { iconName } from '../icons';
import { makeStyles, useTheme, useThemeName } from '../ThemeProvider';
import { radius, space, tint, type } from '../theme';
import { sourceFill } from '../sourceFill';

interface Props {
  hidden: SourceId[];
  onToggle: (source: SourceId) => void;
  /** Signal counts per source, shown inside each chip. */
  counts: Record<string, number>;
}

/**
 * Source toggles above the feed. These filter what's already loaded rather than
 * refetching, so they respond instantly.
 */
export function FilterChips({ hidden, onToggle, counts }: Props) {
  const c = useTheme();
  const styles = useStyles();
  const themeName = useThemeName();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {ALL_DESCRIPTORS.map((s) => {
        const off = hidden.includes(s.id);
        const count = counts[s.id] ?? 0;
        // Solid when on. The light theme uses its own darker fill per source —
        // the bright descriptor colours have almost no presence on a near-white
        // page. See `sourceFill` for the measurements.
        const fill = sourceFill(s.id, s.color, themeName);

        return (
          <Pressable
            key={s.id}
            onPress={() => onToggle(s.id)}
            hitSlop={{ top: space.sm, bottom: space.sm }}
            style={[
              styles.chip,
              off ? styles.chipOff : { backgroundColor: fill, borderColor: fill },
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: !off }}
            // The count is only rendered as a small pill, so it has to be said
            // out loud here or it's invisible to assistive tech.
            accessibilityLabel={`${s.label} filter, ${count} signal${count === 1 ? '' : 's'}`}
          >
            {/* `onAccent` is the token for text on a filled surface: near-black
                in dark, white in light — which is the right direction for both
                fills. White on the bright originals would measure 1.87–3.23:1
                and fail everywhere. */}
            <Ionicons name={iconName(s.icon)} size={13} color={off ? c.textMuted : c.onAccent} />
            <Text style={[styles.chipText, { color: off ? c.textMuted : c.onAccent }]}>
              {s.label}
            </Text>
            <View
              style={[
                styles.count,
                // A wash of the text colour over the fill, so the pill reads as
                // part of the chip rather than a second object stuck on it.
                { backgroundColor: off ? c.surfaceAlt : tint(c.onAccent, 0.2) },
              ]}
            >
              <Text style={[styles.countText, { color: off ? c.textMuted : c.onAccent }]}>
                {count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  row: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipOff: {
    backgroundColor: 'transparent',
    borderColor: c.border,
  },
  chipText: {
    ...type.micro,
  },
  count: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
  },
}));
