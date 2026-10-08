import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DISCLOSURE_LIMIT_DAYS, disclosureLag, isLate, partyTag, withoutParty } from '@/lib/filing';
import { isAbort } from '@/lib/http';
import { fillBuckets, monthSpans, shortDate, type ActivityBucket } from '@/lib/timeline';
import { describe, getProvider } from '@/providers/registry';
import type { Signal, SourceId } from '@/providers/types';
import { useFeed } from '@/store/feed';
import { rememberSignals } from '@/store/signalCache';
import { useWatchlist } from '@/store/watchlist';
import { ActivityChart } from '@/ui/components/ActivityChart';
import { Avatar } from '@/ui/components/Avatar';
import { Segmented } from '@/ui/components/Segmented';
import { SignalCard } from '@/ui/components/SignalCard';
import { TradeCard } from '@/ui/components/TradeCard';
import { groupGlyph } from '@/ui/groupGlyph';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { font, radius, space, tint, type } from '@/ui/theme';

type Tab = 'trades' | 'filings' | 'about';

const YEAR = 365 * 86_400_000;

/**
 * One member, insider, topic or ticker: who they are, how often and how late
 * they file, and everything they filed.
 *
 * Fetches directly from the provider rather than filtering the merged feed, so
 * it can go deeper than the per-subject cap the unified feed applies — which is
 * also what makes the year of activity above the list worth drawing.
 */
