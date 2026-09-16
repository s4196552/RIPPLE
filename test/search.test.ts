import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NO_FILTER,
  applyFilter,
  filterSummary,
  isFiltering,
  matchesAction,
  matchesQuery,
  suggestions,
  withinWindow,
} from '../src/lib/search.ts';
import type { Signal, TradeDetail } from '../src/providers/types.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 4);

function signal(id: string, over: Partial<Signal> = {}): Signal {
  return {
    id,
    source: 'congress',
    actor: { handle: 'a', displayName: 'Nancy Pelosi', subtitle: 'CA-11 · Democrat' },
    text: 'Disclosed a purchase',
    url: `https://example.test/${id}`,
    timestamp: NOW,
    ...over,
  };
}

function trade(over: Partial<TradeDetail> = {}): TradeDetail {
  return {
    traderName: 'Nancy Pelosi',
    traderTitle: 'CA-11',
    action: 'buy',
    discretionary: true,
    kindLabel: 'PURCHASE',
    assetName: 'NVIDIA Corporation',
    amountLabel: '$1,001 - $15,000',
    ...over,
  };
}

describe('isFiltering', () => {
  it('is false for the empty filter', () => {
    assert.equal(isFiltering(NO_FILTER), false);
  });

  it('ignores a query that is only whitespace', () => {
    // Otherwise tapping into the field and back out leaves the feed looking
    // filtered, with a count bar and a clear button and nothing removed.
    assert.equal(isFiltering({ ...NO_FILTER, query: '   ' }), false);
  });

  it('is true for any real constraint', () => {
    assert.equal(isFiltering({ ...NO_FILTER, query: 'nvda' }), true);
    assert.equal(isFiltering({ ...NO_FILTER, action: 'sell' }), true);
    assert.equal(isFiltering({ ...NO_FILTER, window: 30 }), true);
  });
});

describe('matchesQuery', () => {
  it('finds a person by name', () => {
    assert.equal(matchesQuery(signal('a'), 'pelosi'), true);
  });

  it('is case insensitive', () => {
    assert.equal(matchesQuery(signal('a'), 'PELOSI'), true);
  });

  it('finds a ticker with or without the dollar sign', () => {
    const s = signal('a', { ticker: 'NVDA' });
    assert.equal(matchesQuery(s, 'nvda'), true);
    assert.equal(matchesQuery(s, '$NVDA'), true);
  });

  it('searches the district and party in the subtitle', () => {
    assert.equal(matchesQuery(signal('a'), 'democrat'), true);
  });

  it('searches the company name behind a ticker', () => {
    const s = signal('a', { ticker: 'NVDA', trade: trade() });
    assert.equal(matchesQuery(s, 'nvidia'), true);
  });

  it('searches badges', () => {
    const s = signal('a', { badges: ['LATE FILING'] });
    assert.equal(matchesQuery(s, 'late'), true);
  });

  it('narrows with each extra term rather than widening', () => {
    // Typing more words getting you more results is the behaviour people find
    // surprising, so every term has to match.
    const s = signal('a', { ticker: 'NVDA', trade: trade() });
    assert.equal(matchesQuery(s, 'pelosi nvda'), true);
    assert.equal(matchesQuery(s, 'pelosi tesla'), false);
  });

  it('matches everything on an empty query', () => {
    assert.equal(matchesQuery(signal('a'), ''), true);
    assert.equal(matchesQuery(signal('a'), '   '), true);
  });

  it('does not crash on a signal with nothing optional set', () => {
    const bare: Signal = {
      id: 'x',
      source: 'policy',
      actor: { handle: 'wh', displayName: 'The White House' },
      text: 'An executive order',
      url: 'https://example.test',
      timestamp: NOW,
    };
    assert.equal(matchesQuery(bare, 'white house'), true);
    assert.equal(matchesQuery(bare, 'nvda'), false);
  });
});

