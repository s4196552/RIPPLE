import { getJson, isAbort, q } from '@/lib/http';
import { hashString, seededRandom } from '@/lib/rng';
import type {
  Actor,
  GetSignalsOptions,
  Provider,
  ProviderMode,
  Signal,
  SubjectResult,
} from '@/providers/types';
import { deriveEvents, normalizeTickerEvent, type Series, type TickerEvent } from './events';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅  NO API KEY REQUIRED (by default)
 * ═══════════════════════════════════════════════════════════════════════════
 * This provider talks to Yahoo Finance's public JSON endpoints, which need no
 * registration. It is the reference implementation of the `Provider` contract:
 * everything below is real network data.
 *
 * A "watched account" here is a ticker, and a "post" is a notable market event
 * derived from the price series — a large daily move, a period high or low, or
 * a volume spike. That is what lets a trades tracker sit naturally in a
 * reverse-chronological feed beside social posts. The event derivation itself
 * lives in `./events.ts`.
 *
 * KNOWN LIMITS, and what to do about each:
 *
 *   • Yahoo sends no CORS headers, so these calls succeed on iOS/Android but
 *     are blocked by the browser on `expo start --web`. The web build falls
 *     back to the synthetic series below. Native is the real target; if you
 *     need web, proxy these two endpoints through your own backend.
 *
 *   • Yahoo is undocumented and rate-limits under load. Set
 *     `EXPO_PUBLIC_FINNHUB_API_KEY` to route through Finnhub instead
 *     (https://finnhub.io/register — the free tier covers search + candles).
 *
 *   • Daily candles put events at one-per-session granularity. For intraday
 *     alerts, change RANGE/INTERVAL to '5d'/'15m'.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const FINNHUB_KEY = process.env.EXPO_PUBLIC_FINNHUB_API_KEY?.trim() || '';

const YAHOO_SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search';
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

/** Yahoo rejects requests that look automated; a browser UA is enough. */
const YAHOO_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
};

const RANGE = '3mo';
const INTERVAL = '1d';

interface YahooSearchResponse {
  quotes?: {
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchDisp?: string;
    typeDisp?: string;
    quoteType?: string;
  }[];
}

interface YahooChartResponse {
  chart?: {
    result?: {
      meta?: { symbol?: string; currency?: string };
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[]; volume?: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
}

interface FinnhubCandles {
  s: string;
  t?: number[];
  c?: number[];
  v?: number[];
}

interface FinnhubSearchResponse {
  count?: number;
  result?: { symbol?: string; displaySymbol?: string; description?: string; type?: string }[];
}

/**
 * Symbol search via Finnhub, which — unlike `/stock/candle` — is free.
 *
 * Preferred over Yahoo whenever a key is set, because Yahoo fingerprints its
 * callers and answers 429 to anything it does not take for a browser. Yahoo
 * stays as the keyless fallback.
 *
 * Results carrying an exchange suffix (`2788.T`, `PNPL.L`) are dropped: a free
 * Finnhub key cannot quote foreign listings, so offering one would only produce
 * a subject that never resolves to a price.
 */
async function fetchFinnhubSearch(term: string, signal?: AbortSignal): Promise<SubjectResult[]> {
  const res = await getJson<FinnhubSearchResponse>(
    `${FINNHUB_BASE}/search?q=${q(term)}&token=${q(FINNHUB_KEY)}`,
    { signal, timeoutMs: 6_000 },
  );

  return (res.result ?? [])
    .filter((r) => r.symbol && !r.symbol.includes('.'))
    .map((r) => ({
      source: 'stocks' as const,
      handle: r.symbol!,
      displayName: r.description || r.symbol!,
      subtitle: r.type || null,
      avatarUrl: null,
    }));
}

async function fetchYahooSeries(symbol: string, signal?: AbortSignal): Promise<Series> {
  const res = await getJson<YahooChartResponse>(
    `${YAHOO_CHART}/${q(symbol)}?range=${RANGE}&interval=${INTERVAL}`,
    { headers: YAHOO_HEADERS, signal },
  );

  const result = res.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result || !quote?.close) throw new Error(`No chart data for ${symbol}`);

  // Yahoo pads the series with nulls for halted/holiday sessions; drop them so
  // the change calculations don't straddle phantom gaps.
  const times: number[] = [];
  const closes: number[] = [];
  const volumes: number[] = [];
  (result.timestamp ?? []).forEach((t, i) => {
    const close = quote.close?.[i];
    if (t == null || close == null) return;
    times.push(t * 1000);
    closes.push(close);
    volumes.push(quote.volume?.[i] ?? 0);
  });

  return {
    symbol: result.meta?.symbol ?? symbol.toUpperCase(),
    currency: result.meta?.currency ?? 'USD',
    times,
    closes,
    volumes,
  };
}

async function fetchFinnhubSeries(symbol: string, signal?: AbortSignal): Promise<Series> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 90 * 24 * 60 * 60;
  const res = await getJson<FinnhubCandles>(
    `${FINNHUB_BASE}/stock/candle?symbol=${q(symbol)}&resolution=D&from=${from}&to=${to}&token=${q(FINNHUB_KEY)}`,
    { signal },
  );
  if (res.s !== 'ok' || !res.t || !res.c) throw new Error(`No Finnhub candles for ${symbol}`);

