import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { relativeTime } from '@/lib/time';
import {
  holdingSummary,
  qualityLabel,
  qualityTone,
  toTradeRows,
  topAssets,
  type AssetHolding,
  type TradeRow,
} from '@/lib/trades';
import { logoUrl } from '@/providers/logos';
import { describe } from '@/providers/registry';
import { useFeed, visibleSignals } from '@/store/feed';
import { useWatchlist } from '@/store/watchlist';
import { Avatar } from '@/ui/components/Avatar';
import { EmptyState } from '@/ui/components/EmptyState';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { radius, space, tapSlop, tint, type } from '@/ui/theme';
import { markedLabel, toneColor, type Tone } from '@/ui/tone';

/**
 * Disclosed transactions as a table, plus what the watched group traded most.
 *
 * Reads the same store as the feed — no fetching of its own. Only signals that
 * carry a structured `trade` appear; an executive order has no trader, action
 * or asset, and a row of dashes is worse than an absent row.
 */
export default function TradesScreen() {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();

  const signals = useFeed((s) => s.signals);
  const subjects = useWatchlist((s) => s.subjects);
  const hidden = useWatchlist((s) => s.hiddenSources);
  const hydrated = useWatchlist((s) => s.hydrated);

  const rows = useMemo(
    () => toTradeRows(visibleSignals(signals, hidden, subjects)),
    [signals, hidden, subjects],
  );
  const holdings = useMemo(() => topAssets(rows), [rows]);

  const open = useCallback(async (url: string) => {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      toolbarColor: c.bg,
      controlsColor: c.accent,
    });
  }, []);

  if (!hydrated) return <View style={styles.screen} />;

  if (rows.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="swap-horizontal-outline"
          title="No trades yet"
          body={
            subjects.length === 0
              ? 'Follow a member of Congress or a company, and their disclosed transactions will be tabled here.'
              : 'Nothing you follow has a disclosed transaction with a ticker yet. Congressional trades need an aggregator key; SEC Form 4 filings work without one.'
          }
          {...(subjects.length === 0
            ? { action: { label: 'Add a subject', onPress: () => router.push('/add') } }
            : {})}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Trades</Text>
      <Text style={styles.sectionNote}>Stocks &amp; crypto · {rows.length} disclosed</Text>

      {rows.map((row) => (
        <TradeCard key={row.signal.id} row={row} onOpen={open} />
      ))}

      <Text style={styles.sectionTitle}>Top holdings</Text>
      <Text style={styles.sectionNote}>
        Stocks &amp; crypto, ranked by how many different people disclosed trading them. These are
        disclosed transactions, not current positions — an asset bought and later sold still
        appears.
      </Text>

      {holdings.map((holding, i) => (
        <HoldingRow key={holding.ticker} holding={holding} rank={i + 1} />
      ))}
    </ScrollView>
  );
}

/**
 * One disclosed transaction.
 *
 * A true grid does not survive a 375px screen, so the columns are laid out as
 * two lines that keep the same reading order — trader and action up top, asset
 * and the numbers beneath.
 */
function TradeCard({ row, onOpen }: { row: TradeRow; onOpen: (url: string) => void }) {
  const c = useTheme();
  const styles = useStyles();
  const meta = describe(row.source);
  const { trade } = row;
  const buy = trade.action === 'buy';
  const tone = row.quality ? qualityTone(row.quality) : 'neutral';

  // Direction of the return itself, which is not the same as `tone` above —
  // that one grades the timing of the decision, this one is just the number.
  const returnTone: Tone = row.changePct === null ? 'neutral' : row.changePct >= 0 ? 'up' : 'down';

  // Two forms: the marked one is drawn, the plain one is spoken. A screen
  // reader renders `▲` as "black up-pointing triangle", so it never hears it.
  const returnValue =
    row.changePct === null ? '—' : `${row.changePct >= 0 ? '+' : ''}${row.changePct.toFixed(2)}%`;
  const returnText = markedLabel(returnTone, returnValue);

  return (
    <Pressable
      onPress={() => onOpen(row.url)}
      style={({ pressed }) => [styles.trade, pressed && styles.tradePressed]}
      accessibilityRole="button"
      // The row's meaning is spread across eight columns; the label has to
      // carry them in the order a person would say them.
      accessibilityLabel={
        `${trade.traderName}${trade.traderTitle ? `, ${trade.traderTitle}` : ''}. ` +
        `${trade.discretionary ? (buy ? 'Bought' : 'Sold') : trade.kindLabel} ` +
        `${trade.assetName || row.ticker}, ${row.assetType}. ` +
        `${trade.amountLabel ?? 'Amount undisclosed'}. ${relativeTime(row.timestamp)} ago. ` +
        `Return ${row.changePct === null ? 'unavailable' : returnValue}. ` +
        `${
          row.quality
            ? qualityLabel(row.quality)
            : row.changePct === null
              ? 'No price data'
              : 'Not a decision, so no timing verdict'
        }.`
      }
      accessibilityHint="Opens the filing"
    >
      <View style={styles.tradeTop}>
        <Avatar
          uri={trade.traderPhotoUrl}
          name={trade.traderName}
          accent={meta.color}
          size={34}
        />

        <View style={styles.traderBlock}>
          <Text style={styles.traderName} numberOfLines={1}>
            {trade.traderName}
          </Text>
          {trade.traderTitle ? (
            <Text style={styles.traderTitle} numberOfLines={1}>
              {trade.traderTitle}
            </Text>
          ) : null}
        </View>

        {/* Only a deliberate trade gets the BUY/SELL colours. A grant or a tax
            withholding is shown by name in neutral tone — calling it BUY would
            read as an insider buying the stock, which is not what happened. */}
        <View
          style={[
            styles.actionChip,
            {
              backgroundColor: trade.discretionary
                ? tint(buy ? c.up : c.down, 0.16)
                : c.surfaceAlt,
            },
          ]}
        >
          {trade.discretionary ? (
            <Ionicons
              name={buy ? 'arrow-up' : 'arrow-down'}
              size={11}
              color={buy ? c.up : c.down}
            />
          ) : null}
          <Text
            style={[
              styles.actionText,
              {
                color: trade.discretionary
                  ? buy
                    ? c.up
                    : c.down
                  : c.textMuted,
              },
            ]}
          >
            {trade.discretionary ? (buy ? 'BUY' : 'SELL') : shortKind(trade.kindLabel)}
          </Text>
        </View>
      </View>

      <View style={styles.tradeBottom}>
        <Avatar uri={logoUrl(row.ticker)} name={row.ticker} accent={meta.color} size={26} square logo />

        <View style={styles.assetBlock}>
          <Text style={styles.assetName} numberOfLines={1}>
            {row.ticker}
            <Text style={styles.assetType}> · {row.assetType}</Text>
          </Text>
          <Text style={styles.assetMeta} numberOfLines={1}>
            {trade.amountLabel ?? 'Amount undisclosed'} · {relativeTime(row.timestamp)}
          </Text>
        </View>

        <View style={styles.numbers}>
          <Text
            style={[
              styles.returnText,
              { color: toneColor(returnTone, c) },
            ]}
          >
            {returnText}
          </Text>
          {/* Three distinct states, and they must not be conflated: a verdict,
              no prices to draw one from, and nothing to judge because the
              movement was not a decision. */}
          {row.quality ? (
            <Text style={[styles.qualityText, { color: toneColor(tone, c) }]}>
              {qualityLabel(row.quality)}
            </Text>
          ) : row.changePct === null ? (
            <Text style={styles.qualityMuted}>No price data</Text>
          ) : (
            <Text style={styles.qualityMuted}>Not a decision</Text>
          )}
        </View>

        <Ionicons name="open-outline" size={15} color={c.textMuted} />
      </View>
    </Pressable>
  );
}

