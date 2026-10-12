import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fundOverlaps, tradersPhrase } from '../src/lib/overlap.ts';
import type { FundMove, Signal } from '../src/providers/types.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 8);

function trade(id: string, source: 'congress' | 'insider', ticker: string, trader: string, daysAgo: number): Signal {
  return {
    id,
    source,
    actor: { handle: 'h', displayName: trader },
    text: '',
    url: 'https://example.test',
    timestamp: NOW - daysAgo * DAY,
    ticker,
    trade: { traderName: trader, action: 'buy', discretionary: true, kindLabel: 'PURCHASE' },
  };
}

function move(ticker: string, kind: FundMove['kind']): FundMove {
  return {
    issuer: ticker, ticker, classTitle: 'COM', cusip: ticker, putCall: null, value: 1, shares: 1, weight: 0.1,
    kind, valueBefore: 0, sharesBefore: 0, sharesChangePct: null,
  };
}

function filing(id: string, fund: string, daysAgo: number, moves: FundMove[]): Signal {
  return {
    id,
    source: 'funds',
    actor: { handle: fund, displayName: fund },
    text: '',
    url: 'https://example.test',
    timestamp: NOW - daysAgo * DAY,
    holdings: {
      form: '13F-HR', period: '2026-06-30', totalValue: 1, priorValue: 1, positionCount: 1,
      positions: [], moves, truncated: false,
    },
  };
}

describe('fundOverlaps', () => {
  const signals = [
    filing('f1', 'Pershing', 50, [move('MSFT', 'new'), move('HLT', 'exited'), move('QSR', 'unchanged')]),
    filing('f0', 'Pershing', 140, [move('NKE', 'new')]),
    trade('c1', 'congress', 'MSFT', 'Nancy Pelosi', 30),
    trade('c2', 'congress', 'MSFT', 'Nancy Pelosi', 20),
    trade('c3', 'congress', 'MSFT', 'Max Miller', 10),
    trade('i1', 'insider', 'MSFT', 'Satya Nadella', 5),
    trade('c4', 'congress', 'HLT', 'Cleo Fields', 200),
    trade('c5', 'congress', 'QSR', 'Cleo Fields', 5),
    trade('c6', 'congress', 'NKE', 'Cleo Fields', 5),
  ];
  const overlaps = fundOverlaps(signals, NOW);

  it('pairs a fund’s move with the people who traded the same stock', () => {
    const msft = overlaps.find((o) => o.ticker === 'MSFT');
    assert.deepEqual(msft?.traders, { congress: ['Max Miller', 'Nancy Pelosi'], insider: ['Satya Nadella'] });
    assert.equal(msft?.kind, 'new');
  });

  it('counts each person once, however often they filed', () => {
    const msft = overlaps.find((o) => o.ticker === 'MSFT');
    assert.equal(msft?.traders.congress?.length, 2);
  });

  it('ignores trades outside the window, unchanged positions and older filings', () => {
    assert.deepEqual(
      overlaps.map((o) => o.ticker),
      ['MSFT'],
    );
  });

  it('phrases the people for a sentence', () => {
    assert.equal(
      tradersPhrase({ congress: ['A', 'B'], insider: ['C'] }),
      '2 members of Congress and 1 insider',
    );
    assert.equal(tradersPhrase({ congress: ['A'] }), '1 member of Congress');
  });
});
