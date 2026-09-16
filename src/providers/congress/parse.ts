import type { Actor, Signal } from '@/providers/types';
// Relative, not the '@/' alias: this module is unit-tested directly under
// Node's type stripping, which does no tsconfig path resolution.
import { district, money, personName, slug } from '../../lib/format.ts';

/**
 * Parsing the House Clerk's annual financial-disclosure index.
 *
 * Free of network and framework imports, so it is unit-tested directly with
 * no network. This is where the correctness risk lives — the index is a
 * tab-separated file with optional columns and US-format dates.
 */

/** One row of `{year}FD.txt`. */
export interface FilingRow {
  prefix: string;
  last: string;
  first: string;
  suffix: string;
  /**
   * Filing type. `P` is the Periodic Transaction Report — the STOCK Act trade
   * disclosure, and the only type that represents an actual trade. The rest are
   * annual reports (`A`), amendments (`C`/`X`), candidate reports (`D`),
   * extensions (`W`/`H`) and terminations (`T`).
   */
  filingType: string;
  stateDst: string;
  year: string;
  filingDate: string;
  docId: string;
}

export const PERIODIC_TRANSACTION_REPORT = 'P';

const HEADER_FIRST_CELL = 'Prefix';

/**
 * Parse the tab-separated index. Tolerant by design: the Clerk pads rows with
 * empty optional columns and occasionally emits stray blank lines.
 */
export function parseFilingIndex(text: string): FilingRow[] {
  const rows: FilingRow[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const c = line.split('\t');
    if (c[0]?.trim() === HEADER_FIRST_CELL) continue; // header
    // A valid row has all nine columns; anything shorter is malformed.
    if (c.length < 9) continue;

    const docId = (c[8] ?? '').trim();
    const last = (c[1] ?? '').trim();
    if (!docId || !last) continue;

    rows.push({
      prefix: (c[0] ?? '').trim(),
      last,
      first: (c[2] ?? '').trim(),
      suffix: (c[3] ?? '').trim(),
      filingType: (c[4] ?? '').trim(),
      stateDst: (c[5] ?? '').trim(),
      year: (c[6] ?? '').trim(),
      filingDate: (c[7] ?? '').trim(),
      docId,
    });
  }

  return rows;
}

/**
 * `M/D/YYYY` -> epoch ms at UTC midnight.
 *
 * Built explicitly rather than handed to `Date.parse`, which reads bare
 * `M/D/YYYY` in the *device's* timezone. That would shift every filing by up to
 * a day depending on where the user is standing, and the feed sorts on this.
 */
export function parseFilingDate(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mo, day, yr] = m;
  const ts = Date.UTC(Number(yr), Number(mo) - 1, Number(day));
  return Number.isFinite(ts) ? ts : null;
}

/** Stable subject id for a member: `nancy-pelosi-ca11`. */
export function memberHandle(row: Pick<FilingRow, 'first' | 'last' | 'stateDst'>): string {
  return slug(row.first, row.last, row.stateDst);
}

export interface Member {
  handle: string;
  displayName: string;
  district: string | null;
  /** How many periodic transaction reports this member has on file. */
  filingCount: number;
}

/** Unique members that have filed at least one trade report, busiest first. */
export function extractMembers(rows: readonly FilingRow[]): Member[] {
  const byHandle = new Map<string, Member>();

  for (const row of rows) {
    if (row.filingType !== PERIODIC_TRANSACTION_REPORT) continue;
    const handle = memberHandle(row);
    if (!handle) continue;

    const existing = byHandle.get(handle);
    if (existing) {
      existing.filingCount++;
    } else {
      byHandle.set(handle, {
        handle,
        displayName: personName(row.first, row.last),
        district: district(row.stateDst),
        filingCount: 1,
      });
    }
  }

  return [...byHandle.values()].sort(
    (a, b) => b.filingCount - a.filingCount || a.displayName.localeCompare(b.displayName),
  );
}

/** Public PDF of one periodic transaction report. */
export function filingUrl(row: Pick<FilingRow, 'year' | 'docId'>): string {
  return `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${row.year}/${row.docId}.pdf`;
}

/**
 * A filing row -> a feed signal.
 *
 * Note what this deliberately does *not* claim: no ticker, no amount, no
 * direction. The Clerk publishes those only inside the PDF, which is often a
 * scan. Asserting a ticker we haven't actually read would be inventing data.
 * Set a QuiverQuant or FMP key to get parsed, ticker-level trades instead.
 */
