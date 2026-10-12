import { getJson, getText, isAbort } from '@/lib/http';
import { sameTicker, type FundHolder } from '@/lib/ticker';
import type {
  Actor,
  GetSignalsOptions,
  Provider,
  ProviderMode,
  Signal,
  SubjectProfile,
  SubjectResult,
} from '@/providers/types';
import {
  ARCHIVES_BASE,
  SEC_HEADERS,
  SUBMISSIONS_BASE,
  enqueue,
  loadTickerMap,
  padCik,
} from '@/providers/sec';
import { tag } from '../../lib/xml.ts';
import { logoUrl, siteIconUrl } from '@/providers/logos';
import { orderLinks, socialLink } from '@/lib/social';
import { loadSeries } from '@/providers/stocks/StocksProvider';
import type { Series } from '@/providers/stocks/events';
import { measureMoves, movesToMeasure } from './measure';
import { fundSignal, noticeSignal, type FilingInput } from './normalize';
import {
  buildTickerIndex,
  diffHoldings,
  fundName,
  parseInfoTable,
  tickerForIssuer,
  valueScaleFor,
  withWeights,
  type Holding,
  type TickerMatch,
} from './thirteenF';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅  NO API KEY REQUIRED — fully public SEC data
 * ═══════════════════════════════════════════════════════════════════════════
 * What the big funds hold, from their quarterly Form 13F on EDGAR. A watched
 * subject is a filer, by CIK; each signal is one quarter's filing, with what
 * changed since the one before.
 *
 * Requests go through the shared SEC queue in `@/providers/sec`, so this and
 * Insiders together stay inside SEC's rate limit.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Quarters the feed shows per fund. Each costs two requests, once — filings never change. */
const FEED_QUARTERS = 4;
/** Quarters the fund's own page asks for, for streaks and the filing list. */
const PAGE_QUARTERS = 8;

/**
 * Above this the information table is not read on the phone.
 *
 * A quant shop's table runs to thousands of lines and several megabytes;
 * parsing that on a phone on every refresh is not worth it for a card. The
 * card still reports the total and the count, from the cover page.
 */
const MAX_TABLE_BYTES = 3_000_000;

/**
 * Funds people look up by name, to offer before anything is typed and to find
 * by their manager's name. CIKs checked against EDGAR, October 2026.
 *
 * `logo` is the listed parent's logo where there is one, else the firm's own
 * site icon — only for sites checked by eye to serve a real mark rather than a
 * blank globe, which is why some funds have none and keep their glyph.
 *
 * `site` and `x` feed the fund's profile card. `x.firm` is the firm's own
 * account and `x.manager` the manager's personal one — often the louder of the
 * two, and where a new position tends to be talked up first. Only accounts
 * checked by hand to be the real ones are listed.
 */
