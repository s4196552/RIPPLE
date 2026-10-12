import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { compact, money, pct } from '@/lib/format';
import { OVERLAP_WINDOW_DAYS, fundOverlaps, tradersPhrase } from '@/lib/overlap';
import { useFeed } from '@/store/feed';
import {
  FILING_LIMIT_DAYS,
  concentration,
  concentrationVerdict,
  daysToFile,
  findStreaks,
  fundName,
  positionLabel,
  quarterLabel,
} from '@/providers/funds/thirteenF';
import type { FundMove, Signal } from '@/providers/types';
import { makeStyles, useTheme } from '../ThemeProvider';
import { font, radius, space, type } from '../theme';
import { spokenLabel, type Tone } from '../tone';
import { Segmented } from './Segmented';
import { TonePill } from './TonePill';
import { ToneMark } from './ToneMark';

interface Props {
  /** The fund's 13F signals, newest first. */
  signals: Signal[];
  onOpenFiling: (signal: Signal) => void;
}

type Tab = 'holdings' | 'moves' | 'filings';
type MoveFilter = 'all' | 'bought' | 'sold' | 'newexit';

const KIND_WORD: Record<FundMove['kind'], string> = {
  new: 'New',
  added: 'Added',
  trimmed: 'Trimmed',
  exited: 'Exited',
  unchanged: 'Unchanged',
};

const KIND_TONE: Record<FundMove['kind'], Tone> = {
  new: 'up',
  added: 'up',
  trimmed: 'down',
  exited: 'down',
  unchanged: 'neutral',
};

