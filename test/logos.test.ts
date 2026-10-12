import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { logoUrl, siteIconUrl } from '../src/providers/logos.ts';

describe('logoUrl', () => {
  it('addresses a logo by ticker alone, with no API call', () => {
    assert.equal(
      logoUrl('AAPL'),
      'https://images.financialmodelingprep.com/symbol/AAPL.png',
    );
  });

  it('uppercases, so a symbol from a search result and a saved one agree', () => {
    assert.equal(logoUrl('nvda'), logoUrl('NVDA'));
  });

  it('trims stray whitespace', () => {
    assert.equal(logoUrl('  TSLA '), logoUrl('TSLA'));
  });

  it('leaves class shares and crypto pairs intact — the host accepts both', () => {
    // Verified against the live host: BRK.B, BTC-USD and BTCUSD all resolve, so
    // reshaping them would only risk turning a working symbol into a 404.
    assert.equal(logoUrl('BRK.B'), 'https://images.financialmodelingprep.com/symbol/BRK.B.png');
    assert.equal(
      logoUrl('BTC-USD'),
      'https://images.financialmodelingprep.com/symbol/BTC-USD.png',
    );
  });

  it('is null for nothing to look up, rather than a URL that 404s', () => {
    assert.equal(logoUrl(''), null);
    assert.equal(logoUrl('   '), null);
    assert.equal(logoUrl(null), null);
    assert.equal(logoUrl(undefined), null);
  });

  it('encodes a symbol so it cannot reshape the URL', () => {
    // Symbols arrive from search results and saved subjects, not a fixed list.
    const url = logoUrl('A/B?x=1');
    assert.ok(url);
    assert.equal(url.startsWith('https://images.financialmodelingprep.com/symbol/'), true);
    assert.equal(url.includes('?x='), false, 'a query string must not survive');
    assert.equal(url.includes('/B'), false, 'a path separator must not survive');
  });
});

describe('siteIconUrl', () => {
  it('asks for the large icon of a bare domain', () => {
    assert.equal(
      siteIconUrl('Bridgewater.com '),
      'https://www.google.com/s2/favicons?sz=128&domain=bridgewater.com',
    );
  });

  it('is null for nothing to look up', () => {
    assert.equal(siteIconUrl(''), null);
    assert.equal(siteIconUrl(null), null);
  });
});
