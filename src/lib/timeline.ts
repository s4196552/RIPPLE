import type { Signal, SourceId } from '@/providers/types';

/**
 * Layout maths for the signal timeline.
 *
 * The feed answers "what happened, newest first". It is bad at the question
 * this view exists for: when did all of this happen *relative to each other* —
 * did three members buy the same week an executive order landed? Stacking each
 * source as its own lane on a shared time axis makes that legible in a way a
 * vertical list never can.
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

/** Where a timestamp falls across the window, clamped to 0..1. */
export function positionOf(timestamp: number, window: TimelineWindow): number {
  const span = window.end - window.start;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (timestamp - window.start) / span));
}

/** Signals inside the window, newest first. */
export function withinWindow(
  signals: readonly Signal[],
  window: TimelineWindow,
): Signal[] {
  return signals
    .filter((s) => s.timestamp >= window.start && s.timestamp <= window.end)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export interface TimelineTick {
  at: number;
  label: string;
  /** 0..1 across the window. */
  position: number;
}

/**
 * Evenly spaced date labels along the axis.
 *
 * The format follows the span rather than being fixed: a year of history
 * labelled with day numbers is unreadable, and a month labelled only by month
 * name says nothing.
 */
export function ticksFor(window: TimelineWindow, count = 4): TimelineTick[] {
  if (count < 2) return [];

  const ticks: TimelineTick[] = [];
  for (let i = 0; i < count; i++) {
    const position = i / (count - 1);
    const at = window.start + (window.end - window.start) * position;
    ticks.push({ at, label: tickLabel(at, window.days), position });
  }
  return ticks;
}

function tickLabel(at: number, spanDays: number): string {
  const d = new Date(at);
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

  if (spanDays > 400) return `${month} ${String(d.getUTCFullYear()).slice(2)}`;
  if (spanDays > 120) return month;
  return `${d.getUTCDate()} ${month}`;
}

export interface TimelineCluster {
  /** 0..1 across the window. */
  position: number;
  /** Newest first; the first is the representative for tap and label. */
  signals: Signal[];
  /** Shared direction, or neutral when the cluster disagrees with itself. */
  tone: 'up' | 'down' | 'neutral';
  /** Newest timestamp in the cluster. */
  at: number;
}

/**
 * Collapse markers that would overlap into one.
 *
 * Without this a busy week renders as a single smear of overlapping dots that
 * cannot be tapped apart, and the eye reads it as one event rather than nine.
 * `minGap` is a fraction of track width, so the caller decides using the width
 * it actually has.
 */
export function clusterSignals(
  signals: readonly Signal[],
  window: TimelineWindow,
  minGap = 0.03,
): TimelineCluster[] {
  const points = signals
    .map((signal) => ({ signal, position: positionOf(signal.timestamp, window) }))
    .sort((a, b) => a.position - b.position || b.signal.timestamp - a.signal.timestamp);

  // Greedy left-to-right: a point joins the open group while it sits within
  // minGap of where that group started, otherwise it opens a new one.
  const groups: { position: number; signals: Signal[] }[] = [];

  for (const point of points) {
    const open = groups[groups.length - 1];
    if (open && point.position - open.position <= minGap) {
      open.signals.push(point.signal);
    } else {
      groups.push({ position: point.position, signals: [point.signal] });
    }
  }

  return groups.map((group) => {
    const ordered = [...group.signals].sort((a, b) => b.timestamp - a.timestamp);
    return {
      position: group.position,
      signals: ordered,
      tone: toneOf(ordered),
      at: ordered[0]?.timestamp ?? window.end,
    };
  });
}

/** A cluster is directional only when everything in it agrees. */
function toneOf(signals: readonly Signal[]): 'up' | 'down' | 'neutral' {
  const tones = new Set(signals.map((s) => s.accent?.tone ?? 'neutral'));
  if (tones.size === 1) {
    const only = [...tones][0];
    return only === 'up' || only === 'down' ? only : 'neutral';
  }
  return 'neutral';
}

export interface TimelineLane {
  source: SourceId;
  clusters: TimelineCluster[];
  /** Signals in the window for this source. */
  count: number;
}

/**
 * One lane per source that actually has signals in the window.
 *
 * Empty lanes are dropped rather than drawn blank: a row of nothing reads as a
 * rendering failure, and the source chips above the feed already say which
 * sources exist.
 */
export function buildLanes(
  signals: readonly Signal[],
  window: TimelineWindow,
  minGap = 0.03,
): TimelineLane[] {
  const bySource = new Map<SourceId, Signal[]>();
  for (const signal of withinWindow(signals, window)) {
    const bucket = bySource.get(signal.source);
    if (bucket) bucket.push(signal);
    else bySource.set(signal.source, [signal]);
  }

  return [...bySource.entries()]
    .map(([source, group]) => ({
      source,
      clusters: clusterSignals(group, window, minGap),
      count: group.length,
    }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}

/** `3 Mar` / `3 Mar 2025` when the year differs from the window's end. */
export function clusterDateLabel(cluster: TimelineCluster, window: TimelineWindow): string {
  const d = new Date(cluster.at);
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const sameYear = d.getUTCFullYear() === new Date(window.end).getUTCFullYear();
  return sameYear
    ? `${d.getUTCDate()} ${month}`
    : `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}
