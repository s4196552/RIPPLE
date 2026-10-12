import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OPTIONS_BADGE,
  byTradeDay,
  chartMarks,
  lineSegments,
  monthTicks,
  ownerName,
  moneyValue,
  priceSummary,
  rankHolders,
  sameTicker,
  scalePoints,
  seatLine,
  sessionIndex,
  stockStake,
  summarizeCongress,
  summarizeInsiders,
  tradeDay,
  windowStart,
  type FundHolder,
} from '../src/lib/ticker.ts';
import { normalizeTrade } from '../src/providers/congress/parse.ts';
import type { FundPosition, Signal, TradeDetail } from '../src/providers/types.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 9);

/** A daily close at 20:00 UTC, as Yahoo stamps them. */
function session(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d, 20);
}

function signal(
  id: string,
  source: 'congress' | 'insider',
  trade: Partial<TradeDetail> & { tradedAt?: number | null },
  extra: Partial<Signal> = {},
): Signal {
  return {
    id,
    source,
    actor: { handle: 'h', displayName: 'Actor' },
    text: '',
    url: 'https://example.test',
    timestamp: (trade.tradedAt ?? NOW) + 10 * DAY,
    ticker: 'AAPL',
    trade: {
      traderName: 'Trader',
      action: 'buy',
      discretionary: true,
      kindLabel: 'PURCHASE',
      ...trade,
    },
    ...extra,
  };
}

describe('sameTicker', () => {
  it('ignores case and the class separator', () => {
    assert.equal(sameTicker('BRK.B', 'brk-b'), true);
    assert.equal(sameTicker('$AAPL'.slice(1), 'AAPL'), true);
    assert.equal(sameTicker('AAPL', 'AAP'), false);
  });

  it('never matches an empty symbol', () => {
    assert.equal(sameTicker('', ''), false);
    assert.equal(sameTicker(null, null), false);
  });
});

describe('tradeDay and byTradeDay', () => {
  it('prefers the trade date to the filing date', () => {
    const s = signal('a', 'congress', { tradedAt: NOW - 30 * DAY });
    assert.equal(tradeDay(s), NOW - 30 * DAY);
    assert.equal(tradeDay({ ...s, trade: { ...s.trade!, tradedAt: null } }), s.timestamp);
  });

  it('sorts by when the trade happened, newest first', () => {
    const early = signal('early', 'congress', { tradedAt: NOW - 50 * DAY }, { timestamp: NOW });
    const late = signal('late', 'congress', { tradedAt: NOW - 5 * DAY }, { timestamp: NOW - 2 * DAY });
    assert.deepEqual(byTradeDay([early, late]).map((s) => s.id), ['late', 'early']);
  });
});

describe('summarizeCongress', () => {
  const since = windowStart(NOW);

  it('counts trades and distinct members inside the window', () => {
    const summary = summarizeCongress(
      [
        signal('1', 'congress', { traderName: 'Pete Sessions', action: 'sell', tradedAt: NOW - 17 * DAY }),
        signal('2', 'congress', { traderName: 'Kevin Hern', action: 'sell', tradedAt: NOW - 31 * DAY }),
        signal('3', 'congress', { traderName: 'kevin hern', action: 'sell', tradedAt: NOW - 31 * DAY }),
        signal('4', 'congress', { traderName: 'Cleo Fields', action: 'buy', tradedAt: NOW - 31 * DAY }),
        // Outside the 90 days.
        signal('5', 'congress', { traderName: 'Old Trade', action: 'buy', tradedAt: NOW - 120 * DAY }),
      ],
      since,
    );
    assert.deepEqual(summary, { trades: 4, members: 3, buys: 1, sells: 3 });
  });

  it('lists an option trade but counts it as neither a buy nor a sell of the stock', () => {
    const summary = summarizeCongress(
      [signal('o', 'congress', { tradedAt: NOW - DAY }, { badges: ['BUY', OPTIONS_BADGE] })],
      since,
    );
    assert.deepEqual(summary, { trades: 1, members: 1, buys: 0, sells: 0 });
  });
});

describe('summarizeInsiders', () => {
  it('counts open-market decisions apart from grants and withholding', () => {
    const since = windowStart(NOW);
    const summary = summarizeInsiders(
      [
        signal('s', 'insider', { action: 'sell', kindLabel: 'OPEN-MARKET SELL', tradedAt: NOW - 3 * DAY }),
        signal('g', 'insider', { action: 'buy', discretionary: false, kindLabel: 'GRANT / AWARD', tradedAt: NOW - 3 * DAY }),
        signal('f', 'insider', { action: 'sell', discretionary: false, kindLabel: 'TAX WITHHOLDING', tradedAt: NOW - 3 * DAY }),
        signal('old', 'insider', { action: 'buy', kindLabel: 'OPEN-MARKET BUY', tradedAt: NOW - 200 * DAY }),
      ],
      since,
    );
    assert.deepEqual(summary, { filings: 3, openMarketBuys: 0, openMarketSells: 1 });
  });
});

