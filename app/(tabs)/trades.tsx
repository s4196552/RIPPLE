import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { relativeTime, spokenTime } from '@/lib/time';
import {
  holdingSummary,
  qualityLabel,
  toFilingRows,
  toTradeRows,
  topAssets,
  type AssetHolding,
  type TradeRow,
} from '@/lib/trades';
import { logoUrl } from '@/providers/logos';
import type { Signal } from '@/providers/types';
import { useFeed, visibleSignals } from '@/store/feed';
import { useWatchlist } from '@/store/watchlist';
import { Avatar } from '@/ui/components/Avatar';
import { EmptyState } from '@/ui/components/EmptyState';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { font, radius, space, tapSlop, type } from '@/ui/theme';
import { type Tone } from '@/ui/tone';
import { TonePill } from '@/ui/components/TonePill';
import { openLink } from '@/lib/feedback';
import { useTabBarSpace } from '@/ui/components/FloatingTabBar';

/**
 * Disclosed transactions as a table, plus what the watched group traded most.
 *
 * Reads the same store as the feed — no fetching of its own. Only signals that
 * carry a structured `trade` reach the table; an executive order has no trader,
 * action or asset, and a row of dashes is worse than an absent row.
 *
 * Congressional reports without line items get their own list below the table
 * instead (see `toFilingRows`): they are trade disclosures, just ones whose
 * details live in the PDF.
 */
export default function TradesScreen() {
  const c = useTheme();
  const styles = useStyles();
  // Room for the last row to scroll clear of the floating tab bar.
  const tabSpace = useTabBarSpace();
  const router = useRouter();

  const signals = useFeed((s) => s.signals);
  const subjects = useWatchlist((s) => s.subjects);
  const hidden = useWatchlist((s) => s.hiddenSources);
  const hydrated = useWatchlist((s) => s.hydrated);

  const visible = useMemo(
    () => visibleSignals(signals, hidden, subjects),
    [signals, hidden, subjects],
  );
  const rows = useMemo(() => toTradeRows(visible), [visible]);
  const filings = useMemo(() => toFilingRows(visible), [visible]);
  const holdings = useMemo(() => topAssets(rows), [rows]);

  const open = useCallback(async (url: string) => {
    await openLink(url);
  }, []);

  const openTicker = useCallback(
    (symbol: string) => router.push({ pathname: '/ticker/[symbol]', params: { symbol } }),
    [router],
  );

  if (!hydrated) return <View style={styles.screen} />;

  if (rows.length === 0 && filings.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="swap-horizontal-outline"
          title="No trades yet"
          body={
            subjects.length === 0
              ? 'Follow a member of Congress or a company, and their disclosed transactions will be tabled here.'
              : 'Nothing you follow has disclosed a transaction yet. Follow a member of Congress, a party, or a company to see their trades here.'
          }
          {...(subjects.length === 0
            ? { action: { label: 'Add a subject', icon: 'add', onPress: () => router.push('/add') } }
            : {})}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: tabSpace }]}>
      {rows.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Trades</Text>
          <Text style={styles.sectionNote}>Stocks &amp; crypto · {rows.length} disclosed</Text>

          {rows.map((row) => (
            <TradeCard
              key={row.signal.id}
              row={row}
              onOpen={(signal) => router.push({ pathname: '/filing/[id]', params: { id: signal.id } })}
              onOpenTicker={openTicker}
            />
          ))}
        </>
      )}

      {filings.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Congress trade reports</Text>
          <Text style={styles.sectionNote}>
            {filings.length} filed with the House Clerk with no stock trades to list here — bond
            and fund purchases, scanned paper forms, or reports filed since the data was last
            updated. The details are in the report itself. Tap one to read it.
          </Text>

          {filings.map((filing) => (
            <FilingCard key={filing.id} filing={filing} onOpen={open} />
          ))}
        </>
      )}

      {holdings.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Top holdings</Text>
          <Text style={styles.sectionNote}>
            Stocks &amp; crypto, ranked by how many different people disclosed trading them. These
            are disclosed transactions, not current positions — an asset bought and later sold still
            appears.
          </Text>

          {holdings.map((holding, i) => (
            <HoldingRow key={holding.ticker} holding={holding} rank={i + 1} onPress={openTicker} />
          ))}
        </>
      )}
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
/**
 * Opens the in-app filing view, which links on to the original — except the
 * asset, which opens the ticker's page.
 *
 * Three Pressables side by side rather than one with a button inside it,
 * which on web would nest a <button> in a <button>. The pressed look is lifted
 * to the card so the two filing targets still light it up as one. The second
 * filing target (the numbers) is hidden from assistive tech: the first already
 * says everything, and a screen reader should meet the filing once.
 */