describe('matchesAction', () => {
  it('keeps everything on all', () => {
    assert.equal(matchesAction(signal('a'), 'all'), true);
  });

  it('separates buys from sells', () => {
    const buy = signal('a', { trade: trade({ action: 'buy' }) });
    const sell = signal('b', { trade: trade({ action: 'sell', kindLabel: 'SALE' }) });

    assert.equal(matchesAction(buy, 'buy'), true);
    assert.equal(matchesAction(buy, 'sell'), false);
    assert.equal(matchesAction(sell, 'sell'), true);
  });

  it('excludes a movement nobody chose', () => {
    // Filtering to Buys and being handed seven vesting events is the same bug
    // the Trades table already had.
    const grant = signal('a', {
      trade: trade({ action: 'buy', discretionary: false, kindLabel: 'GRANT / AWARD' }),
    });
    assert.equal(matchesAction(grant, 'buy'), false);
    assert.equal(matchesAction(grant, 'all'), true, 'but it is still a signal');
  });

  it('excludes a signal that is not a trade at all', () => {
    const order = signal('a', { source: 'policy', text: 'An executive order' });
    assert.equal(matchesAction(order, 'buy'), false);
    assert.equal(matchesAction(order, 'sell'), false);
  });
});

describe('withinWindow', () => {
  it('keeps everything on all', () => {
    assert.equal(withinWindow(signal('a', { timestamp: 0 }), 'all', NOW), true);
  });

  it('keeps a signal inside the window and drops one outside', () => {
    const recent = signal('a', { timestamp: NOW - 3 * DAY });
    const old = signal('b', { timestamp: NOW - 30 * DAY });

    assert.equal(withinWindow(recent, 7, NOW), true);
    assert.equal(withinWindow(old, 7, NOW), false);
    assert.equal(withinWindow(old, 90, NOW), true);
  });

  it('includes a signal exactly on the boundary', () => {
    assert.equal(withinWindow(signal('a', { timestamp: NOW - 7 * DAY }), 7, NOW), true);
  });

  it('keeps a signal dated in the future', () => {
    // Disclosure dates are day-resolution and time zones are not, so a filing
    // can legitimately read as slightly ahead of the device clock. Hiding it
    // would be worse than showing it.
    assert.equal(withinWindow(signal('a', { timestamp: NOW + DAY }), 7, NOW), true);
  });
});

describe('applyFilter', () => {
  const feed = [
    signal('nvda-buy', { ticker: 'NVDA', trade: trade(), timestamp: NOW - DAY }),
    signal('nvda-sell', {
      ticker: 'NVDA',
      trade: trade({ action: 'sell', kindLabel: 'SALE' }),
      timestamp: NOW - 40 * DAY,
    }),
    signal('order', { source: 'policy', text: 'Executive order on semiconductors' }),
  ];

  it('returns everything unfiltered', () => {
    assert.equal(applyFilter(feed, NO_FILTER, NOW).length, 3);
  });

  it('combines every constraint', () => {
    const got = applyFilter(feed, { query: 'nvda', action: 'buy', window: 7 }, NOW);
    assert.deepEqual(got.map((s) => s.id), ['nvda-buy']);
  });

  it('preserves the feed order rather than ranking by relevance', () => {
    // The merge engine owns the order. A search that silently re-sorted would
    // make the newest thing hard to find exactly when someone is scanning.
    const got = applyFilter(feed, { ...NO_FILTER, query: 'nvda' }, NOW);
    assert.deepEqual(got.map((s) => s.id), ['nvda-buy', 'nvda-sell']);
  });

  it('can return nothing without throwing', () => {
    assert.deepEqual(applyFilter(feed, { ...NO_FILTER, query: 'zzzz' }, NOW), []);
  });

  it('copies rather than returning the caller its own array', () => {
    const got = applyFilter(feed, NO_FILTER, NOW);
    assert.notEqual(got, feed);
  });
});

describe('filterSummary', () => {
  it('names the total when nothing was removed', () => {
    assert.equal(filterSummary(3, 3), '3 signals');
    assert.equal(filterSummary(1, 1), '1 signal');
  });

  it('shows the fraction when something was', () => {
    assert.equal(filterSummary(2, 40), '2 of 40');
  });
});

describe('suggestions', () => {
  it('offers the busiest tickers in what is actually loaded', () => {
    // Drawn from the feed rather than a fixed list, so every suggestion is one
    // that will genuinely return results.
    const got = suggestions([
      signal('a', { ticker: 'NVDA' }),
      signal('b', { ticker: 'NVDA' }),
      signal('c', { ticker: 'AAPL' }),
      signal('d', { source: 'policy' }),
    ]);
    assert.deepEqual(got, ['NVDA', 'AAPL']);
  });

  it('honours the limit', () => {
    const many = ['A', 'B', 'C', 'D'].map((t) => signal(t, { ticker: t }));
    assert.equal(suggestions(many, 2).length, 2);
  });

  it('returns nothing for a feed with no tickers', () => {
    assert.deepEqual(suggestions([signal('a', { source: 'policy' })]), []);
  });
});
