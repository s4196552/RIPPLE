import { compact as compactVolume, pct as formatPct } from '../../lib/format.ts';

// Re-exported under the stock-facing names so callers reach for one module.
export { compactVolume, formatPct };
import type { Actor, Signal } from '@/providers/types';

/**
 * Turning a price series into feed signals.
 *
 * Only `import type` plus our own pure formatters, so this is unit-tested with
 * no network. This is the interesting half of StocksProvider: deciding which
 * sessions are worth a card and how to word them.
 */

/** A daily move at or above this magnitude is worth a feed card. */
export const MOVE_THRESHOLD_PCT = 1.5;
/** Volume at or above this multiple of the trailing average is a spike. */
export const VOLUME_SPIKE_MULTIPLE = 1.9;
/** Sessions of history required before high/low claims are meaningful. */
const MIN_HISTORY = 5;
/** Lookback for the "vs average volume" comparison. */
const VOLUME_WINDOW = 20;
/**
 * A new high/low must clear the previous extreme by this much to count.
 *
 * Without it, a ticker drifting sideways posts a "3-month high" card every time
 * it closes a fraction of a cent above the old one — technically true, useless
 * in a feed. The margin makes the claim mean something.
 */
export const EXTREME_MARGIN_PCT = 0.25;

export interface Series {
  symbol: string;
  currency: string;
  /** Epoch ms per session, ascending. */
  times: number[];
  closes: number[];
  volumes: number[];
}

/** One notable trading session. */
export interface TickerEvent {
  symbol: string;
  time: number;
  kind: 'move' | 'high' | 'low' | 'volume';
  close: number;
  changePct: number;
  volume: number;
  /** Trailing average volume, for the spike copy. */
  avgVolume: number;
  currency: string;
}

/**
 * Scan a series and emit one event per notable session, newest first.
 * Unremarkable sessions produce nothing — a ticker that drifted sideways for a
 * month should not fill the feed with noise.
 */
export function deriveEvents(series: Series): TickerEvent[] {
  const { closes, times, volumes, symbol, currency } = series;
  const events: TickerEvent[] = [];

  for (let i = 1; i < closes.length; i++) {
    const close = closes[i];
    const prev = closes[i - 1];
    const time = times[i];
    if (close == null || prev == null || time == null || prev === 0) continue;

    const changePct = ((close - prev) / prev) * 100;
    const volume = volumes[i] ?? 0;

    const window = volumes
      .slice(Math.max(0, i - VOLUME_WINDOW), i)
      .filter((v): v is number => v != null && v > 0);
    const avgVolume = window.length ? window.reduce((a, b) => a + b, 0) / window.length : 0;

    const past = closes.slice(0, i).filter((c): c is number => c != null);
    const hasHistory = past.length >= MIN_HISTORY;
    const priorHigh = hasHistory ? Math.max(...past) : 0;
    const priorLow = hasHistory ? Math.min(...past) : 0;

    const isHigh = hasHistory && close > priorHigh * (1 + EXTREME_MARGIN_PCT / 100);
    // A prior low of zero can't be beaten by a positive close, and dividing by
    // it would blow up — treat that series as having no meaningful floor.
    const isLow = hasHistory && priorLow > 0 && close < priorLow * (1 - EXTREME_MARGIN_PCT / 100);

    // One event per session; the most newsworthy classification wins.
    let kind: TickerEvent['kind'] | null = null;
    if (isHigh) kind = 'high';
    else if (isLow) kind = 'low';
    else if (Math.abs(changePct) >= MOVE_THRESHOLD_PCT) kind = 'move';
    else if (avgVolume > 0 && volume >= avgVolume * VOLUME_SPIKE_MULTIPLE) kind = 'volume';

    if (!kind) continue;
    events.push({ symbol, time, kind, close, changePct, volume, avgVolume, currency });
  }

  return events.reverse();
}

export function money(value: number, currency: string): string {
  const sigil = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '';
  return sigil ? `${sigil}${value.toFixed(2)}` : `${value.toFixed(2)} ${currency}`;
}

/** Human copy for one event. */
export function describeEvent(raw: TickerEvent): string {
  const dir = raw.changePct >= 0 ? 'up' : 'down';
  const change = formatPct(raw.changePct);
  const close = money(raw.close, raw.currency);

  switch (raw.kind) {
    case 'high':
      return `${raw.symbol} closed at a 3-month high of ${close}, ${dir} ${change} on the session.`;
    case 'low':
      return `${raw.symbol} closed at a 3-month low of ${close}, ${dir} ${change} on the session.`;
    case 'volume':
      return `${raw.symbol} traded ${compactVolume(raw.volume)} shares — ${(raw.volume / raw.avgVolume).toFixed(1)}× its ${VOLUME_WINDOW}-day average — closing at ${close} (${change}).`;
    case 'move':
    default:
      return `${raw.symbol} moved ${change} to ${close} on ${compactVolume(raw.volume)} shares.`;
  }
}

const BADGES: Record<TickerEvent['kind'], string> = {
  high: '3-MONTH HIGH',
  low: '3-MONTH LOW',
  volume: 'VOLUME SPIKE',
  move: 'PRICE MOVE',
};

/** A ticker event -> the shared feed shape. */
export function normalizeTickerEvent(raw: TickerEvent, actor: Actor): Signal {
  return {
    id: `stocks:${raw.symbol}-${raw.time}-${raw.kind}`,
    source: 'stocks',
    actor,
    text: describeEvent(raw),
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(raw.symbol)}`,
    timestamp: raw.time,
    ticker: raw.symbol,
    accent: {
      label: formatPct(raw.changePct),
      tone: raw.changePct > 0 ? 'up' : raw.changePct < 0 ? 'down' : 'neutral',
    },
    badges: [BADGES[raw.kind]],
  };
}
