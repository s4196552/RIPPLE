import type { FundPosition, Signal } from '@/providers/types';

/**
 * The readings behind the ticker page: one stock, every source.
 *
 * Congress trades, insider Form 4s and fund holdings arrive from three
 * providers in three shapes; this is where they are counted, pinned to the
 * price line and summarised. Only `import type`, so it is unit-tested directly
 * with no React and no network.
 */

const DAY = 86_400_000;

/** The span the page summarises, matching the price history it draws. */
export const TICKER_WINDOW_DAYS = 90;

/** An insider trade at or above this is drawn as a larger mark. */
export const LARGE_TRADE = 1_000_000;

/**
 * Badge on a congressional trade in options rather than the stock.
 *
 * A bought put is a bet against the company, so an option trade is listed but
 * never counted as a buy or a sell of the stock, and never pinned to its price.
 */
export const OPTIONS_BADGE = 'OPTIONS';

/**
 * Two spellings of one symbol. Sources disagree on the class separator —
 * `BRK.B`, `BRK-B`, `BRK/B` — so it is ignored.
 */
export function sameTicker(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string | null | undefined) => (s ?? '').trim().toUpperCase().replace(/[.\-/\s]/g, '');
  const left = n(a);
  return left.length > 0 && left === n(b);
}

/** When the trade itself happened: the trade date where the filing gives one. */
export function tradeDay(signal: Signal): number {
  const at = signal.trade?.tradedAt;
  return at != null && Number.isFinite(at) ? at : signal.timestamp;
}

export function isOptionTrade(signal: Signal): boolean {
  return signal.badges?.includes(OPTIONS_BADGE) ?? false;
}

/** Newest trade first, by the day it happened rather than the day it was filed. */
export function byTradeDay(signals: readonly Signal[]): Signal[] {
  return [...signals].sort((a, b) => tradeDay(b) - tradeDay(a) || b.timestamp - a.timestamp);
}

/** The start of the window ending `now`. */
export function windowStart(now: number = Date.now(), days: number = TICKER_WINDOW_DAYS): number {
  return now - days * DAY;
}

export interface CongressSummary {
  trades: number;
  /** Distinct people: one member filing four times is one member. */
  members: number;
  /** Purchases and sales of the stock itself — option trades are in `trades` only. */
  buys: number;
  sells: number;
}

/** Congress trades made since `since`. */
export function summarizeCongress(signals: readonly Signal[], since: number): CongressSummary {
  const members = new Set<string>();
  const out: CongressSummary = { trades: 0, members: 0, buys: 0, sells: 0 };
  for (const s of signals) {
    if (!s.trade || tradeDay(s) < since) continue;
    out.trades++;
    members.add(s.trade.traderName.trim().toLowerCase());
    if (isOptionTrade(s)) continue;
    if (s.trade.action === 'buy') out.buys++;
    else out.sells++;
  }
  out.members = members.size;
  return out;
}

export interface InsiderSummary {
  filings: number;
  /** Decisions to trade on the open market — not grants, exercises or withholding. */
  openMarketBuys: number;
  openMarketSells: number;
}

/** Form 4s for trades made since `since`. */
export function summarizeInsiders(signals: readonly Signal[], since: number): InsiderSummary {
  const out: InsiderSummary = { filings: 0, openMarketBuys: 0, openMarketSells: 0 };
  for (const s of signals) {
    if (!s.trade || tradeDay(s) < since) continue;
    out.filings++;
    if (!s.trade.discretionary) continue;
    if (s.trade.action === 'buy') out.openMarketBuys++;
    else out.openMarketSells++;
  }
  return out;
}

/** `-$63.8M` -> 63800000. The dollar figure in a pre-formatted label, or null. */
export function moneyValue(label: string | null | undefined): number | null {
  const m = (label ?? '').match(/\$\s?([\d,]+(?:\.\d+)?)\s*([KMB])?/i);
  if (!m) return null;
  const n = Number(m[1]!.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const scale = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? '').toUpperCase() as 'K' | 'M' | 'B'] ?? 1;
  return n * scale;
}

// ───────────────────────────────────────────────────────────────────────────
// The price line
// ───────────────────────────────────────────────────────────────────────────

