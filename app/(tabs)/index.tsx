import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { refreshFeed } from '@/hooks/useFeedSync';
import { describe } from '@/providers/registry';
import { isStarterFeed } from '@/store/defaults';
import { dayHeadline, dayLabel, daySummary, groupByDay, type DigestDay } from '@/lib/digest';
import { relativeTime } from '@/lib/time';
import type { Signal, SourceId } from '@/providers/types';
import { countBySource, useFeed, visibleSignals } from '@/store/feed';
import { useWatchlist } from '@/store/watchlist';
import { EmptyState } from '@/ui/components/EmptyState';
import { StarterNotice } from '@/ui/components/StarterNotice';
import { FilterChips } from '@/ui/components/FilterChips';
import { SignalCard } from '@/ui/components/SignalCard';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { radius, shadow, space, type } from '@/ui/theme';

/** One day of the feed, in the shape `SectionList` wants. */
interface DigestSection {
  day: DigestDay;
  data: Signal[];
}

/**
 * Home — the unified signal feed, grouped by day.
 *
 * Everything on screen comes from one already-merged, already-sorted array in
 * the feed store. This screen's only jobs are filtering, grouping, presentation
 * and navigation — the order of the stream is never changed here.
 */
export default function FeedScreen() {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();
  // The sync itself is mounted by the tabs layout so every tab has data; this
  // screen only needs a handle for pull-to-refresh.
  const refresh = refreshFeed;

  const signals = useFeed((s) => s.signals);
  const loading = useFeed((s) => s.loading);
  const refreshing = useFeed((s) => s.refreshing);
  const lastUpdated = useFeed((s) => s.lastUpdated);
  const errors = useFeed((s) => s.errors);
  const newSincePeek = useFeed((s) => s.newSincePeek);
  const clearNewCount = useFeed((s) => s.clearNewCount);

  const subjects = useWatchlist((s) => s.subjects);
  const hidden = useWatchlist((s) => s.hiddenSources);
  const toggleSource = useWatchlist((s) => s.toggleSource);
  // Waits for the persisted feed as well, so a relaunch never flashes "nothing
  // to show" in the moment before the stored signals arrive.
  const hydrated = useWatchlist((s) => s.hydrated) && useFeed((s) => s.hydrated);

  const [errorsDismissed, setErrorsDismissed] = useState(false);
  const listRef = useRef<SectionList<Signal, DigestSection>>(null);

  const shown = useMemo(
    () => visibleSignals(signals, hidden, subjects),
    [signals, hidden, subjects],
  );

  // Counts reflect everything loaded, so a hidden chip still shows what it holds.
  const counts = useMemo(() => countBySource(signals), [signals]);

  // Grouping happens after filtering, so a day whose only signals are from a
  // hidden source disappears with them rather than leaving an empty header.
  const sections = useMemo<DigestSection[]>(
    () => groupByDay(shown).map((day) => ({ day, data: day.signals })),
    [shown],
  );

  // Polling brings signals in without any user action, so announce it rather
  // than relying on the pill being seen.
  useEffect(() => {
    if (newSincePeek > 0) {
      AccessibilityInfo.announceForAccessibility(
        `${newSincePeek} new signal${newSincePeek === 1 ? '' : 's'} available`,
      );
    }
  }, [newSincePeek]);

  const openSignal = useCallback(async (signal: Signal) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await WebBrowser.openBrowserAsync(signal.url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      toolbarColor: c.bg,
      controlsColor: c.accent,
    });
  }, []);

  const openActor = useCallback(
    (signal: Signal) => {
      router.push({
        pathname: '/subject/[source]/[handle]',
        params: { source: signal.source, handle: signal.actor.handle },
      });
    },
    [router],
  );

  const scrollToTop = useCallback(() => {
    // Not `scrollToLocation`: that targets the first *item*, which leaves the
    // day header it belongs to scrolled off the top. The scroll responder goes
    // to the actual origin.
    listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });
    clearNewCount();
  }, [clearNewCount]);

  if (!hydrated) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  /*
   * No early return for an empty watchlist.
   *
   * An empty watchlist used to mean an empty screen behind a button, which asks
   * a new user to take on faith that following something produces anything.
   * `useFeedSync` substitutes the starter set instead, so there are real
   * filings here on a fresh install — and `StarterNotice` says so, because a
   * starter feed is only defensible if it is labelled as one.
   */
  const starter = isStarterFeed(subjects);
  const showErrors = errors.length > 0 && !errorsDismissed;

  return (
    <View style={styles.container}>
      {starter && <StarterNotice onPress={() => router.push('/add')} />}

      <FilterChips hidden={hidden} onToggle={toggleSource} counts={counts} />

      {showErrors && (
        <Pressable
          style={styles.errorBar}
          onPress={() => setErrorsDismissed(true)}
          accessibilityRole="button"
          accessibilityLabel={
            errors.length === 1
              ? `Couldn't refresh ${errors[0]!.handle}. Showing saved signals. Double tap to dismiss.`
              : `Couldn't refresh ${errors.length} subjects. Showing saved signals. Double tap to dismiss.`
          }
          accessibilityLiveRegion="polite"
        >
          <Ionicons name="warning-outline" size={14} color={c.warning} />
          <Text style={styles.errorText} numberOfLines={2}>
            {errors.length === 1
              ? `Couldn't refresh ${errors[0]!.handle}`
              : `Couldn't refresh ${errors.length} subjects`}
            {' — showing what we have.'}
          </Text>
          <Ionicons name="close" size={14} color={c.textMuted} />
        </Pressable>
      )}

      {/* The list and its floating overlays share a stacking context so the
          pill sits over the list rather than over the filter chips, which is
          where an absolute offset from the screen root put it. */}
      <View style={styles.listArea}>
        {loading && signals.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color={c.accent} />
            <Text style={styles.loadingText}>Pulling filings…</Text>
          </View>
        ) : (
          <SectionList
            ref={listRef}
            sections={sections}
            keyExtractor={(signal) => signal.id}
            renderItem={({ item }) => (
              <SignalCard signal={item} onPress={openSignal} onPressActor={openActor} />
            )}
            renderSectionHeader={({ section }) => <DigestHeader day={section.day} />}
            // A sticky header would cover the card it belongs to on a short day.
            stickySectionHeadersEnabled={false}
            // Clears the floating action button, which otherwise sat on top of
            // the last card with no way to scroll past it.
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setErrorsDismissed(false);
                  void refresh();
                }}
                tintColor={c.textMuted}
                colors={[c.accent]}
                progressBackgroundColor={c.surface}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="funnel-outline"
                title="Nothing to show"
                body={
                  hidden.length > 0
                    ? 'Every source is filtered out. Tap a chip above to bring one back.'
                    : 'No signals yet from the subjects you follow. Pull down to refresh.'
                }
              />
            }
            ListFooterComponent={
              shown.length > 0 && lastUpdated ? (
                <Text style={styles.footer}>Updated {relativeTime(lastUpdated)} ago</Text>
              ) : null
            }
            initialNumToRender={10}
            maxToRenderPerBatch={8}
            windowSize={11}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        )}

        {newSincePeek > 0 && (
          <Pressable
            style={({ pressed }) => [styles.newPill, pressed && styles.pressedLift]}
            onPress={scrollToTop}
            accessibilityRole="button"
            accessibilityLabel={`${newSincePeek} new signal${newSincePeek === 1 ? '' : 's'}. Double tap to scroll to top.`}
            accessibilityLiveRegion="polite"
          >
            <Ionicons name="arrow-up" size={13} color={c.onAccent} />
            <Text style={styles.newPillText}>
              {newSincePeek} new signal{newSincePeek === 1 ? '' : 's'}
            </Text>
          </Pressable>
        )}

        {/*
          Navigates with `router.push` rather than `<Link asChild>`, which
          silently deleted every style on this button.

          `asChild` renders through Radix's `Slot`, and Slot merges `style` by
          object spread: `{ ...slotProps.style, ...childProps.style }`. A
          Pressable's style is allowed to be a *function* of press state, and
          spreading a function yields `{}` — functions have no own enumerable
          properties. So the FAB rendered with no position, no size and no
          background, and its `onAccent` glyph is near-black on a near-black
          page: the primary "add a subject" control was invisible, present only
          as a full-width invisible strip above the tab bar. Slot's dev-time
          guard only catches an *array* style, so nothing warned.

          Every other navigation in this app already uses `router.push`.
        */}
        <Pressable
          onPress={() => router.push('/add')}
          style={({ pressed }) => [styles.fab, pressed && styles.pressedLift]}
          accessibilityRole="button"
          accessibilityLabel="Add a subject to your watchlist"
        >
          <Ionicons name="add" size={26} color={c.onAccent} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The day divider: what landed, from where, and the one thing worth noticing.
 *
 * Grouped into a single accessible node so a screen reader announces the day as
 * one heading rather than three loose fragments before every card.
 */
