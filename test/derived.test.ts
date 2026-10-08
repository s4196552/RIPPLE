import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DERIVED_TICKERS_PER_GROUP,
  MAX_DERIVED_TICKERS,
  derivedTickerSubjects,
  isPartyHandle,
  topTickers,
  viaBadge,
} from '../src/store/derived.ts';
import type { Signal, SourceId } from '../src/providers/types.ts';
import type { WatchedSubject } from '../src/store/watchlist.ts';

let seq = 0;
function trade(handle: string, ticker: string | null, timestamp = 1_000): Signal {
  seq++;
  return {
    id: `congress:${seq}`,
    source: 'congress',
    actor: { handle, displayName: `Member ${seq}` },
    text: 'traded',
    url: 'https://example.test',
    timestamp,
    ticker,
  };
}

function subject(source: SourceId, handle: string, displayName: string, muted = false): WatchedSubject {
  return { source, handle, displayName, addedAt: 1, muted };
}

const nothingWatched = () => false;
const republicans = subject('congress', 'party:republican', 'Republicans');
const democrats = subject('congress', 'party:democrat', 'Democrats');

describe('isPartyHandle', () => {
  it('is true only for congress party scopes', () => {
    assert.equal(isPartyHandle('congress', 'party:republican'), true);
    assert.equal(isPartyHandle('congress', 'Party:Democrat'), true);
    assert.equal(isPartyHandle('congress', 'all'), false);
    assert.equal(isPartyHandle('congress', 'nancy-pelosi-ca11'), false);
    assert.equal(isPartyHandle('stocks', 'party:republican'), false);
  });
});

describe('topTickers', () => {
  it('ranks by how many trades name the ticker', () => {
    const signals = [trade('g', 'AAPL'), trade('g', 'NVDA'), trade('g', 'NVDA'), trade('g', 'MSFT')];
    // AAPL and MSFT tie on count and time, so the alphabetical tie-break decides.
    assert.deepEqual(topTickers(signals, 2), ['NVDA', 'AAPL']);
  });

  it('breaks a count tie on the most recent trade', () => {
    const signals = [trade('g', 'AAPL', 100), trade('g', 'MSFT', 500)];
    assert.deepEqual(topTickers(signals, 2), ['MSFT', 'AAPL']);
  });

  it('upcases and ignores signals with no ticker', () => {
    assert.deepEqual(topTickers([trade('g', 'aapl'), trade('g', null)], 5), ['AAPL']);
  });
});

describe('derivedTickerSubjects', () => {
  it('adds an Insiders and a Stocks subject for each top ticker of a party', () => {
    const signals = [trade('party:republican', 'NVDA'), trade('party:republican', 'NVDA')];
    const derived = derivedTickerSubjects([republicans], signals, nothingWatched);

    assert.deepEqual(
      derived.map((d) => `${d.source}:${d.handle}`),
      ['insider:NVDA', 'stocks:NVDA'],
    );
    assert.deepEqual(derived[0]!.via, ['Republicans']);
    assert.equal(derived[0]!.addedAt, 0, 'nobody added these');
  });

  it('takes at most the per-group number of tickers', () => {
    const tickers = ['A', 'B', 'C', 'D', 'E'];
    const signals = tickers.map((t) => trade('party:republican', t));
    const derived = derivedTickerSubjects([republicans], signals, nothingWatched);
    assert.equal(new Set(derived.map((d) => d.handle)).size, DERIVED_TICKERS_PER_GROUP);
  });

  it('caps the total across parties', () => {
    const many = (handle: string, prefix: string) =>
      Array.from({ length: 10 }, (_, i) => trade(handle, `${prefix}${String.fromCharCode(65 + i)}`));
    const signals = [...many('party:republican', 'R'), ...many('party:democrat', 'D')];
    const groups = [republicans, democrats, subject('congress', 'party:independent', 'Independents')];
    const derived = derivedTickerSubjects(groups, [...signals, ...many('party:independent', 'I')], nothingWatched);
    assert.ok(new Set(derived.map((d) => d.handle)).size <= MAX_DERIVED_TICKERS);
  });

  it('credits a ticker both parties traded to both, once', () => {
    const signals = [trade('party:republican', 'NVDA'), trade('party:democrat', 'NVDA')];
    const derived = derivedTickerSubjects([republicans, democrats], signals, nothingWatched);
    const insider = derived.filter((d) => d.source === 'insider');
    assert.equal(insider.length, 1);
    assert.deepEqual(insider[0]!.via, ['Republicans', 'Democrats']);
  });

  it('skips a subject the user already follows, which is fetched in its own right', () => {
    const signals = [trade('party:republican', 'NVDA')];
    const derived = derivedTickerSubjects([republicans], signals, (source, handle) => source === 'stocks' && handle === 'NVDA');
    assert.deepEqual(derived.map((d) => `${d.source}:${d.handle}`), ['insider:NVDA']);
  });

  it('sends crypto pairs to Stocks only — they have no Form 4 history', () => {
    const derived = derivedTickerSubjects([republicans], [trade('party:republican', 'BTC-USD')], nothingWatched);
    assert.deepEqual(derived.map((d) => d.source), ['stocks']);
  });

  it('ignores muted parties, members, and other sources', () => {
    const signals = [
      trade('party:republican', 'NVDA'),
      trade('nancy-pelosi-ca11', 'AAPL'),
    ];
    const groups = [
      subject('congress', 'party:republican', 'Republicans', true),
      subject('congress', 'nancy-pelosi-ca11', 'Nancy Pelosi'),
    ];
    assert.deepEqual(derivedTickerSubjects(groups, signals, nothingWatched), []);
  });

  it('returns nothing on keyless filings, which carry no ticker', () => {
    const signals = [trade('party:republican', null), trade('party:republican', null)];
    assert.deepEqual(derivedTickerSubjects([republicans], signals, nothingWatched), []);
  });
});

describe('viaBadge', () => {
  it('names every group, uppercased', () => {
    assert.equal(viaBadge(['Republicans']), 'VIA REPUBLICANS');
    assert.equal(viaBadge(['Republicans', 'Democrats']), 'VIA REPUBLICANS & DEMOCRATS');
  });
});