export interface PriceSummary {
  first: number;
  last: number;
  /** Percent, first close to last. */
  changePct: number;
  lastAt: number;
}

export function priceSummary(series: { times: readonly number[]; closes: readonly number[] }): PriceSummary | null {
  const n = Math.min(series.times.length, series.closes.length);
  if (n === 0) return null;
  const first = series.closes[0]!;
  const last = series.closes[n - 1]!;
  return {
    first,
    last,
    changePct: first > 0 ? ((last - first) / first) * 100 : 0,
    lastAt: series.times[n - 1]!,
  };
}

/**
 * The session a trade belongs to: the one on its date, or the last one before
 * it when it fell on a weekend or holiday.
 *
 * Null outside the series: a trade from before the history starts has no point
 * on the line, and one more than a few days past the last close is newer than
 * the prices loaded.
 */
export function sessionIndex(times: readonly number[], at: number): number | null {
  if (times.length === 0 || !Number.isFinite(at)) return null;
  const day = Math.floor(at / DAY);
  if (day < Math.floor(times[0]! / DAY)) return null;
  if (day > Math.floor(times[times.length - 1]! / DAY) + 4) return null;

  let found = 0;
  for (let i = 0; i < times.length; i++) {
    if (Math.floor(times[i]! / DAY) <= day) found = i;
    else break;
  }
  return found;
}

export interface ChartMark {
  /** Index into the series. */
  index: number;
  source: 'congress' | 'insider';
  buys: number;
  sells: number;
  /** Several trades that session, or an insider trade of `LARGE_TRADE` or more. */
  large: boolean;
}

/**
 * The trades pinned to the price line, one mark per source per session.
 *
 * Only decisions are pinned: a congressional trade in the stock (not its
 * options), and an insider's open-market buy or sell. A grant or a tax
 * withholding is a vesting schedule, and drawing it on the line would read as
 * someone choosing to sell.
 */
