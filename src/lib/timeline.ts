import type { Signal, SourceId } from '@/providers/types';

/**
 * Layout maths for the signal timeline.
 *
 * The feed answers "what happened, newest first". It is bad at the question
 * this view exists for: when was it busy, and which way did it lean — did
 * three members buy the same week an executive order landed? Counting every
 * source into the same columns on a shared time axis makes that legible in a
 * way a vertical list never can.
 *
 * Only `import type`, so this is unit-tested directly with no React, no native
 * modules and no network. Every geometry decision lives here rather than in the
 * component, because off-by-one positioning is invisible in a screenshot and
 * obvious in a test.
 */

export type TimelineRange = '30d' | '90d' | '1y' | 'all';

export const RANGES: { id: TimelineRange; label: string; days: number | null }[] = [
  { id: '30d', label: '30D', days: 30 },
  { id: '90d', label: '90D', days: 90 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: null },
];

const DAY = 86_400_000;

export interface TimelineWindow {
  start: number;
  end: number;
  /** Span in days, at least 1 so positioning never divides by zero. */
  days: number;
}

/**
 * The time window a range covers.
 *
 * `all` is derived from the data rather than a fixed span, and is padded by a
 * day on each side so a signal sitting exactly at the edge doesn't render half
 * off the track.
 */
export function windowFor(
  range: TimelineRange,
  signals: readonly Signal[],
  now: number = Date.now(),
): TimelineWindow | null {
  const stamps = signals.map((s) => s.timestamp).filter((t) => Number.isFinite(t));
  if (stamps.length === 0) return null;

  if (range === 'all') {
    const start = Math.min(...stamps) - DAY;
    const end = Math.max(...stamps) + DAY;
    return { start, end, days: Math.max(1, Math.round((end - start) / DAY)) };
  }

  const days = RANGES.find((r) => r.id === range)?.days ?? 30;
  const newest = Math.max(...stamps);

  // End at now while anything would still be on screen, so the axis reads as
  // "up to today". Only when every signal predates a now-anchored window — a
  // subject that stopped filing months ago — fall back to anchoring on the
  // newest signal, which would otherwise render an entirely empty track.
  //
  // Deliberately not a fixed freshness threshold: these sources are
  // day-resolution and routinely lag a weekend, so anything tighter than the
  // window itself misclassifies ordinary gaps as staleness.
  const end = newest >= now - days * DAY ? now : newest;
  return { start: end - days * DAY, end, days };
}

/**
 * ── Activity buckets ────────────────────────────────────────────────────────
 * The timeline draws counts rather than individual marks: one
 * column per day, week or month, buys stacked above an axis and sells hung
 * below it. A column of five reads as "five" at a glance, where five
 * overlapping dots read as one. The same columns drive the source lanes (a dot
 * sized by count) and the "Busiest weeks" list, so the three always agree.
 * ────────────────────────────────────────────────────────────────────────────
 */

export interface BucketSpan {
  /** Inclusive. */
  start: number;
  /** Exclusive. */
  end: number;
}

export interface ActivityBucket extends BucketSpan {
  up: number;
  down: number;
  /** Signals with no direction — policy actions, mostly. Drawn on the axis. */
  neutral: number;
  total: number;
  bySource: Partial<Record<SourceId, number>>;
  /** Newest first. */
  signals: Signal[];
}

export type BucketUnit = 'day' | 'week' | 'month' | 'quarter';

const UNIT_DAYS: Record<BucketUnit, number> = { day: 1, week: 7, month: 30, quarter: 91 };

/**
 * How wide a column is for a range.
 *
 * Chosen so the chart lands between roughly 12 and 30 columns: fewer and the
 * shape is lost, more and a column is narrower than a finger.
 */
export function bucketUnitFor(range: TimelineRange, window: TimelineWindow): BucketUnit {
  if (range === '30d') return 'day';
  if (range === '90d') return 'week';
  if (range === '1y') return 'month';
  if (window.days <= 120) return 'week';
  if (window.days <= 450) return 'month';
  return 'quarter';
}

