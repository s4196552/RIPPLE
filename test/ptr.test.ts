import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { normalizeTrade, tradeSignalId, type FilingRow } from '../src/providers/congress/parse.ts';
import { parsePtr, tickerOf, type PtrTextItem, type PtrTransaction } from '../src/providers/congress/ptr.ts';
import { scrapedTrades } from '../src/providers/congress/scraped.ts';
import {
  assetName,
  decodeFiling,
  encodeFile,
  listedTrades,
} from '../src/providers/congress/scraped-format.ts';

/** Positioned text from real filings, read with pdf.js (see scripts/scrape-house-ptrs.ts). */
const fixture = (name: string): PtrTextItem[] =>
  JSON.parse(readFileSync(`test/fixtures/${name}.json`, 'utf8'));

describe('parsePtr on real filings', () => {
  // Hon. Lloyd K. Smucker, PA-11, filing 20019182: eight stock sales over two
  // pages, most with the asset name and the amount wrapped onto a second line.
  const smucker = parsePtr(fixture('ptr-20019182'));

  it('reads the filer and every transaction across both pages', () => {
    assert.equal(smucker.scanned, false);
    assert.equal(smucker.name, 'Hon. Lloyd K. Smucker');
    assert.deepEqual(
      smucker.transactions.map((t) => t.ticker),
      ['ENBP', 'FULT', 'FULT', 'FULT', 'PRU', 'TFC', 'VZ', 'WFC'],
    );
  });

  it('joins an asset name and an amount that wrap onto the next line', () => {
    const fult = smucker.transactions[1]!;
    assert.equal(fult.asset, 'Fulton Financial Corporation - Common Stock (FULT) [ST]');
    assert.equal(fult.amount, '$50,001 - $100,000');
    assert.equal(fult.assetType, 'ST');
  });

  it('keeps side, trade date and notification date apart', () => {
    const fult = smucker.transactions[2]!;
    assert.equal(fult.type, 'sale');
    assert.equal(fult.date, '2026-04-17');
    assert.equal(fult.notified, '2026-04-20');
  });

  it('does not run a transaction into the field labels under it', () => {
    for (const t of smucker.transactions) {
      assert.ok(!/Filing Status|Subholding|New$/.test(t.asset), t.asset);
      assert.ok(/^\$[\d,]+ - \$[\d,]+$/.test(t.amount), t.amount);
    }
  });

  it('follows a transaction that wraps across a page break, past the repeated header', () => {
    // Filing 20026658: the third Alphabet purchase starts at the foot of page 1
    // and its "(GOOG) [ST]" line is the first row of page 2.
    const txs = parsePtr(fixture('ptr-20026658')).transactions;
    const alphabet = txs.filter((t) => t.asset.startsWith('Alphabet Inc. - Class C'));
    assert.ok(alphabet.length >= 3);
    for (const t of alphabet) assert.equal(t.ticker, 'GOOG', t.asset);
    assert.ok(txs.every((t) => t.assetType !== null), 'every transaction kept its asset code');
  });

  it('reads a non-stock asset without inventing a ticker', () => {
    // Hon. Rudy C. Yakym III, filing 20034984: a single Treasury bill.
    const [bill] = parsePtr(fixture('ptr-20034984')).transactions;
    assert.equal(bill!.ticker, null);
    assert.equal(bill!.assetType, 'GS');
    assert.equal(bill!.type, 'purchase');
    assert.equal(bill!.amount, '$15,001 - $50,000');
    assert.match(bill!.asset, /^Treasury Bill \(3-Month, Matures 10\/15\/2026\) \[GS\]$/);
  });

  it('reports a scanned paper filing as scanned, with nothing guessed', () => {
    assert.deepEqual(parsePtr(fixture('ptr-scan-9116326')), { scanned: true, name: null, transactions: [] });
  });
});

describe('tickerOf', () => {
  it('takes the last parenthesised symbol', () => {
    assert.deepEqual(tickerOf('Berkshire Hathaway Inc. (Class B) (BRK.B) [ST]'), { ticker: 'BRK.B', assetType: 'ST' });
  });

  it('does not take a CUSIP for a ticker', () => {
    assert.deepEqual(tickerOf('US Treasury Note 3.5% DUE 01/31/28 (91282CGH8) [GS]'), { ticker: null, assetType: 'GS' });
  });
});

