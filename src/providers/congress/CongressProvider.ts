import { getJson, getText, isAbort, isAccessDenied } from '@/lib/http';
import { district, personName } from '@/lib/format';
import { loadSeries } from '@/providers/stocks/StocksProvider';
import type { Series } from '@/providers/stocks/events';
import {
  computeExcessReaction,
  computeReactionBetween,
  excessBadge,
  preDisclosureBadge,
} from '@/providers/stocks/reaction';
import {
  pairPositions,
  positionBadge,
  scorePosition,
  type TradeEvent,
} from '@/providers/positions';

/** Benchmark for "how has this done against the market". */
const BENCHMARK_SYMBOL = 'SPY';

/**
 * Ceiling on price lookups per subject fetch.
 *
 * A party subject can name dozens of distinct tickers, and each one is a Yahoo
 * request that counts against a limit which is easy to trip.
 */
const MAX_PRICED_TICKERS = 12;
import type {
  Actor,
  GetSignalsOptions,
  Provider,
  ProviderMode,
  Signal,
  SubjectResult,
} from '@/providers/types';
import {
  PERIODIC_TRANSACTION_REPORT,
  extractMembers,
  memberHandle,
  normalizeFiling,
  normalizeTrade,
  parseFilingDate,
  parseFilingIndex,
  rangeMidpoint,
  type FilingRow,
  clusterBadge,
  clusterBuyers,
  isPurchase,
  tradeActionableAt,
  tradeSignalId,
  type ParsedTrade,
} from './parse';
import {
  CONGRESS_SCOPES,
  buildRoster,
  findByName,
  findLegislator,
  parseScope,
  photoUrl,
  scopeIncludes,
  type CongressScope,
  type Legislator,
  type RawLegislator,
  type Roster,
} from './roster';
import bundledTrades from './data/house-trades.json';
import { allScrapedTrades, scrapedTrades } from './scraped';
import { SCRAPED_FORMAT_VERSION, type ScrapedFile } from './scraped-format';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅  WORKS WITH NO KEY — with one honest limitation
 * ═══════════════════════════════════════════════════════════════════════════
 * Congressional trade disclosures come from the House Clerk's annual index at
 * disclosures-clerk.house.gov. No key, no signup, fully public.
 *
 * THE LIMITATION, stated plainly: the Clerk publishes *who filed and when* as
 * structured data, but the actual tickers, amounts and directions live only
 * inside the filed PDF. Parsing those on device is not realistic, so they are
 * read ahead of time by `scripts/scrape-house-ptrs.ts` and shipped as data (see
 * TRADES_URL below). A filing that was never read — a scan of a paper form, or
 * one newer than the last scrape — still emits one signal per filing ("Rep. X
 * disclosed trades, here is the PDF") rather than inventing a ticker.
 *
 * ── To get ticker-level trades ──────────────────────────────────────────────
 * Set either key in `.env` and this provider upgrades automatically; nothing
 * else in the app changes.
 *
 *   EXPO_PUBLIC_QUIVER_API_TOKEN   https://api.quiverquant.com  (~$25/mo)
 *   EXPO_PUBLIC_FMP_API_KEY        https://financialmodelingprep.com (free tier)
 *
 * FMP's free plan pins `page` to 0 and caps `limit` at 25, so it serves the 25
 * most recent House filings plus the 25 most recent Senate ones — recent, real
 * and ticker-level, but not deep. Members outside that window fall through to
 * the Clerk index automatically.
 *
 * Quiver is preferred when both are present — its congressional coverage is
 * more complete and includes the Senate.
 *
 * ── Senate ──────────────────────────────────────────────────────────────────
 * Not covered on the keyless path. The Senate's eFD system requires accepting
 * an interstitial agreement and holding a session cookie, which is not
 * something to do from a mobile client. Both keyed providers include it.
 *
 * ── Party and portraits ─────────────────────────────────────────────────────
 * The Clerk index identifies a filer only as "Khanna, Ro, CA17" — no party, no
 * photo. Both come from `unitedstates/congress-legislators`, a public-domain
 * roster needing no key, joined to each filing by seat and surname (see
 * `roster.ts`). That join is what makes the party subjects possible:
 * `party:republican` and friends are watchable in their own right, so you can
 * follow a caucus without naming its members.
 *
 * A filer the roster cannot resolve keeps their filing and simply shows no
 * face and no party — they are never guessed at, and never counted into a
 * party they might not belong to.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const QUIVER_TOKEN = process.env.EXPO_PUBLIC_QUIVER_API_TOKEN?.trim() || '';
const FMP_KEY = process.env.EXPO_PUBLIC_FMP_API_KEY?.trim() || '';

/**
 * ── Trades read from the PDFs ourselves ─────────────────────────────────────
 * `scripts/scrape-house-ptrs.ts` (`npm run scrape:house`) reads the Clerk's
 * electronically filed PDFs — about nine in ten — and writes the trades to
 * `data/house-trades.json`, which ships inside the app. Wherever a filing has
 * been read, its card becomes real trades: ticker, side, band, and a link back
 * to that PDF. Scanned paper filings, and anything filed since the last scrape,
 * keep the "a filing exists" card.
 *
 * Set `EXPO_PUBLIC_CONGRESS_TRADES_URL` to a hosted copy of that file (a nightly
 * job's output) and the app prefers it, so new filings appear without a rebuild.
 */
const TRADES_URL = process.env.EXPO_PUBLIC_CONGRESS_TRADES_URL?.trim() || '';
const BUNDLED_TRADES = bundledTrades as unknown as ScrapedFile;

let scrapedCache: { file: ScrapedFile; fetchedAt: number; ttl: number } | null = null;
/** One download shared by every congress subject in a refresh. */
let scrapedInFlight: Promise<ScrapedFile> | null = null;
/** How long a failed hosted fetch falls back to the bundle before trying again. */
const SCRAPED_RETRY_MS = 15 * 60 * 1000;

async function loadScraped(signal?: AbortSignal): Promise<ScrapedFile> {
  if (!TRADES_URL) return BUNDLED_TRADES;
  const cached = scrapedCache;
  if (cached && Date.now() - cached.fetchedAt < cached.ttl) return cached.file;

  // Not tied to any one caller's abort signal: it is shared, and one subject
  // being superseded must not cancel the download for the others.
  scrapedInFlight ??= (async () => {
    try {
      const file = await getJson<ScrapedFile>(TRADES_URL, { timeoutMs: 20_000 });
      if (file.v !== SCRAPED_FORMAT_VERSION) throw new Error(`unknown format v${file.v}`);
      scrapedCache = { file, fetchedAt: Date.now(), ttl: INDEX_TTL_MS };
      return file;
    } catch (err) {
      console.warn('[congress] hosted trades unavailable, using the copy bundled with the app:', err);
      // Remembered, so every subject of every refresh doesn't wait out the
      // same timeout again.
      scrapedCache = { file: BUNDLED_TRADES, fetchedAt: Date.now(), ttl: SCRAPED_RETRY_MS };
      return BUNDLED_TRADES;
    } finally {
      scrapedInFlight = null;
    }
  })();

  const file = await scrapedInFlight;
  if (signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  return file;
}

/** Filings read and found to hold only bonds, Treasuries or funds. */
let unlistedCache: { file: ScrapedFile; set: Set<string> } | null = null;

function unlistedSet(file: ScrapedFile): Set<string> {
  if (unlistedCache?.file !== file) unlistedCache = { file, set: new Set(file.unlisted) };
  return unlistedCache.set;
}

/** Every scraped trade, for cluster counts and round trips — rebuilt only when the data changes. */
let allScrapedCache: { file: ScrapedFile; rows: readonly FilingRow[]; trades: ParsedTrade[] } | null = null;

function allScraped(file: ScrapedFile, rows: readonly FilingRow[]): ParsedTrade[] {
  const cached = allScrapedCache;
  if (cached && cached.file === file && cached.rows === rows) return cached.trades;
  const trades = allScrapedTrades(file, rows);
  allScrapedCache = { file, rows, trades };
  return trades;
}

/**
 * Set when the keyed aggregator refuses us — a free FMP key does not include
 * the congressional trading endpoints, and an expired Quiver token behaves the
 * same way. Latched so we stop paying a request per poll to be told no, and so
 * `mode()` reports 'public' instead of claiming 'live' while actually serving
 * the keyless House Clerk index.
 */
let keyedDenied = false;

const CLERK_BASE = 'https://disclosures-clerk.house.gov/public_disc/financial-pdfs';
const QUIVER_BASE = 'https://api.quiverquant.com/beta';
// The v4 "…-rss-feed" endpoints were retired on 2025-08-31 and now answer 403
// "Legacy Endpoint" to any key issued after that date. `stable` replaces them.
const FMP_BASE = 'https://financialmodelingprep.com/stable';

// Free FMP plans pin `page` to 0 and cap `limit` at 25, so a keyed fetch sees
// the 25 most recent House filings plus the 25 most recent Senate ones and no
// further back. A watched member often will not appear in that window, which
// is fine: the caller falls through to the House Clerk index for them.
const FMP_PAGE_LIMIT = 25;

/** SEC and the Clerk both expect a descriptive agent; be a good citizen. */
const AGENT = { 'user-agent': 'Ripple/1.0 (github.com/ripple-app; contact via app store listing)' };

/**
 * The index is ~80KB per year and changes at most daily, so it is fetched once
 * per session per year and reused across every watched member. Without this,
 * ten watched members would mean ten downloads of the same file.
 */
const indexCache = new Map<number, { rows: FilingRow[]; fetchedAt: number }>();
const INDEX_TTL_MS = 6 * 60 * 60 * 1000;

/** Years to cover. Two gives continuity across a January rollover. */
function coverageYears(now = Date.now()): number[] {
  const year = new Date(now).getUTCFullYear();
  return [year, year - 1];
}

async function loadIndex(year: number, signal?: AbortSignal): Promise<FilingRow[]> {
  const cached = indexCache.get(year);
  if (cached && Date.now() - cached.fetchedAt < INDEX_TTL_MS) return cached.rows;

  const text = await getText(`${CLERK_BASE}/${year}FD.txt`, { headers: AGENT, signal, timeoutMs: 20_000 });
  const rows = parseFilingIndex(text);
  indexCache.set(year, { rows, fetchedAt: Date.now() });
  return rows;
}

/**
 * The last concatenation, by the year arrays it was built from. Returning the
 * same array while the indexes are unchanged lets the caches keyed on it
 * (`allScraped`) actually hit.
 */
let allRowsCache: { parts: readonly FilingRow[][]; rows: FilingRow[] } | null = null;

/** All rows across the covered years. Failures on one year don't sink the rest. */
async function loadAllRows(signal?: AbortSignal): Promise<FilingRow[]> {
  const results = await Promise.allSettled(coverageYears().map((y) => loadIndex(y, signal)));
  const parts: FilingRow[][] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') parts.push(r.value);
    else if (isAbort(r.reason)) throw r.reason;
  }

  const cached = allRowsCache;
  if (
    cached &&
    cached.parts.length === parts.length &&
    cached.parts.every((p, i) => p === parts[i])
  ) {
    return cached.rows;
  }
  const rows = parts.flat();
  allRowsCache = { parts, rows };
  return rows;
}

/**
 * The sitting-member roster: party affiliation and official portraits, neither
 * of which the Clerk's index carries.
 *
 * ~1.4MB and it changes at most a couple of times a session, so it is fetched
 * once per day and shared by every watched subject. A failure here is not
 * fatal: an empty roster costs faces and party filtering, not the feed.
 */
let rosterCache: { roster: Roster; fetchedAt: number } | null = null;
const ROSTER_TTL_MS = 24 * 60 * 60 * 1000;
const ROSTER_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';

const EMPTY_ROSTER: Roster = { all: [], byDistrict: new Map(), bySurname: new Map() };

async function loadRoster(signal?: AbortSignal): Promise<Roster> {
  const cached = rosterCache;
  if (cached && Date.now() - cached.fetchedAt < ROSTER_TTL_MS) return cached.roster;

  try {
    const raw = await getJson<RawLegislator[]>(ROSTER_URL, {
      headers: AGENT,
      signal,
      timeoutMs: 20_000,
    });
    const roster = buildRoster(raw);
    rosterCache = { roster, fetchedAt: Date.now() };
    return roster;
  } catch (err) {
    if (isAbort(err)) throw err;
    console.warn('[congress] roster unavailable — no faces or party filters this session:', err);
    return EMPTY_ROSTER;
  }
}

/**
 * The actor shown on a card.
 *
 * `handle` is always the *watched subject's* handle, never the member's: the
 * feed prunes any signal whose actor handle does not match something on the
 * watchlist, so a party subject's cards must all carry the party handle even
 * though each names a different person. The member's identity lives in
 * `displayName`, `subtitle` and the portrait, which is exactly what those
 * fields are for.
 */
function actorFor(handle: string, row: FilingRow, legislator: Legislator | null): Actor {
  return {
    handle,
    displayName: legislator?.name ?? personName(row.first, row.last),
    // Party is worth repeating on every card even inside a party subject: the
    // unified feed interleaves subjects, so a card has to stand on its own.
    subtitle: [district(row.stateDst), legislator?.party].filter(Boolean).join(' · ') || null,
    avatarUrl: legislator ? photoUrl(legislator.bioguide) : null,
  };
}

/** Same, for the keyed path, which has a name and a ticker but no filing row. */
function actorForTrade(handle: string, trade: ParsedTrade, legislator: Legislator | null): Actor {
  return {
    handle,
    displayName: legislator?.name ?? trade.representative,
    subtitle:
      [
        legislator ? districtOf(legislator) : district(trade.district ?? null),
        legislator?.party,
      ]
        .filter(Boolean)
        .join(' · ') || null,
    avatarUrl: legislator ? photoUrl(legislator.bioguide) : null,
  };
}

/** One member as a search or group-member row. */
function memberResult(
  m: { handle: string; displayName: string; district: string | null; filingCount: number; legislator: Legislator | null },
): SubjectResult {
  return {
    source: 'congress',
    handle: m.handle,
    displayName: m.legislator?.name ?? m.displayName,
    subtitle: [
      m.district,
      m.legislator?.party,
      `${m.filingCount} trade filing${m.filingCount === 1 ? '' : 's'}`,
    ]
      .filter(Boolean)
      .join(' · '),
    avatarUrl: m.legislator ? photoUrl(m.legislator.bioguide) : null,
  };
}

/** `CA-17` for a representative, `CA` for a senator. */
function districtOf(legislator: Legislator): string {
  return legislator.district === null || legislator.district === 0
    ? legislator.state
    : `${legislator.state}-${legislator.district}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Keyed backends
// ───────────────────────────────────────────────────────────────────────────

interface QuiverTrade {
  Representative?: string;
  Ticker?: string;
  Transaction?: string;
  Range?: string;
  Amount?: string | number;
  TransactionDate?: string;
  ReportDate?: string;
  District?: string;
}

interface FmpTrade {
  /** `stable` splits the name; v4 sent a single `representative` string. */
  firstName?: string;
  lastName?: string;
  office?: string;
  district?: string;
  symbol?: string;
  type?: string;
  amount?: string;
  transactionDate?: string;
  disclosureDate?: string;
}

function fromQuiver(t: QuiverTrade): ParsedTrade | null {
  if (!t.Ticker || !t.TransactionDate) return null;
  const amount = typeof t.Amount === 'number' ? t.Amount : rangeMidpoint(t.Range ?? String(t.Amount ?? ''));
  return {
    representative: t.Representative ?? 'Unknown',
    district: t.District ?? null,
    ticker: t.Ticker,
    transaction: t.Transaction ?? 'Purchase',
    range: t.Range ?? null,
    amount,
    transactionDate: t.TransactionDate,
    disclosureDate: t.ReportDate ?? null,
  };
}

function fromFmp(t: FmpTrade): ParsedTrade | null {
  if (!t.symbol || !t.transactionDate) return null;
  const name = [t.firstName, t.lastName].filter(Boolean).join(' ').trim();
  return {
    representative: name || t.office || 'Unknown',
    district: t.district ?? null,
    ticker: t.symbol,
    transaction: t.type ?? 'Purchase',
    range: t.amount ?? null,
    amount: rangeMidpoint(t.amount),
    transactionDate: t.transactionDate,
    disclosureDate: t.disclosureDate ?? null,
  };
}

async function fetchQuiverTrades(signal?: AbortSignal): Promise<ParsedTrade[]> {
  const raw = await getJson<QuiverTrade[]>(`${QUIVER_BASE}/live/congresstrading`, {
    headers: { authorization: `Bearer ${QUIVER_TOKEN}`, ...AGENT },
    signal,
  });
  return raw.map(fromQuiver).filter((t): t is ParsedTrade => t !== null);
}

/**
 * Both chambers in parallel. The Senate call is worth making even though the
 * free window is shallow: it is the one chamber the keyless House Clerk path
 * cannot reach at all.
 */
async function fetchFmpTrades(signal?: AbortSignal): Promise<ParsedTrade[]> {
  const key = encodeURIComponent(FMP_KEY);
  const results = await Promise.allSettled(
    ['house-latest', 'senate-latest'].map((chamber) =>
      getJson<FmpTrade[]>(
        `${FMP_BASE}/${chamber}?page=0&limit=${FMP_PAGE_LIMIT}&apikey=${key}`,
        { headers: AGENT, signal },
      ),
    ),
  );

  const trades: ParsedTrade[] = [];
  let denial: unknown = null;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      trades.push(...r.value.map(fromFmp).filter((t): t is ParsedTrade => t !== null));
    } else if (isAbort(r.reason)) {
      throw r.reason;
    } else if (isAccessDenied(r.reason)) {
      denial = r.reason;
    }
  }

  // Surface a denial only when it cost us everything. One chamber answering
  // still beats latching the whole source off and using the filing index.
  if (trades.length === 0 && denial) throw denial;
  return trades;
}

/**
 * Both keyed feeds are chamber-wide rather than per-member, so without this
 * every watched member would fire an identical request — ten members, ten
 * calls, same payload. Cached for roughly one poll interval, which keeps a
 * whole watchlist inside a free plan's quota.
 */
let tradesCache: { trades: ParsedTrade[]; fetchedAt: number } | null = null;
const TRADES_TTL_MS = 10 * 60 * 1000;

async function fetchKeyedTrades(signal?: AbortSignal): Promise<ParsedTrade[]> {
  const cached = tradesCache;
  if (cached && Date.now() - cached.fetchedAt < TRADES_TTL_MS) return cached.trades;

  const trades = QUIVER_TOKEN ? await fetchQuiverTrades(signal) : await fetchFmpTrades(signal);
  tradesCache = { trades, fetchedAt: Date.now() };
  return trades;
}

// ───────────────────────────────────────────────────────────────────────────
// Provider
// ───────────────────────────────────────────────────────────────────────────

export const CongressProvider: Provider<FilingRow> = {
  id: 'congress',
  label: 'Congress',
  sigil: '',
  color: '#C084FC',
  icon: 'fa6:landmark-dome',
  blurb: 'STOCK Act trade disclosures filed by members of Congress',
  subjectNoun: 'a member or party',
  provenance: 'House Clerk financial disclosures',

  mode(): ProviderMode {
    return (QUIVER_TOKEN || FMP_KEY) && !keyedDenied ? 'live' : 'public';
  },

  async searchSubjects(query: string, signal?: AbortSignal): Promise<SubjectResult[]> {
    const term = query.trim().toLowerCase();

    // Group scopes are offered before anything is typed, so "follow every
    // Republican" is a visible option rather than something you have to know to
    // search for. They cost no network, which is why they answer an empty term.
    const groups: SubjectResult[] = CONGRESS_SCOPES.filter(
      (s) =>
        !term ||
        s.label.toLowerCase().includes(term) ||
        s.subtitle.toLowerCase().includes(term) ||
        s.handle.toLowerCase().includes(term),
    ).map((s) => ({
      source: 'congress' as const,
      handle: s.handle,
      displayName: s.label,
      subtitle: s.subtitle,
      avatarUrl: null,
    }));

    if (!term) return groups;

    // The roster only adds faces and party, so a failure there must not cost us
    // the member list itself.
    const [rows, roster] = await Promise.all([loadAllRows(signal), loadRoster(signal)]);
    const byHandle = new Map(rows.map((r) => [memberHandle(r), r] as const));

    const members = extractMembers(rows)
      .map((m) => {
        const row = byHandle.get(m.handle);
        const legislator = row ? findLegislator(roster, row) : null;
        return { ...m, legislator };
      })
      .filter(
        (m) =>
          m.displayName.toLowerCase().includes(term) ||
          (m.district ?? '').toLowerCase().includes(term) ||
          // Typing a party name finds its members as well as the group above.
          (m.legislator?.party.toLowerCase().includes(term) ?? false),
      )
      .slice(0, 12)
      .map(memberResult);

    return [...groups, ...members].slice(0, 12);
  },

  async groupMembers(handle: string, signal?: AbortSignal): Promise<SubjectResult[] | null> {
    const scope = parseScope(handle);
    if (scope.kind === 'member') return null;

    const [rows, roster] = await Promise.all([loadAllRows(signal), loadRoster(signal)]);
    const reports = rows.filter(
      (r) =>
        r.filingType === PERIODIC_TRANSACTION_REPORT && scopeIncludes(scope, findLegislator(roster, r)),
    );

    // Whoever filed most recently leads: "who in this party is trading right
    // now" is the question, and a busy filer from last spring is not the answer.
    const latest = new Map<string, number>();
    for (const r of reports) {
      const h = memberHandle(r);
      latest.set(h, Math.max(latest.get(h) ?? 0, parseFilingDate(r.filingDate) ?? 0));
    }
    const byHandle = new Map(reports.map((r) => [memberHandle(r), r] as const));

    return extractMembers(reports)
      .sort((a, b) => (latest.get(b.handle) ?? 0) - (latest.get(a.handle) ?? 0))
      .map((m) => {
        const row = byHandle.get(m.handle);
        return memberResult({ ...m, legislator: row ? findLegislator(roster, row) : null });
      });
  },

  async getSignals(handle: string, options: GetSignalsOptions = {}): Promise<Signal[]> {
    const scope = parseScope(handle);
    const [rows, roster] = await Promise.all([loadAllRows(options.signal), loadRoster(options.signal)]);

    const reports = rows.filter((r) => r.filingType === PERIODIC_TRANSACTION_REPORT);
    const mine =
      scope.kind === 'member'
        ? reports.filter((r) => memberHandle(r) === handle)
        : reports.filter((r) => scopeIncludes(scope, findLegislator(roster, r)));

    if (mine.length === 0) return [];

    // With a key, prefer real ticker-level trades over "a filing exists".
    if ((QUIVER_TOKEN || FMP_KEY) && !keyedDenied) {
      try {
        const trades = await fetchKeyedTrades(options.signal);
        const picked = pickTrades(trades, scope, roster, mine[0]!);

        if (picked.length > 0) {
          const signals = picked.map(({ trade, legislator }) =>
            normalizeTrade(trade, actorForTrade(handle, trade, legislator)),
          );
          // `trades` is the full aggregator feed, not just this subject's — so
          // the cluster count can see buyers this subject has nothing to do
          // with, which is exactly the point.
          annotateClusters(signals, picked, trades);
          await annotateTradeContext(signals, picked, trades, options.signal);
          return finish(signals, options);
        }
      } catch (err) {
        if (isAbort(err)) throw err;
        if (isAccessDenied(err)) {
          keyedDenied = true;
          console.warn(
            '[congress] aggregator rejected the congressional trades endpoint — it is not ' +
              'included on this plan. Falling back to the House Clerk index for this session.',
          );
        } else {
          console.warn('[congress] keyed trade fetch failed, using filing index:', err);
        }
      }
    }

    // Keyless: the trades we read from the PDFs ourselves, where we have them.
    const scraped = await loadScraped(options.signal);
    const unlisted = unlistedSet(scraped);
    const picked: { trade: ParsedTrade }[] = [];
    const tradeSignals: Signal[] = [];
    const filingSignals: Signal[] = [];

    for (const row of mine) {
      const legislator = findLegislator(roster, row);
      const actor = actorFor(handle, row, legislator);
      const trades = scrapedTrades(row, scraped);
      if (trades.length === 0) {
        filingSignals.push(normalizeFiling(row, actor, unlisted.has(row.docId)));
        continue;
      }
      for (const trade of trades) {
        picked.push({ trade });
        tradeSignals.push(normalizeTrade(trade, actor));
      }
    }

    if (tradeSignals.length > 0) {
      // Price only what this page will show: a party subject can have hundreds
      // of trades, and each distinct ticker is a price request.
      const page = finish(tradeSignals, options);
      const onPage = new Set(page.map((s) => s.id));
      const pagePicked = picked.filter((p) => onPage.has(tradeSignalId(p.trade)));
      const pageSignals = pagePicked.map((p) => page.find((s) => s.id === tradeSignalId(p.trade))!);
      const everyone = allScraped(scraped, rows);
      annotateClusters(pageSignals, pagePicked, everyone);
      await annotateTradeContext(pageSignals, pagePicked, everyone, options.signal);
    }

    return finish(
      [...tradeSignals, ...filingSignals].filter((s) => s.timestamp > 0),
      options,
    );
  },

  normalizeSignal(raw: FilingRow, actor: Actor): Signal {
    return normalizeFiling(raw, actor);
  },
};

/**
 * Tag each trade with how many other members bought the same name recently.
 *
 * Pure and synchronous — the aggregator feed is already in hand, so this costs
 * no extra request.
 */
function annotateClusters(
  signals: Signal[],
  picked: readonly { trade: ParsedTrade }[],
  allTrades: readonly ParsedTrade[],
): void {
  signals.forEach((signal, i) => {
    const trade = picked[i]?.trade;
    if (!trade || trade.option || !isPurchase(trade.transaction)) return;

    const badge = clusterBadge(clusterBuyers(allTrades, trade.ticker, signal.timestamp));
    if (badge) signal.badges = [...(signal.badges ?? []), badge];
  });
}

/**
 * Add the two price contexts a disclosed trade needs to be read honestly:
 * how much of the move happened before the filing was public, and how the
 * stock has done against the market since.
 *
 * Both are best-effort. A price outage must never cost us the disclosure data,
 * which is the part that is actually authoritative.
 */
async function annotateTradeContext(
  signals: Signal[],
  picked: readonly { trade: ParsedTrade }[],
  allTrades: readonly ParsedTrade[],
  abortSignal?: AbortSignal,
): Promise<void> {
  // Options are left unpriced: the stock's move says nothing reliable about
  // an option whose strike, expiry and side were never read.
  const symbols = [
    ...new Set(
      signals
        .filter((_, i) => !picked[i]?.trade.option)
        .map((s) => s.ticker)
        .filter((t): t is string => !!t),
    ),
  ];
  if (symbols.length === 0) return;

  // Cap the fan-out: a party subject can name dozens of tickers, and each is a
  // price request. The newest signals are the ones on screen.
  const budget = symbols.slice(0, MAX_PRICED_TICKERS);
  const series = new Map<string, Series>();

  const loaded = await Promise.allSettled(
    [...budget, BENCHMARK_SYMBOL].map(async (symbol) => {
      series.set(symbol, await loadSeries(symbol, abortSignal));
    }),
  );
  for (const r of loaded) {
    if (r.status === 'rejected' && isAbort(r.reason)) throw r.reason;
  }

  const benchmark = series.get(BENCHMARK_SYMBOL) ?? null;

  signals.forEach((signal, i) => {
    const trade = picked[i]?.trade;
    const symbol = signal.ticker;
    if (!trade || trade.option || !symbol) return;
    const stock = series.get(symbol);
    if (!stock) return;

    // What the public missed: transaction date -> disclosure date.
    const tradedAt = Date.parse(trade.transactionDate);
    if (Number.isFinite(tradedAt) && signal.timestamp > tradedAt) {
      const missed = computeReactionBetween(stock, tradedAt, signal.timestamp);
      // Only worth saying when the delay actually cost something material.
      if (missed && Math.abs(missed.changePct) >= 1) {
        signal.badges = [...(signal.badges ?? []), preDisclosureBadge(missed)];
      }
    }

    // What has happened since it became public, against the market.
    const excess =
      benchmark && symbol !== BENCHMARK_SYMBOL
        ? computeExcessReaction(stock, benchmark, signal.timestamp, BENCHMARK_SYMBOL)
        : null;
    if (excess) {
      signal.badges = [...(signal.badges ?? []), excessBadge(excess)];
      // The numbers as well as the chip — the trades table ranks on these.
      signal.reaction = {
        changePct: excess.changePct,
        benchmarkPct: excess.benchmarkPct,
        excessPct: excess.excessPct,
        sessions: excess.sessions,
        benchmarkSymbol: excess.benchmarkSymbol,
      };
    } else {
      const raw = computeReactionBetween(stock, signal.timestamp);
      if (raw) signal.reaction = { changePct: raw.changePct, sessions: raw.sessions };
    }
  });

  if (benchmark) annotateRoundTrips(signals, allTrades, series, benchmark);
}

/**
 * Pair each member's disclosed buys with their own later disclosed sells, and
 * report the round trip against the market.
 *
 * The holding period is the member's own. Measuring these over an invented
 * fixed window is what turns a set of individually winning trades into a losing
 * portfolio — the horizon does the work, not the picks (see `positions.ts`).
 *
 * Pairing runs over the whole aggregator feed rather than this subject's page,
 * because the buy a visible sell closes is usually months further back.
 */
function annotateRoundTrips(
  signals: Signal[],
  allTrades: readonly ParsedTrade[],
  series: Map<string, Series>,
  benchmark: Series,
): void {
  const events: TradeEvent[] = allTrades
    .map((trade) => ({
      // Per member: one member's sale cannot close another's purchase.
      actorKey: trade.representative,
      ticker: trade.ticker,
      side: (isPurchase(trade.transaction) ? 'buy' : 'sell') as TradeEvent['side'],
      at: tradeActionableAt(trade),
      signalId: tradeSignalId(trade),
    }))
    .filter((e) => Number.isFinite(e.at));

  if (events.length === 0) return;

  const byId = new Map(signals.map((s) => [s.id, s]));

  for (const position of pairPositions(events)) {
    // Closed round trips only — an open one would restate the excess badge
    // already sitting on its opening card.
    if (!position.closeSignalId) continue;

    const target = byId.get(position.closeSignalId);
    if (!target) continue;

    const stock = series.get(position.ticker);
    if (!stock) continue;

    const outcome = scorePosition(position, stock, benchmark);
    if (outcome) {
      target.badges = [...(target.badges ?? []), positionBadge(outcome, BENCHMARK_SYMBOL)];
    }
  }
}

/**
 * Which aggregator trades belong to this subject, each paired with the member
 * it names so the card can carry their face.
 *
 * A member subject still matches on the name text rather than the roster: the
 * subject's handle came from the Clerk index, so name matching is what has
 * always tied the two feeds together, and it keeps working for a member the
 * roster failed to resolve.
 */
function pickTrades(
  trades: readonly ParsedTrade[],
  scope: CongressScope,
  roster: Roster,
  sample: FilingRow,
): { trade: ParsedTrade; legislator: Legislator | null }[] {
  if (scope.kind === 'member') {
    const name = personName(sample.first, sample.last).toLowerCase();
    return trades
      .filter((t) => {
        const rep = t.representative.toLowerCase();
        // Aggregators format names inconsistently ("Nancy Pelosi", "Pelosi,
        // Nancy", "Hon. Nancy Pelosi"), so match on surname plus forename.
        return rep.includes(last(name)) && rep.includes(firstWord(name));
      })
      .map((trade) => ({ trade, legislator: findByName(roster, trade.representative) }));
  }

  return trades
    .map((trade) => ({ trade, legislator: findByName(roster, trade.representative) }))
    .filter(({ legislator }) => scopeIncludes(scope, legislator));
}

/** Shared tail: apply `since`, sort newest first, apply `limit`. */
function finish(signals: Signal[], options: GetSignalsOptions): Signal[] {
  const since = options.since;
  const filtered = since === undefined ? signals : signals.filter((s) => s.timestamp > since);
  return filtered.sort((a, b) => b.timestamp - a.timestamp).slice(0, options.limit ?? 15);
}

function last(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? name;
}

function firstWord(name: string): string {
  return name.split(/\s+/).filter(Boolean)[0] ?? name;
}

export { parseFilingDate };