export function chartMarks(
  times: readonly number[],
  congress: readonly Signal[],
  insider: readonly Signal[],
): ChartMark[] {
  const marks = new Map<string, ChartMark>();

  const pin = (s: Signal, source: ChartMark['source']) => {
    if (!s.trade) return;
    const index = sessionIndex(times, tradeDay(s));
    if (index === null) return;
    const key = `${source}:${index}`;
    const mark = marks.get(key) ?? { index, source, buys: 0, sells: 0, large: false };
    if (s.trade.action === 'buy') mark.buys++;
    else mark.sells++;
    if (source === 'insider' && (moneyValue(s.trade.amountLabel) ?? 0) >= LARGE_TRADE) mark.large = true;
    if (source === 'congress' && mark.buys + mark.sells > 1) mark.large = true;
    marks.set(key, mark);
  };

  for (const s of congress) if (!isOptionTrade(s)) pin(s, 'congress');
  for (const s of insider) if (s.trade?.discretionary) pin(s, 'insider');

  // Congress under insider, each left to right, so a later mark sits on top.
  return [...marks.values()].sort(
    (a, b) => (a.source === b.source ? a.index - b.index : a.source === 'congress' ? -1 : 1),
  );
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Closes -> points in a `width` × `height` box, highest close at the top.
 *
 * `pad` keeps the extremes off the edges so a mark centred on one is not cut
 * in half. A flat series sits in the middle rather than dividing by zero.
 */
export function scalePoints(closes: readonly number[], width: number, height: number, pad = 0): Point[] {
  if (closes.length === 0) return [];
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min;
  const inner = Math.max(0, height - 2 * pad);
  const step = closes.length > 1 ? width / (closes.length - 1) : 0;
  return closes.map((close, i) => ({
    x: closes.length > 1 ? i * step : width / 2,
    y: span > 0 ? pad + (1 - (close - min) / span) * inner : height / 2,
  }));
}

export interface Segment {
  left: number;
  top: number;
  width: number;
  /** Degrees, clockwise. */
  angle: number;
}

/**
 * A polyline as rotated bars, for drawing without an SVG renderer.
 *
 * Each bar is laid out horizontally around the segment's midpoint and turned
 * about its own centre, which is where React Native rotates by default.
 */
export function lineSegments(points: readonly Point[], thickness: number): Segment[] {
  const out: Segment[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    // A hair longer than the gap, so neighbouring bars overlap at the joint.
    const width = length + thickness * 0.5;
    out.push({
      left: (a.x + b.x) / 2 - width / 2,
      top: (a.y + b.y) / 2 - thickness / 2,
      width,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    });
  }
  return out;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * A label at the first session of each month.
 *
 * The opening month is labelled only when it runs long enough for its label
 * to clear the next one; otherwise the two would print on top of each other.
 */
export function monthTicks(times: readonly number[], minGap = 8): { index: number; label: string }[] {
  const ticks: { index: number; label: string }[] = [];
  let month = -1;
  times.forEach((t, i) => {
    const m = new Date(t).getUTCMonth();
    if (m !== month) {
      ticks.push({ index: i, label: MONTHS[m]! });
      month = m;
    }
  });
  if (ticks.length > 1 && ticks[1]!.index - ticks[0]!.index < minGap) ticks.shift();
  return ticks;
}

// ───────────────────────────────────────────────────────────────────────────
// Funds
// ───────────────────────────────────────────────────────────────────────────

/** One fund's stake in the stock, from its newest 13F. */
export interface FundHolder {
  cik: string;
  name: string;
  logo: string | null;
  /** Quarter end, `YYYY-MM-DD`. */
  period: string;
  /** The stock and any options on it, each as reported. */
  positions: FundPosition[];
}

/** The stake in the stock itself: shares, dollars and share of the book. */
export function stockStake(holder: FundHolder): { shares: number; value: number; weight: number } {
  const stock = holder.positions.filter((p) => !p.putCall);
  const pool = stock.length > 0 ? stock : holder.positions;
  return pool.reduce(
    (sum, p) => ({ shares: sum.shares + p.shares, value: sum.value + p.value, weight: sum.weight + p.weight }),
    { shares: 0, value: 0, weight: 0 },
  );
}

/** Funds that hold it, the biggest share of a portfolio first. */
export function rankHolders(holders: readonly FundHolder[]): FundHolder[] {
  return holders
    .filter((h) => h.positions.length > 0)
    .sort((a, b) => stockStake(b).weight - stockStake(a).weight || a.name.localeCompare(b.name));
}

/** `CA-11 · REP` for the design's seat line, from `CA-11 · Republican`. */
export function seatLine(subtitle: string | null | undefined): string {
  if (!subtitle) return '';
  return subtitle
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      /^democrat$/i.test(part) ? 'D' : /^republican$/i.test(part) ? 'R' : /^independent$/i.test(part) ? 'I' : part,
    )
    .join(' · ');
}

/** Words that mark a Form 4 filer as an entity rather than a person. */
const ENTITY = /\b(INC|LLC|L\.?P|LTD|CORP|CORPORATION|CO|TRUST|FUND|FOUNDATION|CAPITAL|HOLDINGS?|PARTNERS|GROUP|MANAGEMENT|BANK|PLC|N\.?A)\b\.?|&/i;

/**
 * A Form 4 owner as people write the name: `COOK TIMOTHY D` -> `Timothy D Cook`.
 *
 * EDGAR files a person surname first, often in capitals. An entity — a trust,
 * a fund — is left in its own order, only recased.
 */
export function ownerName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  const recase = (s: string) =>
    s === s.toUpperCase()
      ? s.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
      : s;
  if (!name || ENTITY.test(name)) return recase(name);
  // `Smith, John` names its own surname.
  const comma = name.match(/^([^,]+),\s*(.+)$/);
  const parts = comma ? [comma[1]!, ...comma[2]!.split(' ')] : name.split(' ');
  if (parts.length < 2) return recase(name);
  // A generational suffix stays at the end: `SMITH JOHN JR` -> `John Smith Jr`.
  const suffix = /^(JR|SR|II|III|IV)\.?$/i.test(parts[parts.length - 1]!) ? parts.pop()! : null;
  const ordered = [...parts.slice(1), parts[0]!, ...(suffix ? [suffix] : [])].join(' ');
  return recase(ordered).replace(/\b(Ii|Iii|Iv)\b/g, (s) => s.toUpperCase());
}

/** Plural helper: `1 member`, `3 members`. */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
