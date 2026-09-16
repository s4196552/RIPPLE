import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ALL_DESCRIPTORS } from '@/providers/registry';
import type { SourceId } from '@/providers/types';
import { iconName } from '../icons';
import { makeStyles, useTheme } from '../ThemeProvider';
import { radius, space, tint, type } from '../theme';

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

        return (
          <Pressable
            key={s.id}
            onPress={() => onToggle(s.id)}
            hitSlop={{ top: space.sm, bottom: space.sm }}
            style={[
              styles.chip,
              off
                ? styles.chipOff
                : { backgroundColor: tint(s.color, 0.15), borderColor: tint(s.color, 0.4) },
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: !off }}
            // The count is only rendered as a small pill, so it has to be said
            // out loud here or it's invisible to assistive tech.
            accessibilityLabel={`${s.label} filter, ${count} signal${count === 1 ? '' : 's'}`}
          >
            <Ionicons name={iconName(s.icon)} size={13} color={off ? c.textMuted : s.color} />
            <Text style={[styles.chipText, { color: off ? c.textMuted : s.color }]}>
              {s.label}
            </Text>
            <View
              style={[
                styles.count,
                { backgroundColor: off ? c.surfaceAlt : tint(s.color, 0.22) },
              ]}
            >
              <Text style={[styles.countText, { color: off ? c.textMuted : s.color }]}>
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
