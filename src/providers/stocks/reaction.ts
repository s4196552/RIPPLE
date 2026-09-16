// Relative, not the '@/' alias: this module is unit-tested directly under
// Node's type stripping, which does no tsconfig path resolution.
import { pct } from '../../lib/format.ts';
import type { Series } from './events';

/**
 * "What did the stock do after this happened?"
 *
 * This is the join that makes the app more than four separate lists: a
 * congressional trade disclosure or an insider Form 4 is only interesting
 * against what the price did next. Pure and unit-tested; the caller supplies
 * the series.
 */

export interface PriceReaction {
  /** Percentage move from the session of the event to the end of the window. */
  changePct: number;
  /** Close on (or immediately after) the event date. */
  fromClose: number;
  /** Close at the end of the measured window. */
  toClose: number;
  /** Trading sessions elapsed. */
  sessions: number;
  /** Session timestamp the measurement starts from. */
  fromTime: number;
  /** Session timestamp the measurement ends at. */
  toTime: number;
}

/**
 * Move between the first session at or after `since` and the last session at
 * or before `until`.
 *
 * Returns null rather than a misleading zero when the series can't support the
 * comparison: no data, the event predating the series (so we'd measure from an
 * arbitrary baseline), or no session after the event yet.
 */
export function computeReactionBetween(
  series: Series,
  since: number,
  until: number = Number.POSITIVE_INFINITY,
): PriceReaction | null {
  const { times, closes } = series;
  if (times.length < 2 || closes.length < 2) return null;

  // The event must fall inside the series.
  const firstTime = times[0];
  if (firstTime == null || since < firstTime) return null;

  // First session at or after the event.
  let start = -1;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (t != null && t >= since) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;

  // Last session at or before the window end.
  let end = -1;
  for (let i = times.length - 1; i >= 0; i--) {
    const t = times[i];
    if (t != null && t <= until) {
      end = i;
      break;
    }
  }
  if (end <= start) return null; // nothing after the event inside the window

  const fromClose = closes[start];
  const toClose = closes[end];
  const fromTime = times[start];
  const toTime = times[end];
  if (fromClose == null || toClose == null || fromTime == null || toTime == null) return null;
  if (fromClose <= 0 || toClose <= 0) return null;

  return {
    changePct: ((toClose - fromClose) / fromClose) * 100,
    fromClose,
    toClose,
    sessions: end - start,
    fromTime,
    toTime,
  };
}

/** Move from the event to the latest close in the series. */
export function computeReaction(series: Series, since: number): PriceReaction | null {
  return computeReactionBetween(series, since);
}

/**
 * The same move, measured against a benchmark over the identical window.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * A raw "+11% since" number is close to meaningless on its own, and reporting
 * it alone is actively misleading: a strategy can be up a lot and still be
 * losing badly to simply holding the index. Backtests of congressional copy-
 * trading make the point vividly — copying every disclosed buy turns $10k into
 * roughly $39k, which sounds like a win until you see the S&P did $57k over the
 * same period. Same direction, worse outcome.
 *
 * So every reaction the app shows is measured against a benchmark over exactly
 * the same window, and the number that leads is the *excess* — the part that
 * isn't just the market moving. Expressed in percentage points, because it is a
 * difference of two percentages, not a percentage of one.
 * ────────────────────────────────────────────────────────────────────────────
 */
export interface ExcessReaction extends PriceReaction {
  benchmarkSymbol: string;
  /** Benchmark's move over the identical window. */
  benchmarkPct: number;
  /** changePct - benchmarkPct, in percentage points. */
  excessPct: number;
}

/**
 * Measure `series` and `benchmark` over the same window and return the excess.
 *
 * The benchmark is deliberately clamped to the subject's own window rather than
 * run to its own latest close: comparing a 47-session stock move against a
 * 50-session index move would quietly credit or penalise three sessions the
 * subject never experienced.
 */
export function computeExcessReaction(
  series: Series,
  benchmark: Series,
  since: number,
  benchmarkSymbol: string,
): ExcessReaction | null {
  const subject = computeReactionBetween(series, since);
  if (!subject) return null;

  const index = computeReactionBetween(benchmark, since, subject.toTime);
  if (!index) return null;

  return {
    ...subject,
    benchmarkSymbol,
    benchmarkPct: index.changePct,
    excessPct: subject.changePct - index.changePct,
  };
}

/** Badge text for a raw reaction: `NVDA +4.21% · 12D`. */
export function reactionBadge(symbol: string, reaction: PriceReaction): string {
  return `${symbol} ${pct(reaction.changePct)} · ${reaction.sessions}D`;
}

/**
 * Badge text for the excess: `+6.88pp vs SPY`.
 *
 * Kept as a separate chip from the raw move so each stays short, and so the
 * comparison is legible on its own — this is the number that actually says
 * whether the move beat simply owning the index.
 */
export function excessBadge(reaction: ExcessReaction): string {
  const sign = reaction.excessPct >= 0 ? '+' : '';
  return `${sign}${reaction.excessPct.toFixed(2)}pp vs ${reaction.benchmarkSymbol}`;
}

/**
 * The move that happened *before the public could act on it*.
 *
 * A congressional trade is disclosed weeks after it happens, and by the time
 * the filing lands some of the move is already gone — a trade that looks like a
 * good call can be one whose gain was almost entirely captured during the
 * reporting delay. Measuring the transaction-date-to-disclosure-date window
 * makes that visible instead of leaving the reader to assume the whole return
 * was available to them.
 *
 * Compute with `computeReactionBetween(series, tradedAt, disclosedAt)`.
 */
export function preDisclosureBadge(move: PriceReaction): string {
  return `${pct(move.changePct)} BEFORE FILING`;
}