function DigestHeader({ day }: { day: DigestDay }) {
  const styles = useStyles();
  const label = dayLabel(day.dayStart);
  const summary = daySummary(day, (source: SourceId) => describe(source).label);
  const headline = dayHeadline(day);

  return (
    <View
      style={styles.dayHeader}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${label}. ${summary}.${headline ? ` ${headline}.` : ''}`}
    >
      <View style={styles.dayHeaderRow}>
        <Text style={styles.dayLabel}>{label}</Text>
        {headline ? (
          <View style={styles.headlinePill}>
            <Text style={styles.headlineText}>{headline}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.daySummary}>{summary}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  dayHeader: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.sm,
    gap: 2,
    backgroundColor: c.bg,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dayLabel: {
    ...type.heading,
    color: c.text,
  },
  daySummary: {
    ...type.caption,
    color: c.textMuted,
  },
  headlinePill: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceAlt,
  },
  headlineText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: c.textMuted,
    textTransform: 'uppercase',
  },
  listArea: {
    flex: 1,
  },
  listContent: {
    // 56pt button + its 24pt inset + breathing room, so the last card clears it.
    paddingBottom: 56 + space.xl + space.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  loadingText: {
    ...type.caption,
    color: c.textMuted,
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: 'rgba(232, 178, 58, 0.10)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  errorText: {
    ...type.caption,
    color: c.textMuted,
    flex: 1,
  },
  footer: {
    ...type.caption,
    color: c.textMuted,
    textAlign: 'center',
    paddingVertical: space.xl,
  },
  newPill: {
    position: 'absolute',
    top: space.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    ...shadow.raised,
  },
  newPillText: {
    ...type.micro,
    color: c.onAccent,
  },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
    ...shadow.floating,
  },
  // One press treatment for every raised control, so they don't each drift.
  pressedLift: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
}));
