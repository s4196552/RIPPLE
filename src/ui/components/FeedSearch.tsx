import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  NO_FILTER,
  isFiltering,
  type ActionFilter,
  type FeedFilter,
  type SearchWindow,
} from '@/lib/search';
import { makeStyles, useTheme } from '../ThemeProvider';
import { radius, space, tapSlop, type } from '../theme';

interface Props {
  filter: FeedFilter;
  onChange: (filter: FeedFilter) => void;
  /** `12 of 340`, shown only while something is actually filtered. */
  summary: string;
  /** Tickers worth offering before anything is typed. */
  suggestions: readonly string[];
}

const ACTIONS: { value: ActionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'buy', label: 'Buys' },
  { value: 'sell', label: 'Sells' },
];

const WINDOWS: { value: SearchWindow; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

/**
 * Search and narrow the feed.
 *
 * The refinements sit under the field rather than behind a toggle. They are two
 * short rows, they say what the current state is just by being visible, and a
 * hidden filter that is silently still applied is the thing that makes people
 * think an app has lost their data.
 */
export function FeedSearch({ filter, onChange, summary, suggestions }: Props) {
  const c = useTheme();
  const styles = useStyles();
  const filtering = isFiltering(filter);

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Ionicons name="search" size={15} color={c.textMuted} />

        <TextInput
          value={filter.query}
          onChangeText={(query) => onChange({ ...filter, query })}
          placeholder="Search people, tickers, filings"
          placeholderTextColor={c.textFaint}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          // `search` gives iOS the clear affordance and the right keyboard, and
          // the label names the scope because the placeholder disappears the
          // moment anything is typed.
          accessibilityRole="search"
          accessibilityLabel="Search the feed by person, ticker or filing text"
          clearButtonMode="while-editing"
        />

        {/* Android has no `clearButtonMode`, so the control is drawn here for
            both rather than leaving one platform without a way out. */}
        {filter.query.length > 0 && (
          <Pressable
            onPress={() => onChange({ ...filter, query: '' })}
            hitSlop={tapSlop(18)}
            accessibilityRole="button"
            accessibilityLabel="Clear the search text"
          >
            <Ionicons name="close-circle" size={16} color={c.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Offered only on an empty field: once someone is typing, a row of
          alternatives is noise competing with the results underneath. */}
      {filter.query === '' && suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          keyboardShouldPersistTaps="handled"
        >
          {suggestions.map((ticker) => (
            <Pressable
              key={ticker}
              onPress={() => onChange({ ...filter, query: ticker })}
              style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Search for ${ticker}`}
            >
              <Text style={styles.suggestionText}>{ticker}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Transaction">
          {ACTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={filter.action === option.value}
              onPress={() => onChange({ ...filter, action: option.value })}
              group="Transaction"
            />
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Time range">
          {WINDOWS.map((option) => (
            <Chip
              key={String(option.value)}
              label={option.label}
              selected={filter.window === option.value}
              onPress={() => onChange({ ...filter, window: option.value })}
              group="Time range"
            />
          ))}
        </View>
      </ScrollView>

      {filtering && (
        <View style={styles.statusRow}>
          {/* Announced because the count changes as a consequence of typing,
              which a screen reader user otherwise has no way to hear. */}
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {summary}
          </Text>

          <Pressable
            onPress={() => onChange(NO_FILTER)}
            hitSlop={tapSlop(20)}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters and show the whole feed"
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  group,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  group: string;
}) {
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      // Without the group name each chip announces as a bare word — "All",
      // "7 days" — with nothing saying what it would change.
      accessibilityLabel={`${group}: ${label}`}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    paddingTop: space.sm,
    gap: space.sm,
    backgroundColor: c.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  input: {
    flex: 1,
    // Height rather than padding so the field does not collapse on Android,
    // which measures an empty TextInput at close to nothing.
    minHeight: 40,
    ...type.bodyTight,
    color: c.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  group: {
    flexDirection: 'row',
    gap: space.xs,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginHorizontal: space.sm,
    backgroundColor: c.border,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipSelected: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  chipText: {
    ...type.micro,
    color: c.textMuted,
  },
  chipTextSelected: {
    color: c.onAccent,
  },
  suggestion: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
  },
  suggestionText: {
    ...type.micro,
    color: c.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  status: {
    ...type.caption,
    color: c.textMuted,
  },
  clear: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  clearText: {
    ...type.micro,
    color: c.text,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.7,
  },
}));
