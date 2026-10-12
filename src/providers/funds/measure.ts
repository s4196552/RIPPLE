// Relative, not the '@/' alias: unit-tested directly under Node's type
// stripping, which does no tsconfig path resolution.
import type { FundMove } from '@/providers/types';
import type { Series } from '../stocks/events';
import { computeExcessReaction, computeReactionBetween } from '../stocks/reaction.ts';

/** Moves measured per filing: each is one price request. */
export const MEASURED_MOVES = 6;

/**
 * The moves worth measuring: the biggest decisions with a ticker to price.
 * `moves` arrives biggest dollar move first.
 */
export function movesToMeasure(moves: readonly FundMove[]): FundMove[] {
  return moves.filter((m) => m.ticker && m.kind !== 'unchanged' && !m.putCall).slice(0, MEASURED_MOVES);
}

/**
 * Did it matter? What each stock did from the day the filing became public,
 * and against the benchmark over exactly the same sessions.
 *
 * Measured from the filing date, not the quarter end: the trades themselves
 * happened on unknown days inside the quarter, and the filing is the first
 * moment anyone outside the fund could act on them. That is the same rule the
 * app applies to Congress and to insiders.
 *
 * Returns new move objects; a move whose series is missing, or that predates
 * it, is left unmeasured rather than given a misleading zero.
 */
export function measureMoves(
  moves: readonly FundMove[],
  filedAt: number,
  seriesFor: (ticker: string) => Series | undefined,
  benchmark: Series | null,
  benchmarkSymbol = 'SPY',
): FundMove[] {
  const wanted = new Set(movesToMeasure(moves));
  return moves.map((m) => {
    if (!wanted.has(m) || !m.ticker) return m;
    const series = seriesFor(m.ticker);
    if (!series) return m;

    const excess = benchmark ? computeExcessReaction(series, benchmark, filedAt, benchmarkSymbol) : null;
    if (excess) {
      return { ...m, sinceFiling: { changePct: excess.changePct, excessPct: excess.excessPct, sessions: excess.sessions } };
    }
    const raw = computeReactionBetween(series, filedAt);
    return raw ? { ...m, sinceFiling: { changePct: raw.changePct, excessPct: null, sessions: raw.sessions } } : m;
  });
}