describe('scraped trades', () => {
  const row: FilingRow = {
    prefix: 'Hon.',
    last: 'Smucker',
    first: 'Lloyd K.',
    suffix: '',
    filingType: 'P',
    stateDst: 'PA11',
    year: '2026',
    filingDate: '4/30/2026',
    docId: '20019182',
  };
  const tx = (ticker: string | null, type: PtrTransaction['type'], amount: string, owner: string | null, asset: string): PtrTransaction => ({
    ticker,
    type,
    date: '2026-04-23',
    notified: null,
    amount,
    owner,
    asset,
    assetType: asset.match(/\[([A-Z]{2})\]$/)?.[1] ?? null,
  });
  const parsed: PtrTransaction[] = [
    tx('FULT', 'sale', '$50,001 - $100,000', 'SP', 'Fulton Financial Corporation - Common Stock (FULT) [ST]'),
    tx(null, 'purchase', '$15,001 - $50,000', null, 'Treasury Bill (3-Month) [GS]'),
    tx('XOM', 'exchange', '$1,001 - $15,000', null, 'Exxon Mobil Corporation (XOM) [ST]'),
    tx('AAPL', 'purchase', '$1,001 - $15,000', 'JT', 'Apple Inc. - Common Stock (AAPL) [ST]'),
    tx('GLAS', 'purchase', '$1,001 - $15,000', null, 'Trimer Capital Partners I LP (GLAS) - Core [HN]'),
    tx('BTC', 'purchase', '$1,001 - $15,000', null, 'Bitcoin (BTC) [CT]'),
    tx('MSFT', 'purchase', '$15,001 - $50,000', null, 'Microsoft Corporation - Common Stock (MSFT) [OP]'),
    tx('IBIT', 'sale', '$1,001 - $15,000', null, 'iShares Bitcoin Trust ETF (IBIT) [ET]'),
  ];
  const fileOf = (docId: string, trades = listedTrades(parsed)) =>
    encodeFile({ [docId]: trades }, { generatedAt: '', years: [2026], unlisted: [], scanned: [], unreadable: [] });
  const file = fileOf(row.docId);

  it('keeps only listed buys and sells: no bonds, private funds, crypto or exchanges', () => {
    assert.deepEqual(listedTrades(parsed).map((t) => `${t.side} ${t.ticker}`), [
      'sale FULT',
      'purchase AAPL',
      'purchase MSFT',
      'sale IBIT',
    ]);
  });

  it('round-trips through the compact file, storing each band and name once', () => {
    assert.deepEqual(decodeFiling(file, row.docId), listedTrades(parsed));
    assert.equal(file.bands.length, 3);
    assert.equal(file.names.AAPL, 'Apple Inc.');
  });

  it('dates the disclosure to the filing, and links the card to the PDF', () => {
    const [fult] = scrapedTrades(row, file);
    assert.equal(fult!.transaction, 'Sale');
    assert.equal(fult!.disclosureDate, '2026-04-30');
    assert.equal(fult!.sourceUrl, 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20019182.pdf');
    assert.equal(fult!.amount, 75_001);
  });

  it('labels an option trade as options, not as the stock', () => {
    const msft = scrapedTrades(row, file).find((t) => t.ticker === 'MSFT');
    assert.equal(msft!.assetName, 'Microsoft Corporation (options)');
  });

  it('gives two same-day lots of one stock distinct ids', () => {
    const fult = listedTrades(parsed)[0]!;
    const ids = scrapedTrades(row, fileOf(row.docId, [fult, fult])).map(tradeSignalId);
    assert.equal(new Set(ids).size, 2);
  });

  it('has nothing for a filing the file does not hold', () => {
    assert.deepEqual(scrapedTrades({ ...row, docId: '1' }, file), []);
  });

  it('says whose account it was, and names the company, on the card', () => {
    const [fult] = scrapedTrades(row, file);
    const actor = { handle: 'lloyd-k-smucker-pa11', displayName: 'Lloyd Smucker', subtitle: null, avatarUrl: null };
    const signal = normalizeTrade(fult!, actor);
    assert.equal(signal.url, fult!.sourceUrl);
    assert.match(signal.text, /sold FULT · Fulton Financial Corporation/);
    assert.match(signal.text, /in a spouse’s account/);
    assert.equal(signal.ticker, 'FULT');
  });

  it('trims the share-class boilerplate from asset names', () => {
    assert.equal(assetName('Apple Inc. - Common Stock (AAPL) [ST]'), 'Apple Inc.');
    assert.equal(assetName('Prudential Financial, Inc. Common Stock (PRU) [ST]'), 'Prudential Financial, Inc.');
    assert.equal(assetName('Taiwan Semiconductor Manufacturing Company Ltd. (TSM) [ST]'), 'Taiwan Semiconductor Manufacturing Company Ltd.');
  });
});