export const KNOWN_FUNDS: {
  cik: string;
  name: string;
  who: string;
  logo?: string | null;
  site?: string;
  x?: { firm?: string; manager?: string };
}[] = [
  { cik: '1067983', name: 'Berkshire Hathaway', who: 'Warren Buffett', logo: logoUrl('BRK.B'), site: 'berkshirehathaway.com' },
  { cik: '2026053', name: 'Pershing Square Inc.', who: 'Bill Ackman', logo: siteIconUrl('pershingsquareholdings.com'), site: 'pershingsquareholdings.com', x: { manager: 'BillAckman' } },
  { cik: '1336528', name: 'Pershing Square Capital Management', who: 'Bill Ackman', logo: siteIconUrl('pershingsquareholdings.com'), site: 'pershingsquareholdings.com', x: { manager: 'BillAckman' } },
  { cik: '1350694', name: 'Bridgewater Associates', who: 'Ray Dalio', logo: siteIconUrl('bridgewater.com'), site: 'bridgewater.com', x: { manager: 'RayDalio' } },
  { cik: '1029160', name: 'Soros Fund Management', who: 'George Soros' },
  { cik: '1536411', name: 'Duquesne Family Office', who: 'Stanley Druckenmiller', logo: siteIconUrl('duquesne.com'), site: 'duquesne.com' },
  { cik: '1656456', name: 'Appaloosa', who: 'David Tepper' },
  { cik: '1040273', name: 'Third Point', who: 'Dan Loeb' },
  { cik: '921669', name: 'Icahn Carl C', who: 'Carl Icahn', x: { manager: 'Carl_C_Icahn' } },
  { cik: '1791786', name: 'Elliott Investment Management', who: 'Paul Singer', logo: siteIconUrl('elliottmgmt.com'), site: 'elliottmgmt.com' },
  { cik: '1061768', name: 'Baupost Group', who: 'Seth Klarman' },
  { cik: '1709323', name: 'Himalaya Capital Management', who: 'Li Lu' },
  { cik: '1112520', name: 'Akre Capital Management', who: 'Chuck Akre', logo: siteIconUrl('akrefund.com'), site: 'akrefund.com' },
  { cik: '1569205', name: 'Fundsmith', who: 'Terry Smith', logo: siteIconUrl('fundsmith.co.uk'), site: 'fundsmith.co.uk' },
  { cik: '1697748', name: 'ARK Investment Management', who: 'Cathie Wood', logo: siteIconUrl('ark-invest.com'), site: 'ark-invest.com', x: { firm: 'ARKInvest', manager: 'CathieDWood' } },
  { cik: '1167483', name: 'Tiger Global Management', who: 'Chase Coleman', logo: siteIconUrl('tigerglobal.com'), site: 'tigerglobal.com' },
  { cik: '1135730', name: 'Coatue Management', who: 'Philippe Laffont', logo: siteIconUrl('coatue.com'), site: 'coatue.com' },
  { cik: '1061165', name: 'Lone Pine Capital', who: 'Stephen Mandel', logo: siteIconUrl('lonepinecapital.com'), site: 'lonepinecapital.com' },
  { cik: '1103804', name: 'Viking Global Investors', who: 'Andreas Halvorsen', logo: siteIconUrl('vikingglobal.com'), site: 'vikingglobal.com' },
  { cik: '1037389', name: 'Renaissance Technologies', who: 'Jim Simons’ firm', logo: siteIconUrl('rentec.com'), site: 'rentec.com' },
  { cik: '1166559', name: 'Gates Foundation Trust', who: 'Gates Foundation', logo: siteIconUrl('gatesfoundation.org'), site: 'gatesfoundation.org' },
];

export function cikOf(handle: string): string {
  return String(Number(handle.replace(/\D/g, '')) || handle);
}

// ───────────────────────────────────────────────────────────────────────────
// Filings
// ───────────────────────────────────────────────────────────────────────────

interface SubmissionsResponse {
  name?: string;
  filings?: {
    recent?: {
      form?: string[];
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
    };
  };
}

interface FilingRef extends FilingInput {
  cik: string;
}

/**
 * The fund's 13F holdings reports and notices, newest first.
 *
 * Amendments (`13F-HR/A`) are left out: one may restate the whole table or add
 * a handful of lines, and the submissions list does not say which, so folding
 * them in risks double-counting. The original filing stands.
 */
async function thirteenFs(cik: string, signal?: AbortSignal): Promise<{ name: string; refs: FilingRef[] }> {
  const res = await enqueue(() =>
    getJson<SubmissionsResponse>(`${SUBMISSIONS_BASE}/CIK${padCik(cik)}.json`, {
      headers: SEC_HEADERS,
      signal,
      timeoutMs: 25_000,
    }),
  );
  const recent = res.filings?.recent;
  const refs: FilingRef[] = [];
  (recent?.form ?? []).forEach((form, i) => {
    if (form !== '13F-HR' && form !== '13F-NT') return;
    const accessionNumber = recent?.accessionNumber?.[i];
    const filingDate = recent?.filingDate?.[i];
    const period = recent?.reportDate?.[i];
    if (!accessionNumber || !filingDate || !period) return;
    refs.push({
      cik,
      accessionNumber,
      form,
      filingDate,
      period,
      url: `${ARCHIVES_BASE}/${cik}/${accessionNumber.replace(/-/g, '')}/${accessionNumber}-index.html`,
    });
  });
  return { name: res.name ?? '', refs };
}

interface Table {
  holdings: Holding[] | null;
  /** From the cover page, when the table was too large to read. */
  total?: number;
  count?: number;
}

