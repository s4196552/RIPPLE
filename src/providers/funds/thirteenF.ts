import type { FundFiling, FundMove, FundMoveKind, FundPosition } from '@/providers/types';
import { tag, tagAll } from '../../lib/xml.ts';

/**
 * Reading SEC Form 13F: a fund's US stock holdings at the end of each quarter.
 *
 * Managers with over $100M in US equities file one within 45 days of every
 * quarter's end. The holdings sit in an "information table" XML document, one
 * `<infoTable>` row per line item. That is all a 13F says — long US-listed
 * positions at one instant — so "bought" and "sold" here always mean "held
 * more or fewer shares than last quarter", never a dated trade.
 *
 * Pure apart from the tiny XML reader, so it is unit-tested against real
 * filings in `test/fixtures`.
 */

/** One position as filed, after summing its duplicate rows. */
export interface Holding {
  /** CUSIP plus option side: the identity a position keeps between filings. */
  key: string;
  issuer: string;
  classTitle: string;
  cusip: string;
  putCall: 'PUT' | 'CALL' | null;
  /** Dollars. */
  value: number;
  shares: number;
}

/**
 * The multiplier that turns a filing's `<value>` into dollars.
 *
 * SEC changed the unit: filings made on or after 3 January 2023 report whole
 * dollars, earlier ones report thousands. Nothing in the document itself says
 * which — the cover page's total uses the same unit — so the filing date
 * decides.
 */
export function valueScaleFor(filingDate: string): 1 | 1000 {
  return filingDate >= '2023-01-03' ? 1 : 1000;
}

/**
 * Every position in an information table, rows for the same security summed.
 *
 * Large managers split one holding across several rows — one per sub-manager
 * or voting arrangement (Berkshire files Ally Financial three times) — so a
 * position is the sum of its rows. Options are kept apart from the stock: a
 * put on a company is not more of the company.
 *
 * Namespace prefixes are stripped first: most filers write `<infoTable>`, some
 * `<ns1:infoTable>`, and the reader matches tag names exactly.
 */
export function parseInfoTable(xml: string, scale: 1 | 1000 = 1): Holding[] {
  const plain = xml.replace(/<(\/?)[\w.-]+:/g, '<$1');
  const byKey = new Map<string, Holding>();

  for (const row of tagAll('infoTable', plain)) {
    const cusip = (tag('cusip', row) ?? '').toUpperCase();
    if (!cusip) continue;
    const rawPutCall = (tag('putCall', row) ?? '').toUpperCase();
    const putCall = rawPutCall === 'PUT' || rawPutCall === 'CALL' ? rawPutCall : null;
    const value = Number((tag('value', row) ?? '').replace(/,/g, '')) * scale;
    const shares = Number((tag('sshPrnamt', row) ?? '').replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;

    const key = putCall ? `${cusip}:${putCall}` : cusip;
    const existing = byKey.get(key);
    if (existing) {
      existing.value += value;
      existing.shares += Number.isFinite(shares) ? shares : 0;
    } else {
      byKey.set(key, {
        key,
        issuer: tag('nameOfIssuer', row) ?? cusip,
        classTitle: tag('titleOfClass', row) ?? '',
        cusip,
        putCall,
        value,
        shares: Number.isFinite(shares) ? shares : 0,
      });
    }
  }

  return [...byKey.values()].sort((a, b) => b.value - a.value);
}

/** `Q1 2026` for a quarter ending `2026-03-31`. */
export function quarterLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return `Q${Math.ceil(month / 3)} ${year}`;
}

