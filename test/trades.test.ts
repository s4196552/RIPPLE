import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FLAT_THRESHOLD_PCT,
  assetType,
  classifyQuality,
  holdingSummary,
  qualityLabel,
  qualityTone,
  toTradeRows,
  topAssets,
} from '../src/lib/trades.ts';
import type { Signal, SourceId, TradeDetail } from '../src/providers/types.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 5, 15);

function signal(
  id: string,
  at: number,
  opts: {
    ticker?: string | null;
    action?: TradeDetail['action'];
    trader?: string;
    changePct?: number | null;
    excessPct?: number | null;
    source?: SourceId;
    assetName?: string;
    discretionary?: boolean;
    kindLabel?: string;
  } = {},
): Signal {
  const {
    ticker = 'NVDA',
    action = 'buy',
    trader = 'Nancy Pelosi',
    changePct,
    excessPct,
    discretionary = true,
    kindLabel = action === 'buy' ? 'PURCHASE' : 'SALE',
  } = opts;

  return {
    id,
    source: opts.source ?? 'congress',
    actor: { handle: 'a', displayName: trader },
    text: `signal ${id}`,
    url: `https://example.test/${id}`,
    timestamp: at,
    ticker,
    ...(ticker
      ? {
          trade: {
            traderName: trader,
            traderTitle: 'CA-11',
            action,
            discretionary,
            kindLabel,
            assetName: opts.assetName ?? ticker,
            amountLabel: '$1,001 - $15,000',
          } satisfies TradeDetail,
        }
      : {}),
    ...(changePct === undefined
      ? {}
      : changePct === null
        ? {}
        : { reaction: { changePct, sessions: 10, excessPct: excessPct ?? null } }),
  };
}

describe('assetType', () => {
  it('reads a crypto pair from its quote suffix', () => {
    assert.equal(assetType('BTC-USD'), 'Crypto');
    assert.equal(assetType('eth-usd'), 'Crypto');
  });

  it('recognises well-known ETFs', () => {
    assert.equal(assetType('SPY'), 'ETF');
    assert.equal(assetType('QQQ'), 'ETF');
  });

  it('calls anything unrecognised a stock rather than guessing', () => {
    // Ticker shape cannot distinguish an ETF from a common stock, so an
    // unknown symbol is reported plainly instead of mislabelled.
    assert.equal(assetType('NVDA'), 'Stock');
    assert.equal(assetType('ZZZZ'), 'Stock');
  });
});

describe('classifyQuality', () => {
  it('calls a sale ahead of a fall well timed', () => {
    assert.equal(classifyQuality('sell', -10), 'sold-high');
  });

  it('calls a sale ahead of a rise early', () => {
    assert.equal(classifyQuality('sell', 10), 'sold-early');
  });

  it('calls a purchase ahead of a rise well timed', () => {
    assert.equal(classifyQuality('buy', 10), 'bought-low');
  });

  it('calls a purchase ahead of a fall early', () => {
    assert.equal(classifyQuality('buy', -10), 'bought-early');
  });

  it('calls a small move flat, whichever way it went', () => {
    // Without a dead band a 0.2% drift would be reported as shrewd timing.
    assert.equal(classifyQuality('sell', 0.2), 'flat');
    assert.equal(classifyQuality('buy', -0.2), 'flat');
    assert.equal(classifyQuality('sell', FLAT_THRESHOLD_PCT - 0.01), 'flat');
  });

  it('honours a caller-supplied threshold', () => {
    assert.equal(classifyQuality('sell', -5, 10), 'flat');
    assert.equal(classifyQuality('sell', -5, 1), 'sold-high');
  });

  it('treats a non-finite return as flat rather than throwing', () => {
    assert.equal(classifyQuality('sell', Number.NaN), 'flat');
  });
});

describe('quality presentation', () => {
  it('labels each verdict in plain words', () => {
    assert.equal(qualityLabel('sold-high'), 'Sold high');
    assert.equal(qualityLabel('sold-early'), 'Sold early');
    assert.equal(qualityLabel('bought-low'), 'Bought low');
    assert.equal(qualityLabel('flat'), 'Flat');
  });

  it('tones good timing up and poor timing down', () => {
    assert.equal(qualityTone('sold-high'), 'up');
    assert.equal(qualityTone('bought-low'), 'up');
    assert.equal(qualityTone('sold-early'), 'down');
    assert.equal(qualityTone('bought-early'), 'down');
    assert.equal(qualityTone('flat'), 'neutral');
  });
});

