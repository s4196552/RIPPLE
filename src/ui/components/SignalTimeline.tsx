import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, Text, View } from 'react-native';
import { describe } from '@/providers/registry';
import type { Signal } from '@/providers/types';
import {
  RANGES,
  buildLanes,
  clusterDateLabel,
  ticksFor,
  windowFor,
  type TimelineCluster,
  type TimelineRange,
} from '@/lib/timeline';
import { makeStyles, useTheme } from '../ThemeProvider';
import { radius, space, tapSlop, tint, type } from '../theme';

interface Props {
  signals: Signal[];
  onSelect: (cluster: TimelineCluster) => void;
  /** Hidden when the caller already shows a heading. */
  title?: string;
}

/** Marker diameter; also sets the minimum gap before clusters merge. */
const DOT = 12;
const LANE_HEIGHT = 34;
const LABEL_WIDTH = 78;

/**
 * Every watched source stacked on one shared time axis.
 *
 * The feed is good at "what happened, newest first" and bad at "when did these
 * happen relative to each other" — whether three members bought the same week
 * an executive order landed. One lane per source makes that visible.
 *
 * All geometry comes from `@/lib/timeline`, which is unit-tested; this file
 * only measures the track and draws.
 */
export function SignalTimeline({ signals, onSelect, title }: Props) {
  const c = useTheme();
  const styles = useStyles();
  const [range, setRange] = useState<TimelineRange>('90d');
  const [trackWidth, setTrackWidth] = useState(0);

  const window = useMemo(() => windowFor(range, signals), [range, signals]);

  // Merge markers that would physically overlap. Expressed as a fraction of the
  // measured track, so the threshold follows the real width rather than a guess.
  const minGap = trackWidth > 0 ? DOT / trackWidth : 0.03;

  const lanes = useMemo(
    () => (window ? buildLanes(signals, window, minGap) : []),
    [signals, window, minGap],
  );
  const ticks = useMemo(() => (window ? ticksFor(window, 4) : []), [window]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - trackWidth) > 1) setTrackWidth(w);
  };

  if (!window || lanes.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No signals to plot yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        {title ? <Text style={styles.title}>{title}</Text> : <View />}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ranges}
        >
          {RANGES.map((r) => {
            const active = r.id === range;
            return (
              <Pressable
                key={r.id}
                onPress={() => setRange(r.id)}
                hitSlop={{ top: space.sm, bottom: space.sm }}
                style={[styles.rangeChip, active && styles.rangeChipOn]}
                accessibilityRole="switch"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`Show ${r.days ? `the last ${r.days} days` : 'all history'}`}
              >
                <Text style={[styles.rangeText, active && styles.rangeTextOn]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {lanes.map((lane) => {
        const meta = describe(lane.source);
        return (
          <View key={lane.source} style={styles.lane}>
            <View style={styles.laneLabel}>
              <Text style={[styles.laneName, { color: meta.color }]} numberOfLines={1}>
                {meta.label}
              </Text>
              <Text style={styles.laneCount}>{lane.count}</Text>
            </View>

            <View style={styles.track} onLayout={onTrackLayout}>
              <View style={styles.baseline} />

              {/* Markers are siblings on the track, never nested inside another
                  Pressable — nesting renders a <button> in a <button> on web. */}
              {lane.clusters.map((cluster) => {
                const count = cluster.signals.length;
                const size = count > 1 ? DOT + 4 : DOT;
                const color =
                  cluster.tone === 'up'
                    ? c.up
                    : cluster.tone === 'down'
                      ? c.down
                      : meta.color;

                return (
                  <Pressable
                    key={`${cluster.at}-${cluster.signals[0]?.id}`}
                    onPress={() => onSelect(cluster)}
                    hitSlop={tapSlop(size)}
                    style={[
                      styles.marker,
                      {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: tint(color, 0.9),
                        borderColor: color,
                        // Centre the dot on its date rather than starting there.
                        left: Math.max(
                          0,
                          Math.min(trackWidth - size, cluster.position * trackWidth - size / 2),
                        ),
                        marginTop: -size / 2,
                      },
                    ]}
                    accessibilityRole="button"
                    // The dot's colour, size and position are the whole message
                    // visually, so the label has to carry all three in words.
                    accessibilityLabel={
                      `${meta.label}, ${clusterDateLabel(cluster, window)}. ` +
                      (count > 1
                        ? `${count} signals. Latest: ${cluster.signals[0]?.text ?? ''}`
                        : (cluster.signals[0]?.text ?? ''))
                    }
                    accessibilityHint="Opens the filing"
                  >
                    {count > 1 && <Text style={styles.markerCount}>{count}</Text>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      <View style={styles.axis}>
        <View style={styles.axisSpacer} />
        <View style={styles.axisTicks}>
          {ticks.map((tick) => (
            <Text
              key={tick.at}
              style={[
                styles.tick,
                // First and last hug their ends so labels stay on screen.
                tick.position === 0
                  ? { left: 0 }
                  : tick.position === 1
                    ? { right: 0 }
                    : { left: `${tick.position * 100}%`, transform: [{ translateX: -18 }] },
              ]}
            >
              {tick.label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    paddingVertical: space.md,
    gap: space.xs,
  },
  empty: {
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...type.caption,
    color: c.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    gap: space.md,
  },
  title: {
    ...type.label,
    color: c.text,
  },
  ranges: {
    flexDirection: 'row',
    gap: space.xs,
  },
  rangeChip: {
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
  },
  rangeChipOn: {
    backgroundColor: tint(c.accent, 0.16),
    borderColor: tint(c.accent, 0.5),
  },
  rangeText: {
    ...type.micro,
    color: c.textMuted,
  },
  rangeTextOn: {
    color: c.accent,
  },
  lane: {
    flexDirection: 'row',
    alignItems: 'center',
    height: LANE_HEIGHT,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  laneLabel: {
    width: LABEL_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  laneName: {
    ...type.micro,
    flexShrink: 1,
  },
  laneCount: {
    ...type.caption,
    color: c.textMuted,
  },
  track: {
    flex: 1,
    height: LANE_HEIGHT,
    justifyContent: 'center',
  },
  baseline: {
    height: 1,
    backgroundColor: c.border,
    width: '100%',
  },
  marker: {
    position: 'absolute',
    top: '50%',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCount: {
    fontSize: 8,
    fontWeight: '700',
    color: c.bg,
  },
  axis: {
    flexDirection: 'row',
    paddingHorizontal: space.lg,
    gap: space.sm,
    marginTop: space.xs,
  },
  axisSpacer: {
    width: LABEL_WIDTH,
  },
  axisTicks: {
    flex: 1,
    height: 14,
  },
  tick: {
    position: 'absolute',
    ...type.caption,
    fontSize: 10,
    color: c.textMuted,
  },
}));
