import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { compact, money, pct } from '@/lib/format';
import { isAbort } from '@/lib/http';
import {
  TICKER_WINDOW_DAYS,
  byTradeDay,
  chartMarks,
  count,
  isOptionTrade,
  ownerName,
  priceSummary,
  rankHolders,
  sameTicker,
  seatLine,
  stockStake,
  summarizeCongress,
  summarizeInsiders,
  tradeDay,
  windowStart,
  type FundHolder,
} from '@/lib/ticker';
import { shortDate } from '@/lib/timeline';
import { congressTradesFor } from '@/providers/congress/CongressProvider';
import { KNOWN_FUNDS, cikOf, tickerHolding } from '@/providers/funds/FundsProvider';
import { fundName } from '@/providers/funds/thirteenF';
import { logoUrl } from '@/providers/logos';
import { describe, getProvider } from '@/providers/registry';
import { loadTickerMap } from '@/providers/sec';
import { loadSeries, type Series } from '@/providers/stocks/StocksProvider';
import type { Signal } from '@/providers/types';
import { rememberSignals } from '@/store/signalCache';
import { useWatchlist } from '@/store/watchlist';
import { Avatar } from '@/ui/components/Avatar';
import { PriceChart } from '@/ui/components/PriceChart';
import { TonePill } from '@/ui/components/TonePill';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { font, radius, space, type } from '@/ui/theme';
import { spokenLabel, type Tone } from '@/ui/tone';

type Load<T> = { status: 'loading' } | { status: 'done'; data: T } | { status: 'error'; message: string };

interface FundsCheck {
  holders: FundHolder[];
  checked: number;
  total: number;
  /** Funds whose newest table is too large to read on a phone. */
  unreadable: string[];
  /** Lookups that failed outright — no answer either way. */
  failed: number;
  done: boolean;
}

/** Rows shown before "Show all". */
const COLLAPSED = 5;
const DAY = 86_400_000;

/**
 * One stock, every source: its price, who in Congress traded it, what its
 * insiders filed, and which funds hold it.
 *
 * Reached from any ticker chip in the app. Everything is fetched here rather
 * than read from the feed, because the point is the people you do not follow:
 * every member who disclosed the stock, not only those on the watchlist.
 */
