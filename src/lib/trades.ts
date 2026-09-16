import type { Signal, SourceId, TradeDetail } from '@/providers/types';

/**
 * The trades table and the holdings roll-up.
 *
 * Two views over signals that carry a `trade`: a row per disclosed transaction,
 * and an aggregate per asset. Only `import type`, so both are unit-tested with
 * no React and no network.
 */

export type AssetType = 'Stock' | 'ETF' | 'Crypto';

/** Suffix Yahoo uses for crypto pairs, which is how they arrive here. */
const CRYPTO_SUFFIX = /-(USD|USDT|EUR|GBP)$/i;

/**
 * Well-known ETFs. Deliberately a short list rather than a guess: there is no
 * reliable way to tell an ETF from a common stock by ticker shape, so anything
 * unrecognised is reported as a stock rather than mislabelled.
 */
const KNOWN_ETFS = new Set([
  'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI', 'VEA', 'VWO', 'AGG', 'BND',
  'GLD', 'SLV', 'XLF', 'XLE', 'XLK', 'XLV', 'ARKK', 'TLT', 'HYG', 'EEM',
]);

export function assetType(ticker: string): AssetType {
  const symbol = ticker.trim().toUpperCase();
  if (CRYPTO_SUFFIX.test(symbol)) return 'Crypto';
  if (KNOWN_ETFS.has(symbol)) return 'ETF';
  return 'Stock';
}

/**
 * How the timing looks with hindsight.
 *
 * Judged on what the price did *after* the trade became public, which is what
 * "sold high" means in plain speech: a sale ahead of a fall was well timed, a
 * sale ahead of a rise left money on the table.
 *
 * This is hindsight, not skill, and certainly not prediction — it says what
 * happened next, nothing about what happens next.
 */
export type TradeQuality = 'sold-high' | 'sold-early' | 'bought-low' | 'bought-early' | 'flat';

/**
 * Moves smaller than this are called flat.
 *
 * Without a dead band almost nothing is ever "flat" — a 0.2% drift would be
 * reported as shrewd timing, which is noise wearing a verdict.
 */
export const FLAT_THRESHOLD_PCT = 2;

export function classifyQuality(
  action: TradeDetail['action'],
  changePct: number,
  flatThreshold: number = FLAT_THRESHOLD_PCT,
): TradeQuality {
  if (!Number.isFinite(changePct) || Math.abs(changePct) < flatThreshold) return 'flat';

  if (action === 'sell') {
    // Price fell after the sale: they got out above where it went.
    return changePct < 0 ? 'sold-high' : 'sold-early';
  }
  // Price rose after the purchase: they got in below where it went.
  return changePct > 0 ? 'bought-low' : 'bought-early';
}

const QUALITY_LABELS: Record<TradeQuality, string> = {
  'sold-high': 'Sold high',
  'sold-early': 'Sold early',
  'bought-low': 'Bought low',
  'bought-early': 'Bought early',
  flat: 'Flat',
};

export function qualityLabel(quality: TradeQuality): string {
  return QUALITY_LABELS[quality];
}

/** Green for well-timed, red for poorly-timed, neutral for flat. */
export function qualityTone(quality: TradeQuality): 'up' | 'down' | 'neutral' {
  if (quality === 'sold-high' || quality === 'bought-low') return 'up';
  if (quality === 'sold-early' || quality === 'bought-early') return 'down';
  return 'neutral';
}

export interface TradeRow {
  signal: Signal;
  source: SourceId;
  trade: TradeDetail;
  ticker: string;
  assetType: AssetType;
  timestamp: number;
  /** Null when no price data was available for this ticker. */
  changePct: number | null;
  /** Null unless a benchmark covered the same window. */
  excessPct: number | null;
  /** Null when there is no return to judge. */
  quality: TradeQuality | null;
  url: string;
}

/**
 * Signals that are actually trades, newest first.
 *
 * A signal without a `trade` (an executive order, a price move, a bare
 * disclosure with no ticker) has no row here — the table's columns would all be
 * empty, and a row of dashes is worse than an absent row.
 */
