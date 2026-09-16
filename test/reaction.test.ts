import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeExcessReaction,
  computeReaction,
  computeReactionBetween,
  excessBadge,
  preDisclosureBadge,
  reactionBadge,
} from '../src/providers/stocks/reaction.ts';
import type { Series } from '../src/providers/stocks/events.ts';

const DAY = 86_400_000;

/** Sessions on consecutive days starting at epoch day 0. */
function series(closes: number[], symbol = 'TEST'): Series {
  return {
    symbol,
    currency: 'USD',
    times: closes.map((_, i) => i * DAY),
    closes,
    volumes: closes.map(() => 1_000_000),
  };
}

describe('computeReaction', () => {
  it('measures from the event session to the latest close', () => {
    const r = computeReaction(series([90, 100, 105, 110]), 1 * DAY)!;

    assert.equal(r.fromClose, 100);
    assert.equal(r.toClose, 110);
    assert.equal(Math.round(r.changePct * 100) / 100, 10);
    assert.equal(r.sessions, 2);
  });

  it('reports the window it actually measured', () => {
    const r = computeReaction(series([90, 100, 105, 110]), 1 * DAY)!;
    assert.equal(r.fromTime, 1 * DAY);
    assert.equal(r.toTime, 3 * DAY);
  });

  it('reports a decline as negative', () => {
    const r = computeReaction(series([100, 100, 90, 80]), 1 * DAY)!;
    assert.ok(r.changePct < 0);
    assert.equal(r.toClose, 80);
  });

  it('snaps an event between sessions forward to the next one', () => {
    const r = computeReaction(series([90, 100, 105, 110]), 1 * DAY + DAY / 2)!;
    assert.equal(r.fromClose, 105);
  });

  it('returns null when the event is the latest session', () => {
    assert.equal(computeReaction(series([90, 100, 110]), 2 * DAY), null);
  });

  it('returns null when the event predates the series', () => {
    assert.equal(computeReaction(series([90, 100, 110]), -5 * DAY), null);
  });

  it('returns null for a series too short to compare', () => {
    assert.equal(computeReaction(series([100]), 0), null);
    assert.equal(computeReaction(series([]), 0), null);
  });

  it('returns null rather than dividing by a zero close', () => {
    assert.equal(computeReaction(series([0, 0, 0]), 0), null);
  });
});

describe('computeReactionBetween', () => {
  it('stops at the window end instead of running to the latest close', () => {
    // Day 1 (100) -> day 2 (105), ignoring the later rise to 110.
    const r = computeReactionBetween(series([90, 100, 105, 110]), 1 * DAY, 2 * DAY)!;

    assert.equal(r.fromClose, 100);
    assert.equal(r.toClose, 105);
    assert.equal(r.sessions, 1);
  });

  it('clamps the end back to the last session at or before it', () => {
    const r = computeReactionBetween(series([90, 100, 105, 110]), 1 * DAY, 2 * DAY + DAY / 2)!;
    assert.equal(r.toClose, 105);
  });

  it('returns null when the window contains no session after the event', () => {
    assert.equal(computeReactionBetween(series([90, 100, 105]), 1 * DAY, 1 * DAY), null);
  });
});

describe('computeExcessReaction', () => {
  // Stock +10% over the window; benchmark +5% over the same window.
  const stock = series([90, 100, 105, 110]);
  const bench = series([200, 200, 205, 210], 'SPY');

  it('reports the subject move, the benchmark move and the difference', () => {
    const r = computeExcessReaction(stock, bench, 1 * DAY, 'SPY')!;

    assert.equal(Math.round(r.changePct * 100) / 100, 10);
    assert.equal(Math.round(r.benchmarkPct * 100) / 100, 5);
    assert.equal(Math.round(r.excessPct * 100) / 100, 5);
    assert.equal(r.benchmarkSymbol, 'SPY');
  });

  it('goes negative when the subject lags a rising market', () => {
    // The number that matters: up 10% is a *loss* against a market up 20%.
    const hotMarket = series([200, 200, 220, 240], 'SPY');
    const r = computeExcessReaction(stock, hotMarket, 1 * DAY, 'SPY')!;

    assert.ok(r.changePct > 0, 'the raw move is still positive');
    assert.ok(r.excessPct < 0, 'but it lost to the index');
  });

  it('measures the benchmark over the subject window, not its own', () => {
    // Benchmark has two extra sessions the subject never saw. Crediting them
    // would compare a 2-session move against a 4-session one.
    const longerBench = series([200, 200, 205, 210, 260, 300], 'SPY');
    const r = computeExcessReaction(stock, longerBench, 1 * DAY, 'SPY')!;

    assert.equal(Math.round(r.benchmarkPct * 100) / 100, 5);
  });

  it('returns null when the benchmark cannot cover the window', () => {
    const shortBench = series([200], 'SPY');
    assert.equal(computeExcessReaction(stock, shortBench, 1 * DAY, 'SPY'), null);
  });

  it('returns null when the subject itself has no reaction', () => {
    assert.equal(computeExcessReaction(stock, bench, 3 * DAY, 'SPY'), null);
  });
});

describe('badges', () => {
  it('states the raw move and the window length', () => {
    const r = computeReaction(series([90, 100, 105, 110]), 1 * DAY)!;
    assert.equal(reactionBadge('NVDA', r), 'NVDA +10.00% · 2D');
  });

  it('states the excess in percentage points, signed', () => {
    const r = computeExcessReaction(
      series([90, 100, 105, 110]),
      series([200, 200, 205, 210], 'SPY'),
      1 * DAY,
      'SPY',
    )!;
    assert.equal(excessBadge(r), '+5.00pp vs SPY');
  });

  it('signs a negative excess', () => {
    const r = computeExcessReaction(
      series([90, 100, 105, 110]),
      series([200, 200, 220, 240], 'SPY'),
      1 * DAY,
      'SPY',
    )!;
    assert.match(excessBadge(r), /^-\d+\.\d{2}pp vs SPY$/);
  });

  it('names the pre-filing move as such', () => {
    const missed = computeReactionBetween(series([90, 100, 105, 110]), 1 * DAY, 2 * DAY)!;
    assert.equal(preDisclosureBadge(missed), '+5.00% BEFORE FILING');
  });
});