export default function TickerScreen() {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ symbol: string }>();
  const symbol = (params.symbol ?? '').replace(/^\$/, '').toUpperCase();

  const subjects = useWatchlist((s) => s.subjects);

  const [series, setSeries] = useState<Load<Series>>({ status: 'loading' });
  const [congress, setCongress] = useState<Load<Signal[]>>({ status: 'loading' });
  const [insider, setInsider] = useState<Load<Signal[]>>({ status: 'loading' });
  const [funds, setFunds] = useState<FundsCheck>({
    holders: [],
    checked: 0,
    total: 0,
    unreadable: [],
    failed: 0,
    done: false,
  });
  const [secName, setSecName] = useState<string | null>(null);
  const [showAllCongress, setShowAllCongress] = useState(false);
  const [showAllInsider, setShowAllInsider] = useState(false);

  const scroll = useRef<ScrollView>(null);
  const sectionY = useRef<Record<'congress' | 'insider' | 'funds', number>>({ congress: 0, insider: 0, funds: 0 });

  useEffect(() => {
    if (!symbol) return;
    const controller = new AbortController();
    const signal = controller.signal;
    const live = () => !signal.aborted;
    const fail = (err: unknown) => (err instanceof Error ? err.message : String(err));

    loadSeries(symbol, signal).then(
      (data) => live() && setSeries({ status: 'done', data }),
      (err) => live() && !isAbort(err) && setSeries({ status: 'error', message: fail(err) }),
    );

    // The company's registered name. Best effort: the symbol stands in.
    loadTickerMap(signal).then(
      (entries) => {
        const entry = entries.find((e) => sameTicker(e.ticker, symbol));
        if (entry && live()) setSecName(fundName(entry.title));
      },
      () => undefined,
    );

    congressTradesFor(symbol, signal).then(
      (data) => live() && setCongress({ status: 'done', data }),
      (err) => live() && !isAbort(err) && setCongress({ status: 'error', message: fail(err) }),
    );

    const insiders = getProvider('insider')
      .getSignals(symbol, { limit: 20, signal })
      .then(
        (data) => live() && setInsider({ status: 'done', data }),
        (err) => live() && !isAbort(err) && setInsider({ status: 'error', message: fail(err) }),
      );

    // Funds after the Form 4s: both go through SEC's one request queue, and
    // the insiders are what the top of the page is waiting on.
    const followed = useWatchlist.getState().subjects.filter((s) => s.source === 'funds').map((s) => cikOf(s.handle));
    const ciks = [...new Set([...followed, ...KNOWN_FUNDS.map((f) => f.cik)])];
    setFunds({ holders: [], checked: 0, total: ciks.length, unreadable: [], failed: 0, done: false });

    void insiders.then(async () => {
      if (!live()) return;
      await Promise.allSettled(
        ciks.map((cik) =>
          tickerHolding(cik, symbol, signal).then(
            (found) =>
              live() &&
              setFunds((prev) => ({
                ...prev,
                checked: prev.checked + 1,
                holders: found?.readable && found.positions.length > 0 ? [...prev.holders, found] : prev.holders,
                unreadable: found && !found.readable ? [...prev.unreadable, found.name] : prev.unreadable,
              })),
            () => live() && setFunds((prev) => ({ ...prev, checked: prev.checked + 1, failed: prev.failed + 1 })),
          ),
        ),
      );
      if (live()) setFunds((prev) => ({ ...prev, done: true }));
    });

    return () => controller.abort();
  }, [symbol]);

  const congressTrades = useMemo(() => (congress.status === 'done' ? byTradeDay(congress.data) : []), [congress]);
  const insiderTrades = useMemo(() => (insider.status === 'done' ? byTradeDay(insider.data) : []), [insider]);
  // The filing view opens a signal by id; these never pass through the feed.
  useEffect(() => rememberSignals([...congressTrades, ...insiderTrades]), [congressTrades, insiderTrades]);

  const since = windowStart();
  const congressSummary = summarizeCongress(congressTrades, since);
  const insiderSummary = summarizeInsiders(insiderTrades, since);
  const congressRecent = congressTrades.filter((s) => tradeDay(s) >= since);
  const holders = rankHolders(funds.holders);
  const topHolder = holders[0];
  // Funds that actually answered: a failed lookup says nothing about holding.
  const answered = funds.total - funds.failed;
  const fundsUnreachable = funds.done && answered === 0;

  const price = series.status === 'done' ? priceSummary(series.data) : null;
  const marks = useMemo(
    () => (series.status === 'done' ? chartMarks(series.data.times, congressTrades, insiderTrades) : []),
    [series, congressTrades, insiderTrades],
  );

  const watchedName = subjects.find(
    (s) => (s.source === 'stocks' || s.source === 'insider') && sameTicker(s.handle, symbol),
  )?.displayName;
  const name = secName ?? (watchedName && !sameTicker(watchedName, symbol) ? watchedName : null) ?? symbol;
  const followedIn = (['stocks', 'insider'] as const).filter((source) =>
    subjects.some((s) => s.source === source && sameTicker(s.handle, symbol)),
  );

  const changeTone: Tone = price ? (price.changePct > 0 ? 'up' : price.changePct < 0 ? 'down' : 'neutral') : 'neutral';
  const spanDays =
    series.status === 'done' && series.data.times.length > 1
      ? Math.round((series.data.times[series.data.times.length - 1]! - series.data.times[0]!) / DAY)
      : TICKER_WINDOW_DAYS;

  const jump = (key: keyof typeof sectionY.current) =>
    scroll.current?.scrollTo({ y: Math.max(0, sectionY.current[key] - space.sm), animated: true });

  const openFiling = (s: Signal) => router.push({ pathname: '/filing/[id]', params: { id: s.id } });
  const openFund = (cik: string) =>
    router.push({ pathname: '/subject/[source]/[handle]', params: { source: 'funds', handle: cik } });

  const markedBuys = marks.reduce((n, m) => n + m.buys, 0);
  const markedSells = marks.reduce((n, m) => n + m.sells, 0);
  const hasInsiderBuy = marks.some((m) => m.source === 'insider' && m.buys > 0);
  const chartLabel = price
    ? `${name}’s price over ${spanDays} days: ${money(price.first)} to ${money(price.last)}, ` +
      `${spokenLabel(changeTone, pct(price.changePct))}. ` +
      (marks.length > 0
        ? `Marked on the line: ${count(markedBuys, 'buy')} and ${count(markedSells, 'sale')} by members of Congress and insiders, each on the day it was made.`
        : 'No disclosed trades fall inside this range.')
    : '';

  const congressShown = showAllCongress ? congressTrades : congressRecent.slice(0, COLLAPSED);
  const insiderShown = showAllInsider ? insiderTrades : insiderTrades.slice(0, COLLAPSED);

  return (
    <ScrollView ref={scroll} style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.identity}>
        <Avatar uri={logoUrl(symbol)} name={symbol} size={56} square logo />
        <View
          style={styles.identityBody}
          accessible
          accessibilityRole="header"
          accessibilityLabel={
            `${name}, ticker ${symbol}` +
            (followedIn.length > 0 ? `. Followed in ${followedIn.map((s) => describe(s).label).join(' and ')}` : '')
          }
        >
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            <Text style={styles.mono}>${symbol}</Text>
            {followedIn.length > 0 ? ` · followed in ${followedIn.map((s) => describe(s).label).join(' and ')}` : ''}
          </Text>
        </View>
      </View>

      {price ? (
        <View
          style={styles.priceRow}
          accessible
          accessibilityLabel={
            `Last close ${money(price.last)} on ${shortDate(price.lastAt)}. ` +
            `${spokenLabel(changeTone, pct(price.changePct))} over ${spanDays} days.`
          }
        >
          <Text style={styles.price}>
            {series.status === 'done' && series.data.currency !== 'USD'
              ? `${price.last.toFixed(2)} ${series.data.currency}`
              : `$${price.last.toFixed(2)}`}
          </Text>
          <TonePill tone={changeTone} label={pct(price.changePct)} />
          <Text style={styles.priceCaption}>
            {spanDays} days · close {shortDate(price.lastAt)}
          </Text>
        </View>
      ) : null}

      <View style={styles.panel}>
        {series.status === 'loading' ? (
          <View style={styles.chartState}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : series.status === 'error' || !price ? (
          <View style={styles.chartState} accessibilityLiveRegion="polite">
            <Text style={styles.stateText}>
              No price history for {symbol} right now. The trades below don’t depend on it.
            </Text>
          </View>
        ) : (
          <>
            <PriceChart
              times={series.data.times}
              closes={series.data.closes}
              marks={marks}
              accessibilityLabel={chartLabel}
            />
            <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <LegendItem shape="circle" fill="up" label="Congress buy" />
              <LegendItem shape="circle" fill="down" label="Congress sell" />
              {hasInsiderBuy && <LegendItem shape="diamond" fill="up" label="Insider buy" />}
              <LegendItem shape="diamond" fill="down" label="Insider sell" />
              <Text style={styles.legendNote}>Larger: several that day, or an insider trade of $1M+</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.tiles}>
        <Tile
          eyebrow="Congress"
          value={congress.status === 'done' ? String(congressSummary.trades) : congress.status === 'loading' ? '…' : '—'}
          caption={
            congress.status === 'loading'
              ? 'reading disclosures'
              : congress.status === 'error'
                ? 'unavailable'
                : congressSummary.trades === 0
                  ? `no trades in ${TICKER_WINDOW_DAYS} days`
                  : `trades by ${count(congressSummary.members, 'member')} · ${count(congressSummary.buys, 'buy')}`
          }
          spoken={
            congress.status === 'done'
              ? `Congress: ${count(congressSummary.trades, 'trade')} in the last ${TICKER_WINDOW_DAYS} days, ` +
                `by ${count(congressSummary.members, 'member')}, ${count(congressSummary.buys, 'buy')}. Show the list.`
              : 'Congress trades, still loading. Show the list.'
          }
          onPress={() => jump('congress')}
        />
        <Tile
          eyebrow="Insiders"
          value={insider.status === 'done' ? String(insiderSummary.filings) : insider.status === 'loading' ? '…' : '—'}
          caption={
            insider.status === 'loading'
              ? 'reading Form 4s'
              : insider.status === 'error'
                ? 'no Form 4s'
                : insiderSummary.openMarketBuys === 0
                  ? 'Form 4s · no open-market buys'
                  : `Form 4s · ${count(insiderSummary.openMarketBuys, 'open-market buy')}`
          }
          spoken={
            insider.status === 'done'
              ? `Insiders: ${count(insiderSummary.filings, 'Form 4')} in the last ${TICKER_WINDOW_DAYS} days, ` +
                `${insiderSummary.openMarketBuys === 0 ? 'no open-market buys' : count(insiderSummary.openMarketBuys, 'open-market buy')}. Show the list.`
              : 'Insider Form 4s, not loaded. Show the list.'
          }
          onPress={() => jump('insider')}
        />
        <Tile
          eyebrow="Funds"
          value={
            topHolder ? `${Math.round(stockStake(topHolder).weight * 100)}%` : fundsUnreachable ? '—' : funds.done ? '0' : '…'
          }
          caption={
            topHolder
              ? `of ${topHolder.name}’s portfolio`
              : fundsUnreachable
                ? 'unavailable'
                : funds.done
                  ? `of ${count(answered, 'fund')} checked hold it`
                  : 'checking 13Fs'
          }
          spoken={
            topHolder
              ? `Funds: ${(stockStake(topHolder).weight * 100).toFixed(1)} percent of ${topHolder.name}’s portfolio` +
                (holders.length > 1 ? `, and ${count(holders.length - 1, 'other fund')} hold it` : '') +
                '. Show the list.'
              : fundsUnreachable
                ? 'Funds: SEC EDGAR could not be reached. Show the list.'
                : funds.done
                  ? `Funds: none of the ${answered} checked hold it. Show the list.`
                  : 'Funds, still checking. Show the list.'
          }
          onPress={() => jump('funds')}
        />
      </View>

      {/* ── Congress ─────────────────────────────────────────────────────── */}
      <Text
        style={styles.sectionTitle}
        accessibilityRole="header"
        onLayout={(e) => (sectionY.current.congress = e.nativeEvent.layout.y)}
      >
        {showAllCongress ? 'Congress · every disclosed trade' : `Congress · last ${TICKER_WINDOW_DAYS} days`}
      </Text>
      <View style={styles.card}>
        {congress.status === 'loading' ? (
          <Pending text="Reading House disclosures…" />
        ) : congress.status === 'error' ? (
          <Empty text="Couldn’t load congressional disclosures. Try again later." />
        ) : congressShown.length === 0 ? (
          <Empty
            text={
              congressTrades.length === 0
                ? `No member of Congress has disclosed trading ${symbol} in the filings Ripple has read.`
                : `No disclosed trades in the last ${TICKER_WINDOW_DAYS} days.`
            }
          />
        ) : (
          congressShown.map((s, i) => <CongressRow key={s.id} signal={s} first={i === 0} onPress={openFiling} />)
        )}
        {!showAllCongress && congressTrades.length > congressShown.length ? (
          <ShowAll label={`Show all ${count(congressTrades.length, 'trade')}`} onPress={() => setShowAllCongress(true)} />
        ) : null}
      </View>

      {/* ── Insiders ─────────────────────────────────────────────────────── */}
      <Text
        style={styles.sectionTitle}
        accessibilityRole="header"
        onLayout={(e) => (sectionY.current.insider = e.nativeEvent.layout.y)}
      >
        Insiders · Form 4
      </Text>
      <View style={styles.card}>
        {insider.status === 'loading' ? (
          <Pending text="Reading Form 4s from SEC EDGAR…" />
        ) : insider.status === 'error' ? (
          <Empty
            text={
              /No SEC registrant/i.test(insider.message)
                ? `${symbol} has no SEC registrant, so no insider files Form 4s for it — funds, ETFs and crypto don’t.`
                : 'Couldn’t reach SEC EDGAR for Form 4s. Try again later.'
            }
          />
        ) : insiderShown.length === 0 ? (
          <Empty text="No recent Form 4s on file." />
        ) : (
          insiderShown.map((s, i) => <InsiderRow key={s.id} signal={s} first={i === 0} onPress={openFiling} />)
        )}
        {!showAllInsider && insiderTrades.length > insiderShown.length ? (
          <ShowAll label={`Show all ${count(insiderTrades.length, 'filing')}`} onPress={() => setShowAllInsider(true)} />
        ) : null}
      </View>

      {/* ── Funds ────────────────────────────────────────────────────────── */}
      <Text
        style={styles.sectionTitle}
        accessibilityRole="header"
        onLayout={(e) => (sectionY.current.funds = e.nativeEvent.layout.y)}
      >
        Funds · 13F
      </Text>
      {holders.map((h) => (
        <FundRow key={h.cik} holder={h} onPress={openFund} />
      ))}
      <View style={styles.fundStatus} accessibilityLiveRegion="polite">
        {!funds.done && <ActivityIndicator size="small" color={c.textMuted} />}
        <Text style={styles.stateText}>
          {!funds.done
            ? `Checking the newest 13F of ${count(funds.total, 'fund')} you follow or that are widely followed… ${funds.checked} of ${funds.total}`
            : fundsUnreachable
              ? 'Couldn’t reach SEC EDGAR for 13F filings. Try again later.'
              : holders.length === 0
                ? `None of the ${count(answered, 'fund')} checked — the ones you follow and the widely followed — lists ${symbol} in its newest 13F.`
                : `Checked the newest 13F of ${count(answered, 'fund')} you follow or that are widely followed.`}
          {funds.done && !fundsUnreachable && funds.failed > 0
            ? ` ${count(funds.failed, 'fund')} couldn’t be reached.`
            : ''}
          {funds.done && funds.unreadable.length > 0
            ? ` ${funds.unreadable.join(', ')} ${funds.unreadable.length === 1 ? 'files a table' : 'file tables'} too large to read on a phone.`
            : ''}
        </Text>
      </View>
    </ScrollView>
  );
}

