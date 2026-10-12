import { getJson, getText, isAbort } from '@/lib/http';
import {
  ARCHIVES_BASE,
  SEC_HEADERS,
  SUBMISSIONS_BASE,
  enqueue,
  loadTickerMap,
  padCik,
  type TickerEntry,
} from '@/providers/sec';
import { logoUrl } from '@/providers/logos';
import type {
  Actor,
  GetSignalsOptions,
  Provider,
  ProviderMode,
  Signal,
  SubjectResult,
} from '@/providers/types';
import {
  TRANSACTION_CODES,
  normalizeForm4,
  parseFilingDay,
  parseForm4,
  principalTransaction,
  type Form4,
} from './form4';
import { loadSeries } from '@/providers/stocks/StocksProvider';
import {
  computeExcessReaction,
  computeReaction,
  excessBadge,
  reactionBadge,
} from '@/providers/stocks/reaction';
import type { Series } from '@/providers/stocks/events';
import {
  pairPositions,
  positionBadge,
  scorePosition,
  type TradeEvent,
} from '@/providers/positions';

/**
 * Benchmark every price reaction against the broad market.
 *
 * SPY rather than an index level because it is a real tradable series on the
 * same keyless Yahoo endpoint the rest of the app already uses.
 */
const BENCHMARK_SYMBOL = 'SPY';

/**
 * Corporate insider trading, straight from EDGAR. Officers, directors and 10%
 * owners must file a Form 4 within two business days of trading their own
 * company's stock, and every one of those filings is free and machine-readable.
 *
 * A watched subject here is a ticker; signals are that company's insider
 * transactions. SEC's access rules, and the queue that honours them, are in
 * `@/providers/sec`.
 */

/** Filings inspected per ticker. Each costs one request, so keep it modest. */
const FILINGS_PER_TICKER = 8;
/**
 * Ceiling when a caller asks for a deeper history (the subject-detail screen).
 * Each filing is one SEC request behind the 120ms queue, so 40 is roughly five
 * seconds — acceptable on a screen the user deliberately opened, and far too
 * slow for the feed, which is why the feed keeps the smaller default.
 */
const MAX_FILINGS_PER_TICKER = 40;

/**
 * The default list: the largest US companies, whose executives' Form 4s are
 * the ones that make the news. Tickers as EDGAR's ticker map spells them, so
 * each resolves to a CIK on its first fetch.
 */
