import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assetName, disclosureLag, isLate, isoDate, partyTag, withoutParty } from '../src/lib/filing.ts';
import type { Signal } from '../src/providers/types.ts';

const DAY = 86_400_000;
const FILED = Date.UTC(2026, 7, 21);

function trade(lagDays: number | null, extra: Partial<Signal> = {}): Signal {
  return {
    id: 'congress:x',
    source: 'congress',
    actor: { handle: 'p', displayName: 'Nancy Pelosi' },
    text: 'Nancy Pelosi bought BE · Bloom Energy ($1,000,001 - $5,000,000) on 2026-07-24.',
    url: 'https://example.test',
    timestamp: FILED,
    ticker: 'BE',
    trade: {
      traderName: 'Nancy Pelosi',
      action: 'buy',
      discretionary: true,
      kindLabel: 'PURCHASE',
      assetName: 'BE',
      tradedAt: lagDays === null ? null : FILED - lagDays * DAY,
    },
    ...extra,
  };
}

describe('disclosureLag', () => {
  it('counts days from trade to disclosure', () => {
    assert.equal(disclosureLag(trade(28)), 28);
  });

  it('is unknown without a trade date', () => {
    assert.equal(disclosureLag(trade(null)), null);
  });
});

describe('isLate', () => {
  it('flags a congress trade past 45 days', () => {
    assert.equal(isLate(trade(52)), true);
    assert.equal(isLate(trade(45)), false);
  });

  it('trusts the provider badge', () => {
    assert.equal(isLate(trade(null, { badges: ['LATE FILING'] })), true);
  });
});

describe('partyTag', () => {
  it('reads the party out of a subtitle', () => {
    assert.equal(partyTag('CA-11 · Democrat'), 'DEM');
    assert.equal(partyTag('OH-7 · Republican'), 'REP');
    assert.equal(partyTag('VT · Independent'), 'IND');
    assert.equal(partyTag('Director'), null);
    assert.equal(partyTag(null), null);
    assert.equal(partyTag('Trades filed by Republican members'), null, 'a party is not a member');
  });

  it('drops the party word that the tag replaces', () => {
    assert.equal(withoutParty('CA-11 · Democrat'), 'CA-11');
    assert.equal(withoutParty('CEO'), 'CEO');
  });
});

describe('assetName', () => {
  it('recovers the company a congress trade names in its sentence', () => {
    assert.equal(assetName(trade(28)), 'Bloom Energy');
  });

  it('prefers a real asset name over the ticker', () => {
    const s = trade(28);
    s.trade!.assetName = 'NVIDIA Corporation';
    assert.equal(assetName(s), 'NVIDIA Corporation');
  });
});

describe('isoDate', () => {
  it('prints the date as filings do', () => {
    assert.equal(isoDate(FILED), '2026-08-21');
  });
});