/**
 * Equal spans laid back from the window's end, oldest first.
 *
 * Anchored at the end rather than the start so the newest column is always a
 * whole one — it is the column people look at, and a stub there would read as
 * a quiet week when it is really a short one.
 */
export function fixedSpans(window: TimelineWindow, unit: BucketUnit): BucketSpan[] {
  const width = UNIT_DAYS[unit] * DAY;
  // Columns break at UTC midnight, the resolution filings are dated in, so a
  // day column is one calendar day and its label is the day it holds. The
  // last column runs to the end of the window's final day.
  const anchor = Math.floor(window.end / DAY) * DAY + DAY;
  const count = Math.max(1, Math.ceil((window.end - window.start) / width - 1e-9));
  const spans: BucketSpan[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const end = anchor - i * width;
    spans.push({ start: end - width, end });
  }
  return spans;
}

/** The last `months` calendar months (UTC) up to and including `now`'s, oldest first. */
export function monthSpans(months: number, now: number = Date.now()): BucketSpan[] {
  const d = new Date(now);
  const spans: BucketSpan[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1);
    const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i + 1, 1);
    spans.push({ start, end });
  }
  return spans;
}

/** Sorts signals into spans and counts them by direction and source. */
export function fillBuckets(signals: readonly Signal[], spans: readonly BucketSpan[]): ActivityBucket[] {
  const buckets: ActivityBucket[] = spans.map((span) => ({
    ...span,
    up: 0,
    down: 0,
    neutral: 0,
    total: 0,
    bySource: {},
    signals: [],
  }));

  for (const signal of signals) {
    const bucket = buckets.find((b) => signal.timestamp >= b.start && signal.timestamp < b.end);
    if (!bucket) continue;
    const tone = signal.accent?.tone ?? 'neutral';
    if (tone === 'up') bucket.up += 1;
    else if (tone === 'down') bucket.down += 1;
    else bucket.neutral += 1;
    bucket.total += 1;
    bucket.bySource[signal.source] = (bucket.bySource[signal.source] ?? 0) + 1;
    bucket.signals.push(signal);
  }

  for (const bucket of buckets) bucket.signals.sort((a, b) => b.timestamp - a.timestamp);
  return buckets;
}

/** Non-empty buckets, busiest first; a tie goes to the more recent. */
export function busiestBuckets(buckets: readonly ActivityBucket[], limit = 3): ActivityBucket[] {
  return buckets
    .filter((b) => b.total > 0)
    .sort((a, b) => b.total - a.total || b.start - a.start)
    .slice(0, limit);
}

function dayMonth(at: number): { day: number; month: string; year: number } {
  const d = new Date(at);
  return {
    day: d.getUTCDate(),
    month: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    year: d.getUTCFullYear(),
  };
}

/** `9 Jul` — the short date the axis and headers use. */
export function shortDate(at: number): string {
  const { day, month } = dayMonth(at);
  return `${day} ${month}`;
}

/**
 * A span as people say it: `7 Oct`, `1–7 Oct`, `28 Sep – 4 Oct`.
 *
 * Spans end exclusively, so the last day shown is the one before `end`.
 */
export function spanLabel(span: BucketSpan): string {
  const first = dayMonth(span.start);
  const last = dayMonth(Math.max(span.start, span.end - DAY));
  if (first.day === last.day && first.month === last.month) return `${first.day} ${first.month}`;
  if (first.month === last.month && first.year === last.year) {
    return `${first.day}–${last.day} ${last.month}`;
  }
  return `${first.day} ${first.month} – ${last.day} ${last.month}`;
}

/** The axis label under a column. */
export function bucketAxisLabel(span: BucketSpan, unit: BucketUnit): string {
  const { day, month, year } = dayMonth(span.start);
  if (unit === 'quarter') return `${month} ${String(year).slice(2)}`;
  return `${day} ${month}`;
}
