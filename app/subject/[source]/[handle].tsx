import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { isAbort } from '@/lib/http';
import type { TimelineCluster } from '@/lib/timeline';
import { describe, getProvider } from '@/providers/registry';
import type { Signal, SourceId } from '@/providers/types';
import { useWatchlist } from '@/store/watchlist';
import { Avatar } from '@/ui/components/Avatar';
import { SignalCard } from '@/ui/components/SignalCard';
import { SignalTimeline } from '@/ui/components/SignalTimeline';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { radius, space, tapSlop, tint, type } from '@/ui/theme';

/** Below this, the axis adds nothing the list beneath it doesn't already say. */
const MIN_TIMELINE_SIGNALS = 4;

/**
 * Single-subject timeline.
 *
 * Fetches directly from the provider rather than filtering the merged feed, so
 * it can go deeper than the per-subject cap the unified feed applies — which is
 * also what makes the axis above the list worth drawing.
 */
export default function SubjectDetailScreen() {
  const c = useTheme();
  const styles = useStyles();
  const { source, handle } = useLocalSearchParams<{ source: SourceId; handle: string }>();
  const navigation = useNavigation();
  const router = useRouter();

  const meta = describe(source);
  const provider = getProvider(source);

  const subjects = useWatchlist((s) => s.subjects);
  const toggleMute = useWatchlist((s) => s.toggleMute);
  const remove = useWatchlist((s) => s.remove);
  const add = useWatchlist((s) => s.add);

  const watched = subjects.find(
    (s) => s.source === source && s.handle.toLowerCase() === handle.toLowerCase(),
  );

  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = watched?.displayName ?? signals[0]?.actor.displayName ?? handle;

  useEffect(() => {
    navigation.setOptions({ title: displayName });
  }, [navigation, displayName]);

  const inFlight = useRef<AbortController | null>(null);

  const fetchSignals = useCallback(
    async (mode: 'initial' | 'refresh') => {
      // One request at a time. Pull-to-refresh during a slow initial load used
      // to run both, and whichever finished last won — which could be the
      // older one, quietly replacing fresh signals with stale ones.
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const found = await provider.getSignals(handle, {
          limit: 40,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setSignals(found);
      } catch (err) {
        if (controller.signal.aborted || isAbort(err)) return;
        setError('Could not load signals for this subject.');
      } finally {
        // A superseded request must not clear the spinner belonging to the one
        // that replaced it.
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [provider, handle],
  );

  useEffect(() => {
    void fetchSignals('initial');
    // Leaving the screen mid-fetch would otherwise land a setState on an
    // unmounted component and keep the request burning quota for nothing.
    return () => inFlight.current?.abort();
  }, [fetchSignals]);

  const confirmUnfollow = useCallback(() => {
    Alert.alert(
      `Stop following ${displayName}?`,
      'Their signals will be removed from your feed. You can add them again any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: () => {
            remove(source, handle);
            router.back();
          },
        },
      ],
    );
  }, [displayName, remove, source, handle, router]);

  const openSignal = useCallback(async (signal: Signal) => {
    await WebBrowser.openBrowserAsync(signal.url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      toolbarColor: c.bg,
      controlsColor: c.accent,
    });
  }, []);

  /**
   * A timeline dot stands for a cluster of filings on the same day; opening one
   * opens its representative, which `buildTimeline` puts first.
   */
  const openCluster = useCallback(
    (cluster: TimelineCluster) => {
      const first = cluster.signals[0];
      if (first) void openSignal(first);
    },
    [openSignal],
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={signals}
        keyExtractor={(signal) => signal.id}
        renderItem={({ item }) => <SignalCard signal={item} onPress={openSignal} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void fetchSignals('refresh')}
            tintColor={c.textMuted}
            progressBackgroundColor={c.surface}
          />
        }
        ListHeaderComponent={
          <>
            {/* A failed refresh with signals already on screen used to say
                nothing at all — the empty-state message below only renders when
                the list is empty, so the user saw stale data and no hint of it. */}
            {error && signals.length > 0 ? (
              <View style={styles.errorStrip} accessibilityLiveRegion="polite">
                <Ionicons name="warning-outline" size={14} color={c.warning} />
                <Text style={styles.errorStripText}>
                  Couldn’t refresh — showing the last signals loaded.
                </Text>
              </View>
            ) : null}

            <View style={styles.header}>
              <Avatar
                uri={watched?.avatarUrl}
                name={displayName}
                accent={meta.color}
                square={source === 'stocks' || source === 'insider'}
                size={56}
              />

            {/* Grouped so the name and its subtitle are announced as one
                heading, instead of two unrelated fragments either side of the
                avatar. */}
            <View
              style={styles.headerBody}
              accessible
              accessibilityRole="header"
              accessibilityLabel={`${displayName}. ${watched?.subtitle ?? meta.label}`}
            >
              <Text style={styles.name} numberOfLines={2}>
                {displayName}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {watched?.subtitle ?? meta.label}
              </Text>
            </View>

            {watched ? (
              <View style={styles.headerActions}>
                <Pressable
                  onPress={() => toggleMute(source, handle)}
                  style={[
                    styles.iconButton,
                    watched.muted && { backgroundColor: tint(c.warning, 0.16) },
                  ]}
                  hitSlop={tapSlop(36)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: watched.muted }}
                  accessibilityLabel={
                    watched.muted ? `Unmute ${displayName}` : `Mute ${displayName}`
                  }
                >
                  <Ionicons
                    name={watched.muted ? 'notifications-off' : 'notifications-outline'}
                    size={18}
                    color={watched.muted ? c.warning : c.textMuted}
                  />
                </Pressable>
                <Pressable
                  onPress={confirmUnfollow}
                  style={styles.iconButton}
                  hitSlop={tapSlop(36)}
                  accessibilityRole="button"
                  accessibilityLabel={`Stop following ${displayName}`}
                >
                  <Ionicons name="person-remove-outline" size={17} color={c.textMuted} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() =>
                  add({ source, handle, displayName, subtitle: meta.label, avatarUrl: null })
                }
                style={[styles.followButton, { backgroundColor: tint(meta.color, 0.18) }]}
                accessibilityRole="button"
                accessibilityLabel={`Follow ${displayName}`}
              >
                  <Text style={[styles.followText, { color: meta.color }]}>Follow</Text>
                </Pressable>
              )}
            </View>

            {/* Below a handful of filings the axis says less than the list
                underneath it already does, and a track with two dots on it
                reads as a broken chart rather than a sparse one. */}
            {signals.length >= MIN_TIMELINE_SIGNALS ? (
              <View style={styles.timeline}>
                <SignalTimeline signals={signals} onSelect={openCluster} />
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={c.accent} />
            </View>
          ) : (
            <View style={styles.centered} accessibilityLiveRegion="polite">
              <Text style={styles.emptyText}>{error ?? 'No signals on file yet.'}</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  timeline: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  headerBody: {
    flex: 1,
    gap: 3,
  },
  name: {
    ...type.title,
    color: c.text,
  },
  subtitle: {
    ...type.caption,
    color: c.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  followButton: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  followText: {
    ...type.label,
  },
  centered: {
    alignItems: 'center',
    paddingTop: 64,
    gap: space.md,
  },
  emptyText: {
    ...type.body,
    color: c.textMuted,
  },
  errorStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: tint(c.warning, 0.1),
  },
  errorStripText: {
    ...type.caption,
    color: c.textMuted,
    flex: 1,
  },
}));
