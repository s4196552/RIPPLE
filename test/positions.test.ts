import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  pairPositions,
  positionBadge,
  recordSummary,
  scorePosition,
  summarizePositions,
  type PositionOutcome,
  type TradeEvent,
} from '../src/providers/positions.ts';
import type { Series } from '../src/providers/stocks/events.ts';

const DAY = 86_400_000;

function series(closes: number[], symbol = 'TEST'): Series {
  return {
    symbol,
    currency: 'USD',
    times: closes.map((_, i) => i * DAY),
    closes,
    volumes: closes.map(() => 1_000_000),
  };
}

const buy = (actor: string, ticker: string, day: number, id?: string): TradeEvent => ({
  actorKey: actor,
  ticker,
  side: 'buy',
  at: day * DAY,
  ...(id ? { signalId: id } : {}),
});

const sell = (actor: string, ticker: string, day: number, id?: string): TradeEvent => ({
  actorKey: actor,
  ticker,
  side: 'sell',
  at: day * DAY,
  ...(id ? { signalId: id } : {}),
});

describe('pairPositions', () => {
  it('closes a buy with the later sell of the same ticker', () => {
    const [p] = pairPositions([buy('pelosi', 'NVDA', 1, 'b1'), sell('pelosi', 'NVDA', 5, 's1')]);

    assert.equal(p?.openedAt, 1 * DAY);
    assert.equal(p?.closedAt, 5 * DAY);
    assert.equal(p?.openSignalId, 'b1');
    assert.equal(p?.closeSignalId, 's1');
  });

  it('leaves a buy with no matching sell open', () => {
    const [p] = pairPositions([buy('pelosi', 'NVDA', 1)]);
    assert.equal(p?.closedAt, null);
  });

  it('never lets one actor close another actor position', () => {
    const positions = pairPositions([buy('pelosi', 'NVDA', 1), sell('khanna', 'NVDA', 5)]);

    assert.equal(positions.length, 1);
    assert.equal(positions[0]?.closedAt, null, 'a different person cannot close it');
  });

  it('never pairs across tickers', () => {
    const positions = pairPositions([buy('pelosi', 'NVDA', 1), sell('pelosi', 'AAPL', 5)]);
    assert.equal(positions[0]?.closedAt, null);
  });

  it('matches first in, first out', () => {
    const positions = pairPositions([
      buy('pelosi', 'NVDA', 1, 'b1'),
      buy('pelosi', 'NVDA', 3, 'b2'),
      sell('pelosi', 'NVDA', 5, 's1'),
    ]);

    assert.equal(positions.length, 2);
    assert.equal(positions[0]?.closeSignalId, 's1', 'the oldest lot closes first');
    assert.equal(positions[1]?.closedAt, null);
  });

  it('drops a sell with nothing open in front of it', () => {
    // It closes a position opened before the data window; inventing an opening
    // date for it would fabricate a holding period.
    assert.deepEqual(pairPositions([sell('pelosi', 'NVDA', 5)]), []);
  });

  it('orders by date regardless of input order', () => {
    const positions = pairPositions([sell('pelosi', 'NVDA', 5, 's1'), buy('pelosi', 'NVDA', 1, 'b1')]);
    assert.equal(positions[0]?.closeSignalId, 's1');
  });

  it('is case- and whitespace-insensitive on actor and ticker', () => {
    const positions = pairPositions([
      buy('  Nancy Pelosi ', 'nvda', 1),
      sell('NANCY PELOSI', ' NVDA ', 5),
    ]);
    assert.equal(positions[0]?.closedAt, 5 * DAY);
  });

  it('ignores events with an unusable date', () => {
    const bad: TradeEvent = { actorKey: 'pelosi', ticker: 'NVDA', side: 'buy', at: Number.NaN };
    assert.deepEqual(pairPositions([bad]), []);
  });

  it('pairs the same ticker independently for two people', () => {
    const positions = pairPositions([
      buy('pelosi', 'NVDA', 1),
      buy('khanna', 'NVDA', 2),
      sell('pelosi', 'NVDA', 5),
    ]);

    assert.equal(positions.length, 2);
    assert.equal(positions.filter((p) => p.closedAt !== null).length, 1);
  });
});

