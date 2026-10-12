import { getJson } from '@/lib/http';

/**
 * What every SEC EDGAR source shares: the headers SEC requires, one request
 * queue, and the ticker map.
 *
 * One queue for the whole app, not one per source. SEC's 10-requests-a-second
 * limit is per client, so Insiders and Funds fetching at once must still take
 * turns, or the pair of them bursts past it and the app gets blocked.
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅  NO API KEY REQUIRED — fully public SEC data
 * ═══════════════════════════════════════════════════════════════════════════
 * SEC FAIR ACCESS RULES — https://www.sec.gov/os/webmaster-faq#developers
 *   • A descriptive User-Agent identifying the app is required. Requests
 *     without one get thrown a 403.
 *   • Maximum 10 requests/second. The queue below serialises with a small gap,
 *     which keeps us far under it even with many watched subjects.
 * Both are honoured here. Please keep them honoured.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * SEC requires a real contact address. Replace with your own before shipping —
 * it is how they reach you instead of silently blocking your users.
 */
export const SEC_HEADERS = {
  'user-agent': 'Ripple/1.0 (contact: support@ripple.app)',
};

export const TICKER_MAP_URL = 'https://www.sec.gov/files/company_tickers.json';
export const SUBMISSIONS_BASE = 'https://data.sec.gov/submissions';
export const ARCHIVES_BASE = 'https://www.sec.gov/Archives/edgar/data';

/** Gap between SEC requests. 120ms ≈ 8/s, comfortably inside their 10/s cap. */
const REQUEST_GAP_MS = 120;

// ───────────────────────────────────────────────────────────────────────────
// Rate-limited request queue
// ───────────────────────────────────────────────────────────────────────────

let queue: Promise<unknown> = Promise.resolve();

/**
 * Serialise every SEC call with a fixed gap. Fanning out across watched tickers
 * with `Promise.all` would burst well past their limit and get the whole app
 * blocked, which is a much worse failure than being slightly slower.
 */
export function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    await new Promise((r) => setTimeout(r, REQUEST_GAP_MS));
    return work();
  });
  // Keep the chain alive even when one link rejects.
  queue = result.catch(() => undefined);
  return result;
}

// ───────────────────────────────────────────────────────────────────────────
// Ticker -> CIK
// ───────────────────────────────────────────────────────────────────────────

export interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

let tickerMap: TickerEntry[] | null = null;
let tickerMapPromise: Promise<TickerEntry[]> | null = null;

/** The full ticker->CIK map is ~800KB, so it's fetched once and shared. */
export async function loadTickerMap(signal?: AbortSignal): Promise<TickerEntry[]> {
  if (tickerMap) return tickerMap;
  if (tickerMapPromise) return tickerMapPromise;

  tickerMapPromise = enqueue(() =>
    getJson<Record<string, TickerEntry>>(TICKER_MAP_URL, {
      headers: SEC_HEADERS,
      signal,
      timeoutMs: 25_000,
    }),
  )
    .then((raw) => {
      tickerMap = Object.values(raw);
      return tickerMap;
    })
    .catch((err) => {
      tickerMapPromise = null; // allow a retry on the next attempt
      throw err;
    });

  return tickerMapPromise;
}

export function padCik(cik: number | string): string {
  return String(cik).padStart(10, '0');
}

