import type { Signal, SourceId } from '@/providers/types';

/**
 * Grouping the feed into days, with a one-line summary per day.
 *
 * A raw reverse-chronological stream tells you what is newest but never what a
 * *day* looked like — whether six filings landed together or trickled over a
 * fortnight. Day headers turn the same signals into something closer to a
 * briefing without hiding anything or reordering the stream.
 *
 * Only `import type`, so this is unit-tested with no React and no network.
 */

const DAY = 86_400_000;

/**
 * UTC midnight of the day a timestamp falls in.
 *
 * UTC, not local time, and deliberately so: every date in this app is built
 * with `Date.UTC` from the source's own published date, so a filing dated
 * 2026-08-27 has a timestamp of exactly UTC midnight. Bucketing by *local* day
 * would drop it into 26 August for every user west of UTC — the filing would
 * appear under the wrong date on the majority of devices.
 */
export function dayStartOf(timestamp: number): number {
  return Math.floor(timestamp / DAY) * DAY;
}

export interface DigestSource {
  source: SourceId;
  count: number;
}

export interface DigestDay {
  /** UTC midnight of the day. */
  dayStart: number;
  /** Newest first, matching the feed. */
  signals: Signal[];
  /** Per-source counts, busiest first. */
  bySource: DigestSource[];
}

/**
 * Bucket signals into days, newest day first.
 *
 * The order within a day is left as the caller gave it (the feed hands them
 * over already sorted), so grouping never silently re-sorts the stream.
 */
export function groupByDay(signals: readonly Signal[]): DigestDay[] {
  const byDay = new Map<number, Signal[]>();

  for (const signal of signals) {
    if (!Number.isFinite(signal.timestamp)) continue;
    const key = dayStartOf(signal.timestamp);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(signal);
    else byDay.set(key, [signal]);
  }

  return [...byDay.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([dayStart, group]) => ({
      dayStart,
      signals: group,
      bySource: countSources(group),
    }));
}

function countSources(signals: readonly Signal[]): DigestSource[] {
  const counts = new Map<SourceId, number>();
  for (const s of signals) counts.set(s.source, (counts.get(s.source) ?? 0) + 1);

  return [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}

/** `Today` / `Yesterday` / `Sat 30 Aug` / `30 Aug 2024`. */
export function dayLabel(dayStart: number, now: number = Date.now()): string {
  const today = dayStartOf(now);
  if (dayStart === today) return 'Today';
  if (dayStart === today - DAY) return 'Yesterday';

  const d = new Date(dayStart);
  const weekday = d.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const sameYear = d.getUTCFullYear() === new Date(today).getUTCFullYear();

  return sameYear
    ? `${weekday} ${d.getUTCDate()} ${month}`
    : `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}

/**
 * `6 filings · 4 policy, 2 insider`.
 *
 * `labelFor` is injected rather than imported so this stays free of the
 * provider registry, which pulls in the whole network layer and would make the
 * module untestable in isolation.
 */
export function daySummary(day: DigestDay, labelFor: (source: SourceId) => string): string {
  const total = day.signals.length;
  const noun = total === 1 ? 'filing' : 'filings';
  // Source names are labels, not nouns: "1 stocks" and "1 insiders" read as
  // typos, so the count follows the name instead of preceding it.
  const breakdown = day.bySource.map((s) => `${labelFor(s.source)} ${s.count}`);

  // With one source a count would just restate the total, so only name it.
  return day.bySource.length > 1
    ? `${total} ${noun} · ${breakdown.join(', ')}`
    : `${total} ${noun} · ${day.bySource[0] ? labelFor(day.bySource[0].source) : ''}`
        .replace(/ · $/, '');
}

const LATE_BADGE = 'LATE FILING';

/**
 * The single most notable fact about a day, or null when nothing stands out.
 *
 * Derived only from fields the signals actually carry. In particular it never
 * parses a formatted `accent.label` back into a number to rank "biggest trade"
 * — that string is built for display, and reading it back would break the first
 * time the formatting changed.
 */
export function dayHeadline(day: DigestDay): string | null {
  const late = day.signals.filter((s) => s.badges?.includes(LATE_BADGE)).length;
  if (late > 0) {
    return `${late} late ${late === 1 ? 'filing' : 'filings'}`;
  }

  const repeated = mostRepeatedTicker(day.signals);
  if (repeated) {
    return `${repeated.count} filings on ${repeated.ticker}`;
  }

  return null;
}

function mostRepeatedTicker(
  signals: readonly Signal[],
): { ticker: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const s of signals) {
    if (!s.ticker) continue;
    counts.set(s.ticker, (counts.get(s.ticker) ?? 0) + 1);
  }

  let best: { ticker: string; count: number } | null = null;
  for (const [ticker, count] of counts) {
    // Two or more, or it is not a pattern — just a filing.
    if (count < 2) continue;
    if (!best || count > best.count || (count === best.count && ticker < best.ticker)) {
      best = { ticker, count };
    }
  }
  return best;
}