/** `+$2.1B`, `−$313.3M`. */
function signedMoney(n: number): string {
  return `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;
}

function filedDate(s: Signal): string {
  return new Date(s.timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * A fund's page: what it holds, how concentrated that is, what it changed
 * this quarter, and every filing behind it.
 *
 * Holdings are drawn in one neutral ink, not a colour per stock: colour in
 * this app means direction, so it is kept for the moves.
 */
export function FundView({ signals, onOpenFiling }: Props) {
  const c = useTheme();
  const styles = useStyles();
  const [tab, setTab] = useState<Tab>('holdings');
  const [filter, setFilter] = useState<MoveFilter>('all');

  const reports = signals.filter((s) => s.holdings?.form === '13F-HR');
  const latest = reports[0];
  const notice = signals[0]?.holdings?.form === '13F-NT' ? signals[0] : null;
  const h = latest?.holdings;

  const moveByCusip = useMemo(() => {
    const map = new Map<string, FundMove>();
    for (const m of h?.moves ?? []) map.set(`${m.cusip}:${m.putCall ?? ''}`, m);
    return map;
  }, [h]);

  // Who else traded what this fund moved, from what the feed already holds.
  const feed = useFeed((st) => st.signals);
  const alsoTraded = useMemo(() => {
    const handle = signals[0]?.actor.handle;
    const map = new Map<string, string>();
    for (const o of fundOverlaps([...feed, ...signals])) {
      if (o.fundHandle === handle) map.set(o.ticker, tradersPhrase(o.traders));
    }
    return map;
  }, [feed, signals]);

  const streaks = useMemo(
    () => findStreaks(reports.flatMap((r) => (r.holdings ? [r.holdings] : []))),
    [reports],
  );

  if (!latest || !h) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          {notice
            ? (notice.text)
            : 'No 13F holdings report on file. Only managers with over $100M in US stocks file one.'}
        </Text>
      </View>
    );
  }

  const conc = concentration(h.positions);
  const lag = daysToFile(h.period, new Date(latest.timestamp).toISOString().slice(0, 10));
  const change = h.priorValue != null && h.totalValue != null ? h.totalValue - h.priorValue : null;
  const opened = h.moves.filter((m) => m.kind === 'new').length;
  const closed = h.moves.filter((m) => m.kind === 'exited').length;
  const quarter = quarterLabel(h.period);

  const moves = h.moves.filter((m) =>
    filter === 'bought'
      ? m.kind === 'new' || m.kind === 'added'
      : filter === 'sold'
        ? m.kind === 'trimmed' || m.kind === 'exited'
        : filter === 'newexit'
          ? m.kind === 'new' || m.kind === 'exited'
          : true,
  );
  const outflow = h.moves.reduce((s, m) => s + Math.min(0, m.value - m.valueBefore), 0);
  const inflow = h.moves.reduce((s, m) => s + Math.max(0, m.value - m.valueBefore), 0);

  return (
    <View>
      {notice ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Ionicons name="information-circle-outline" size={18} color={c.textMuted} />
          <Text style={styles.noticeText}>{notice.text}</Text>
        </View>
      ) : null}

      <View style={styles.stats}>
        <Stat value={money(h.totalValue ?? 0)} label={`book · ${quarter}`} />
        <Stat
          value={String(h.positionCount)}
          label={opened || closed ? `positions · ${opened} new, ${closed} out` : 'positions'}
        />
        <Stat
          value={lag !== null ? `${lag} d` : '—'}
          label={`to file (${FILING_LIMIT_DAYS} allowed)`}
          warn={lag !== null && lag > FILING_LIMIT_DAYS}
        />
      </View>

      {change !== null ? (
        <View style={styles.changeRow}>
          <TonePill tone={change >= 0 ? 'up' : 'down'} label={`${signedMoney(change)} vs prior`} />
          <Text style={styles.changeNote}>mostly price moves on what was already held</Text>
        </View>
      ) : null}

      <View
        style={styles.card}
        accessible
        accessibilityLabel={
          `${concentrationVerdict(conc.hhi)}. Top 5 positions are ${Math.round(conc.top5 * 100)}% of value, ` +
          `top 10 are ${Math.round(conc.top10 * 100)}%. Concentration index ${conc.hhi}.`
        }
      >
        <Text style={styles.eyebrow}>Concentration</Text>
        <Text style={styles.verdict}>{concentrationVerdict(conc.hhi)}</Text>
        <View style={styles.split}>
          <View style={[styles.splitFill, { flex: Math.max(0.001, conc.top5) }]} />
          <View style={[styles.splitRest, { flex: Math.max(0.001, 1 - conc.top5) }]} />
        </View>
        <Text style={styles.cardText}>
          Top 5 = <Text style={styles.mono}>{Math.round(conc.top5 * 100)}%</Text> · Top 10 ={' '}
          <Text style={styles.mono}>{(conc.top10 * 100).toFixed(1)}%</Text> of value. HHI{' '}
          <Text style={styles.mono}>{conc.hhi.toLocaleString('en-US')}</Text> — index funds ≈ 40, most hedge funds
          100–400.
        </Text>
      </View>

      <View style={styles.tabs}>
        <Segmented
          label="Show"
          value={tab}
          onChange={setTab}
          fill
          options={[
            { value: 'holdings', label: 'Holdings' },
            { value: 'moves', label: 'Moves' },
            { value: 'filings', label: 'Filings' },
          ]}
        />
      </View>

      {tab === 'holdings' && (
        <>
          <View style={styles.list}>
            {h.positions.map((p, i) => {
              const move = moveByCusip.get(`${p.cusip}:${p.putCall ?? ''}`);
              const label = positionLabel(p);
              return (
                <PositionRow
                  key={`${p.cusip}:${p.putCall ?? ''}`}
                  ticker={p.ticker}
                  first={i === 0}
                  label={
                    `${label}${p.ticker ? `, ${fundName(p.issuer)}` : ''}. ${(p.weight * 100).toFixed(1)}% of the book, ${money(p.value)}.` +
                    (move ? ` ${KIND_WORD[move.kind]} this quarter.` : '')
                  }
                >
                  <View style={styles.rowBody}>
                    <View style={styles.nameLine}>
                      <Text style={[styles.rowName, p.ticker && styles.mono]} numberOfLines={1}>
                        {label}
                      </Text>
                      {move ? <KindTag kind={move.kind} /> : null}
                    </View>
                    {p.ticker ? (
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {fundName(p.issuer)}
                      </Text>
                    ) : null}
                    <View style={styles.weightTrack}>
                      <View style={[styles.weightFill, { width: `${Math.max(1, p.weight * 100)}%` }]} />
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowValue}>{(p.weight * 100).toFixed(1)}%</Text>
                    <Text style={styles.rowSub}>{money(p.value)}</Text>
                  </View>
                </PositionRow>
              );
            })}
          </View>
          {h.positionCount > h.positions.length ? (
            <Text style={styles.footnote}>
              The largest {h.positions.length} of {h.positionCount} positions.
              {h.truncated ? ' This filing is too large to list on a phone; its total is from the cover page.' : ''}
            </Text>
          ) : null}
        </>
      )}

      {tab === 'moves' && (
        <>
          {streaks.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.eyebrow}>Streaks · last {reports.length} filings</Text>
              {streaks.map((s) => (
                <View key={s.key} style={styles.streak}>
                  <ToneMark tone={s.kind === 'added' ? 'up' : 'down'} size={10} />
                  <Text style={styles.cardText}>
                    <Text style={styles.strong}>{s.label}</Text> — {s.kind} {s.count} quarters straight
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.filters}>
            <Segmented
              label="Moves"
              value={filter}
              onChange={setFilter}
              fill
              options={[
                { value: 'all', label: 'All' },
                { value: 'bought', label: 'Bought' },
                { value: 'sold', label: 'Sold' },
                { value: 'newexit', label: 'New/exit', spoken: 'New and exited' },
              ]}
            />
          </View>

          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {moves.length} of {h.moves.length} moves · {quarter}
            </Text>
            <View style={styles.flows}>
              <TonePill tone="down" label={money(Math.abs(outflow))} />
              <TonePill tone="up" label={money(inflow)} />
            </View>
          </View>

          {h.moves.length === 0 ? (
            <Text style={styles.footnote}>No earlier filing to compare this one with.</Text>
          ) : (
            <View style={styles.list}>
              {moves.map((m, i) => {
                const label = positionLabel(m);
                const delta = m.value - m.valueBefore;
                const shareText =
                  m.kind === 'new'
                    ? 'new'
                    : m.kind === 'exited'
                      ? 'exited'
                      : `${(m.sharesChangePct ?? 0) >= 0 ? '+' : '−'}${Math.abs(m.sharesChangePct ?? 0).toFixed(1)}% sh`;
                return (
                  <PositionRow
                    key={`${m.cusip}:${m.putCall ?? ''}`}
                    ticker={m.ticker}
                    first={i === 0}
                    label={
                      `${label}. ${KIND_WORD[m.kind]}. From ${money(m.valueBefore)} to ${money(m.value)}, ` +
                      `${spokenLabel(delta >= 0 ? 'up' : 'down', signedMoney(delta))}. Shares ${shareText}.` +
                      (m.sinceFiling
                        ? ` Since the filing, the stock is ${spokenLabel(m.sinceFiling.changePct >= 0 ? 'up' : 'down', pct(m.sinceFiling.changePct))}` +
                          (m.sinceFiling.excessPct != null
                            ? `, ${pct(m.sinceFiling.excessPct).replace('%', ' percentage points')} against SPY.`
                            : '.')
                        : '') +
                      (m.ticker && alsoTraded.get(m.ticker)
                        ? ` Also traded by ${alsoTraded.get(m.ticker)} in the last ${OVERLAP_WINDOW_DAYS} days.`
                        : '')
                    }
                  >
                    <View style={styles.rowBody}>
                      <View style={styles.nameLine}>
                        <Text style={[styles.rowName, m.ticker && styles.mono]} numberOfLines={1}>
                          {label}
                        </Text>
                        <KindTag kind={m.kind} />
                      </View>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {money(m.valueBefore)} → {money(m.value)} ·{' '}
                        {m.shares - m.sharesBefore >= 0 ? '+' : '−'}
                        {compact(Math.abs(m.shares - m.sharesBefore))} sh
                      </Text>
                      {m.ticker && alsoTraded.get(m.ticker) ? (
                        <View style={styles.measured}>
                          <Ionicons name="git-merge-outline" size={13} color={c.accent} />
                          <Text style={styles.alsoText}>Also traded by {alsoTraded.get(m.ticker)}</Text>
                        </View>
                      ) : null}
                      {m.sinceFiling ? (
                        <View style={styles.measured}>
                          <Text style={styles.measuredLabel}>Since filed</Text>
                          <TonePill
                            tone={m.sinceFiling.changePct >= 0 ? 'up' : 'down'}
                            label={pct(m.sinceFiling.changePct)}
                          />
                          {m.sinceFiling.excessPct != null ? (
                            <TonePill
                              tone={m.sinceFiling.excessPct >= 0 ? 'up' : 'down'}
                              label={`${pct(m.sinceFiling.excessPct).replace('%', 'pp')} vs SPY`}
                            />
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.rowRight}>
                      <TonePill tone={delta >= 0 ? 'up' : 'down'} label={signedMoney(delta)} />
                      <Text style={styles.rowSub}>{shareText}</Text>
                    </View>
                  </PositionRow>
                );
              })}
            </View>
          )}
          <Text style={styles.footnote}>
            Shares and dollars can move in opposite directions: a stake trimmed into a rising price loses shares
            and gains value. The tag follows the shares; the pill follows the money. “Since filed” is the
            stock’s move from the day this filing went public, against the S&amp;P 500 over the same days.
          </Text>
        </>
      )}

      {tab === 'filings' && (
        <View style={styles.list}>
          {signals.map((s, i) => {
            const fh = s.holdings;
            if (!fh) return null;
            const isNotice = fh.form === '13F-NT';
            return (
              <Pressable
                key={s.id}
                onPress={() => onOpenFiling(s)}
                style={({ pressed }) => [styles.row, i > 0 && styles.rule, pressed && styles.pressed]}
                accessibilityRole="link"
                accessibilityLabel={
                  `${quarterLabel(fh.period)}, filed ${filedDate(s)}. ` +
                  (isNotice ? 'Notice: holdings reported by another manager.' : `${fh.positionCount} positions, ${money(fh.totalValue ?? 0)}.`)
                }
                accessibilityHint="Opens the filing on SEC EDGAR"
              >
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{quarterLabel(fh.period)}</Text>
                  <Text style={styles.rowSub}>
                    Filed {filedDate(s)} · {isNotice ? 'notice — reported by another manager' : `${fh.positionCount} positions`}
                  </Text>
                </View>
                {!isNotice ? <Text style={styles.rowValue}>{money(fh.totalValue ?? 0)}</Text> : null}
                <Ionicons name="open-outline" size={16} color={c.textMuted} />
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.footnote}>
        A 13F lists long US stock positions at each quarter’s end, filed up to {FILING_LIMIT_DAYS} days later. It
        leaves out shorts, cash and most non-US holdings. Public record, not investment advice.
      </Text>
    </View>
  );
}

/**
 * One holding or move. With a ticker it is a button to that stock's page;
 * without one — a name the ticker list could not match — it is plain text.
 */
function PositionRow({
  ticker,
  first,
  label,
  children,
}: {
  ticker: string | null;
  first: boolean;
  label: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  const router = useRouter();
  const style = [styles.row, !first && styles.rule];

  if (!ticker) {
    return (
      <View style={style} accessible accessibilityLabel={label}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/ticker/[symbol]', params: { symbol: ticker } })}
      style={({ pressed }) => [...style, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the ticker page"
    >
      {children}
    </Pressable>
  );
}

/** A neutral outlined tag: the word in ink, the direction as a drawn mark. */
function KindTag({ kind }: { kind: FundMove['kind'] }) {
  const styles = useStyles();
  return (
    <View style={styles.tag}>
      {KIND_TONE[kind] !== 'neutral' ? <ToneMark tone={KIND_TONE[kind]} size={8} /> : null}
      <Text style={styles.tagText}>{KIND_WORD[kind].toUpperCase()}</Text>
    </View>
  );
}

function Stat({ value, label, warn = false }: { value: string; label: string; warn?: boolean }) {
  const c = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value}, ${label}${warn ? ', late' : ''}`}>
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
  empty: {
    paddingTop: space.xl,
  },
  emptyText: {
    ...type.body,
    color: c.textMuted,
  },
  mono: {
    fontFamily: font.monoSemibold,
    fontVariant: ['tabular-nums'],
  },
  strong: {
    fontFamily: font.semibold,
    color: c.text,
  },
  pressed: {
    backgroundColor: c.surfaceAlt,
  },
  notice: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: 14,
    padding: space.md,
    borderRadius: 12,
    backgroundColor: c.surfaceAlt,
  },
  noticeText: {
    ...type.label,
    fontFamily: font.regular,
    lineHeight: 19,
    color: c.text,
    flex: 1,
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
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: 10,
  },
  changeNote: {
    ...type.caption,
    color: c.textSubtle,
  },
  card: {
    marginTop: 14,
    padding: 14,
    gap: 6,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.lg,
  },
  eyebrow: {
    ...type.eyebrow,
    textTransform: 'uppercase',
    color: c.textSubtle,
  },
  verdict: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: font.bold,
    color: c.text,
  },
  split: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
    marginVertical: 2,
  },
  splitFill: {
    backgroundColor: c.textMuted,
  },
  splitRest: {
    backgroundColor: c.surfaceAlt,
  },
  cardText: {
    ...type.bodyTight,
    color: c.textMuted,
    flexShrink: 1,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  tabs: {
    marginTop: 14,
    marginBottom: space.md,
  },
  filters: {
    marginTop: space.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: 2,
  },
  summaryText: {
    ...type.label,
    fontFamily: font.medium,
    color: c.textMuted,
  },
  flows: {
    flexDirection: 'row',
    gap: 6,
  },
  list: {
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rowPressed: {
    backgroundColor: c.surfaceAlt,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowName: {
    ...type.body,
    fontFamily: font.semibold,
    color: c.text,
    flexShrink: 1,
  },
  rowSub: {
    ...type.caption,
    color: c.textSubtle,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  rowValue: {
    fontFamily: font.monoSemibold,
    fontSize: 14,
    lineHeight: 20,
    color: c.text,
  },
  measured: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  alsoText: {
    ...type.caption,
    color: c.text,
  },
  measuredLabel: {
    ...type.caption,
    color: c.textSubtle,
  },
  weightTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: c.surfaceAlt,
    marginTop: 2,
  },
  weightFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: c.textMuted,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
  },
  tagText: {
    ...type.tag,
    color: c.text,
  },
  footnote: {
    ...type.caption,
    lineHeight: 17,
    color: c.textSubtle,
    paddingTop: space.md,
    paddingHorizontal: 2,
  },
}));