/**
 * Filings never change once made, so each one is fetched once a session —
 * a poll costs a single request for the submissions list.
 */
const tables = new Map<string, Promise<Table>>();

function tableFor(ref: FilingRef, signal?: AbortSignal): Promise<Table> {
  const cached = tables.get(ref.accessionNumber);
  if (cached) return cached;
  const work = loadTable(ref, signal).catch((err) => {
    tables.delete(ref.accessionNumber); // let the next refresh retry
    throw err;
  });
  tables.set(ref.accessionNumber, work);
  return work;
}

async function loadTable(ref: FilingRef, signal?: AbortSignal): Promise<Table> {
  const folder = `${ARCHIVES_BASE}/${ref.cik}/${ref.accessionNumber.replace(/-/g, '')}`;
  // The table's file name varies by filer (`infotable.xml`, `56757.xml`), so
  // the folder listing says which file it is, and how big.
  const index = await enqueue(() =>
    getJson<{ directory?: { item?: { name: string; size?: string | number }[] } }>(`${folder}/index.json`, {
      headers: SEC_HEADERS,
      signal,
    }),
  );
  const items = index.directory?.item ?? [];
  const table = items.find((i) => /\.xml$/i.test(i.name) && !/primary_doc/i.test(i.name));
  if (!table) return { holdings: [] };

  const scale = valueScaleFor(ref.filingDate);
  if (Number(table.size) > MAX_TABLE_BYTES) {
    const cover = await enqueue(() =>
      getText(`${folder}/primary_doc.xml`, { headers: SEC_HEADERS, signal }),
    );
    const plain = cover.replace(/<(\/?)[\w.-]+:/g, '<$1');
    return {
      holdings: null,
      total: Number(tag('tableValueTotal', plain) ?? 0) * scale,
      count: Number(tag('tableEntryTotal', plain) ?? 0),
    };
  }

  const xml = await enqueue(() =>
    getText(`${folder}/${table.name}`, { headers: SEC_HEADERS, signal, timeoutMs: 25_000 }),
  );
  return { holdings: parseInfoTable(xml, scale) };
}

let tickerIndex: Map<string, TickerMatch> | null = null;

/** Best effort: without SEC's ticker list, positions show by name alone. */
async function tickers(signal?: AbortSignal): Promise<(h: Holding) => string | null> {
  if (!tickerIndex) {
    try {
      tickerIndex = buildTickerIndex(await loadTickerMap(signal));
    } catch (err) {
      if (isAbort(err)) throw err;
      return () => null;
    }
  }
  const index = tickerIndex;
  return (h) => tickerForIssuer(index, h.issuer, h.classTitle);
}

// ───────────────────────────────────────────────────────────────────────────
// Search
// ───────────────────────────────────────────────────────────────────────────

interface EntityHit {
  _id: string;
  _source?: { entity?: string };
}

/**
 * Any SEC filer by name, from EDGAR's own type-ahead.
 *
 * It knows every registrant, not only 13F filers, so a hit may turn out to
 * have no holdings reports; the fund's page says so if it does.
 */
