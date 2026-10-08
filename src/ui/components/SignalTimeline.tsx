import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SOURCE_IDS, describe } from '@/providers/registry';
import type { Signal } from '@/providers/types';
import {
  RANGES,
  bucketAxisLabel,
  bucketUnitFor,
  busiestBuckets,
  fillBuckets,
  fixedSpans,
  shortDate,
  spanLabel,
  windowFor,
  type ActivityBucket,
  type BucketUnit,
  type TimelineRange,
} from '@/lib/timeline';
import { makeStyles, useTheme } from '../ThemeProvider';
import { font, radius, space, type } from '../theme';
import { spokenLabel } from '../tone';
import { ActivityChart } from './ActivityChart';
import { Segmented } from './Segmented';
import { TonePill } from './TonePill';
import { ToneMark } from './ToneMark';

interface Props {
  signals: Signal[];
  onOpen: (signal: Signal) => void;
}

const UNIT_PLURAL: Record<BucketUnit, string> = {
  day: 'days',
  week: 'weeks',
  month: 'months',
  quarter: 'quarters',
};

/** Columns per axis label, so labels never crowd. */
const LABEL_EVERY: Record<BucketUnit, number> = { day: 8, week: 4, month: 3, quarter: 3 };

/**
 * Everything you follow, counted on one time axis.
 *
 * The feed answers "what is newest". This answers "when was it busy, and which
 * way did it lean": one column per day, week or month, buys above the axis and
 * sells below, and a lane per source underneath whose dots grow with the
 * count. Tap a column, or a row under "Busiest weeks", to list what is in it.
 *
 * All the counting lives in `@/lib/timeline`, which is unit-tested; this file
 * only lays it out.
 */