export function normalizeFiling(row: FilingRow, actor: Actor): Signal {
  const timestamp = parseFilingDate(row.filingDate) ?? 0;

  return {
    id: `congress:${row.docId}`,
    source: 'congress',
    actor,
    text: `${actor.displayName}${actor.subtitle ? ` (${actor.subtitle})` : ''} filed a periodic transaction report disclosing one or more trades. Amounts and tickers are in the filed PDF.`,
    url: filingUrl(row),
    timestamp,
    ticker: null,
    accent: null,
    badges: ['TRADE DISCLOSURE'],
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Keyed path: parsed trades from an aggregator
// ───────────────────────────────────────────────────────────────────────────

/**
 * A parsed congressional trade, as returned by QuiverQuant or Financial
 * Modeling Prep. Field names differ between them, so both are mapped onto this
 * before normalization.
 */
export interface ParsedTrade {
  representative: string;
  district?: string | null;
  ticker: string;
  /** `Purchase` / `Sale` / `Exchange`, source-dependent casing. */
  transaction: string;
  /** Disclosed dollar range, e.g. `$1,001 - $15,000`. */
  range?: string | null;
  /** Midpoint of the disclosed range in dollars, when derivable. */
  amount?: number | null;
  /** ISO date the trade occurred. */
  transactionDate: string;
  /** ISO date it was disclosed. */
  disclosureDate?: string | null;
}

/** True for anything that reads as a purchase. */
export function isPurchase(transaction: string): boolean {
  return /purchase|buy/i.test(transaction);
}

/**
 * Disclosure ranges are reported as bands, never exact figures. The midpoint is
 * the standard convention for making them comparable — and it is an estimate,
 * which the UI says out loud rather than presenting it as the real number.
 */
export function rangeMidpoint(range: string | null | undefined): number | null {
  if (!range) return null;
  const nums = [...range.matchAll(/\$?([\d,]+)/g)]
    .map((m) => Number((m[1] ?? '').replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (nums.length === 0) return null;
  if (nums.length === 1) return nums[0] ?? null;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return Math.round((lo + hi) / 2);
}

/** Days between the trade and its disclosure. The STOCK Act allows 45. */
export function disclosureLagDays(trade: ParsedTrade): number | null {
  if (!trade.disclosureDate) return null;
  const traded = Date.parse(trade.transactionDate);
  const disclosed = Date.parse(trade.disclosureDate);
  if (!Number.isFinite(traded) || !Number.isFinite(disclosed)) return null;
  return Math.round((disclosed - traded) / 86_400_000);
}

export const STOCK_ACT_DEADLINE_DAYS = 45;

/** Window used when counting how many members bought the same name. */
export const CLUSTER_WINDOW_DAYS = 30;

/**
 * ── A composite "wired into Washington" score is deliberately NOT built here ──
 *
 * The obvious next move with this data is to score companies by lobbying spend
 * plus federal contract awards plus congressional buying, rank them, and treat
 * the top of that list as a buy list. It is intuitive, and published backtests
 * of exactly that construction find it does not work — the top-ranked basket
 * underperforms both the equal-weight control and, strikingly, the bottom-ranked
 * basket it told you to avoid. The signal came out inverted.
 *
 * The explanation is mundane rather than sinister: the companies most dependent
 * on Washington are mature, slow-growing defence, energy and pharma names, while
 * the market's actual growth has come from companies that were never
 * contract-driven. Lobbying is a proxy for being an incumbent, not for having an
 * edge.
 *
 * So this file exposes `clusterBuyers` — a plain count of who filed, which
 * claims nothing about future prices — and stops there. If someone later wants
 * the composite score, it should ship as a labelled research view, never as a
 * ranking the feed implies you should act on.
 */

/**
 * How many *distinct* members disclosed a purchase of the same ticker in the
 * window ending at `at`.
 *
 * Of the things people try to read out of this data, this is one of the few
 * that is purely descriptive: it counts filings, and claims nothing about what
 * the price will do next. Several members independently buying the same name in
 * the same month is a fact about disclosure activity, and it is the kind of fact
 * a watchlist app should surface.
 *
 * Deliberately counts *people*, not filings — one member filing four times is a
 * single buyer, not a crowd, and counting filings would let a frequent filer
 * manufacture the appearance of consensus.
 */
export function clusterBuyers(
  trades: readonly ParsedTrade[],
  ticker: string,
  at: number,
  windowDays: number = CLUSTER_WINDOW_DAYS,
): number {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol || !Number.isFinite(at)) return 0;

  const windowStart = at - windowDays * 86_400_000;
  const buyers = new Set<string>();

  for (const trade of trades) {
    if (!isPurchase(trade.transaction)) continue;
    if (trade.ticker.trim().toUpperCase() !== symbol) continue;

    // Cluster on disclosure, not transaction date: the window has to describe
    // when this became knowable, which is the same basis the feed sorts on.
    const disclosed = trade.disclosureDate ? Date.parse(trade.disclosureDate) : NaN;
    const stamp = Number.isFinite(disclosed) ? disclosed : Date.parse(trade.transactionDate);
    if (!Number.isFinite(stamp)) continue;
    if (stamp > at || stamp < windowStart) continue;

    buyers.add(trade.representative.trim().toLowerCase());
  }

  return buyers.size;
}

/** Badge for a cluster, or null when it isn't one. */
export function clusterBadge(
  buyers: number,
  windowDays: number = CLUSTER_WINDOW_DAYS,
): string | null {
  // One buyer is just the trade the card already describes.
  if (buyers < 2) return null;
  return `${buyers} MEMBERS BOUGHT · ${windowDays}D`;
}

/**
 * The signal id a given trade normalizes to.
 *
 * Extracted so position pairing can address trades it never turned into cards —
 * the buy that a visible sell closes usually belongs to an earlier page.
 */
export function tradeSignalId(trade: ParsedTrade): string {
  return `congress:${slug(trade.representative, trade.ticker, trade.transactionDate, trade.transaction)}`;
}

/** When a trade became public, which is the only date a reader could act on. */
export function tradeActionableAt(trade: ParsedTrade): number {
  const disclosed = trade.disclosureDate ? Date.parse(trade.disclosureDate) : NaN;
  if (Number.isFinite(disclosed)) return disclosed;
  const traded = Date.parse(trade.transactionDate);
  return Number.isFinite(traded) ? traded : Number.NaN;
}

/** A parsed trade -> a feed signal, with ticker, direction and value. */
export function normalizeTrade(trade: ParsedTrade, actor: Actor): Signal {
  const buy = isPurchase(trade.transaction);
  const amount = trade.amount ?? rangeMidpoint(trade.range);
  const lag = disclosureLagDays(trade);

  // Sort on disclosure, not trade date: the disclosure is the news event, and
  // it is what the user is finding out about today.
  const disclosed = trade.disclosureDate ? Date.parse(trade.disclosureDate) : NaN;
  const traded = Date.parse(trade.transactionDate);
  const timestamp = Number.isFinite(disclosed) ? disclosed : Number.isFinite(traded) ? traded : 0;

  const badges = [buy ? 'BUY' : 'SELL'];
  if (lag !== null && lag > STOCK_ACT_DEADLINE_DAYS) badges.push('LATE FILING');

  const lagText =
    lag === null
      ? ''
      : lag > STOCK_ACT_DEADLINE_DAYS
        ? ` Disclosed ${lag} days later — past the ${STOCK_ACT_DEADLINE_DAYS}-day STOCK Act deadline.`
        : ` Disclosed ${lag} day${lag === 1 ? '' : 's'} later.`;

  return {
    id: tradeSignalId(trade),
    source: 'congress',
    actor,
    text:
      `${actor.displayName} ${buy ? 'bought' : 'sold'} ${trade.ticker}` +
      (trade.range ? ` (${trade.range})` : '') +
      ` on ${trade.transactionDate}.${lagText}`,
    url: `https://www.capitoltrades.com/politicians?search=${encodeURIComponent(trade.representative)}`,
    timestamp,
    ticker: trade.ticker.toUpperCase(),
    accent: amount
      ? { label: `${buy ? '+' : '-'}${money(amount)}`, tone: buy ? 'up' : 'down' }
      : { label: buy ? 'BUY' : 'SELL', tone: buy ? 'up' : 'down' },
    badges,
    trade: {
      traderName: actor.displayName,
      traderTitle: actor.subtitle ?? null,
      traderPhotoUrl: actor.avatarUrl ?? null,
      action: buy ? 'buy' : 'sell',
      // A member's disclosed trade is always a decision — there is no
      // compensation-mechanics equivalent in a periodic transaction report.
      discretionary: true,
      kindLabel: buy ? 'PURCHASE' : 'SALE',
      assetName: trade.ticker.toUpperCase(),
      // The disclosed band, not its midpoint: the range is what was actually
      // filed, and the midpoint is our estimate of it.
      amountLabel: trade.range ?? (amount ? money(amount) : null),
    },
  };
}