async function edgarEntities(term: string, signal?: AbortSignal): Promise<SubjectResult[]> {
  const res = await enqueue(() =>
    getJson<{ hits?: { hits?: EntityHit[] } }>(
      `https://efts.sec.gov/LATEST/search-index?keysTyped=${encodeURIComponent(term)}`,
      { headers: SEC_HEADERS, signal },
    ),
  );
  return (res.hits?.hits ?? []).flatMap((hit) => {
    const raw = hit._source?.entity?.replace(/\s*\([^)]*\)\s*$/, '');
    if (!raw || !/^\d+$/.test(hit._id)) return [];
    return [
      {
        source: 'funds' as const,
        handle: cikOf(hit._id),
        displayName: fundName(raw),
        subtitle: `SEC filer · CIK ${padCik(hit._id)}`,
        avatarUrl: null,
      },
    ];
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Provider
// ───────────────────────────────────────────────────────────────────────────

export const FundsProvider: Provider<never> = {
  id: 'funds',
  label: 'Funds',
  sigil: '',
  color: '#6366F1',
  icon: 'pie-chart-outline',
  blurb: 'Quarterly 13F holdings — what the big funds own, and what they changed',
  subjectNoun: 'a fund',
  provenance: 'SEC EDGAR Form 13F, no key required',

  subjectAvatarUrl(handle: string): string | null {
    const cik = cikOf(handle);
    return KNOWN_FUNDS.find((f) => f.cik === cik)?.logo ?? null;
  },

  mode(): ProviderMode {
    return 'public';
  },

  async profile(handle: string): Promise<SubjectProfile | null> {
    const fund = KNOWN_FUNDS.find((f) => f.cik === cikOf(handle));
    if (!fund) return null;
    const links = orderLinks([
      socialLink('website', fund.site),
      socialLink('x', fund.x?.firm),
      socialLink('x', fund.x?.manager, fund.who),
    ]);
    return {
      facts: [`Managed by ${fund.who}`, `SEC filer, CIK ${padCik(fund.cik)}`],
      links,
      provenance: 'Official site and accounts, listed by Ripple',
    };
  },

  async searchSubjects(query: string, signal?: AbortSignal): Promise<SubjectResult[]> {
    const term = query.trim().toLowerCase();
    const known = KNOWN_FUNDS.filter(
      (f) => !term || f.name.toLowerCase().includes(term) || f.who.toLowerCase().includes(term),
    ).map((f) => ({
      source: 'funds' as const,
      handle: f.cik,
      displayName: f.name,
      subtitle: `${f.who} · CIK ${padCik(f.cik)}`,
      avatarUrl: f.logo ?? null,
    }));
    if (!term) return known;

    const byCik = /^\d{1,10}$/.test(term)
      ? [
          {
            source: 'funds' as const,
            handle: cikOf(term),
            displayName: `CIK ${padCik(term)}`,
            subtitle: 'Look up a filer by its SEC number',
            avatarUrl: null,
          },
        ]
      : [];

    let others: SubjectResult[] = [];
    if (term.length >= 3 && !byCik.length) {
      try {
        others = await edgarEntities(term, signal);
      } catch (err) {
        if (isAbort(err)) throw err;
      }
    }

    const seen = new Set(known.map((k) => k.handle));
    return [...byCik, ...known, ...others.filter((o) => !seen.has(o.handle))].slice(0, 12);
  },

  async getSignals(handle: string, options: GetSignalsOptions = {}): Promise<Signal[]> {
    const cik = cikOf(handle);
    const quarters = (options.limit ?? 15) >= 20 ? PAGE_QUARTERS : FEED_QUARTERS;
    const { name, refs } = await thirteenFs(cik, options.signal);

    const known = KNOWN_FUNDS.find((f) => f.cik === cik);
    const actor: Actor = {
      handle: cik,
      displayName: known?.name ?? fundName(name || `CIK ${padCik(cik)}`),
      subtitle: `${known ? `${known.who} · ` : ''}CIK ${padCik(cik)}`,
      avatarUrl: known?.logo ?? null,
    };

    const reports = refs.filter((r) => r.form === '13F-HR');
    const shown = reports.slice(0, quarters);
    const tickerFor = await tickers(options.signal);

    const results = await Promise.allSettled(
      shown.map(async (ref, i) => {
        const current = await tableFor(ref, options.signal);
        const priorRef = reports[i + 1];
        const prior = priorRef ? await tableFor(priorRef, options.signal) : null;

        if (!current.holdings) {
          return fundSignal(ref, actor, {
            totalValue: current.total ?? 0,
            priorValue: prior?.holdings ? sum(prior.holdings) : (prior?.total ?? null),
            positions: [],
            moves: [],
            truncated: true,
            positionCount: current.count,
          });
        }

        return fundSignal(ref, actor, {
          totalValue: sum(current.holdings),
          priorValue: prior ? (prior.holdings ? sum(prior.holdings) : (prior.total ?? null)) : null,
          positions: withWeights(current.holdings, tickerFor),
          moves: prior?.holdings ? diffHoldings(prior.holdings, current.holdings, tickerFor) : [],
          truncated: false,
        });
      }),
    );

    const out: Signal[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') out.push(r.value);
      else if (isAbort(r.reason)) throw r.reason;
      // One unreadable filing should not cost the others.
    }

    // Notices inside the same span of quarters, so a fund that hands its
    // reporting to another manager does not just fall silent.
    const oldest = shown[shown.length - 1]?.filingDate ?? '';
    for (const ref of refs) {
      if (ref.form === '13F-NT' && ref.filingDate >= oldest) out.push(noticeSignal(ref, actor));
    }

    let sorted = out.sort((a, b) => b.timestamp - a.timestamp);
    const newest = sorted.find((x) => x.holdings?.form === '13F-HR');
    if (newest) await measureNewest(newest, options.signal);
    if (options.since !== undefined) {
      const since = options.since;
      sorted = sorted.filter((s) => s.timestamp > since);
    }
    return sorted;
  },

  normalizeSignal(): Signal {
    throw new Error('Funds signals are built from whole filings, not single rows');
  },
};

/**
 * Each fund's newest holdings report, briefly. The ticker page asks about
 * twenty funds at a time, and opening a second ticker should not repeat the
 * twenty submissions downloads the first one made.
 */
const newestReports = new Map<string, { at: number; name: string; ref: FilingRef | null }>();
const NEWEST_TTL_MS = 60 * 60 * 1000;

async function newestReport(cik: string, signal?: AbortSignal): Promise<{ name: string; ref: FilingRef | null }> {
  const cached = newestReports.get(cik);
  if (cached && Date.now() - cached.at < NEWEST_TTL_MS) return cached;
  const { name, refs } = await thirteenFs(cik, signal);
  const entry = { at: Date.now(), name, ref: refs.find((r) => r.form === '13F-HR') ?? null };
  newestReports.set(cik, entry);
  return entry;
}

/** What a fund's newest 13F says about one ticker. */
export type TickerHolding =
  | ({ readable: true } & FundHolder)
  /** The table was too large to read on a phone, so it is unknown. */
  | { readable: false; cik: string; name: string };

/**
 * Whether a fund's newest 13F lists a ticker, and how much of it.
 *
 * For the ticker page. Weights are against the whole filing, not the capped
 * list a feed card keeps — a small stake is still a stake. Resolves null for a
 * filer with no holdings report on file.
 */
export async function tickerHolding(
  handle: string,
  symbol: string,
  signal?: AbortSignal,
): Promise<TickerHolding | null> {
  const cik = cikOf(handle);
  const { name, ref } = await newestReport(cik, signal);
  if (!ref) return null;

  const known = KNOWN_FUNDS.find((f) => f.cik === cik);
  const display = known?.name ?? fundName(name || `CIK ${padCik(cik)}`);
  const table = await tableFor(ref, signal);
  if (!table.holdings) return { readable: false, cik, name: display };

  const tickerFor = await tickers(signal);
  return {
    readable: true,
    cik,
    name: display,
    logo: known?.logo ?? null,
    period: ref.period,
    positions: withWeights(table.holdings, tickerFor).filter((p) => sameTicker(p.ticker, symbol)),
  };
}

const BENCHMARK_SYMBOL = 'SPY';

/**
 * Price the newest filing's biggest moves from the day it went public — the
 * "did it matter?" the rest of the app asks of every trade.
 *
 * Only the newest: price history reaches back three months, which is about
 * one filing. Strictly a bonus: a price outage must never cost the filing.
 */
async function measureNewest(signal: Signal, abort?: AbortSignal): Promise<void> {
  const holdings = signal.holdings;
  if (!holdings) return;
  const tickersWanted = [...new Set(movesToMeasure(holdings.moves).map((m) => m.ticker!))];
  if (tickersWanted.length === 0) return;

  const series = new Map<string, Series>();
  let benchmark: Series | null = null;
  const loaded = await Promise.allSettled([
    loadSeries(BENCHMARK_SYMBOL, abort).then((s) => {
      benchmark = s;
    }),
    ...tickersWanted.map((t) => loadSeries(t, abort).then((s) => void series.set(t, s))),
  ]);
  for (const r of loaded) {
    if (r.status === 'rejected' && isAbort(r.reason)) throw r.reason;
  }
  holdings.moves = measureMoves(holdings.moves, signal.timestamp, (t) => series.get(t), benchmark, BENCHMARK_SYMBOL);
}

function sum(holdings: readonly Holding[]): number {
  return holdings.reduce((s, h) => s + h.value, 0);
}
