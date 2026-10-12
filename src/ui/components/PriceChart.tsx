import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { lineSegments, monthTicks, scalePoints, type ChartMark } from '@/lib/ticker';
import { makeStyles, useTheme } from '../ThemeProvider';
import { font, type } from '../theme';

interface Props {
  times: readonly number[];
  closes: readonly number[];
  marks: readonly ChartMark[];
  /** The whole chart, in words: range, move and what is marked on it. */
  accessibilityLabel: string;
  height?: number;
}

const LINE = 2;
/** Room above and below the line for a mark centred on a high or a low. */
const PAD = 9;

/**
 * A price line with each disclosed trade pinned to the session it happened.
 *
 * Direction is carried by fill as well as colour, the same rule as
 * `ActivityChart`: a buy is a solid mark in the up tone, a sell an outline in
 * the down tone, and a session with both is a ring around a dot. Congress is a
 * circle and an insider a diamond, so the source never rests on colour either.
 *
 * Drawn with plain Views — rotated bars for the line — because the app ships
 * no SVG renderer, and one would mean a native rebuild for a single chart.
 * One image to assistive tech; the lists under it carry every trade in words.
 */
export function PriceChart({ times, closes, marks, accessibilityLabel, height = 132 }: Props) {
  const c = useTheme();
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - width) > 1) setWidth(w);
  };

  const points = width > 0 ? scalePoints(closes, width, height, PAD) : [];
  const segments = lineSegments(points, LINE);
  const ticks = monthTicks(times);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={[styles.plot, { height }]} onLayout={onLayout}>
        {segments.map((s, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { left: s.left, top: s.top, width: s.width, transform: [{ rotate: `${s.angle}deg` }] },
            ]}
          />
        ))}
        {marks.map((m) => {
          const p = points[m.index];
          if (!p) return null;
          return <Mark key={`${m.source}:${m.index}`} mark={m} x={p.x} y={p.y} surface={c.surface} />;
        })}
      </View>

      <View style={styles.axis}>
        {width > 0 &&
          ticks.map((t) => {
            const x = points[t.index]?.x ?? 0;
            // The last label is pinned to the right edge rather than running off it.
            const nearEnd = x > width - 28;
            return (
              <Text key={t.index} style={[styles.tick, nearEnd ? { right: 0 } : { left: x }]}>
                {t.label}
              </Text>
            );
          })}
      </View>
    </View>
  );
}

function Mark({ mark, x, y, surface }: { mark: ChartMark; x: number; y: number; surface: string }) {
  const c = useTheme();
  const both = mark.buys > 0 && mark.sells > 0;
  const buy = mark.buys > 0 && !both;
  const diamond = mark.source === 'insider';
  // A diamond's corners reach further than a circle's edge, so it is drawn a
  // little smaller to read as the same weight.
  const size = (mark.large || both ? 14 : 11) - (diamond ? 2 : 0);
  const radius = diamond ? 1.5 : size / 2;

  return (
    <View
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: buy ? c.up : surface,
        borderWidth: buy ? 1 : 2,
        // The solid buy gets a hairline in the card colour, so it reads over the line.
        borderColor: buy ? surface : c.down,
        transform: diamond ? [{ rotate: '45deg' }] : undefined,
      }}
    >
      {both && (
        <View style={{ width: size / 2.6, height: size / 2.6, borderRadius: diamond ? 1 : size, backgroundColor: c.up }} />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  plot: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  segment: {
    position: 'absolute',
    height: LINE,
    borderRadius: LINE / 2,
    backgroundColor: c.accent,
  },
  axis: {
    position: 'relative',
    height: 13,
    marginTop: 6,
  },
  tick: {
    ...type.tag,
    position: 'absolute',
    top: 0,
    fontFamily: font.semibold,
    letterSpacing: 0.4,
    color: c.textSubtle,
  },
}));