const NOTABLE: { ticker: string; name: string; sector: string }[] = [
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Semiconductors' },
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Consumer tech' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Software' },
  { ticker: 'AMZN', name: 'Amazon.com, Inc.', sector: 'E-commerce and cloud' },
  { ticker: 'META', name: 'Meta Platforms, Inc.', sector: 'Social media' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Search and cloud' },
  { ticker: 'TSLA', name: 'Tesla, Inc.', sector: 'Electric vehicles' },
  { ticker: 'AVGO', name: 'Broadcom Inc.', sector: 'Semiconductors' },
  { ticker: 'PLTR', name: 'Palantir Technologies Inc.', sector: 'Software' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Banking' },
];
// ───────────────────────────────────────────────────────────────────────────
// Filings
// ───────────────────────────────────────────────────────────────────────────

interface SubmissionsResponse {
  cik?: string;
  name?: string;
  tickers?: string[];
  filings?: {
    recent?: {
      form?: string[];
      accessionNumber?: string[];
      filingDate?: string[];
      primaryDocument?: string[];
    };
  };
}

interface FilingRef {
  accessionNumber: string;
  filingDate: string;
  primaryDocument: string;
}

/**
 * Recent Form 4 filings for a CIK, newest first.
 *
 * `want` is honoured rather than ignored: the subject-detail screen asks for a
 * deeper history than the feed, and it needs one — pairing a buy to the sell
 * that closes it is impossible inside a window of eight filings, which is fewer
 * than a single active company files in a week.
 */
async function recentForm4s(
  cik: string,
  want: number,
  signal?: AbortSignal,
): Promise<{ name: string; refs: FilingRef[] }> {
  const res = await enqueue(() =>
    getJson<SubmissionsResponse>(`${SUBMISSIONS_BASE}/CIK${cik}.json`, {
      headers: SEC_HEADERS,
      signal,
      timeoutMs: 25_000,
    }),
  );

  const recent = res.filings?.recent;
  const forms = recent?.form ?? [];
  const refs: FilingRef[] = [];
  // Each filing is one more SEC request, so the ceiling is a real cost.
  const budget = Math.min(MAX_FILINGS_PER_TICKER, Math.max(FILINGS_PER_TICKER, want));

  for (let i = 0; i < forms.length && refs.length < budget; i++) {
    if (forms[i] !== '4') continue;
    const accessionNumber = recent?.accessionNumber?.[i];
    const filingDate = recent?.filingDate?.[i];
    const primaryDocument = recent?.primaryDocument?.[i];
    if (!accessionNumber || !filingDate || !primaryDocument) continue;
    refs.push({ accessionNumber, filingDate, primaryDocument });
  }

  return { name: res.name ?? '', refs };
}

/**
 * EDGAR's `primaryDocument` for a Form 4 points at the human-readable XSL
 * rendering (`xslF345X06/form4.xml`). Stripping that prefix yields the raw XML
 * in the same directory — which saves fetching the directory listing just to
 * discover a filename we can already derive.
 */
function rawDocumentUrl(cikNumeric: string, ref: FilingRef): string {
  const accession = ref.accessionNumber.replace(/-/g, '');
  const doc = ref.primaryDocument.replace(/^xsl[^/]*\//, '');
  return `${ARCHIVES_BASE}/${cikNumeric}/${accession}/${doc}`;
}

async function fetchForm4(
  cikNumeric: string,
  ref: FilingRef,
  signal?: AbortSignal,
): Promise<Form4 | null> {
  const xml = await enqueue(() =>
    getText(rawDocumentUrl(cikNumeric, ref), { headers: SEC_HEADERS, signal, timeoutMs: 20_000 }),
  );
  return parseForm4(xml);
}

// ───────────────────────────────────────────────────────────────────────────
// Provider
// ───────────────────────────────────────────────────────────────────────────

export const InsiderProvider: Provider<Form4> = {
  id: 'insider',
  label: 'Insiders',
  sigil: '$',
  color: '#F59E0B',
  icon: 'fa6:user-tie',
  blurb: 'Form 4 filings — executives and directors trading their own stock',
  subjectNoun: 'a company',
  provenance: 'SEC EDGAR, no key required',

  subjectAvatarUrl(handle: string): string | null {
    return logoUrl(handle.replace(/^\$/, ''));
  },

  mode(): ProviderMode {
    return 'public';
  },

  async searchSubjects(query: string, signal?: AbortSignal): Promise<SubjectResult[]> {
    const term = query.trim().replace(/^\$/, '').toLowerCase();
    // Nothing typed: the companies whose insiders the market watches most,
    // so the screen opens on something to follow. Offline, like the parties.
    if (!term) {
      return NOTABLE.map((n) => ({
        source: 'insider' as const,
        handle: n.ticker,
        displayName: n.name,
        subtitle: `$${n.ticker} · ${n.sector}`,
        avatarUrl: logoUrl(n.ticker),
      }));
    }

    let entries: TickerEntry[];
    try {
      entries = await loadTickerMap(signal);
    } catch (err) {
      if (isAbort(err)) throw err;
      return [];
    }

    return entries
      .filter(
        (e) => e.ticker.toLowerCase().startsWith(term) || e.title.toLowerCase().includes(term),
      )
      .sort((a, b) => {
        // Exact ticker first, then prefix matches, then name matches.
        const rank = (e: TickerEntry) =>
          e.ticker.toLowerCase() === term ? 0 : e.ticker.toLowerCase().startsWith(term) ? 1 : 2;
        return rank(a) - rank(b) || a.ticker.localeCompare(b.ticker);
      })
      .slice(0, 12)
      .map((e) => ({
        source: 'insider' as const,
        handle: e.ticker.toUpperCase(),
        displayName: e.title,
        subtitle: `$${e.ticker.toUpperCase()} · CIK ${padCik(e.cik_str)}`,
        avatarUrl: logoUrl(e.ticker),
      }));
  },

  async getSignals(handle: string, options: GetSignalsOptions = {}): Promise<Signal[]> {
    const ticker = handle.replace(/^\$/, '').toUpperCase();

    const entries = await loadTickerMap(options.signal);
    const entry = entries.find((e) => e.ticker.toUpperCase() === ticker);
    if (!entry) throw new Error(`No SEC registrant for ticker ${ticker}`);

    const cikPadded = padCik(entry.cik_str);
    const cikNumeric = String(entry.cik_str);
    const { refs } = await recentForm4s(cikPadded, options.limit ?? 15, options.signal);

    const actor: Actor = {
      handle: ticker,
      displayName: entry.title,
      subtitle: `$${ticker}`,
      avatarUrl: logoUrl(ticker),
    };

    const results = await Promise.allSettled(
      refs.map(async (ref) => {
        const filedAt = parseFilingDay(ref.filingDate) ?? Date.now();
        const parsed = await fetchForm4(cikNumeric, ref, options.signal);
        if (!parsed) return null;
        const signal = normalizeForm4(parsed, ref.accessionNumber, actor, filedAt);
        // The parsed filing travels with its signal: pairing needs the insider's
        // own name and the transaction code, neither of which survives into the
        // rendered card.
        return signal ? { signal, form4: parsed } : null;
      }),
    );

    const filings: { signal: Signal; form4: Form4 }[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value) filings.push(r.value);
      } else if (isAbort(r.reason)) {
        throw r.reason;
      }
      // A single unparseable filing shouldn't lose the rest.
    }

    let out = filings.map((f) => f.signal);
    if (options.since !== undefined) {
      const since = options.since;
      out = out.filter((s) => s.timestamp > since);
    }
    out = out.sort((a, b) => b.timestamp - a.timestamp).slice(0, options.limit ?? 15);

    // Pairing runs over every filing fetched, not just the page being shown:
    // the sell on screen is usually closing a buy from further back.
    await attachPriceContext(ticker, out, filings, options.signal);
    return out;
  },

  normalizeSignal(raw: Form4, actor: Actor): Signal {
    const signal = normalizeForm4(
      raw,
      `manual-${raw.ticker}-${raw.periodOfReport ?? ''}`,
      actor,
      Date.now(),
    );
    if (!signal) throw new Error('Form 4 contains no reportable transaction');
    return signal;
  },
};