describe('moneyValue', () => {
  it('reads the figure back out of a formatted label', () => {
    assert.equal(moneyValue('-$63.8M'), 63_800_000);
    assert.equal(moneyValue('$796K'), 796_000);
    assert.equal(moneyValue('$8,400'), 8_400);
    assert.equal(moneyValue('$1.2B'), 1_200_000_000);
  });

  it('is null where there is no dollar figure', () => {
    assert.equal(moneyValue('47K shares'), null);
    assert.equal(moneyValue(null), null);
  });
});

describe('priceSummary', () => {
  it('measures first close to last', () => {
    const s = priceSummary({ times: [1, 2, 3], closes: [100, 90, 107.65] });
    assert.ok(s);
    assert.equal(s.last, 107.65);
    assert.equal(s.lastAt, 3);
    assert.ok(Math.abs(s.changePct - 7.65) < 1e-9);
  });

  it('is null for an empty series', () => {
    assert.equal(priceSummary({ times: [], closes: [] }), null);
  });
});

describe('sessionIndex', () => {
  // Thu 3, Fri 4, Mon 7 and Tue 8 September 2026.
  const times = [session(2026, 9, 3), session(2026, 9, 4), session(2026, 9, 7), session(2026, 9, 8)];

  it('finds the session on the trade date', () => {
    assert.equal(sessionIndex(times, Date.UTC(2026, 8, 7)), 2);
  });

  it('snaps a weekend trade back to the Friday', () => {
    assert.equal(sessionIndex(times, Date.UTC(2026, 8, 5)), 1);
    assert.equal(sessionIndex(times, Date.UTC(2026, 8, 6)), 1);
  });

  it('has no place for a trade before the history, or well after it', () => {
    assert.equal(sessionIndex(times, Date.UTC(2026, 8, 2)), null);
    assert.equal(sessionIndex(times, Date.UTC(2026, 8, 30)), null);
    assert.equal(sessionIndex([], NOW), null);
  });

  it('pins a trade a day or two past the last close to that close', () => {
    assert.equal(sessionIndex(times, Date.UTC(2026, 8, 9)), 3);
  });
});

describe('chartMarks', () => {
  const times = [session(2026, 9, 3), session(2026, 9, 4), session(2026, 9, 7), session(2026, 9, 8)];
  const on = (d: number) => Date.UTC(2026, 8, d);

  it('groups a session’s trades into one mark per source', () => {
    const marks = chartMarks(
      times,
      [
        signal('b', 'congress', { action: 'buy', tradedAt: on(8) }),
        signal('s', 'congress', { action: 'sell', tradedAt: on(8) }),
        signal('one', 'congress', { action: 'sell', tradedAt: on(4) }),
      ],
      [],
    );
    assert.deepEqual(marks, [
      { index: 1, source: 'congress', buys: 0, sells: 1, large: false },
      { index: 3, source: 'congress', buys: 1, sells: 1, large: true },
    ]);
  });

  it('pins insider decisions only, and flags a $1M+ trade', () => {
    const marks = chartMarks(
      times,
      [],
      [
        signal('big', 'insider', { action: 'sell', amountLabel: '$63.8M', tradedAt: on(3) }),
        signal('small', 'insider', { action: 'sell', amountLabel: '$796K', tradedAt: on(7) }),
        signal('grant', 'insider', { action: 'buy', discretionary: false, amountLabel: '$9M', tradedAt: on(4) }),
      ],
    );
    assert.deepEqual(marks, [
      { index: 0, source: 'insider', buys: 0, sells: 1, large: true },
      { index: 2, source: 'insider', buys: 0, sells: 1, large: false },
    ]);
  });

  it('keeps option trades off the stock’s line', () => {
    const marks = chartMarks(
      times,
      [signal('opt', 'congress', { tradedAt: on(7) }, { badges: ['BUY', OPTIONS_BADGE] })],
      [],
    );
    assert.deepEqual(marks, []);
  });

  it('draws congress first, then insiders, each left to right', () => {
    const marks = chartMarks(
      times,
      [signal('c2', 'congress', { tradedAt: on(8) }), signal('c1', 'congress', { tradedAt: on(3) })],
      [signal('i1', 'insider', { action: 'sell', tradedAt: on(4) })],
    );
    assert.deepEqual(
      marks.map((m) => `${m.source}:${m.index}`),
      ['congress:0', 'congress:3', 'insider:1'],
    );
  });
});

describe('scalePoints', () => {
  it('spans the width and puts the highest close at the top', () => {
    const points = scalePoints([10, 20, 15], 200, 100, 10);
    assert.deepEqual(points, [
      { x: 0, y: 90 },
      { x: 100, y: 10 },
      { x: 200, y: 50 },
    ]);
  });

  it('centres a flat series instead of dividing by zero', () => {
    assert.deepEqual(scalePoints([5, 5], 100, 40), [
      { x: 0, y: 20 },
      { x: 100, y: 20 },
    ]);
  });
});

