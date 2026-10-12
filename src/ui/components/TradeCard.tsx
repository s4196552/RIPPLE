import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DISCLOSURE_LIMIT_DAYS, assetName, disclosureLag, isLate, isoDate } from '@/lib/filing';
import { pct } from '@/lib/format';
import type { Signal } from '@/providers/types';
import { makeStyles, useTheme } from '../ThemeProvider';
import { font, radius, space, tapSlop, type } from '../theme';
import { spokenLabel, type Tone } from '../tone';
import { TonePill } from './TonePill';

interface Props {
  signal: Signal;
  onPress: (signal: Signal) => void;
}

function toneOf(value: number): Tone {
  return value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
}

/**
 * One disclosed trade on the member page: direction, ticker, the amount as
 * filed, how long it took to disclose, and what the price did.
 *
 * A late filing gets a warning border and a LATE tag, and its delay line says
 * by how much in words — never the warning colour alone.
 *
 * The ticker is its own button, opening the stock's page. It sits beside the
 * card's Pressable rather than inside it — a nested Pressable is a button in a
 * button on web — and is laid over the card's top corner.
 */
export function TradeCard({ signal, onPress }: Props) {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const trade = signal.trade;
  const late = isLate(signal);
  const lag = disclosureLag(signal);
  const name = assetName(signal);
  const r = signal.reaction;
  const action = trade?.action === 'sell' ? 'Sell' : 'Buy';
  const tone: Tone = trade?.action === 'sell' ? 'down' : 'up';

  const delay =
    lag === null
      ? null
      : late
        ? `${lag} days to disclose — ${lag - DISCLOSURE_LIMIT_DAYS} past the ${DISCLOSURE_LIMIT_DAYS}-day limit`
        : `${lag} of ${DISCLOSURE_LIMIT_DAYS} days to disclose`;

  const measures = r
    ? [
        { value: r.changePct, label: pct(r.changePct), caption: 'since filing' },
        ...(r.excessPct != null
          ? [
              {
                value: r.excessPct,
                label: pct(r.excessPct).replace('%', 'pp'),
                caption: `vs ${r.benchmarkSymbol ?? 'SPY'} since filing`,
              },
            ]
          : []),
      ]
    : [];

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onPress(signal)}
        style={({ pressed }) => [styles.card, late && styles.cardLate, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={
          `${action} ${signal.ticker ?? ''}${name ? `, ${name}` : ''}. ` +
          `${trade?.amountLabel ?? ''}. ` +
          (late ? 'Late filing. ' : '') +
          (delay ? `${delay}. ` : '') +
          measures.map((m) => `${spokenLabel(toneOf(m.value), m.label)} ${m.caption}`).join('. ')
        }
        accessibilityHint="Opens the filing"
      >
        <View style={[styles.line, signal.ticker ? styles.lineWithTicker : null]}>
          <TonePill tone={tone} label={action} variant="tag" />
          {name ? (
            <Text style={styles.asset} numberOfLines={1}>
              {name}
            </Text>
          ) : null}
          {late && (
            <View style={styles.late}>
              <Ionicons name="time-outline" size={12} color={c.warning} />
              <Text style={styles.lateText}>LATE</Text>
            </View>
          )}
        </View>

        {trade?.amountLabel ? <Text style={styles.amount}>{trade.amountLabel}</Text> : null}

        {trade?.tradedAt != null || delay ? (
          <View style={styles.foot}>
            {late && <Ionicons name="warning-outline" size={13} color={c.warning} />}
            <Text style={[styles.footText, late && styles.footLate]}>
              {trade?.tradedAt != null ? `Traded ${isoDate(trade.tradedAt)}` : ''}
              {trade?.tradedAt != null && delay ? ' · ' : ''}
              {delay ?? ''}
            </Text>
          </View>
        ) : null}

        {measures.length > 0 && (
          <View style={styles.measures}>
            {measures.map((m) => (
              <View key={m.caption} style={styles.measure}>
                <TonePill tone={toneOf(m.value)} label={m.label} />
                <Text style={styles.measureCaption}>{m.caption}</Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>
      {signal.ticker ? (
        <Pressable
          onPress={() => router.push({ pathname: '/ticker/[symbol]', params: { symbol: signal.ticker! } })}
          hitSlop={tapSlop(TICKER_HEIGHT)}
          style={({ pressed }) => [styles.ticker, pressed && styles.tickerPressed]}
          accessibilityRole="button"
          accessibilityLabel={`${signal.ticker}: price and everyone trading it`}
          accessibilityHint="Opens the ticker page"
        >
          <Text style={styles.tickerText}>{signal.ticker}</Text>
          <Ionicons name="chevron-forward" size={12} color={c.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The ticker chip's height, for padding its tap area out to 44. */
const TICKER_HEIGHT = 22;

const useStyles = makeStyles((c) => ({
  wrap: {
    marginBottom: space.sm,
  },
  card: {
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: 14,
  },
  cardLate: {
    borderWidth: 1.5,
    borderColor: c.warning,
  },
  pressed: {
    backgroundColor: c.surfaceAlt,
  },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  // Room on the first line for the ticker button laid over the corner.
  lineWithTicker: {
    paddingRight: 84,
  },
  ticker: {
    position: 'absolute',
    top: space.md - 1,
    right: 14,
    height: TICKER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 6,
    paddingRight: 4,
    borderRadius: 4,
    backgroundColor: c.surfaceAlt,
  },
  tickerPressed: {
    backgroundColor: c.raised,
  },
  tickerText: {
    ...type.mono,
    color: c.text,
  },
  asset: {
    ...type.bodyTight,
    color: c.textMuted,
    flexShrink: 1,
  },
  late: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.warning,
  },
  lateText: {
    ...type.tag,
    color: c.text,
  },
  amount: {
    fontFamily: font.mono,
    fontSize: 14,
    lineHeight: 20,
    color: c.text,
    marginTop: 6,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  footText: {
    ...type.caption,
    color: c.textSubtle,
    flexShrink: 1,
  },
  footLate: {
    fontFamily: font.semibold,
    color: c.text,
  },
  measures: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  measure: {
    flex: 1,
    gap: 4,
  },
  measureCaption: {
    ...type.caption,
    color: c.textMuted,
  },
}));