function HoldingRow({ holding, rank }: { holding: AssetHolding; rank: number }) {
  const styles = useStyles();
  return (
    <View
      style={styles.holding}
      accessible
      accessibilityLabel={
        `${rank}. ${holding.ticker}, ${holding.assetType}. ` +
        `${holding.traders} ${holding.traders === 1 ? 'person' : 'people'}. ` +
        `${holdingSummary(holding)}.`
      }
    >
      <Text style={styles.rank}>{rank}</Text>
      <Avatar uri={logoUrl(holding.ticker)} name={holding.ticker} size={30} square logo />

      <View style={styles.holdingBlock}>
        <Text style={styles.holdingTicker} numberOfLines={1}>
          {holding.ticker}
          <Text style={styles.assetType}> · {holding.assetType}</Text>
        </Text>
        <Text style={styles.holdingMeta} numberOfLines={1}>
          {holdingSummary(holding)}
        </Text>
      </View>

      <View style={styles.holdingCount}>
        <Text style={styles.holdingTraders}>{holding.traders}</Text>
        <Text style={styles.holdingTradersLabel}>
          {holding.traders === 1 ? 'person' : 'people'}
        </Text>
      </View>
    </View>
  );
}

/** `GRANT / AWARD` -> `GRANT`, so the chip stays one short word. */
function shortKind(kindLabel: string): string {
  return (kindLabel.split('/')[0] ?? kindLabel).trim().split(' ')[0] ?? kindLabel;
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    paddingBottom: space.xxl,
  },
  sectionTitle: {
    ...type.title,
    color: c.text,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
  },
  sectionNote: {
    ...type.caption,
    color: c.textMuted,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.md,
    lineHeight: 17,
  },
  trade: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  tradePressed: {
    backgroundColor: c.surface,
  },
  tradeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  traderBlock: {
    flex: 1,
    gap: 1,
  },
  traderName: {
    ...type.label,
    color: c.text,
  },
  traderTitle: {
    ...type.caption,
    color: c.textMuted,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  actionText: {
    ...type.micro,
  },
  tradeBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.xl + space.sm,
  },
  assetBlock: {
    flex: 1,
    gap: 1,
  },
  assetName: {
    ...type.label,
    color: c.text,
  },
  assetType: {
    ...type.caption,
    color: c.textMuted,
    fontWeight: '400',
  },
  assetMeta: {
    ...type.caption,
    color: c.textMuted,
  },
  numbers: {
    alignItems: 'flex-end',
    gap: 1,
  },
  returnText: {
    ...type.label,
  },
  qualityText: {
    ...type.micro,
  },
  qualityMuted: {
    ...type.caption,
    fontSize: 10,
    color: c.textMuted,
  },
  holding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rank: {
    ...type.caption,
    color: c.textMuted,
    width: 16,
  },
  holdingBlock: {
    flex: 1,
    gap: 1,
  },
  holdingTicker: {
    ...type.label,
    color: c.text,
  },
  holdingMeta: {
    ...type.caption,
    color: c.textMuted,
  },
  holdingCount: {
    alignItems: 'flex-end',
  },
  holdingTraders: {
    ...type.heading,
    color: c.text,
  },
  holdingTradersLabel: {
    ...type.caption,
    fontSize: 10,
    color: c.textMuted,
  },
}));

export { tapSlop };
