import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { ActivityBucket } from '@/lib/timeline';
import { makeStyles, useTheme } from '../ThemeProvider';
import { font, tint, type } from '../theme';

interface Props {
  buckets: ActivityBucket[];
  /** Spoken description of one column — its dates and counts, in words. */
  describeBucket: (bucket: ActivityBucket) => string;
  /** The label under a column, or null for none. Only every `labelEvery`th is asked for. */
  axisLabel: (bucket: ActivityBucket, index: number) => string | null;
  labelEvery?: number;
  /** The column drawn with the accent wash behind it. */
  highlighted?: number | null;
  /** Columns whose bar gets a ring, and the ring's colour — "late", say. */
  ringed?: Partial<Record<number, string>>;
  /** Makes every column a button. */
  onSelect?: (index: number) => void;
  /** Height of the area above the axis, and below it. */
  upHeight?: number;
  downHeight?: number;
  /** Pixels per item, before scaling down to fit the busiest column. */
  unit?: number;
}

/**
 * Counts per column, buys above an axis and sells hung below it.
 *
 * Direction is carried three ways, so colour is never the only cue: which side
 * of the axis a bar sits on, solid against outlined, and the tone colour. The
 * design hatches the sells; React Native has no repeating gradient, so they are
 * outlined over a light wash of the same colour instead. Signals with no
 * direction — policy actions, mostly — sit on the axis as a small diamond.
 */
export function ActivityChart({
  buckets,
  describeBucket,
  axisLabel,
  labelEvery = 1,
  highlighted = null,
  ringed = {},
  onSelect,
  upHeight = 60,
  downHeight = 44,
  unit = 10,
}: Props) {
  const c = useTheme();
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - width) > 1) setWidth(w);
  };
  // A bar is a little over half its column, capped where the design caps it.
  const barWidth = width > 0 ? Math.max(3, Math.min(14, Math.round((width / buckets.length) * 0.55))) : 8;

  const maxUp = Math.max(1, ...buckets.map((b) => b.up));
  const maxDown = Math.max(1, ...buckets.map((b) => b.down));
  const scale = Math.min(unit, upHeight / maxUp, downHeight / maxDown);
  const barHeight = (count: number) => (count > 0 ? Math.max(3, Math.round(count * scale)) : 0);

  // Labels sit in runs of `labelEvery` columns, each run captioned by its first
  // column. A run is wide enough for its label where one column is not, so the
  // labels never overlap however many columns there are.
  const runs: { index: number; length: number }[] = [];
  for (let i = 0; i < buckets.length; i += labelEvery) {
    runs.push({ index: i, length: Math.min(labelEvery, buckets.length - i) });
  }

  return (
    <View>
      <View style={styles.columns} onLayout={onLayout}>
        {buckets.map((bucket, i) => {
          const ring = ringed[i];
          // The design's double ring: a gap in the surface colour, then the
          // ring, so it reads as a mark around the bar rather than its edge.
          const withRing = (bar: ReactNode, side: 'up' | 'down') =>
            ring ? (
              <View style={[styles.ring, side === 'up' ? styles.ringUp : styles.ringDown, { borderColor: ring }]}>
                {bar}
              </View>
            ) : (
              bar
            );

          const content = (
            <>
              <View style={[styles.upArea, { height: upHeight }]}>
                {bucket.up > 0 &&
                  withRing(<View style={[styles.upBar, { width: barWidth, height: barHeight(bucket.up) }]} />, 'up')}
                {bucket.neutral > 0 && <View style={styles.diamond} />}
              </View>
              <View style={[styles.downArea, { height: downHeight }]}>
                {bucket.down > 0 &&
                  withRing(
                    <View style={[styles.downBar, { width: barWidth, height: barHeight(bucket.down) }]} />,
                    'down',
                  )}
              </View>
            </>
          );

          const columnStyle = [styles.column, i === highlighted && styles.highlighted];

          // Columns are siblings, never nested in another Pressable. They are
          // narrower than a fingertip on the 30-day view; every column is also
          // reachable as a full-width row in the list under the chart.
          return onSelect ? (
            <Pressable
              key={bucket.start}
              onPress={() => onSelect(i)}
              style={({ pressed }) => [...columnStyle, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={describeBucket(bucket)}
              accessibilityState={{ selected: i === highlighted }}
            >
              {content}
            </Pressable>
          ) : (
            <View
              key={bucket.start}
              style={columnStyle}
              accessible
              accessibilityLabel={describeBucket(bucket)}
            >
              {content}
            </View>
          );
        })}
      </View>

      <View style={styles.labels} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {runs.map((run) => {
          const bucket = buckets[run.index]!;
          const label = axisLabel(bucket, run.index);
          const on = highlighted !== null && highlighted >= run.index && highlighted < run.index + run.length;
          return (
            <View key={bucket.start} style={{ flex: run.length }}>
              {label ? (
                <Text style={[styles.label, on && labelEvery === 1 && { color: c.text }]} numberOfLines={1}>
                  {label}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  columns: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 6,
  },
  highlighted: {
    backgroundColor: tint(c.accent, 0.16),
  },
  pressed: {
    backgroundColor: c.surfaceAlt,
  },
  upArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderBottomWidth: 1.5,
    borderBottomColor: c.textMuted,
  },
  downArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  ring: {
    padding: 2,
    borderWidth: 1.5,
    borderRadius: 5,
  },
  // Open on the axis side, so the bar still meets the axis.
  ringUp: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  ringDown: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  upBar: {
    backgroundColor: c.up,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  downBar: {
    backgroundColor: tint(c.down, 0.3),
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: c.down,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  // On the axis, ringed in the surface colour so it reads over a bar's foot.
  diamond: {
    position: 'absolute',
    bottom: -5,
    width: 8,
    height: 8,
    backgroundColor: c.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.surface,
    transform: [{ rotate: '45deg' }],
  },
  labels: {
    flexDirection: 'row',
    marginTop: 4,
  },
  label: {
    ...type.tag,
    fontFamily: font.semibold,
    letterSpacing: 0,
    color: c.textSubtle,
  },
}));