describe('lineSegments', () => {
  it('centres each bar on its segment and turns it to the slope', () => {
    const [flat, rising] = lineSegments(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: -10 },
      ],
      2,
    );
    assert.ok(flat && rising);
    assert.equal(flat.angle, 0);
    assert.equal(flat.width, 11);
    assert.equal(flat.left, -0.5);
    assert.equal(flat.top, -1);
    assert.ok(Math.abs(rising.angle + 45) < 1e-9);
  });

  it('skips a zero-length step', () => {
    assert.equal(lineSegments([{ x: 1, y: 1 }, { x: 1, y: 1 }], 2).length, 0);
  });
});

describe('monthTicks', () => {
  it('labels the first session of each month', () => {
    const times = [
      ...Array.from({ length: 10 }, (_, i) => session(2026, 7, 10 + i)),
      session(2026, 8, 3),
      session(2026, 8, 4),
      session(2026, 9, 1),
    ];
    assert.deepEqual(monthTicks(times), [
      { index: 0, label: 'JUL' },
      { index: 10, label: 'AUG' },
      { index: 12, label: 'SEP' },
    ]);
  });

  it('drops a stub opening month whose label would collide', () => {
    const times = [session(2026, 7, 30), session(2026, 7, 31), session(2026, 8, 3)];
    assert.deepEqual(monthTicks(times), [{ index: 2, label: 'AUG' }]);
  });
});

describe('fund holders', () => {
  const position = (weight: number, extra: Partial<FundPosition> = {}): FundPosition => ({
    issuer: 'APPLE INC',
    ticker: 'AAPL',
    classTitle: 'COM',
    cusip: '037833100',
    putCall: null,
    value: weight * 1_000,
    shares: weight * 10,
    weight,
    ...extra,
  });
  const holder = (name: string, positions: FundPosition[]): FundHolder => ({
    cik: name,
    name,
    logo: null,
    period: '2026-06-30',
    positions,
  });

  it('reads the stake in the stock apart from options on it', () => {
    const stake = stockStake(holder('A', [position(0.2), position(0.05, { putCall: 'PUT' })]));
    assert.equal(stake.weight, 0.2);
    assert.equal(stake.value, 200);
  });

  it('falls back to the options when that is all a fund holds', () => {
    assert.equal(stockStake(holder('A', [position(0.03, { putCall: 'CALL' })])).weight, 0.03);
  });

  it('ranks the biggest share of a portfolio first and leaves out non-holders', () => {
    const ranked = rankHolders([holder('Small', [position(0.01)]), holder('None', []), holder('Big', [position(0.22)])]);
    assert.deepEqual(ranked.map((h) => h.name), ['Big', 'Small']);
  });
});

describe('seatLine', () => {
  it('shortens the party to a letter', () => {
    assert.equal(seatLine('TX-17 · Republican'), 'TX-17 · R');
    assert.equal(seatLine('LA-6 · Democrat'), 'LA-6 · D');
    assert.equal(seatLine('CA'), 'CA');
    assert.equal(seatLine(null), '');
  });
});

describe('normalizeTrade on a partial sale', () => {
  it('says partial in the kind, and is still a sell', () => {
    const s = normalizeTrade(
      {
        representative: 'Kevin Hern',
        ticker: 'AAPL',
        transaction: 'Sale (partial)',
        range: '$1,001 - $15,000',
        transactionDate: '2026-09-08',
        disclosureDate: '2026-09-20',
      },
      { handle: 'kevin-hern-ok01', displayName: 'Kevin Hern' },
    );
    assert.equal(s.trade?.action, 'sell');
    assert.equal(s.trade?.kindLabel, 'PARTIAL SALE');
  });
});

describe('ownerName', () => {
  it('puts a filer’s given name first and recases capitals', () => {
    assert.equal(ownerName('COOK TIMOTHY D'), 'Timothy D Cook');
    assert.equal(ownerName('Newstead Jennifer'), 'Jennifer Newstead');
    assert.equal(ownerName("O'BRIEN DEIRDRE"), "Deirdre O'Brien");
    assert.equal(ownerName('Smith, John'), 'John Smith');
  });

  it('keeps a suffix last', () => {
    assert.equal(ownerName('LEVINSON ARTHUR D JR'), 'Arthur D Levinson Jr');
    assert.equal(ownerName('GATES WILLIAM H III'), 'William H Gates III');
  });

  it('leaves an entity in its own order', () => {
    assert.equal(ownerName('BERKSHIRE HATHAWAY INC'), 'Berkshire Hathaway Inc');
    assert.equal(ownerName('Vanguard Group'), 'Vanguard Group');
  });
});
