import { Pressable, ScrollView, Text } from 'react-native';
import { ALL_DESCRIPTORS } from '@/providers/registry';
import type { SourceId } from '@/providers/types';
import { glyph } from '../icons';
import { makeStyles, useTheme } from '../ThemeProvider';
import { font, space, type } from '../theme';
import { Glyph } from './Glyph';

interface Props {
  hidden: SourceId[];
  onChange: (hidden: SourceId[]) => void;
  /** Signal counts per source, folded into each chip's spoken label. */
  counts: Record<string, number>;
}

/**
 * "All", then one chip per source, above the feed.
 *
 * Single choice, as in the redesign: a source chip shows that source alone,
 * and tapping it again — or tapping All — brings everything back. They filter
 * what is already loaded rather than refetching, so they respond instantly.
 *
 * The selected chip is filled with ink rather than the accent, so the state
 * survives greyscale and the accent stays reserved for actions.
 */
export function FilterChips({ hidden, onChange, counts }: Props) {
  const c = useTheme();
  const styles = useStyles();
  const all = hidden.length === 0;
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  const chip = (
    key: string,
    label: string,
    selected: boolean,
    count: number,
    onPress: () => void,
    icon?: SourceId,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.chipPressed]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      // The count is not drawn, so it is said here.
      accessibilityLabel={`${label}, ${count} signal${count === 1 ? '' : 's'}`}
    >
      {icon ? (
        <Glyph
          glyph={glyph(ALL_DESCRIPTORS.find((d) => d.id === icon)!.icon)}
          size={15}
          color={selected ? c.bg : c.textMuted}
        />
      ) : null}
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
      accessibilityRole="radiogroup"
      accessibilityLabel="Filter by source"
    >
      {chip('all', 'All', all, total, () => onChange([]))}
      {ALL_DESCRIPTORS.map((s) => {
        const selected = !all && !hidden.includes(s.id);
        const only = ALL_DESCRIPTORS.filter((d) => d.id !== s.id).map((d) => d.id);
        return chip(
          s.id,
          s.label,
          selected,
          counts[s.id] ?? 0,
          // Tapping the one source on show goes back to everything, so a chip
          // is never a dead end.
          () => onChange(selected && hidden.length === only.length ? [] : only),
          s.id,
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipOn: {
    backgroundColor: c.text,
    borderColor: c.text,
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipText: {
    ...type.label,
    fontSize: 14,
    color: c.textMuted,
  },
  chipTextOn: {
    fontFamily: font.bold,
    color: c.bg,
  },
}));