/**
 * Annotate each signal with what the stock did afterwards — and, crucially,
 * what it did *relative to the market* over the same window.
 *
 * "The CFO sold and the stock is up 11% since" reads like the sale was a
 * mistake. If the index was up 12% over those same sessions, the stock actually
 * lagged, and the raw number told the opposite story. Showing a return without
 * its benchmark is the single easiest way for this app to mislead, so both
 * numbers travel together.
 *
 * Costs at most two cached price requests per watched company — the ticker and
 * the benchmark — and all of a company's filings share both.
 *
 * Strictly a bonus: if the price lookup fails the signals still stand. A Yahoo
 * outage must never cost us the SEC data we already have in hand.
 */
async function attachPriceContext(
  ticker: string,
  signals: Signal[],
  filings: readonly { signal: Signal; form4: Form4 }[],
  abortSignal?: AbortSignal,
): Promise<void> {
  if (signals.length === 0) return;

  try {
    const series = await loadSeries(ticker, abortSignal);

    // The benchmark is best-effort on top of a best-effort feature: if it can't
    // be fetched we still show the raw move rather than nothing.
    let benchmark: Series | null = null;
    if (ticker !== BENCHMARK_SYMBOL) {
      try {
        benchmark = await loadSeries(BENCHMARK_SYMBOL, abortSignal);
      } catch (err) {
        if (isAbort(err)) throw err;
        console.warn('[insider] benchmark series unavailable, showing raw moves:', err);
      }
    }

    for (const s of signals) {
      const excess = benchmark
        ? computeExcessReaction(series, benchmark, s.timestamp, BENCHMARK_SYMBOL)
        : null;

      if (excess) {
        s.badges = [...(s.badges ?? []), reactionBadge(ticker, excess), excessBadge(excess)];
        // Kept as numbers too: a table has to rank and classify on these, and
        // reading them back out of the chip text would break on any rewording.
        s.reaction = {
          changePct: excess.changePct,
          benchmarkPct: excess.benchmarkPct,
          excessPct: excess.excessPct,
          sessions: excess.sessions,
          benchmarkSymbol: excess.benchmarkSymbol,
        };
        continue;
      }

      const reaction = computeReaction(series, s.timestamp);
      if (reaction) {
        s.badges = [...(s.badges ?? []), reactionBadge(ticker, reaction)];
        s.reaction = { changePct: reaction.changePct, sessions: reaction.sessions };
      }
    }

    if (benchmark) attachRoundTrips(ticker, signals, filings, series, benchmark);
  } catch (err) {
    if (isAbort(err)) throw err;
    console.warn(`[insider] price reaction unavailable for ${ticker}:`, err);
  }
}

