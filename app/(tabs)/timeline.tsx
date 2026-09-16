import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { relativeTime } from '@/lib/time';
import type { TimelineCluster } from '@/lib/timeline';
import { useFeed, visibleSignals } from '@/store/feed';
import { useWatchlist } from '@/store/watchlist';
import { EmptyState } from '@/ui/components/EmptyState';
import { SignalCard } from '@/ui/components/SignalCard';
import { SignalTimeline } from '@/ui/components/SignalTimeline';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { space, type } from '@/ui/theme';

/**
 * The feed, laid on a time axis instead of stacked vertically.
 *
 * Same signals, same store — no extra fetching. The vertical feed answers "what
 * is newest"; this answers "when did these happen relative to each other",
 * which is the question you actually have when several sources are in play.
 */
export default function TimelineScreen() {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();

  const signals = useFeed((s) => s.signals);
  const lastUpdated = useFeed((s) => s.lastUpdated);
  const subjects = useWatchlist((s) => s.subjects);
  const hidden = useWatchlist((s) => s.hiddenSources);
  const hydrated = useWatchlist((s) => s.hydrated);

  const shown = useMemo(
    () => visibleSignals(signals, hidden, subjects),
    [signals, hidden, subjects],
  );

  const openSignal = useCallback(async (cluster: TimelineCluster) => {
    const lead = cluster.signals[0];
    if (!lead) return;
    await WebBrowser.openBrowserAsync(lead.url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      toolbarColor: c.bg,
      controlsColor: c.accent,
    });
  }, []);

  const openCard = useCallback(async (signal: { url: string }) => {
    await WebBrowser.openBrowserAsync(signal.url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      toolbarColor: c.bg,
      controlsColor: c.accent,
    });
  }, []);

  if (!hydrated) return <View style={styles.screen} />;

  // Guarded on content, not on the watchlist — the way the trades tab already
  // does it. An empty watchlist still has signals when the starter feed is
  // standing in for one, and blocking on `subjects` showed "nothing here" over
  // a store that was full.
  if (shown.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="git-commit-outline"
          title="Nothing on the timeline"
          body={
            subjects.length === 0
              ? 'Follow a few subjects and their filings will plot here, one lane per source.'
              : 'No signals in range yet. Pull down on the Signals tab to refresh.'
          }
          {...(subjects.length === 0
            ? { action: { label: 'Add a subject', onPress: () => router.push('/add') } }
            : {})}
        />
      </View>
    );
  }

  // The newest few, so the screen answers "and what were they?" without making
  // the user jump back to the feed.
  const recent = shown.slice(0, 5);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SignalTimeline signals={shown} onSelect={openSignal} title="All sources" />

      <View style={styles.legend}>
        <Text style={styles.legendText}>
          Each mark is a filing; a numbered one is several within a few days. Triangles point the
          way a disclosed trade went — up for buys, down for sells — and a circle means no single
          direction.
        </Text>
        {lastUpdated ? (
          <Text style={styles.legendMeta}>Updated {relativeTime(lastUpdated)} ago</Text>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Latest</Text>
      {recent.map((signal) => (
        <SignalCard key={signal.id} signal={signal} onPress={openCard} />
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    paddingBottom: space.xxl,
  },
  legend: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    gap: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  legendText: {
    ...type.caption,
    color: c.textMuted,
    lineHeight: 17,
  },
  legendMeta: {
    ...type.caption,
    color: c.textMuted,
  },
  sectionTitle: {
    ...type.label,
    color: c.text,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
}));
