import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDebounced } from '@/hooks/useDebounced';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { isAbort } from '@/lib/http';
import { describe, getProvider } from '@/providers/registry';
import type { SourceId, SubjectResult } from '@/providers/types';
import { useWatchlist } from '@/store/watchlist';
import { Avatar } from '@/ui/components/Avatar';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { radius, space, tint, type } from '@/ui/theme';

/**
 * Step 2 of the add flow: autocomplete for one source.
 *
 * Search runs on a debounced value, and every in-flight request is aborted when
 * a newer keystroke arrives — otherwise a slow response for "pel" can land
 * after "pelosi" and overwrite the correct suggestions.
 */
export default function SearchScreen() {
  const c = useTheme();
  const styles = useStyles();
  const { source } = useLocalSearchParams<{ source: SourceId }>();
  const router = useRouter();
  const navigation = useNavigation();

  const provider = getProvider(source);
  const meta = describe(source);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SubjectResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Handles added this session, for the inline "Added" confirmation. */
  const [justAdded, setJustAdded] = useState<string[]>([]);

  const debouncedQuery = useDebounced(query, 250);
  const abortRef = useRef<AbortController | null>(null);
  const keyboardInset = useKeyboardInset();
  const insets = useSafeAreaInsets();

  const add = useWatchlist((s) => s.add);
  const subjects = useWatchlist((s) => s.subjects);

  useEffect(() => {
    navigation.setOptions({ title: `Add ${meta.subjectNoun}` });
  }, [navigation, meta.subjectNoun]);

  useEffect(() => {
    const term = debouncedQuery.trim();
    abortRef.current?.abort();

    // An empty term is asked of the provider rather than short-circuited here,
    // because "nothing typed yet" is where a source gets to offer its standing
    // categories — every Republican, every executive order. Sources with
    // nothing to suggest return an empty list and the typing hint shows as
    // before.
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setError(null);

    provider
      .searchSubjects(term, controller.signal)
      .then((found) => {
        if (controller.signal.aborted) return;
        setResults(found);
      })
      .catch((err) => {
        if (controller.signal.aborted || isAbort(err)) return;
        setError('Search failed. Check your connection and try again.');
        setResults([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, provider]);

  const onAdd = (result: SubjectResult) => {
    add(result);
    setJustAdded((prev) => [...prev, result.handle.toLowerCase()]);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const alreadyWatched = (handle: string) =>
    subjects.some(
      (s) => s.source === source && s.handle.toLowerCase() === handle.toLowerCase(),
    );

  // Results replace themselves silently as you type: sighted users see the list
  // change, but nothing moves focus, so assistive tech had no way to know the
  // search had even finished. Announced only once settled, never mid-search.
  useEffect(() => {
    if (searching || !debouncedQuery.trim()) return;
    AccessibilityInfo.announceForAccessibility(
      results.length === 0
        ? 'No matches'
        : `${results.length} result${results.length === 1 ? '' : 's'}`,
    );
  }, [results, searching, debouncedQuery]);

  return (
    /*
     * The done bar is pinned to the bottom and the field autofocuses, so
     * without this inset the keyboard covers the only way out of the screen.
     * See `useKeyboardInset` for why `KeyboardAvoidingView` is not used.
     *
     * Both insets, because the bar has to clear two different things. The
     * keyboard event reports its height in content space, while an edge-to-edge
     * window extends underneath the system navigation bar — so the keyboard's
     * true top is `height + insets.bottom` from the window's bottom edge.
     * (Measured on a Pixel 7: keyboard reported 820px, actually topped out
     * 870px up, and 50px is exactly this device's gesture-bar inset.) With the
     * keyboard closed the term goes to zero and `insets.bottom` alone keeps the
     * bar off the gesture pill, which it needed anyway.
     */
    <View style={[styles.screen, { paddingBottom: keyboardInset + insets.bottom }]}>
      <View style={[styles.searchBar, { borderColor: tint(meta.color, 0.3) }]}>
        <Ionicons name="search" size={16} color={meta.color} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholderFor(source)}
          placeholderTextColor={c.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          accessibilityLabel={`Search ${meta.label}`}
        />
        {searching ? (
          <ActivityIndicator size="small" color={c.textMuted} />
        ) : query.length > 0 ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={space.md}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {error && (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Ionicons name="warning-outline" size={14} color={c.warning} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => `${item.source}:${item.handle}`}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const added = alreadyWatched(item.handle) || justAdded.includes(item.handle.toLowerCase());
          return (
            <Pressable
              onPress={() => !added && onAdd(item)}
              disabled={added}
              style={({ pressed }) => [styles.row, pressed && !added && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityState={{ disabled: added }}
              accessibilityLabel={
                added
                  ? `${item.displayName} is already on your watchlist`
                  : `Add ${item.displayName}${item.subtitle ? `, ${item.subtitle}` : ''}`
              }
            >
              <Avatar
                uri={item.avatarUrl}
                name={item.displayName}
                accent={meta.color}
                square={source === 'stocks' || source === 'insider'}
              />

              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.displayName}
                </Text>
                {item.subtitle ? (
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>

              {added ? (
                <View style={styles.addedTag}>
                  <Ionicons name="checkmark" size={13} color={c.up} />
                  <Text style={styles.addedText}>Added</Text>
                </View>
              ) : (
                <View style={[styles.addButton, { backgroundColor: tint(meta.color, 0.18) }]}>
                  <Ionicons name="add" size={17} color={meta.color} />
                </View>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.hint}>
            <Text style={styles.hintText}>
              {query.trim().length === 0
                ? hintFor(source)
                : searching
                  ? 'Searching…'
                  : 'No matches. Try a different spelling.'}
            </Text>
          </View>
        }
      />

      {justAdded.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.doneBar, pressed && { opacity: 0.85 }]}
          onPress={() => router.dismissTo('/')}
          accessibilityRole="button"
          accessibilityLabel={`Done. ${justAdded.length} added. Return to feed.`}
        >
          <Text style={styles.doneText}>Done · {justAdded.length} added</Text>
          <Ionicons name="arrow-forward" size={16} color={c.onAccent} />
        </Pressable>
      )}
    </View>
  );
}

function placeholderFor(source: SourceId): string {
  switch (source) {
    case 'congress':
      return 'Name, district, or a party';
    case 'insider':
      return 'Company or ticker';
    case 'policy':
      return 'Topic, or pick a document type';
    case 'stocks':
      return 'Ticker or company name';
  }
}

function hintFor(source: SourceId): string {
  switch (source) {
    case 'congress':
      return 'Follow a whole party, or search any House member who has filed a trade disclosure — try a surname, or a district like CA-11.';
    case 'insider':
      return 'Search a company to follow its executives’ and directors’ Form 4 filings — try NVDA, or “Apple”.';
    case 'policy':
      return 'Type any topic to watch it across presidential actions — try “tariff”, “semiconductor”, or “energy”.';
    case 'stocks':
      return 'Start typing a ticker — AAPL, NVDA, BTC-USD — or a company name.';
  }
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    margin: space.lg,
    paddingHorizontal: space.md,
    // `minHeight` and padding rather than a fixed 46: the input's text scales
    // with the system text size, and a fixed box would clip it for anyone who
    // has turned that up. This is the only text-bearing container in the app
    // that was pinned to an exact height.
    minHeight: 46,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: c.surface,
  },
  input: {
    flex: 1,
    ...type.body,
    color: c.text,
    // RN vertically centres single-line inputs inconsistently on Android.
    paddingVertical: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  errorText: {
    ...type.caption,
    color: c.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rowPressed: {
    backgroundColor: c.surface,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...type.label,
    color: c.text,
  },
  rowSubtitle: {
    ...type.caption,
    color: c.textMuted,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: tint(c.up, 0.14),
  },
  addedText: {
    ...type.micro,
    color: c.up,
  },
  hint: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
  },
  hintText: {
    ...type.body,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  doneBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    margin: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
  },
  doneText: {
    ...type.label,
    color: c.onAccent,
  },
}));