export default function SubjectDetailScreen() {
  const c = useTheme();
  const styles = useStyles();
  const { source, handle } = useLocalSearchParams<{ source: SourceId; handle: string }>();
  const router = useRouter();

  const meta = describe(source);
  const group = groupGlyph(source, handle);
  const provider = getProvider(source);

  const subjects = useWatchlist((s) => s.subjects);
  const toggleMute = useWatchlist((s) => s.toggleMute);
  const remove = useWatchlist((s) => s.remove);
  const add = useWatchlist((s) => s.add);

  const watched = subjects.find(
    (s) => s.source === source && s.handle.toLowerCase() === handle.toLowerCase(),
  );

  const [fetched, setFetched] = useState<Signal[] | null>(null);
  // What the feed already holds for this subject: shown at once while the
  // deeper fetch runs, and kept if that fetch fails or comes back empty.
  const feedSignals = useFeed((s) => s.signals);
  const known = useMemo(
    () =>
      feedSignals.filter(
        (s) => s.source === source && s.actor.handle.toLowerCase() === handle.toLowerCase(),
      ),
    [feedSignals, source, handle],
  );
  const signals = fetched && fetched.length > 0 ? fetched : known;
  useEffect(() => rememberSignals(signals), [signals]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);

  const displayName = watched?.displayName ?? signals[0]?.actor.displayName ?? handle;
  const subtitle = watched?.subtitle ?? signals[0]?.actor.subtitle ?? null;
  const party = partyTag(subtitle);
  const place = withoutParty(subtitle) || meta.label;

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
        setFetched(found);
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

  const openSignal = useCallback(
    async (signal: Signal) => {
      await WebBrowser.openBrowserAsync(signal.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: c.bg,
        controlsColor: c.accent,
      });
    },
    [c],
  );

  const openFiling = useCallback(
    (signal: Signal) => router.push({ pathname: '/filing/[id]', params: { id: signal.id } }),
    [router],
  );

  const trades = useMemo(() => signals.filter((s) => s.trade), [signals]);
  const months = useMemo(() => fillBuckets(signals, monthSpans(12)), [signals]);
  const lateMonths = useMemo(() => {
    const ringed: Partial<Record<number, string>> = {};
    months.forEach((b, i) => {
      if (b.signals.some(isLate)) ringed[i] = c.warning;
    });
    return ringed;
  }, [months, c]);
  const busiest = months.reduce(
    (best, b, i) => (b.total > 0 && b.total >= (months[best]?.total ?? 0) ? i : best),
    -1,
  );

  const yearAgo = Date.now() - YEAR;
  const newest = signals[0];
  const latestLag = trades[0] ? disclosureLag(trades[0]) : null;
  const lateCount = signals.filter((s) => s.timestamp >= yearAgo && isLate(s)).length;
  const yearCount = signals.filter((s) => s.timestamp >= yearAgo).length;

  const tabs: { value: Tab; label: string }[] = [
    ...(trades.length > 0 ? [{ value: 'trades' as const, label: 'Trades' }] : []),
    { value: 'filings', label: 'Filings' },
    { value: 'about', label: 'About' },
  ];
  const shownTab: Tab = tab && tabs.some((t) => t.value === tab) ? tab : tabs[0]!.value;

  // Trades grouped under the day they were filed, as the design's cards are.
  const filed = useMemo(() => {
    const groups: { at: number; label: string; trades: Signal[] }[] = [];
    for (const s of trades) {
      const label = `${shortDate(s.timestamp)} ${new Date(s.timestamp).getUTCFullYear()}`;
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.trades.push(s);
      else groups.push({ at: s.timestamp, label, trades: [s] });
    }
    return groups;
  }, [trades]);

  const describeMonth = (b: ActivityBucket) => {
    const month = new Date(b.start).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    if (b.total === 0) return `${month}: nothing filed`;
    const parts = [
      b.up ? `${b.up} up` : '',
      b.down ? `${b.down} down` : '',
      b.neutral ? `${b.neutral} with no direction` : '',
      b.signals.some(isLate) ? 'includes a late filing' : '',
    ].filter(Boolean);
    return `${month}: ${parts.join(', ')}`;
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void fetchSignals('refresh')}
          tintColor={c.textMuted}
          progressBackgroundColor={c.surface}
        />
      }
    >
      {/* A failed refresh with signals already on screen used to say nothing
          at all, so the user saw stale data and no hint of it. */}
      {error && signals.length > 0 ? (
        <View style={styles.errorStrip} accessibilityLiveRegion="polite">
          <Ionicons name="warning-outline" size={14} color={c.warning} />
          <Text style={styles.errorStripText}>Couldn’t refresh — showing the last signals loaded.</Text>
        </View>
      ) : null}

      <View style={styles.identity}>
        <Avatar
          uri={watched?.avatarUrl ?? signals[0]?.actor.avatarUrl}
          name={displayName}
          glyph={group?.glyph}
          square={source === 'stocks' || source === 'insider'}
          size={64}
        />
        {/* One heading, so the name and its subtitle are announced together. */}
        <View
          style={styles.identityBody}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${displayName}. ${subtitle ?? meta.label}`}
        >
          <Text style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>
          <View style={styles.subtitleRow}>
            {party && (
              <View style={styles.party}>
                <Text style={styles.partyText}>{party}</Text>
              </View>
            )}
            <Text style={styles.subtitle} numberOfLines={1}>
              {place}
            </Text>
          </View>
        </View>
      </View>

      {watched ? (
        <View style={styles.actions}>
          <Pressable
            onPress={confirmUnfollow}
            style={({ pressed }) => [styles.following, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Following ${displayName}. Tap to stop following`}
          >
            <Ionicons name="checkmark" size={18} color={c.accent} />
            <Text style={styles.actionText}>Following</Text>
          </Pressable>
          <Pressable
            onPress={() => toggleMute(source, handle)}
            style={({ pressed }) => [styles.outline, pressed && styles.pressed]}
            accessibilityRole="switch"
            accessibilityState={{ checked: watched.muted }}
            accessibilityLabel={watched.muted ? `Unmute ${displayName}` : `Mute ${displayName}`}
          >
            <Ionicons
              name={watched.muted ? 'notifications-off' : 'notifications-off-outline'}
              size={18}
              color={watched.muted ? c.warning : c.text}
            />
            <Text style={styles.actionText}>{watched.muted ? 'Muted' : 'Mute'}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => add({ source, handle, displayName, subtitle: subtitle ?? meta.label, avatarUrl: null })}
          style={({ pressed }) => [styles.follow, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={`Follow ${displayName}`}
        >
          <Ionicons name="add" size={20} color={c.onAccent} />
          <Text style={styles.followText}>Follow</Text>
        </Pressable>
      )}

      {loading && signals.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : signals.length === 0 ? (
        <View style={styles.centered} accessibilityLiveRegion="polite">
          <Text style={styles.emptyText}>{error ?? 'No signals on file yet.'}</Text>
        </View>
      ) : (
        <>
          <View style={styles.stats}>
            <Stat value={newest ? shortDate(newest.timestamp) : '—'} label="last filing" />
            {source === 'congress' ? (
              <>
                <Stat
                  value={latestLag !== null ? `${latestLag} d` : '—'}
                  label={`latest delay (${DISCLOSURE_LIMIT_DAYS} allowed)`}
                />
                <Stat value={`${lateCount} late`} label="in last 12 months" warn={lateCount > 0} />
              </>
            ) : (
              <>
                <Stat value={String(yearCount)} label="in last 12 months" />
                <Stat value={String(signals.length)} label="loaded here" />
              </>
            )}
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Filing activity</Text>
              <Text style={styles.panelMeta}>by month filed · 12 mo</Text>
            </View>
            <ActivityChart
              buckets={months}
              describeBucket={describeMonth}
              axisLabel={(b) => new Date(b.start).toLocaleString('en-US', { month: 'narrow', timeZone: 'UTC' })}
              highlighted={busiest >= 0 ? busiest : null}
              ringed={lateMonths}
              upHeight={48}
              downHeight={48}
              unit={20}
            />
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: c.up }]} />
                <Text style={styles.legendText}>▲ Buys above</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.swatch, styles.swatchDown]} />
                <Text style={styles.legendText}>▼ Sells below</Text>
              </View>
              {Object.keys(lateMonths).length > 0 && (
                <View style={styles.legendItem}>
                  <View style={[styles.swatch, styles.swatchLate]} />
                  <Text style={styles.legendText}>Late</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.tabs}>
            <Segmented label="Show" value={shownTab} onChange={setTab} options={tabs} fill />
          </View>

          {shownTab === 'trades' &&
            filed.map((group) => (
              <View key={group.at}>
                <View style={styles.group}>
                  <Text style={styles.groupText}>Filed {group.label}</Text>
                  <Text style={styles.groupText}>
                    {group.trades.length} trade{group.trades.length === 1 ? '' : 's'}
                  </Text>
                </View>
                {group.trades.map((s) => (
                  <TradeCard key={s.id} signal={s} onPress={openFiling} />
                ))}
              </View>
            ))}

          {shownTab === 'filings' && (
            <View style={styles.bleed}>
              {signals.map((s) => (
                <SignalCard key={s.id} signal={s} onPress={s.trade ? openFiling : openSignal} />
              ))}
            </View>
          )}

          {shownTab === 'about' && (
            <View style={styles.about}>
              <Text style={styles.aboutTitle}>{meta.label}</Text>
              <Text style={styles.aboutBody}>{meta.blurb}</Text>
              <Text style={styles.aboutMeta}>Data: {meta.provenance}</Text>
              {source === 'congress' && (
                <Text style={styles.aboutBody}>
                  Members must disclose a trade within {DISCLOSURE_LIMIT_DAYS} days, as a dollar range. Ripple
                  shows the range as filed and measures the price from the day it became public.
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

/** One of the three figures under the header. A warning gets an icon as well as a colour. */
function Stat({ value, label, warn = false }: { value: string; label: string; warn?: boolean }) {
  const c = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value}, ${label}`}>
      <View style={styles.statValueRow}>
        {warn && <Ionicons name="warning" size={14} color={c.warning} />}
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
  },
  pressed: {
    opacity: 0.8,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: space.xs,
  },
  identityBody: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: font.bold,
    letterSpacing: -0.3,
    color: c.text,
  },
  subtitleRow: {
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
  subtitle: {
    ...type.bodyTight,
    color: c.textMuted,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: 14,
  },
  // Following: the accent as a wash, with ink words and an accent tick.
  following: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: tint(c.accent, 0.16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  outline: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: {
    ...type.body,
    fontFamily: font.semibold,
    color: c.text,
  },
  follow: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: c.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  followText: {
    ...type.body,
    fontFamily: font.semibold,
    color: c.onAccent,
  },
  stats: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: 14,
  },
  stat: {
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: font.monoSemibold,
    fontSize: 17,
    lineHeight: 22,
    color: c.text,
  },
  statLabel: {
    ...type.caption,
    lineHeight: 15,
    color: c.textMuted,
    marginTop: 2,
  },
  panel: {
    marginTop: 14,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.lg,
    paddingTop: space.md,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  panelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: space.xs,
    paddingBottom: 6,
  },
  panelTitle: {
    ...type.body,
    fontFamily: font.semibold,
    color: c.text,
  },
  panelMeta: {
    ...type.caption,
    color: c.textSubtle,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingTop: space.sm,
    paddingHorizontal: space.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    ...type.caption,
    color: c.textMuted,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  swatchDown: {
    borderWidth: 1.5,
    borderColor: c.down,
    backgroundColor: tint(c.down, 0.3),
  },
  swatchLate: {
    borderWidth: 1.5,
    borderColor: c.warning,
  },
  tabs: {
    marginTop: 14,
  },
  group: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space.lg,
    paddingBottom: space.sm,
    paddingHorizontal: 2,
  },
  groupText: {
    ...type.caption,
    fontFamily: font.semibold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: c.textSubtle,
  },
  // SignalCard brings its own side margins for the full-width feed.
  bleed: {
    marginHorizontal: -space.lg,
    paddingTop: space.md,
  },
  about: {
    paddingTop: space.lg,
    gap: space.sm,
  },
  aboutTitle: {
    ...type.heading,
    color: c.text,
  },
  aboutBody: {
    ...type.body,
    color: c.textMuted,
  },
  aboutMeta: {
    ...type.caption,
    color: c.textSubtle,
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
    marginHorizontal: -space.lg,
    marginBottom: space.sm,
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