/** Days from the quarter's end to the filing. SEC allows 45. */
export function daysToFile(period: string, filingDate: string): number | null {
  const end = Date.parse(`${period}T00:00:00Z`);
  const filed = Date.parse(`${filingDate}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(filed)) return null;
  return Math.round((filed - end) / 86_400_000);
}

export const FILING_LIMIT_DAYS = 45;

/** Positions with their share of the total, largest first. */
export function withWeights(
  holdings: readonly Holding[],
  tickerFor: (h: Holding) => string | null = () => null,
): FundPosition[] {
  const total = holdings.reduce((sum, h) => sum + h.value, 0);
  return holdings.map((h) => ({
    issuer: h.issuer,
    ticker: tickerFor(h),
    classTitle: h.classTitle,
    cusip: h.cusip,
    putCall: h.putCall,
    value: h.value,
    shares: h.shares,
    weight: total > 0 ? h.value / total : 0,
  }));
}

/**
 * What changed between two filings, position by position, biggest dollar
 * move first.
 *
 * The verdict follows the shares, because the shares are the manager's
 * decision and the dollars are partly the market's: a stake trimmed into a
 * rising price loses shares and gains value. The dollar change still travels
 * with every move, so a reader sees both.
 */
export function diffHoldings(
  prior: readonly Holding[],
  current: readonly Holding[],
  tickerFor: (h: Holding) => string | null = () => null,
): FundMove[] {
  const before = new Map(prior.map((h) => [h.key, h]));
  const after = new Map(current.map((h) => [h.key, h]));
  const total = current.reduce((sum, h) => sum + h.value, 0);
  const moves: FundMove[] = [];

  for (const h of current) {
    const was = before.get(h.key);
    const kind: FundMoveKind = !was
      ? 'new'
      : h.shares > was.shares
        ? 'added'
        : h.shares < was.shares
          ? 'trimmed'
          : 'unchanged';
    moves.push({
      issuer: h.issuer,
      ticker: tickerFor(h),
      classTitle: h.classTitle,
      cusip: h.cusip,
      putCall: h.putCall,
      value: h.value,
      shares: h.shares,
      weight: total > 0 ? h.value / total : 0,
      kind,
      valueBefore: was?.value ?? 0,
      sharesBefore: was?.shares ?? 0,
      sharesChangePct: was && was.shares > 0 ? ((h.shares - was.shares) / was.shares) * 100 : null,
    });
  }

  for (const was of prior) {
    if (after.has(was.key)) continue;
    moves.push({
      issuer: was.issuer,
      ticker: tickerFor(was),
      classTitle: was.classTitle,
      cusip: was.cusip,
      putCall: was.putCall,
      value: 0,
      shares: 0,
      weight: 0,
      kind: 'exited',
      valueBefore: was.value,
      sharesBefore: was.shares,
      sharesChangePct: -100,
    });
  }

  return moves.sort(
    (a, b) => Math.abs(b.value - b.valueBefore) - Math.abs(a.value - a.valueBefore),
  );
}

/**
 * How concentrated a book is.
 *
 * `hhi` is the Herfindahl–Hirschman index on percentage weights: the sum of
 * each position's squared percentage. An index fund holding hundreds of names
 * scores in the tens; a book of ten equal positions scores 1,000.
 */
export function concentration(positions: readonly { weight: number }[]): {
  top5: number;
  top10: number;
  hhi: number;
} {
  const weights = positions.map((p) => p.weight).sort((a, b) => b - a);
  const sum = (n: number) => weights.slice(0, n).reduce((s, w) => s + w, 0);
  return {
    top5: sum(5),
    top10: sum(10),
    hhi: Math.round(weights.reduce((s, w) => s + (w * 100) ** 2, 0)),
  };
}

/** The concentration in a few plain words. */
export function concentrationVerdict(hhi: number): string {
  if (hhi >= 1000) return 'A conviction book';
  if (hhi >= 400) return 'A concentrated book';
  if (hhi >= 100) return 'A typical hedge-fund spread';
  return 'Spread like an index fund';
}

// ───────────────────────────────────────────────────────────────────────────
// Issuer name → ticker
// ───────────────────────────────────────────────────────────────────────────

/**
 * Words that differ between how a 13F abbreviates a company and how SEC's
 * ticker list spells it, mapped to one form: `HLDGS` and `Holdings` both
 * become `HLDGS`.
 */
const CANONICAL: Record<string, string> = {
  HOLDINGS: 'HLDGS',
  HLDG: 'HLDGS',
  INTERNATIONAL: 'INTL',
  INTERNATL: 'INTL',
  TECHNOLOGIES: 'TECH',
  TECHNOLOGY: 'TECH',
  TECHNOLOGS: 'TECH',
  FINANCIAL: 'FINL',
  FINANCL: 'FINL',
  GROUP: 'GRP',
  COMPANIES: 'COS',
  MANAGEMENT: 'MGMT',
  PLATFORMS: 'PLATFORMS',
  WORLDWIDE: 'WORLDWIDE',
  SYSTEMS: 'SYS',
  PHARMACEUTICALS: 'PHARMACEUTICALS',
  ENTERTAINMENT: 'ENTMT',
  COMMUNICATIONS: 'COMMUNICATIONS',
  AMERICA: 'AMER',
  AMERICAN: 'AMERN',
  RESOURCES: 'RES',
  PROPERTIES: 'PPTYS',
  INDUSTRIES: 'INDS',
  LABORATORIES: 'LABS',
  SERVICES: 'SVCS',
  ENERGY: 'ENERGY',
};

/** Corporate-form words, dropped entirely: they say nothing about which company. */
const DROP = new Set([
  'INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED',
  'PLC', 'LP', 'LLC', 'NV', 'SA', 'AG', 'SE', 'THE', 'NEW', 'DEL', 'COM', 'CL',
  'CLASS', 'A', 'B', 'C', 'ORD', 'SHS',
]);

/**
 * A company name reduced to the words that identify it.
 *
 * `RESTAURANT BRANDS INTL INC` and `Restaurant Brands International Inc.`
 * both become `RESTAURANT BRANDS INTL`.
 */
export function normalizeIssuer(name: string): string {
  return name
    .toUpperCase()
    // EDGAR's country or state tag on a registrant's name: `/CN`, `/DE/`.
    .replace(/\s*\/[A-Z]{2,3}\/?\s*$/, '')
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !DROP.has(w))
    .map((w) => CANONICAL[w] ?? w)
    .join(' ');
}

export interface TickerListEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

/** A company's tickers, primary first, under its normalised name. */
export interface TickerMatch {
  /** The first ticker SEC lists for the company: its main listing. */
  primary: string;
  /** More than one ticker — share classes, preferreds, warrants. */
  several: boolean;
}

/**
 * A lookup from normalised company name to ticker, built once from SEC's
 * ticker list.
 *
 * SEC lists a company's main ticker first and its share classes, notes and
 * warrants after (Brookfield is BN, then BNH and BNJ). Two different companies
 * that normalise to the same name are dropped: a wrong ticker is worse than
 * none, and the issuer's name is always shown either way.
 */
export function buildTickerIndex(entries: readonly TickerListEntry[]): Map<string, TickerMatch> {
  const byCik = new Map<number, { title: string; tickers: string[] }>();
  for (const e of entries) {
    const found = byCik.get(e.cik_str);
    if (found) found.tickers.push(e.ticker.toUpperCase());
    else byCik.set(e.cik_str, { title: e.title, tickers: [e.ticker.toUpperCase()] });
  }

  const byName = new Map<string, TickerMatch>();
  const clash = new Set<string>();
  for (const { title, tickers } of byCik.values()) {
    const name = normalizeIssuer(title);
    if (!name || clash.has(name)) continue;
    if (byName.has(name)) {
      byName.delete(name);
      clash.add(name);
      continue;
    }
    byName.set(name, { primary: tickers[0]!, several: tickers.length > 1 });
  }
  return byName;
}

/**
 * The share class a 13F names, as a letter: `CAP STK CL C` is `C`.
 * Null for plain common stock.
 */
export function shareClass(classTitle: string): string | null {
  return /\bCL(?:ASS)?\s+([A-Z])\b/.exec(classTitle.toUpperCase())?.[1] ?? null;
}

/**
 * The ticker for a position, or null when it cannot be told for sure.
 *
 * A company with several tickers gets its primary one for common stock and
 * class A, which is what the primary listing almost always is. Any other class
 * — Alphabet's C, Berkshire's B — is left without one, because which of the
 * company's other tickers it trades under is not in either list.
 */
export function tickerForIssuer(
  index: ReadonlyMap<string, TickerMatch>,
  issuer: string,
  classTitle = '',
): string | null {
  const match = index.get(normalizeIssuer(issuer));
  if (!match) return null;
  const cls = shareClass(classTitle);
  if (match.several && cls && cls !== 'A') return null;
  return match.primary;
}

// ───────────────────────────────────────────────────────────────────────────
// Words
// ───────────────────────────────────────────────────────────────────────────

/** `Pershing Square Capital Management, L.P.` stays; `BERKSHIRE HATHAWAY INC` softens. */
export function fundName(raw: string): string {
  // EDGAR tags some names with a state to tell namesakes apart: `/MA`.
  const name = raw.trim().replace(/\s*\/[A-Z]{2}\/?$/, '');
  if (name !== name.toUpperCase()) return name;
  const keep = new Set(['LLC', 'LP', 'L.P.', 'LLP', 'II', 'III', 'IV', 'USA', 'US', 'UK', 'ETF']);
  return name
    .split(/\s+/)
    .map((w) => (keep.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
}

/**
 * What a position is called on screen: its ticker, else a softened issuer
 * name with its share class, so Alphabet's two classes are told apart.
 */
export function positionLabel(
  p: Pick<FundPosition, 'ticker' | 'issuer' | 'putCall'> & { classTitle?: string },
): string {
  const cls = p.ticker ? null : shareClass(p.classTitle ?? '');
  const base = p.ticker ?? `${fundName(p.issuer)}${cls ? ` class ${cls}` : ''}`;
  return p.putCall ? `${base} ${p.putCall.toLowerCase()}s` : base;
}

/**
 * Positions added to, or trimmed, in each of the most recent filings running —
 * three or more in a row. `filings` is newest first.
 *
 * Read from the moves each filing already carries, so a move outside a
 * filing's largest forty is not seen; a streak is only ever under-reported.
 */
export function findStreaks(
  filings: readonly FundFiling[],
  minimum = 3,
): { key: string; label: string; kind: 'added' | 'trimmed'; count: number }[] {
  const keyOf = (m: FundMove) => `${m.cusip}:${m.putCall ?? ''}`;
  const out: { key: string; label: string; kind: 'added' | 'trimmed'; count: number }[] = [];

  for (const m of filings[0]?.moves ?? []) {
    if (m.kind !== 'added' && m.kind !== 'trimmed') continue;
    const key = keyOf(m);
    let count = 0;
    for (const f of filings) {
      if (f.moves.find((x) => keyOf(x) === key)?.kind === m.kind) count++;
      else break;
    }
    if (count >= minimum) out.push({ key, label: positionLabel(m), kind: m.kind, count });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, 5);
}