  return {
    symbol: symbol.toUpperCase(),
    currency: 'USD',
    times: res.t.map((t) => t * 1000),
    closes: res.c,
    volumes: res.v ?? res.c.map(() => 0),
  };
}

/**
 * Deterministic random-walk fallback, reached only when the network path fails
 * (web CORS, rate limit, offline). Seeded by symbol so the same ticker always
 * yields the same series: refreshes stay stable and post ids stay dedupable.
 */
function syntheticSeries(symbol: string): Series {
  const rand = seededRandom(hashString(symbol.toUpperCase()));
  const times: number[] = [];
  const closes: number[] = [];
  const volumes: number[] = [];

  let price = 40 + (hashString(symbol) % 400);
  const dayMs = 24 * 60 * 60 * 1000;
  // Anchor to UTC midnight so timestamps don't drift between calls.
  const today = Math.floor(Date.now() / dayMs) * dayMs;

  for (let i = 63; i >= 0; i--) {
    const date = new Date(today - i * dayMs);
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    price = Math.max(1, price * (1 + (rand() - 0.485) * 0.045));
    times.push(date.getTime() + 20 * 60 * 60 * 1000); // ~16:00 ET close
    closes.push(price);
    volumes.push(Math.floor(2_000_000 + rand() * 40_000_000));
  }

  return { symbol: symbol.toUpperCase(), currency: 'USD', times, closes, volumes };
}

/** Yahoo's symbol search, used when no Finnhub key is configured. */
async function fetchYahooSearch(term: string, signal?: AbortSignal): Promise<SubjectResult[]> {
  const res = await getJson<YahooSearchResponse>(
    `${YAHOO_SEARCH}?q=${q(term)}&quotesCount=10&newsCount=0`,
    { headers: YAHOO_HEADERS, signal, timeoutMs: 6_000 },
  );

  return (res.quotes ?? [])
    .filter(
      (r) =>
        r.symbol &&
        (r.quoteType === 'EQUITY' || r.quoteType === 'ETF' || r.quoteType === 'CRYPTOCURRENCY'),
    )
    .map((r) => ({
      source: 'stocks' as const,
      handle: r.symbol!,
      displayName: r.longname ?? r.shortname ?? r.symbol!,
      subtitle: [r.exchDisp, r.typeDisp].filter(Boolean).join(' · ') || null,
      avatarUrl: null,
    }));
}

/**
 * Symbol lookup, Finnhub first and Yahoo second.
 *
 * Search is deliberately *not* governed by `finnhubDenied`: that latch means
 * "this key cannot have candles", which says nothing about `/search`. A key
 * that is useless for history is still fine for finding tickers.
 */