describe('toTradeRows', () => {
  it('builds a row per disclosed trade, newest first', () => {
    const rows = toTradeRows([
      signal('old', NOW - 5 * DAY),
      signal('new', NOW),
    ]);
    assert.deepEqual(rows.map((r) => r.signal.id), ['new', 'old']);
  });

  it('skips signals that are not trades', () => {
    // An executive order has no trader, action or asset — a row of dashes is
    // worse than no row.
    const order: Signal = {
      id: 'eo',
      source: 'policy',
      actor: { handle: 'wh', displayName: 'The White House' },
      text: 'An executive order',
      url: 'https://example.test',
      timestamp: NOW,
    };
    assert.deepEqual(toTradeRows([order]), []);
  });

  it('skips a trade with no ticker', () => {
    assert.deepEqual(toTradeRows([signal('a', NOW, { ticker: null })]), []);
  });

  it('carries the return and derives the verdict from it', () => {
    const [row] = toTradeRows([signal('a', NOW, { action: 'sell', changePct: -12 })]);

    assert.equal(row?.changePct, -12);
    assert.equal(row?.quality, 'sold-high');
  });

  it('leaves the verdict null when there is no price data to judge', () => {
    const [row] = toTradeRows([signal('a', NOW)]);

    assert.equal(row?.changePct, null);
    assert.equal(row?.quality, null, 'no return means no verdict, not a flat one');
  });

  it('withholds a verdict on a movement nobody chose', () => {
    // A share grant has no timing to judge, and "Sold early" on a tax
    // withholding is nonsense. Real NVDA filings surfaced this: seven grants
    // were rendering as open-market buys.
    const [row] = toTradeRows([
      signal('a', NOW, { action: 'buy', changePct: 20, discretionary: false, kindLabel: 'GRANT / AWARD' }),
    ]);

    assert.equal(row?.changePct, 20, 'the return is still reported');
    assert.equal(row?.quality, null, 'but no timing verdict is drawn from it');
  });

  it('classifies the asset', () => {
    const [row] = toTradeRows([signal('a', NOW, { ticker: 'BTC-USD' })]);
    assert.equal(row?.assetType, 'Crypto');
  });

  it('upcases the ticker', () => {
    const [row] = toTradeRows([signal('a', NOW, { ticker: 'nvda' })]);
    assert.equal(row?.ticker, 'NVDA');
  });
});

describe('topAssets', () => {
  it('ranks by distinct traders, not filing count', () => {
    // One prolific filer must not outrank a genuine crowd.
    const rows = toTradeRows([
      signal('a1', NOW, { ticker: 'AAPL', trader: 'Solo Filer' }),
      signal('a2', NOW - DAY, { ticker: 'AAPL', trader: 'Solo Filer' }),
      signal('a3', NOW - 2 * DAY, { ticker: 'AAPL', trader: 'Solo Filer' }),
      signal('n1', NOW, { ticker: 'NVDA', trader: 'One' }),
      signal('n2', NOW - DAY, { ticker: 'NVDA', trader: 'Two' }),
    ]);

    const top = topAssets(rows);
    assert.equal(top[0]?.ticker, 'NVDA');
    assert.equal(top[0]?.traders, 2);
    assert.equal(top[1]?.ticker, 'AAPL');
    assert.equal(top[1]?.traders, 1);
  });

  it('counts buys and sells and nets them', () => {
    const rows = toTradeRows([
      signal('b1', NOW, { action: 'buy', trader: 'One' }),
      signal('b2', NOW - DAY, { action: 'buy', trader: 'Two' }),
      signal('s1', NOW - 2 * DAY, { action: 'sell', trader: 'Three' }),
    ]);

    const [top] = topAssets(rows);
    assert.equal(top?.buys, 2);
    assert.equal(top?.sells, 1);
    assert.equal(top?.net, 1);
  });

  it('counts grants apart from purchases, never as buys', () => {
    // Real NVDA data showed "7 bought" when all seven were share grants.
    const rows = toTradeRows([
      signal('g1', NOW, { action: 'buy', trader: 'One', discretionary: false, kindLabel: 'GRANT / AWARD' }),
      signal('g2', NOW - DAY, { action: 'buy', trader: 'Two', discretionary: false, kindLabel: 'GRANT / AWARD' }),
      signal('s1', NOW - 2 * DAY, { action: 'sell', trader: 'Three' }),
    ]);

    const [top] = topAssets(rows);
    assert.equal(top?.buys, 0, 'a grant is not a purchase');
    assert.equal(top?.awarded, 2);
    assert.equal(top?.sells, 1);
    assert.equal(holdingSummary(top!), '1 sold · 2 awarded');
  });

  it('reports the most recent disclosure on the asset', () => {
    const rows = toTradeRows([
      signal('a', NOW - 10 * DAY, { trader: 'One' }),
      signal('b', NOW, { trader: 'Two' }),
    ]);
    assert.equal(topAssets(rows)[0]?.lastTradedAt, NOW);
  });

  it('honours the limit', () => {
    const rows = toTradeRows(
      ['A', 'B', 'C', 'D'].map((t, i) => signal(t, NOW - i * DAY, { ticker: t })),
    );
    assert.equal(topAssets(rows, 2).length, 2);
  });

  it('returns nothing for no trades', () => {
    assert.deepEqual(topAssets([]), []);
  });

  it('does not leak the internal trader set into the result', () => {
    const [top] = topAssets(toTradeRows([signal('a', NOW)]));
    assert.equal((top as unknown as { traderSet?: unknown }).traderSet, undefined);
  });
});

describe('holdingSummary', () => {
  it('names both sides when both happened', () => {
    const rows = toTradeRows([
      signal('b', NOW, { action: 'buy', trader: 'One' }),
      signal('s', NOW - DAY, { action: 'sell', trader: 'Two' }),
    ]);
    assert.equal(holdingSummary(topAssets(rows)[0]!), '1 bought · 1 sold');
  });

  it('omits a side that never happened', () => {
    const rows = toTradeRows([signal('b', NOW, { action: 'buy' })]);
    assert.equal(holdingSummary(topAssets(rows)[0]!), '1 bought');
  });
});
