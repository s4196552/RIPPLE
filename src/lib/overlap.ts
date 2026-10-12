import type { FundMove, Signal, SourceId } from '@/providers/types';

/**
 * Where a fund's moves meet the rest of the feed.
 *
 * A 13F says a fund bought or sold a stock some time in a quarter; Congress
 * and insider filings say who else traded it, and when. Putting the two side
 * by side is the thing no single-source tracker can show: "Pershing opened
 * Microsoft the same quarter two members bought it."
 *
 * Only `import type`, so it is unit-tested directly.
 */

/** How far back the other sources' trades count as "the same time". */
export const OVERLAP_WINDOW_DAYS = 120;

export interface FundOverlap {
  ticker: string;
  /** The fund, as displayed, and its handle (CIK) for its page. */
  fund: string;
  fundHandle: string;
  kind: FundMove['kind'];
  /** Distinct people in each other source who traded the ticker in the window. */
  traders: Partial<Record<Exclude<SourceId, 'funds'>, string[]>>;
}

/**
 * For each followed fund's newest filing, the moves whose ticker someone in
 * Congress or a company insider also traded inside the window.
 *
 * Counts people, not filings: one member filing four times is one member.
 * Unchanged positions are left out — holding still is not news.
 */
export function fundOverlaps(
  signals: readonly Signal[],
  now: number = Date.now(),
  windowDays = OVERLAP_WINDOW_DAYS,
): FundOverlap[] {
  const since = now - windowDays * 86_400_000;

  // Ticker -> source -> people who traded it.
  const traded = new Map<string, Map<Exclude<SourceId, 'funds'>, Set<string>>>();
  for (const s of signals) {
    if (s.source === 'funds' || !s.trade || !s.ticker || s.timestamp < since) continue;
    const ticker = s.ticker.toUpperCase();
    const bySource = traded.get(ticker) ?? new Map();
    const people = bySource.get(s.source) ?? new Set<string>();
    people.add(s.trade.traderName || s.actor.displayName);
    bySource.set(s.source, people);
    traded.set(ticker, bySource);
  }

  // Each fund's newest holdings report only: an older quarter's move is history.
  const newest = new Map<string, Signal>();
  for (const s of signals) {
    if (s.source !== 'funds' || s.holdings?.form !== '13F-HR') continue;
    const have = newest.get(s.actor.handle);
    if (!have || s.timestamp > have.timestamp) newest.set(s.actor.handle, s);
  }

  const out: FundOverlap[] = [];
  for (const filing of newest.values()) {
    for (const m of filing.holdings?.moves ?? []) {
      if (!m.ticker || m.kind === 'unchanged') continue;
      const others = traded.get(m.ticker.toUpperCase());
      if (!others) continue;
      const traders: FundOverlap['traders'] = {};
      for (const [source, people] of others) traders[source] = [...people].sort();
      out.push({
        ticker: m.ticker,
        fund: filing.actor.displayName,
        fundHandle: filing.actor.handle,
        kind: m.kind,
        traders,
      });
    }
  }

  const reach = (o: FundOverlap) => Object.values(o.traders).reduce((n, p) => n + (p?.length ?? 0), 0);
  return out.sort((a, b) => reach(b) - reach(a) || a.ticker.localeCompare(b.ticker));
}

/** "2 members of Congress and 1 insider", for a sentence. */
export function tradersPhrase(traders: FundOverlap['traders']): string {
  const parts: string[] = [];
  const congress = traders.congress?.length ?? 0;
  const insider = traders.insider?.length ?? 0;
  if (congress) parts.push(`${congress} member${congress === 1 ? '' : 's'} of Congress`);
  if (insider) parts.push(`${insider} insider${insider === 1 ? '' : 's'}`);
  return parts.join(' and ');
}
