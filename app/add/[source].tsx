import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { useDebounced } from '@/hooks/useDebounced';
import { partyTag, withoutParty } from '@/lib/filing';
import { isAbort } from '@/lib/http';
import { describe, getProvider } from '@/providers/registry';
import type { SourceId, SubjectResult } from '@/providers/types';
import { useWatchlist } from '@/store/watchlist';
import { Avatar } from '@/ui/components/Avatar';
import { FollowedSheet } from '@/ui/components/FollowedSheet';
import { FOLLOW_COPY } from '@/ui/followCopy';
import { groupGlyph } from '@/ui/groupGlyph';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { font, radius, space, tint, type } from '@/ui/theme';

/**
 * Step 2 of the Follow flow: who or what, within one source.
 *
 * With nothing typed the provider offers its standing choices — every
 * Republican, every executive order — so the screen opens on something to
 * follow rather than an empty field. Search runs on a debounced value, and
 * every in-flight request is aborted when a newer keystroke arrives, otherwise
 * a slow response for "pel" can land after "pelosi" and overwrite it.
 */
export default function SearchScreen() {
  const c = useTheme();
  const styles = useStyles();
  const { source } = useLocalSearchParams<{ source: SourceId }>();
  const router = useRouter();
  const navigation = useNavigation();

  const provider = getProvider(source);
  const meta = describe(source);
  const copy = FOLLOW_COPY[source];

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SubjectResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followed, setFollowed] = useState<SubjectResult | null>(null);

  const debouncedQuery = useDebounced(query, 250);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<TextInput>(null);

  const add = useWatchlist((s) => s.add);
  const subjects = useWatchlist((s) => s.subjects);

  const searchMode = focused || query.length > 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerLeft: () => (
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => router.back()}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back to sources"
          >
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </Pressable>
          <Text style={styles.step}>Step 2 of 2 · {meta.label}</Text>
        </View>
      ),
    });
  }, [navigation, router, styles, c, meta.label]);

  useEffect(() => {
    const term = debouncedQuery.trim();
    abortRef.current?.abort();

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

  // Results replace themselves silently as you type, so the settled count is
  // announced — never mid-search.
  useEffect(() => {
    if (searching || !debouncedQuery.trim()) return;
    AccessibilityInfo.announceForAccessibility(
      results.length === 0 ? 'No matches' : `${results.length} result${results.length === 1 ? '' : 's'}`,
    );
  }, [results, searching, debouncedQuery]);

  const onFollow = (result: SubjectResult) => {
    add(result);
    setFollowed(result);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const isFollowing = (handle: string) =>
    subjects.some((s) => s.source === source && s.handle.toLowerCase() === handle.toLowerCase());

  const cancel = () => {
    setQuery('');
    inputRef.current?.blur();
  };

  const term = query.trim();
  const sectionTitle = term
    ? 'Matches'
    : source === 'congress'
      ? 'Follow a whole party'
      : 'Suggestions';

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        {!searchMode && (
          <Text style={styles.title} accessibilityRole="header">
            {copy.question}
          </Text>
        )}

        <View style={styles.searchRow}>
          <View style={[styles.field, focused && styles.fieldFocused]}>
            <Ionicons name="search" size={20} color={c.textMuted} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={placeholderFor(source)}
              placeholderTextColor={c.textSubtle}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={`Search ${meta.label}`}
            />
            {searching && term ? (
              <ActivityIndicator size="small" color={c.textMuted} />
            ) : query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                style={styles.clear}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={c.textSubtle} />
              </Pressable>
            ) : null}
          </View>
          {searchMode && (
            <Pressable onPress={cancel} style={styles.cancel} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          )}
        </View>
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
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          results.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionText} accessibilityRole="header">
                {sectionTitle}
              </Text>
              {term ? (
                <Text style={styles.sectionCount}>
                  {results.length} match{results.length === 1 ? '' : 'es'}
                </Text>
              ) : null}
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          const following = isFollowing(item.handle);
          const group = groupGlyph(item.source, item.handle);
          const party = partyTag(item.subtitle);
          const sub = party ? withoutParty(item.subtitle) : item.subtitle;
          const first = index === 0;
          const last = index === results.length - 1;
          return (
            // The list is drawn as one card: each row carries its share of the
            // border so the FlatList can still recycle rows.
            <View style={[styles.row, first && styles.rowFirst, last && styles.rowLast, !first && styles.rowRule]}>
              <Avatar
                uri={item.avatarUrl}
                name={item.displayName}
                glyph={group?.glyph}
                size={44}
                square={source === 'stocks' || source === 'insider'}
              />
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>
                  <Highlighted text={item.displayName} term={term} />
                </Text>
                {party || sub ? (
                  <View style={styles.subLine}>
                    {party ? (
                      <View style={styles.party}>
                        <Text style={styles.partyText}>{party}</Text>
                      </View>
                    ) : null}
                    {sub ? (
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {sub}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {following ? (
                <View
                  style={styles.following}
                  accessible
                  accessibilityLabel={`Following ${item.displayName}`}
                >
                  <Ionicons name="checkmark" size={16} color={c.accent} />
                  <Text style={styles.followText}>Following</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => onFollow(item)}
                  style={({ pressed }) => [styles.follow, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Follow ${item.displayName}${item.subtitle ? `, ${item.subtitle}` : ''}`}
                >
                  <Ionicons name="add" size={16} color={c.accent} />
                  <Text style={styles.followText}>Follow</Text>
                </Pressable>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          term && !searching ? (
            <Text style={styles.hint}>No matches. Try a different spelling.</Text>
          ) : null
        }
        ListFooterComponent={
          !term ? <Text style={styles.hint}>{hintFor(source)}</Text> : null
        }
      />

      <FollowedSheet
        subject={followed}
        onDismiss={() => setFollowed(null)}
        onDone={() => {
          setFollowed(null);
          router.dismissTo('/');
        }}
        onFollowAnother={() => {
          setFollowed(null);
          router.back();
        }}
      />
    </View>
  );
}

/** The name with the typed part marked, as the design's search shows it. */
function Highlighted({ text, term }: { text: string; term: string }) {
  const styles = useStyles();
  const at = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <Text style={styles.mark}>{text.slice(at, at + term.length)}</Text>
      {text.slice(at + term.length)}
    </>
  );
}

function placeholderFor(source: SourceId): string {
  switch (source) {
    case 'congress':
      return 'Search members, states or districts';
    case 'insider':
      return 'Company or ticker';
    case 'policy':
      return 'Topic, or a document type';
    case 'stocks':
      return 'Ticker or company name';
  }
}

function hintFor(source: SourceId): string {
  switch (source) {
    case 'congress':
      return 'Search matches names and districts (“CA-11”). Only members who have filed a trade disclosure appear.';
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.sm,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    ...type.caption,
    fontFamily: font.semibold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: c.textSubtle,
  },
  top: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  title: {
    ...type.display,
    color: c.text,
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.textMuted,
    backgroundColor: c.surface,
  },
  fieldFocused: {
    borderWidth: 2,
    borderColor: c.accent,
  },
  input: {
    flex: 1,
    ...type.body,
    fontSize: 16,
    fontFamily: font.medium,
    color: c.text,
    minWidth: 0,
    paddingVertical: space.sm,
  },
  clear: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: {
    minHeight: 44,
    paddingHorizontal: space.sm,
    justifyContent: 'center',
  },
  cancelText: {
    ...type.body,
    fontFamily: font.semibold,
    color: c.text,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  errorText: {
    ...type.caption,
    color: c.textMuted,
  },
  listContent: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
  },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 22,
    paddingBottom: space.sm,
  },
  sectionText: {
    ...type.caption,
    fontFamily: font.semibold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: c.textSubtle,
  },
  sectionCount: {
    ...type.caption,
    color: c.textSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: space.md,
    backgroundColor: c.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  rowFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  rowLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  rowRule: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    ...type.heading,
    color: c.text,
  },
  mark: {
    backgroundColor: tint(c.accent, 0.2),
    color: c.text,
  },
  subLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  party: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
  },
  partyText: {
    ...type.micro,
    fontFamily: font.bold,
    letterSpacing: 0.6,
    color: c.textMuted,
  },
  rowSubtitle: {
    ...type.label,
    fontFamily: font.regular,
    color: c.textSubtle,
    flexShrink: 1,
  },
  // Outlined in the accent; the word stays ink (small text never sits in an
  // accent colour — see `@/ui/theme`).
  follow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: c.accent,
  },
  following: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: tint(c.accent, 0.16),
  },
  followText: {
    ...type.label,
    fontSize: 14,
    color: c.text,
  },
  pressed: {
    backgroundColor: c.surfaceAlt,
  },
  hint: {
    ...type.bodyTight,
    color: c.textSubtle,
    paddingTop: 18,
    paddingHorizontal: space.xs,
  },
}));