export function SignalTimeline({ signals, onOpen }: Props) {
  const c = useTheme();
  const styles = useStyles();
  const [range, setRange] = useState<TimelineRange>('90d');
  const [selected, setSelected] = useState<number | null>(null);

  const window = useMemo(() => windowFor(range, signals), [range, signals]);
  const unit = window ? bucketUnitFor(range, window) : 'week';
  const buckets = useMemo(
    () => (window ? fillBuckets(signals, fixedSpans(window, unit)) : []),
    [signals, window, unit],
  );

  const totals = useMemo(() => {
    const sum = { up: 0, down: 0, neutral: 0, total: 0, policyOnly: true };
    for (const b of buckets) {
      sum.up += b.up;
      sum.down += b.down;
      sum.neutral += b.neutral;
      sum.total += b.total;
      for (const s of b.signals) {
        if ((s.accent?.tone ?? 'neutral') === 'neutral' && s.source !== 'policy') sum.policyOnly = false;
      }
    }
    return sum;
  }, [buckets]);

  // Lanes in registry order, as the design lists them, and only for sources
  // with something in range: an empty lane reads as a rendering failure.
  const lanes = SOURCE_IDS.filter((id) => buckets.some((b) => (b.bySource[id] ?? 0) > 0));
  const maxCell = Math.max(1, ...buckets.flatMap((b) => SOURCE_IDS.map((id) => b.bySource[id] ?? 0)));

  const busiest = useMemo(() => busiestBuckets(buckets), [buckets]);
  const busiestIndex = busiest[0] ? buckets.indexOf(busiest[0]) : null;
  const current = selected !== null ? buckets[selected] : undefined;

  const changeRange = (next: TimelineRange) => {
    setRange(next);
    setSelected(null);
  };

  const neutralWord = totals.policyOnly ? 'policy' : 'no direction';

  const describeBucket = (b: ActivityBucket) =>
    `${spanLabel(b)}: ${b.total === 0 ? 'nothing' : countsSpoken(b)}`;

  return (
    <View style={styles.wrap}>
      <Segmented
        label="Range"
        value={range}
        onChange={changeRange}
        fill
        mono
        options={RANGES.map((r) => ({
          value: r.id,
          label: r.label,
          spoken: r.days ? `Last ${r.days} days` : 'All history',
        }))}
      />

      {!window || totals.total === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing in this range.</Text>
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryRange}>
              All follows · {shortDate(window.start)} – {shortDate(window.end)}
            </Text>
            <Text style={styles.summaryCount}>
              <Text style={styles.mono}>{totals.total}</Text> {totals.total === 1 ? 'filing' : 'filings'}
            </Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <ToneMark tone="up" size={9} />
                <Text style={styles.legendStrong}>{totals.up} buys & up moves</Text>
              </View>
              <Text style={styles.legendQuiet}>
                {totals.neutral > 0 ? `◆ ${totals.neutral} ${neutralWord} · ` : ''}per {unit}
              </Text>
            </View>

            <ActivityChart
              buckets={buckets}
              describeBucket={describeBucket}
              axisLabel={(b) => bucketAxisLabel(b, unit)}
              labelEvery={LABEL_EVERY[unit]}
              highlighted={selected ?? busiestIndex}
              onSelect={(i) => setSelected(i === selected ? null : i)}
              upHeight={unit === 'day' ? 40 : 60}
              downHeight={unit === 'day' ? 40 : 44}
            />

            <View style={[styles.legendItem, styles.legendFoot]}>
              <ToneMark tone="down" size={9} />
              <Text style={styles.legendStrong}>{totals.down} sells & down moves</Text>
              <Text style={styles.legendQuiet}>· outlined, below</Text>
            </View>

            {lanes.length > 0 && (
              <View style={styles.lanes}>
                {lanes.map((id) => {
                  const label = describe(id).label;
                  const count = buckets.reduce((n, b) => n + (b.bySource[id] ?? 0), 0);
                  const active = buckets.filter((b) => (b.bySource[id] ?? 0) > 0).length;
                  return (
                    <View
                      key={id}
                      style={styles.lane}
                      accessible
                      accessibilityLabel={`${label}: ${count} across ${active} of ${buckets.length} ${UNIT_PLURAL[unit]}`}
                    >
                      <Text style={styles.laneName} numberOfLines={1}>
                        {label}
                      </Text>
                      <View style={styles.laneTrack}>
                        {buckets.map((b) => {
                          const n = b.bySource[id] ?? 0;
                          const d = n === 0 ? 0 : 5 + Math.round((7 * (n - 1)) / Math.max(1, maxCell - 1));
                          return (
                            <View key={b.start} style={styles.laneCell}>
                              {n > 0 && (
                                <View
                                  style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: c.textMuted }}
                                />
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
                <Text style={styles.laneHint}>Dot size = number of items that {unit}</Text>
              </View>
            )}
          </View>

          {current ? (
            <BucketDetail bucket={current} onOpen={onOpen} onClose={() => setSelected(null)} />
          ) : (
            <>
              <Text style={styles.section} accessibilityRole="header">
                Busiest {UNIT_PLURAL[unit]}
              </Text>
              <View style={styles.list}>
                {busiest.map((b, i) => (
                  <Pressable
                    key={b.start}
                    onPress={() => setSelected(buckets.indexOf(b))}
                    style={({ pressed }) => [styles.busyRow, i > 0 && styles.rowRule, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${spanLabel(b)}, ${plural(b.total, 'filing')}: ${countsSpoken(b)}. ${topActors(b)}`}
                    accessibilityHint="Lists what was filed"
                  >
                    <View style={styles.busyBody}>
                      <Text style={styles.busyTitle}>
                        {spanLabel(b)} · <Text style={styles.mono}>{b.total}</Text> {b.total === 1 ? 'filing' : 'filings'}
                      </Text>
                      <Text style={styles.busySub} numberOfLines={1}>
                        {topActors(b)}
                      </Text>
                    </View>
                    <ToneCounts bucket={b} />
                    <Ionicons name="chevron-forward" size={18} color={c.textSubtle} />
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

/** One column's contents, by day — what the design shows for a picked week. */
function BucketDetail({
  bucket,
  onOpen,
  onClose,
}: {
  bucket: ActivityBucket;
  onOpen: (signal: Signal) => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const styles = useStyles();

  const days: { label: string; signals: Signal[] }[] = [];
  for (const s of bucket.signals) {
    // UTC, as the columns are: filings are dated by day, not by hour.
    const weekday = new Date(s.timestamp).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const label = `${weekday} ${shortDate(s.timestamp)}`;
    const last = days[days.length - 1];
    if (last && last.label === label) last.signals.push(s);
    else days.push({ label, signals: [s] });
  }

  return (
    <View>
      <View style={styles.detailHead}>
        <Text style={styles.detailTitle} accessibilityRole="header">
          {spanLabel(bucket)} · <Text style={styles.mono}>{bucket.total}</Text> {bucket.total === 1 ? 'item' : 'items'}
        </Text>
        <ToneCounts bucket={bucket} />
        <Pressable
          onPress={onClose}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Back to busiest"
        >
          <Ionicons name="close" size={20} color={c.text} />
        </Pressable>
      </View>

      {days.map((day) => (
        <View key={day.label}>
          <Text style={styles.day}>{day.label}</Text>
          <View style={styles.list}>
            {day.signals.map((s, i) => {
              const tone = s.accent?.tone ?? 'neutral';
              return (
                <Pressable
                  key={s.id}
                  onPress={() => onOpen(s)}
                  style={({ pressed }) => [styles.item, i > 0 && styles.rowRule, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    `${s.actor.displayName}. ${s.text}` +
                    (s.accent ? ` ${spokenLabel(s.accent.tone, s.accent.label)}.` : '')
                  }
                  accessibilityHint="Opens the original filing"
                >
                  <View style={styles.itemMark}>
                    <ToneMark tone={tone} size={11} />
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemText} numberOfLines={2}>
                      {s.text}
                    </Text>
                    <Text style={styles.itemActor} numberOfLines={1}>
                      {describe(s.source).label} · {s.actor.displayName}
                    </Text>
                  </View>
                  {s.accent && <TonePill tone={s.accent.tone} label={s.accent.label} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

/** ▲5 ▼4 ◆1, as pills: the counts are text, so the colour goes behind them. */
function ToneCounts({ bucket }: { bucket: ActivityBucket }) {
  const styles = useStyles();
  return (
    <View style={styles.counts} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {bucket.up > 0 && <TonePill tone="up" label={String(bucket.up)} />}
      {bucket.down > 0 && <TonePill tone="down" label={String(bucket.down)} />}
      {bucket.neutral > 0 && <TonePill tone="neutral" label={`◆ ${bucket.neutral}`} />}
    </View>
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function countsSpoken(b: ActivityBucket): string {
  const parts = [
    b.up ? `${b.up} up` : '',
    b.down ? `${b.down} down` : '',
    b.neutral ? `${b.neutral} with no direction` : '',
  ].filter(Boolean);
  return parts.join(', ');
}

/** The names behind a column, most frequent first: "HD, Taylor, Fields". */
function topActors(b: ActivityBucket): string {
  const counts = new Map<string, number>();
  for (const s of b.signals) {
    const name = s.ticker ?? s.actor.displayName;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, z) => z[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name)
    .join(', ');
}

const useStyles = makeStyles((c) => ({
  wrap: {
    paddingHorizontal: space.lg,
    paddingTop: 10,
  },
  empty: {
    paddingVertical: space.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...type.bodyTight,
    color: c.textMuted,
  },
  mono: {
    fontFamily: font.monoSemibold,
    fontVariant: ['tabular-nums'],
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.sm,
    paddingTop: space.md,
    paddingBottom: space.sm,
    paddingHorizontal: 2,
  },
  summaryRange: {
    ...type.bodyTight,
    color: c.textMuted,
    flexShrink: 1,
  },
  summaryCount: {
    ...type.bodyTight,
    color: c.text,
  },
  panel: {
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  legendFoot: {
    marginTop: space.xs,
  },
  legendStrong: {
    ...type.caption,
    fontFamily: font.semibold,
    color: c.text,
  },
  legendQuiet: {
    ...type.caption,
    color: c.textSubtle,
  },
  lanes: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  lane: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 26,
  },
  laneName: {
    ...type.caption,
    fontFamily: font.semibold,
    color: c.textMuted,
    width: 62,
  },
  laneTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  laneCell: {
    flex: 1,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laneHint: {
    ...type.caption,
    fontSize: 11,
    color: c.textSubtle,
    paddingLeft: 70,
    marginTop: 2,
  },
  section: {
    ...type.caption,
    fontFamily: font.semibold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: c.textSubtle,
    paddingTop: 14,
    paddingBottom: space.sm,
    paddingHorizontal: 2,
  },
  list: {
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  rowRule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  pressed: {
    backgroundColor: c.surfaceAlt,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  busyBody: {
    flex: 1,
  },
  busyTitle: {
    ...type.body,
    fontFamily: font.semibold,
    color: c.text,
  },
  busySub: {
    ...type.label,
    fontFamily: font.regular,
    color: c.textSubtle,
  },
  counts: {
    flexDirection: 'row',
    gap: 4,
  },
  detailHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: 14,
    paddingHorizontal: 2,
  },
  detailTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: font.bold,
    color: c.text,
    flex: 1,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  day: {
    ...type.caption,
    fontFamily: font.semibold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: c.textSubtle,
    paddingTop: space.md,
    paddingBottom: 6,
    paddingHorizontal: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  itemMark: {
    width: 16,
    alignItems: 'center',
  },
  itemBody: {
    flex: 1,
    gap: 1,
  },
  itemText: {
    ...type.bodyTight,
    color: c.text,
  },
  itemActor: {
    ...type.caption,
    color: c.textSubtle,
  },
}));