/**
 * Pair each insider's buys with their own later sells and report the round trip.
 *
 * The holding period is the insider's, never a fixed window — measuring these
 * over an invented horizon is precisely the mistake that flips the conclusion
 * (see the note atop `positions.ts`).
 *
 * Only open-market buys and sells take part. A share grant and the tax
 * withholding that follows it are compensation mechanics moving in opposite
 * directions; pairing them would manufacture a "round trip" nobody chose to
 * make.
 *
 * ── Expect this to fire rarely, and do not "fix" that ────────────────────────
 * Measured over 120 consecutive Form 4s from three large issuers: JPM produced
 * 18 discretionary transactions, every one of them a sale and not a single
 * open-market purchase; WFC produced none at all; KEY produced three, all
 * sales. Insiders acquire stock through grants (`A`) and option exercises
 * (`M`), then sell. A genuine buy-then-sell round trip is unusual.
 *
 * The tempting repair is to let grants open positions, which would make the
 * badge appear constantly — and describe vesting schedules rather than
 * decisions, which is worse than showing nothing. This code stays as it is and
 * fires on the uncommon case that actually means something. Congressional
 * disclosures, where both sides are real decisions, are where pairing earns its
 * keep.
 * ────────────────────────────────────────────────────────────────────────────
 */
function attachRoundTrips(
  ticker: string,
  visible: Signal[],
  filings: readonly { signal: Signal; form4: Form4 }[],
  series: Series,
  benchmark: Series,
): void {
  const events: TradeEvent[] = [];

  for (const { signal, form4 } of filings) {
    const tx = principalTransaction(form4);
    if (!tx) continue;
    if (!TRANSACTION_CODES[tx.code]?.discretionary) continue;

    events.push({
      // Per person: one officer's sale cannot close another officer's purchase.
      actorKey: form4.ownerName,
      ticker,
      side: tx.acquired ? 'buy' : 'sell',
      at: signal.timestamp,
      signalId: signal.id,
    });
  }
  if (events.length === 0) return;

  const byId = new Map(visible.map((s) => [s.id, s]));

  for (const position of pairPositions(events)) {
    // Only closed round trips get this badge. An open one would restate the
    // reaction badge already on its opening card.
    if (!position.closeSignalId) continue;

    const target = byId.get(position.closeSignalId);
    if (!target) continue;

    const outcome = scorePosition(position, series, benchmark);
    if (outcome) {
      target.badges = [...(target.badges ?? []), positionBadge(outcome, BENCHMARK_SYMBOL)];
    }
  }
}