export function toTradeRows(signals: readonly Signal[]): TradeRow[] {
  const rows: TradeRow[] = [];

  for (const signal of signals) {
    if (!signal.trade || !signal.ticker) continue;

    const changePct = signal.reaction?.changePct ?? null;

    rows.push({
      signal,
      source: signal.source,
      trade: signal.trade,
      ticker: signal.ticker.toUpperCase(),
      assetType: assetType(signal.ticker),
      timestamp: signal.timestamp,
      changePct,
      excessPct: signal.reaction?.excessPct ?? null,
      // No verdict on a movement nobody chose: a vesting schedule has no
      // timing to judge, and "Sold early" on a tax withholding is nonsense.
      quality:
        changePct === null || !signal.trade.discretionary
          ? null
          : classifyQuality(signal.trade.action, changePct),
      url: signal.url,
    });
  }

  return rows.sort((a, b) => b.timestamp - a.timestamp || a.ticker.localeCompare(b.ticker));
}

export interface AssetHolding {
  ticker: string;
  assetName: string;
  assetType: AssetType;
  /** Deliberate purchases only — grants and exercises are counted separately. */
  buys: number;
  /** Deliberate sales only. */
  sells: number;
  /** buys - sells: positive means net accumulation across disclosures. */
  net: number;
  /**
   * Movements that were not decisions: grants, option exercises, tax
   * withholding. Kept apart from `buys`/`sells` so a vesting schedule can never
   * be read as seven insiders buying the stock.
   */
  awarded: number;
  /** Distinct people who traded it — a crowd, not one busy filer. */
  traders: number;
  /** Most recent disclosure touching this asset. */
  lastTradedAt: number;
}

/**
 * Assets ranked by how many distinct people disclosed trading them.
 *
 * ── What this is, and is not ────────────────────────────────────────────────
 * This aggregates *disclosed transactions*, not positions. It cannot tell you
 * what anyone currently holds: periodic transaction reports record trades, and
 * the holdings themselves live in the annual disclosure, which this app does
 * not read. An asset bought and later sold still appears here.
 *
 * Ranked by distinct traders rather than filing count, so one prolific filer
 * cannot manufacture the appearance of consensus — the same reasoning as
 * `clusterBuyers`.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function topAssets(rows: readonly TradeRow[], limit = 10): AssetHolding[] {
  const byTicker = new Map<string, AssetHolding & { traderSet: Set<string> }>();

  for (const row of rows) {
    const existing = byTicker.get(row.ticker);
    const entry =
      existing ??
      {
        ticker: row.ticker,
        assetName: row.trade.assetName || row.ticker,
        assetType: row.assetType,
        buys: 0,
        sells: 0,
        net: 0,
        awarded: 0,
        traders: 0,
        lastTradedAt: 0,
        traderSet: new Set<string>(),
      };

    if (!row.trade.discretionary) entry.awarded++;
    else if (row.trade.action === 'buy') entry.buys++;
    else entry.sells++;
    entry.net = entry.buys - entry.sells;
    entry.traderSet.add(row.trade.traderName.trim().toLowerCase());
    entry.traders = entry.traderSet.size;
    entry.lastTradedAt = Math.max(entry.lastTradedAt, row.timestamp);

    if (!existing) byTicker.set(row.ticker, entry);
  }

  return [...byTicker.values()]
    .map(({ traderSet: _traderSet, ...holding }) => holding)
    .sort(
      (a, b) =>
        b.traders - a.traders ||
        b.buys + b.sells - (a.buys + a.sells) ||
        b.lastTradedAt - a.lastTradedAt ||
        a.ticker.localeCompare(b.ticker),
    )
    .slice(0, limit);
}

/**
 * `4 bought · 1 sold · 7 awarded` — the activity behind a holding row.
 *
 * Awards are named as awards rather than folded into "bought", because they
 * are the opposite of a signal: shares arriving on a schedule the recipient
 * did not choose.
 */
export function holdingSummary(holding: AssetHolding): string {
  const parts: string[] = [];
  if (holding.buys > 0) parts.push(`${holding.buys} bought`);
  if (holding.sells > 0) parts.push(`${holding.sells} sold`);
  if (holding.awarded > 0) parts.push(`${holding.awarded} awarded`);
  return parts.join(' · ') || 'no activity';
}
