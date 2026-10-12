import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MEASURED_MOVES, measureMoves, movesToMeasure } from '../src/providers/funds/measure.ts';
import type { FundMove } from '../src/providers/types.ts';
import type { Series } from '../src/providers/stocks/events.ts';

const DAY = 86_400_000;

function move(ticker: string | null, kind: FundMove['kind'] = 'new', putCall: FundMove['putCall'] = null): FundMove {
  return {
    issuer: ticker ?? 'X', ticker, classTitle: 'COM', cusip: ticker ?? 'X', putCall, value: 1, shares: 1,
    weight: 0.1, kind, valueBefore: 0, sharesBefore: 0, sharesChangePct: null,
  };
}

function series(symbol: string, closes: number[]): Series {
  return { symbol, currency: 'USD', times: closes.map((_, i) => i * DAY), closes, volumes: closes.map(() => 1) };
}

describe('movesToMeasure', () => {
  it('takes the biggest priced decisions, skipping options and positions with no ticker', () => {
    const picked = movesToMeasure([move('MSFT'), move(null), move('SPY', 'added', 'PUT'), move('HLT', 'exited')]);
    assert.deepEqual(picked.map((m) => m.ticker), ['MSFT', 'HLT']);
  });

  it('caps how many it prices', () => {
    const many = Array.from({ length: 10 }, (_, i) => move(`T${i}`));
    assert.equal(movesToMeasure(many).length, MEASURED_MOVES);
  });
});

describe('measureMoves', () => {
  const spy = series('SPY', [100, 101, 102, 103, 104]);

  it('measures from the filing date and nets out the benchmark', () => {
    const [m] = measureMoves([move('MSFT')], 1 * DAY, () => series('MSFT', [50, 50, 55, 60, 66]), spy);
    assert.ok(m?.sinceFiling);
    assert.equal(Math.round(m!.sinceFiling!.changePct), 32);
    assert.ok(m!.sinceFiling!.excessPct! > 25 && m!.sinceFiling!.excessPct! < 30);
  });

  it('falls back to the raw move when there is no benchmark', () => {
    const [m] = measureMoves([move('MSFT')], 1 * DAY, () => series('MSFT', [50, 50, 55, 60, 66]), null);
    assert.equal(m?.sinceFiling?.excessPct, null);
  });

  it('leaves a move unmeasured when its prices are missing', () => {
    const [m] = measureMoves([move('MSFT')], 1 * DAY, () => undefined, spy);
    assert.equal(m?.sinceFiling, undefined);
  });
});
