import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MOVE_THRESHOLD_PCT,
  compactVolume,
  deriveEvents,
  formatPct,
  money,
  normalizeTickerEvent,
  type Series,
} from '../src/providers/stocks/events.ts';

const DAY = 86_400_000;

/** Builds a series from a list of closes, one session per day. */
function series(closes: number[], volumes?: number[]): Series {
  return {
    symbol: 'TEST',
    currency: 'USD',
    times: closes.map((_, i) => i * DAY),
    closes,
    volumes: volumes ?? closes.map(() => 1_000_000),
  };
}

describe('deriveEvents', () => {
  it('ignores sessions that moved less than the threshold', () => {
    // Six flat-ish sessions, each well under 1.5% and never a real extreme.
    assert.deepEqual(deriveEvents(series([100, 100.1, 100.2, 100.1, 100.2, 100.1])), []);
  });

  it('emits a move event once the threshold is crossed', () => {
    // The early dip to 90 sets the floor well below 97, so the closing session
    // is a plain move rather than a new low. That dip and its rebound are
    // themselves moves, so we assert on the newest event, not the count.
    const events = deriveEvents(series([100, 90, 100, 100.1, 100.2, 97]));

    assert.equal(events[0]?.kind, 'move');
    assert.ok(Math.abs(events[0]!.changePct) >= MOVE_THRESHOLD_PCT);
    assert.ok(events[0]!.changePct < 0, 'a drop should be negative');
  });

  it('does not call a fractional new max a period high', () => {
    // Drifts up by ~0.1% a session. Every close is technically a new max, but
    // none of them is news.
    assert.deepEqual(deriveEvents(series([100, 100.1, 100.2, 100.3, 100.4, 100.5, 100.6])), []);
  });

  it('still reports a high once the margin is genuinely cleared', () => {
    const events = deriveEvents(series([100, 100.1, 100.2, 100.1, 100.2, 100.1, 104]));
    assert.equal(events[0]?.kind, 'high');
  });

  it('returns events newest first', () => {
    const events = deriveEvents(series([100, 105, 100, 105, 100, 105, 100]));
    assert.ok(events.length > 1);

    for (let i = 1; i < events.length; i++) {
      assert.ok(
        events[i - 1]!.time > events[i]!.time,
        'each event must be newer than the one after it',
      );
    }
  });

  it('classifies a new period high above a plain move', () => {
    // Rising steadily, so the last session is both a >1.5% move and a new high.
    const events = deriveEvents(series([10, 11, 12, 13, 14, 15, 16, 17]));
    assert.equal(events[0]?.kind, 'high');
  });

  it('classifies a new period low', () => {
    const events = deriveEvents(series([20, 19, 18, 17, 16, 15, 14, 13]));
    assert.equal(events[0]?.kind, 'low');
  });

  it('needs real history before claiming a high', () => {
    // Only two sessions — not enough to call anything a 3-month high.
    const events = deriveEvents(series([10, 20]));
    assert.notEqual(events[0]?.kind, 'high');
  });

  it('flags a volume spike even when the price barely moved', () => {
    const closes = [100, 100.1, 100.2, 100.1, 100.2, 100.1, 100.15];
    const volumes = [1e6, 1e6, 1e6, 1e6, 1e6, 1e6, 9e6];
    const events = deriveEvents(series(closes, volumes));

    assert.equal(events.length, 1);
    assert.equal(events[0]?.kind, 'volume');
    assert.ok(events[0]!.avgVolume > 0);
  });

  it('survives a zero close in the series without emitting Infinity', () => {
    const events = deriveEvents(series([0, 100, 101, 102, 103, 104, 105, 106]));

    assert.ok(events.length > 0, 'the rest of the series should still produce events');
    for (const e of events) {
      assert.ok(Number.isFinite(e.changePct), 'changePct must stay finite');
      assert.ok(Number.isFinite(e.close));
    }
  });

  it('handles an empty series', () => {
    assert.deepEqual(deriveEvents(series([])), []);
  });
});

describe('normalizeTickerEvent', () => {
  const author = { handle: 'TEST', displayName: 'TEST' };

  it('produces a stable, unique, platform-prefixed id', () => {
    const [event] = deriveEvents(series([100, 100.1, 100.2, 100.1, 100.2, 97]));
    const first = normalizeTickerEvent(event!, author);
    const second = normalizeTickerEvent(event!, author);

    assert.equal(first.id, second.id, 'same event must normalize to the same id');
    assert.ok(first.id.startsWith('stocks:'));
  });

  it('carries the session timestamp through as the sort key', () => {
    const [event] = deriveEvents(series([100, 100.1, 100.2, 100.1, 100.2, 97]));
    assert.equal(normalizeTickerEvent(event!, author).timestamp, event!.time);
  });

  it('tags a decline as down and a rise as up', () => {
    const down = deriveEvents(series([100, 100.1, 100.2, 100.1, 100.2, 97]))[0]!;
    const up = deriveEvents(series([100, 100.1, 100.2, 100.1, 100.2, 104]))[0]!;

    assert.equal(normalizeTickerEvent(down, author).accent?.tone, 'down');
    assert.equal(normalizeTickerEvent(up, author).accent?.tone, 'up');
  });

  it('links to the ticker on Yahoo Finance', () => {
    const [event] = deriveEvents(series([100, 100.1, 100.2, 100.1, 100.2, 97]));
    assert.equal(
      normalizeTickerEvent(event!, author).url,
      'https://finance.yahoo.com/quote/TEST',
    );
  });

  it('writes text that names the symbol', () => {
    const [event] = deriveEvents(series([100, 100.1, 100.2, 100.1, 100.2, 97]));
    assert.match(normalizeTickerEvent(event!, author).text, /TEST/);
  });
});

describe('formatting helpers', () => {
  it('signs percentages explicitly', () => {
    assert.equal(formatPct(3.456), '+3.46%');
    assert.equal(formatPct(-3.456), '-3.46%');
    assert.equal(formatPct(0), '+0.00%');
  });

  it('renders known currencies with a symbol and others with a code', () => {
    assert.equal(money(12.5, 'USD'), '$12.50');
    assert.equal(money(12.5, 'GBP'), '£12.50');
    assert.equal(money(12.5, 'JPY'), '12.50 JPY');
  });

  it('abbreviates volume at each magnitude', () => {
    assert.equal(compactVolume(950), '950');
    assert.equal(compactVolume(12_400), '12K');
    assert.equal(compactVolume(3_200_000), '3.2M');
    assert.equal(compactVolume(2_500_000_000), '2.5B');
  });
});
