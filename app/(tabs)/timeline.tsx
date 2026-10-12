import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { relativeTime } from '@/lib/time';
import { useFeed, visibleSignals } from '@/store/feed';
import { useWatchlist } from '@/store/watchlist';
import { EmptyState } from '@/ui/components/EmptyState';
import { SignalTimeline } from '@/ui/components/SignalTimeline';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { space, type } from '@/ui/theme';
import { openLink } from '@/lib/feedback';
import { useTabBarSpace } from '@/ui/components/FloatingTabBar';

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
  // Room for the last row to scroll clear of the floating tab bar.
  const tabSpace = useTabBarSpace();
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

  const openSignal = useCallback(async (signal: { url: string }) => {
    await openLink(signal.url);
  }, [c]);

  if (!hydrated) return <View style={styles.screen} />;

  // Guarded on content, not on the watchlist — the way the trades tab already
  // does it. An empty watchlist still has signals when the starter feed is
  // standing in for one, and blocking on `subjects` showed "nothing here" over
  // a store that was full.
  if (shown.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="mci:chart-timeline-variant"
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: tabSpace }]}>
      <SignalTimeline signals={shown} onOpen={openSignal} />
      {lastUpdated ? (
        <Text style={styles.updated}>Updated {relativeTime(lastUpdated)} ago</Text>
      ) : null}
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
  updated: {
    ...type.caption,
    color: c.textSubtle,
    textAlign: 'center',
    paddingTop: space.lg,
  },
}));