async function fetchRemoteMatches(term: string, signal?: AbortSignal): Promise<SubjectResult[]> {
  if (FINNHUB_KEY) {
    try {
      const matches = await fetchFinnhubSearch(term, signal);
      if (matches.length) return matches;
    } catch (err) {
      if (isAbort(err)) throw err;
      console.warn('[stocks] Finnhub search failed, trying Yahoo:', err);
    }
  }
  return fetchYahooSearch(term, signal);
}

/** Tracks whether the last network attempt worked, so `mode()` can be honest. */
let lastFetchWasReal = true;

/**
 * Shared daily-series loader. Exported because the price *reaction* shown on
 * congress and insider signals ("what the stock did after") needs the same
 * data — see `./reaction.ts`.
 */
export async function loadSeries(symbol: string, signal?: AbortSignal): Promise<Series> {
  try {
    const series = FINNHUB_KEY
      ? await fetchFinnhubSeries(symbol, signal)
      : await fetchYahooSeries(symbol, signal);
    lastFetchWasReal = true;
    return series;
  } catch (err) {
    if (isAbort(err)) throw err;
    lastFetchWasReal = false;
    console.warn(`[stocks] live fetch failed for ${symbol}, using synthetic series:`, err);
    return syntheticSeries(symbol);
  }
}

/** Small directory so a short query still shows something useful. */
const POPULAR = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE Arca' },
  { symbol: 'BTC-USD', name: 'Bitcoin USD', exchange: 'CCC' },
  { symbol: 'COIN', name: 'Coinbase Global, Inc.', exchange: 'NASDAQ' },
] as const;

export const StocksProvider: Provider<TickerEvent> = {
  id: 'stocks',
  label: 'Stocks',
  sigil: '$',
  color: '#3FD68C',
  icon: 'trending-up',
  blurb: 'Price moves and volume spikes for tickers you track',
  subjectNoun: 'a ticker',
  provenance: 'Yahoo Finance, no key required',

  mode(): ProviderMode {
    if (FINNHUB_KEY) return 'live';
    return lastFetchWasReal ? 'public' : 'mock';
  },

  async searchSubjects(query: string, signal?: AbortSignal): Promise<SubjectResult[]> {
    const term = query.trim().replace(/^\$/, '');
    if (!term) return [];

    const lower = term.toLowerCase();
    const local: SubjectResult[] = POPULAR.filter(
      (p) => p.symbol.toLowerCase().startsWith(lower) || p.name.toLowerCase().includes(lower),
    ).map((p) => ({
      source: 'stocks' as const,
      handle: p.symbol,
      displayName: p.name,
      subtitle: p.exchange,
      avatarUrl: null,
    }));

    try {
      const remote = await fetchRemoteMatches(term, signal);

      if (remote.length) {
        const seen = new Set(remote.map((r) => r.handle.toUpperCase()));
        return [...remote, ...local.filter((l) => !seen.has(l.handle.toUpperCase()))].slice(0, 10);
      }
    } catch (err) {
      if (isAbort(err)) throw err;
      // Search is best-effort; the local directory keeps the field usable.
    }

    return local.slice(0, 10);
  },

  async getSignals(handle: string, options: GetSignalsOptions = {}): Promise<Signal[]> {
    const symbol = handle.replace(/^\$/, '').toUpperCase();
    const series = await loadSeries(symbol, options.signal);

    const actor: Actor = {
      handle: series.symbol,
      displayName: series.symbol,
      subtitle: series.currency,
      avatarUrl: null,
    };

    let events = deriveEvents(series);
    if (options.since !== undefined) {
      const since = options.since;
      events = events.filter((e) => e.time > since);
    }

    return events.slice(0, options.limit ?? 15).map((raw) => normalizeTickerEvent(raw, actor));
  },

  normalizeSignal(raw: TickerEvent, actor: Actor): Signal {
    return normalizeTickerEvent(raw, actor);
  },
};

export type { Series, TickerEvent };