function Tile({
  eyebrow,
  value,
  caption,
  spoken,
  onPress,
}: {
  eyebrow: string;
  value: string;
  caption: string;
  spoken: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={spoken}
    >
      <Text style={styles.tileEyebrow}>{eyebrow}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.tileCaption}>{caption}</Text>
    </Pressable>
  );
}

function CongressRow({ signal, first, onPress }: { signal: Signal; first: boolean; onPress: (s: Signal) => void }) {
  const styles = useStyles();
  const trade = signal.trade!;
  const buy = trade.action === 'buy';
  const partial = trade.kindLabel === 'PARTIAL SALE';
  const option = isOptionTrade(signal);
  const seat = seatLine(signal.actor.subtitle);
  const when = shortDate(tradeDay(signal));
  const action = buy ? 'Buy' : partial ? 'Partial sell' : 'Sell';

  return (
    <Pressable
      onPress={() => onPress(signal)}
      style={({ pressed }) => [styles.row, !first && styles.rule, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={
        `${trade.traderName}${signal.actor.subtitle ? `, ${signal.actor.subtitle}` : ''}. ` +
        `${buy ? 'Bought' : partial ? 'Partly sold' : 'Sold'}${option ? ' options' : ''}, ` +
        `${trade.amountLabel ?? 'amount undisclosed'}. Traded ${when}.`
      }
      accessibilityHint="Opens the filing"
    >
      <Avatar uri={trade.traderPhotoUrl} name={trade.traderName} size={32} />
      <View style={styles.rowBody}>
        {/* Wraps rather than clips: the seat is information, and a long name
            with larger text would otherwise cut it off. */}
        <Text style={styles.rowName}>
          {trade.traderName}
          {seat ? <Text style={styles.rowSeat}> {seat}</Text> : null}
        </Text>
        <Text style={styles.rowMeta}>
          {trade.amountLabel ?? 'Amount undisclosed'}
          {option ? ' · options' : ''} · traded {when}
        </Text>
      </View>
      <TonePill tone={buy ? 'up' : 'down'} label={action} variant="tag" />
    </Pressable>
  );
}

function InsiderRow({ signal, first, onPress }: { signal: Signal; first: boolean; onPress: (s: Signal) => void }) {
  const styles = useStyles();
  const trade = signal.trade!;
  const buy = trade.action === 'buy';
  const when = shortDate(tradeDay(signal));
  // Only a decision gets a direction. A grant or a tax withholding is named
  // for what it is, in neutral, or it reads as an insider choosing to trade.
  const tag = trade.discretionary ? (buy ? 'Buy' : 'Sell') : shortKind(trade.kindLabel);
  const who = ownerName(trade.traderName);

  return (
    <Pressable
      onPress={() => onPress(signal)}
      style={({ pressed }) => [styles.row, !first && styles.rule, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={
        `${who}${trade.traderTitle ? `, ${trade.traderTitle}` : ''}. ` +
        `${trade.discretionary ? (buy ? 'Open-market buy' : 'Open-market sale') : trade.kindLabel.toLowerCase()}, ` +
        `${trade.amountLabel ?? ''}. ${when}.`
      }
      accessibilityHint="Opens the filing"
    >
      <Avatar name={who} size={32} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {who}
        </Text>
        {trade.traderTitle ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {trade.traderTitle}
          </Text>
        ) : null}
        <Text style={styles.rowMeta}>
          {trade.amountLabel ? `${trade.amountLabel} · ` : ''}
          {when}
        </Text>
      </View>
      <TonePill tone={trade.discretionary ? (buy ? 'up' : 'down') : 'neutral'} label={tag} variant="tag" />
    </Pressable>
  );
}

function FundRow({ holder, onPress }: { holder: FundHolder; onPress: (cik: string) => void }) {
  const styles = useStyles();
  const stake = stockStake(holder);
  const weight = stake.weight * 100;
  const options = holder.positions.filter((p) => p.putCall).map((p) => `${p.putCall!.toLowerCase()}s`);
  const asOf = shortDate(Date.parse(`${holder.period}T00:00:00Z`));

  return (
    <Pressable
      onPress={() => onPress(holder.cik)}
      style={({ pressed }) => [styles.fund, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={
        `${holder.name}: ${weight.toFixed(1)} percent of its portfolio, ${compact(stake.shares)} shares worth ${money(stake.value)}, ` +
        `as of ${asOf}.${options.length > 0 ? ` Also holds ${options.join(' and ')}.` : ''}`
      }
      accessibilityHint="Opens the fund"
    >
      <Avatar uri={holder.logo} name={holder.name} size={36} square logo />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {holder.name}
        </Text>
        <Text style={styles.rowMeta}>
          <Text style={styles.monoSmall}>{compact(stake.shares)}</Text> shares ·{' '}
          <Text style={styles.monoSmall}>{money(stake.value)}</Text> · as of {asOf}
          {options.length > 0 ? ` · also ${options.join(', ')}` : ''}
        </Text>
      </View>
      <View style={styles.weight}>
        <Text style={styles.weightValue}>{weight.toFixed(1)}%</Text>
        <View style={styles.weightTrack}>
          <View style={[styles.weightFill, { width: `${Math.min(100, Math.max(2, weight))}%` }]} />
        </View>
      </View>
    </Pressable>
  );
}

function LegendItem({ shape, fill, label }: { shape: 'circle' | 'diamond'; fill: 'up' | 'down'; label: string }) {
  const c = useTheme();
  const styles = useStyles();
  const solid = fill === 'up';
  return (
    <View style={styles.legendItem}>
      <View
        style={{
          width: shape === 'diamond' ? 8 : 9,
          height: shape === 'diamond' ? 8 : 9,
          borderRadius: shape === 'diamond' ? 1 : 5,
          backgroundColor: solid ? c.up : 'transparent',
          borderWidth: solid ? 0 : 2,
          borderColor: c.down,
          transform: shape === 'diamond' ? [{ rotate: '45deg' }] : undefined,
        }}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function ShowAll({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.showAll, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={styles.showAllText}>{label}</Text>
    </Pressable>
  );
}

function Pending({ text }: { text: string }) {
  const c = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.state}>
      <ActivityIndicator size="small" color={c.textMuted} />
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      <Text style={styles.stateText}>{text}</Text>
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
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    gap: 14,
  },
  pressed: {
    backgroundColor: c.surfaceAlt,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  identityBody: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: font.bold,
    letterSpacing: -0.3,
    color: c.text,
  },
  subtitle: {
    ...type.label,
    fontFamily: font.regular,
    color: c.textMuted,
  },
  mono: {
    fontFamily: font.monoSemibold,
  },
  monoSmall: {
    fontFamily: font.mono,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  price: {
    fontFamily: font.monoSemibold,
    fontSize: 28,
    lineHeight: 34,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  priceCaption: {
    ...type.caption,
    color: c.textSubtle,
  },
  panel: {
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.lg,
    paddingTop: 14,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  chartState: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    ...type.caption,
    color: c.textMuted,
  },
  legendNote: {
    ...type.caption,
    color: c.textSubtle,
  },
  tiles: {
    flexDirection: 'row',
    gap: space.sm,
  },
  tile: {
    flex: 1,
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  tileEyebrow: {
    ...type.eyebrow,
    textTransform: 'uppercase',
    color: c.textSubtle,
  },
  tileValue: {
    fontFamily: font.monoSemibold,
    fontSize: 18,
    lineHeight: 23,
    color: c.text,
  },
  tileCaption: {
    ...type.caption,
    lineHeight: 15,
    color: c.textMuted,
  },
  sectionTitle: {
    ...type.caption,
    fontFamily: font.semibold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: c.textSubtle,
    marginTop: 6,
    marginBottom: -6,
    paddingHorizontal: 2,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
    paddingVertical: space.sm,
    paddingLeft: 14,
    paddingRight: space.md,
  },
  rule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    ...type.bodyTight,
    fontFamily: font.semibold,
    color: c.text,
  },
  rowSeat: {
    fontFamily: font.regular,
    color: c.textMuted,
  },
  rowMeta: {
    ...type.caption,
    color: c.textMuted,
  },
  showAll: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  showAllText: {
    ...type.label,
    color: c.text,
  },
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: 14,
  },
  stateText: {
    ...type.caption,
    color: c.textMuted,
    flex: 1,
  },
  fund: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  weight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  weightValue: {
    ...type.mono,
    fontSize: 14,
    color: c.text,
  },
  weightTrack: {
    width: 64,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.surfaceAlt,
    overflow: 'hidden',
  },
  weightFill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: c.accent,
  },
  fundStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 2,
  },
}));