describe('scorePosition', () => {
  // Subject +20% over the held window; benchmark +5% over the same window.
  const stock = series([100, 100, 110, 120, 200]);
  const bench = series([200, 200, 205, 210, 400], 'SPY');

  it('measures the closed position over its own holding period', () => {
    const [position] = pairPositions([buy('a', 'TEST', 1), sell('a', 'TEST', 3)]);
    const o = scorePosition(position!, stock, bench)!;

    assert.equal(o.open, false);
    assert.equal(Math.round(o.changePct), 20);
    assert.equal(Math.round(o.benchmarkPct), 5);
    assert.equal(Math.round(o.excessPct), 15);
    assert.equal(o.holdingDays, 2);
  });

  it('stops at the disclosed sell, ignoring later moves', () => {
    // The series doubles on day 4. A position closed on day 3 must not see it —
    // this is the fixed-window mistake in miniature.
    const [position] = pairPositions([buy('a', 'TEST', 1), sell('a', 'TEST', 3)]);
    const o = scorePosition(position!, stock, bench)!;

    assert.equal(o.changePct < 100, true, 'must not include the post-exit move');
  });

  it('measures an open position to the latest close and flags it', () => {
    const [position] = pairPositions([buy('a', 'TEST', 1)]);
    const o = scorePosition(position!, stock, bench)!;

    assert.equal(o.open, true);
    assert.equal(Math.round(o.changePct), 100, 'runs to the last session');
  });

  it('returns null when the price series cannot cover the position', () => {
    const [position] = pairPositions([buy('a', 'TEST', 99)]);
    assert.equal(scorePosition(position!, stock, bench), null);
  });
});

describe('summarizePositions', () => {
  const outcome = (excessPct: number, open = false, holdingDays = 10): PositionOutcome => ({
    position: { actorKey: 'a', ticker: 'T', openedAt: 0, closedAt: open ? null : 1, },
    open,
    holdingDays,
    sessions: 5,
    changePct: excessPct,
    benchmarkPct: 0,
    excessPct,
  });

  it('counts closed and open separately', () => {
    const r = summarizePositions([outcome(1), outcome(2), outcome(3, true)]);
    assert.equal(r.closed, 2);
    assert.equal(r.open, 1);
  });

  it('reports mean and median, because one outlier moves the mean', () => {
    const r = summarizePositions([outcome(0), outcome(0), outcome(300)]);

    assert.equal(r.medianExcessPct, 0);
    assert.equal(Math.round(r.averageExcessPct!), 100);
  });

  it('reports the share that beat the benchmark', () => {
    const r = summarizePositions([outcome(5), outcome(-5), outcome(5), outcome(-5)]);
    assert.equal(r.beatRate, 0.5);
  });

  it('does not count a flat result as a beat', () => {
    assert.equal(summarizePositions([outcome(0)]).beatRate, 0);
  });

  it('reports the median holding period', () => {
    const r = summarizePositions([outcome(1, false, 10), outcome(1, false, 30), outcome(1, false, 20)]);
    assert.equal(r.medianHoldingDays, 20);
  });

  it('returns nulls rather than NaN for no positions', () => {
    const r = summarizePositions([]);
    assert.equal(r.averageExcessPct, null);
    assert.equal(r.medianExcessPct, null);
    assert.equal(r.beatRate, null);
    assert.equal(r.closed, 0);
  });
});

describe('badges', () => {
  const closed: PositionOutcome = {
    position: { actorKey: 'a', ticker: 'NVDA', openedAt: 0, closedAt: 1 },
    open: false,
    holdingDays: 143,
    sessions: 99,
    changePct: 12,
    benchmarkPct: 8.88,
    excessPct: 3.12,
  };

  it('states how long it was held and the excess', () => {
    assert.equal(positionBadge(closed, 'SPY'), 'HELD 143D · +3.12pp vs SPY');
  });

  it('says OPEN for a position still on the books', () => {
    assert.match(positionBadge({ ...closed, open: true }, 'SPY'), /^OPEN 143D/);
  });

  it('signs a negative excess', () => {
    assert.match(positionBadge({ ...closed, excessPct: -2.5 }, 'SPY'), /· -2\.50pp vs SPY$/);
  });

  it('summarises a record without implying a forecast', () => {
    const r = summarizePositions([closed, { ...closed, excessPct: -1 }]);
    assert.equal(recordSummary(r, 'SPY'), '2 closed · median +1.06pp vs SPY · beat 50%');
  });

  it('mentions open positions when there are any', () => {
    const r = summarizePositions([closed, { ...closed, open: true }]);
    assert.match(recordSummary(r, 'SPY')!, /^1 closed · 1 open/);
  });

  it('returns null when there is nothing to summarise', () => {
    assert.equal(recordSummary(summarizePositions([]), 'SPY'), null);
  });
});