function TradeCard({
  row,
  onOpen,
  onOpenTicker,
}: {
  row: TradeRow;
  onOpen: (signal: Signal) => void;
  onOpenTicker: (symbol: string) => void;
}) {
  const c = useTheme();
  const styles = useStyles();
  const [pressed, setPressed] = useState(false);
  const { trade } = row;
  const press = {
    onPress: () => onOpen(row.signal),
    onPressIn: () => setPressed(true),
    onPressOut: () => setPressed(false),
  };
  const buy = trade.action === 'buy';

  // Direction of the return itself, which is not the same as `tone` above —
  // that one grades the timing of the decision, this one is just the number.
  const returnTone: Tone = row.changePct === null ? 'neutral' : row.changePct >= 0 ? 'up' : 'down';

  // Drawn by `TonePill`, which adds the ▲/▼ mark; spoken without it, since a
  // screen reader renders `▲` as "black up-pointing triangle".
  const returnValue =
    row.changePct === null ? '—' : `${row.changePct >= 0 ? '+' : ''}${row.changePct.toFixed(2)}%`;

  return (
    <View style={[styles.trade, pressed && styles.tradePressed]}>
      <Pressable
        {...press}
        style={styles.tradeTop}
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
        <Avatar
          uri={trade.traderPhotoUrl}
          name={trade.traderName}
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
        {trade.discretionary ? (
          <TonePill tone={buy ? 'up' : 'down'} label={buy ? 'Buy' : 'Sell'} variant="tag" />
        ) : (
          <TonePill tone="neutral" label={shortKind(trade.kindLabel)} variant="tag" />
        )}
      </Pressable>

      <View style={styles.tradeBottom}>
        <Pressable
          onPress={() => onOpenTicker(row.ticker)}
          style={({ pressed: on }) => [styles.assetButton, on && styles.assetPressed]}
          accessibilityRole="button"
          accessibilityLabel={`${row.ticker}: price and everyone trading it`}
          accessibilityHint="Opens the ticker page"
        >
          <Avatar uri={logoUrl(row.ticker)} name={row.ticker} size={26} square logo />

          <View style={styles.assetBlock}>
            <Text style={styles.assetName} numberOfLines={1}>
              {row.ticker}
              <Text style={styles.assetType}> · {row.assetType}</Text>
            </Text>
            <Text style={styles.assetMeta} numberOfLines={1}>
              {trade.amountLabel ?? 'Amount undisclosed'} · {relativeTime(row.timestamp)}
            </Text>
          </View>
        </Pressable>

        <Pressable
          {...press}
          style={styles.numbersButton}
          accessible={false}
          focusable={false}
          aria-hidden
        >
          <View style={styles.numbers}>
            {/* A solid pill rather than text in the tone colour: the tones are
                shared by every mode and only carry small text at AA as a fill. */}
            <TonePill tone={returnTone} label={returnValue} />
            {/* Three distinct states, and they must not be conflated: a verdict,
                no prices to draw one from, and nothing to judge because the
                movement was not a decision. */}
            {row.quality ? (
              <Text style={styles.qualityText}>{qualityLabel(row.quality)}</Text>
            ) : row.changePct === null ? (
              <Text style={styles.qualityMuted}>No price data</Text>
            ) : (
              <Text style={styles.qualityMuted}>Not a decision</Text>
            )}
          </View>

          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

/** A congressional report whose line items are only in its PDF. */
function FilingCard({ filing, onOpen }: { filing: Signal; onOpen: (url: string) => void }) {
  const c = useTheme();
  const styles = useStyles();
  const { actor } = filing;

  return (
    <Pressable
      onPress={() => onOpen(filing.url)}
      style={({ pressed }) => [styles.filing, pressed && styles.tradePressed]}
      accessibilityRole="button"
      accessibilityLabel={
        `${actor.displayName}${actor.subtitle ? `, ${actor.subtitle}` : ''}. ` +
        `Filed a trade report ${spokenTime(filing.timestamp)}. Details are in the report.`
      }
      accessibilityHint="Opens the report"
    >
      <Avatar uri={actor.avatarUrl} name={actor.displayName} size={34} />

      <View style={styles.traderBlock}>
        <Text style={styles.traderName} numberOfLines={1}>
          {actor.displayName}
        </Text>
        <Text style={styles.traderTitle} numberOfLines={1}>
          {[actor.subtitle, relativeTime(filing.timestamp)].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <TonePill tone="neutral" label="Report" variant="tag" />

      <Ionicons name="open-outline" size={15} color={c.textMuted} />
    </Pressable>
  );
}

function HoldingRow({
  holding,
  rank,
  onPress,
}: {
  holding: AssetHolding;
  rank: number;
  onPress: (symbol: string) => void;
}) {
  const c = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => onPress(holding.ticker)}
      style={({ pressed }) => [styles.holding, pressed && styles.tradePressed]}
      accessibilityRole="button"
      accessibilityLabel={
        `${rank}. ${holding.ticker}, ${holding.assetType}. ` +
        `${holding.traders} ${holding.traders === 1 ? 'person' : 'people'}. ` +
        `${holdingSummary(holding)}.`
      }
      accessibilityHint="Opens the ticker page"
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

      <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
    </Pressable>
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
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: 14,
    paddingVertical: space.md,
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  filing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: 14,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  tradePressed: {
    backgroundColor: c.surfaceAlt,
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
  tradeBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.xl + space.sm,
  },
  // The asset opens its ticker page: a target of its own, padded to 44pt.
  assetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    marginVertical: -6,
    marginLeft: -6,
    paddingLeft: 6,
    borderRadius: radius.md,
  },
  assetPressed: {
    backgroundColor: c.raised,
  },
  numbersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
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
    fontFamily: font.regular,
  },
  assetMeta: {
    ...type.caption,
    color: c.textMuted,
  },
  numbers: {
    alignItems: 'flex-end',
    gap: 1,
  },
  qualityText: {
    ...type.micro,
    color: c.text,
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
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: 14,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
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
