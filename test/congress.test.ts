import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STOCK_ACT_DEADLINE_DAYS,
  clusterBadge,
  clusterBuyers,
  disclosureLagDays,
  extractMembers,
  filingUrl,
  isPurchase,
  memberHandle,
  normalizeFiling,
  normalizeTrade,
  parseFilingDate,
  parseFilingIndex,
  rangeMidpoint,
  type ParsedTrade,
} from '../src/providers/congress/parse.ts';

/** A verbatim slice of the House Clerk's 2026FD.txt, tabs and all. */
const INDEX = [
  'Prefix\tLast\tFirst\tSuffix\tFilingType\tStateDst\tYear\tFilingDate\tDocID',
  '\tAlford\tMark\t\tP\tMO04\t2026\t3/31/2026\t20034201',
  '\tAllen\tRichard W.\t\tP\tGA12\t2026\t1/15/2026\t20033751',
  '\tAllen\tRichard W.\t\tP\tGA12\t2026\t2/17/2026\t20033945',
  '\tAaron\tRichard\t\tW\tMI04\t2026\t4/15/2026\t8068',
  'Mr.\tAboujaoude\tRock Adel\tJr.\tC\tFL03\t2026\t11/12/2026\t10072809',
].join('\n');

describe('parseFilingIndex', () => {
  it('skips the header row', () => {
    const rows = parseFilingIndex(INDEX);
    assert.ok(rows.every((r) => r.last !== 'Last'));
  });

  it('reads all nine tab-separated columns', () => {
    const row = parseFilingIndex(INDEX)[0]!;
    assert.equal(row.last, 'Alford');
    assert.equal(row.first, 'Mark');
    assert.equal(row.filingType, 'P');
    assert.equal(row.stateDst, 'MO04');
    assert.equal(row.year, '2026');
    assert.equal(row.docId, '20034201');
  });

  it('keeps optional prefix and suffix columns', () => {
    const row = parseFilingIndex(INDEX).find((r) => r.last === 'Aboujaoude')!;
    assert.equal(row.prefix, 'Mr.');
    assert.equal(row.suffix, 'Jr.');
  });

  it('handles CRLF line endings', () => {
    assert.equal(parseFilingIndex(INDEX.replace(/\n/g, '\r\n')).length, 5);
  });

  it('drops blank and malformed lines rather than throwing', () => {
    const messy = INDEX + '\n\n\tShort\tRow\n';
    assert.equal(parseFilingIndex(messy).length, 5);
  });

  it('returns nothing for empty input', () => {
    assert.deepEqual(parseFilingIndex(''), []);
  });
});

describe('parseFilingDate', () => {
  it('reads M/D/YYYY as UTC midnight', () => {
    assert.equal(parseFilingDate('3/31/2026'), Date.UTC(2026, 2, 31));
  });

  it('accepts single-digit months and days', () => {
    assert.equal(parseFilingDate('1/5/2026'), Date.UTC(2026, 0, 5));
  });

  it('is timezone-independent', () => {
    // Date.parse('3/31/2026') would read this in the device's local zone and
    // shift the feed's sort key by up to a day. This must not.
    assert.equal(parseFilingDate('3/31/2026')! % 86_400_000, 0);
  });

  it('returns null for junk rather than NaN', () => {
    assert.equal(parseFilingDate('not a date'), null);
    assert.equal(parseFilingDate(''), null);
  });
});

describe('extractMembers', () => {
  const members = extractMembers(parseFilingIndex(INDEX));

  it('only counts periodic transaction reports', () => {
    // The `W` and `C` rows are extensions/amendments, not trades.
    assert.equal(members.length, 2);
    assert.ok(!members.some((m) => m.displayName.includes('Aaron')));
  });

  it('dedupes a member across multiple filings and counts them', () => {
    const allen = members.find((m) => m.displayName.startsWith('Richard'))!;
    assert.equal(allen.filingCount, 2);
  });

  it('orders by filing count, busiest first', () => {
    assert.equal(members[0]?.filingCount, 2);
  });

  it('formats the district readably, without the Clerk zero-padding', () => {
    assert.equal(members.find((m) => m.displayName === 'Mark Alford')?.district, 'MO-4');
  });
});

describe('memberHandle', () => {
  it('is a stable url-safe slug', () => {
    assert.equal(
      memberHandle({ first: 'Nancy', last: 'Pelosi', stateDst: 'CA11' }),
      'nancy-pelosi-ca11',
    );
  });

  it('survives punctuation and middle initials', () => {
    assert.equal(
      memberHandle({ first: 'Richard W.', last: "O'Brien", stateDst: 'GA12' }),
      'richard-w-o-brien-ga12',
    );
  });
});

describe('filingUrl', () => {
  it('points at the year-scoped PTR pdf', () => {
    assert.equal(
      filingUrl({ year: '2026', docId: '20034201' }),
      'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20034201.pdf',
    );
  });
});

describe('normalizeFiling', () => {
  const row = parseFilingIndex(INDEX)[0]!;
  const actor = { handle: 'mark-alford-mo04', displayName: 'Mark Alford', subtitle: 'MO-04' };
  const s = normalizeFiling(row, actor);

  it('namespaces the id by source', () => {
    assert.equal(s.id, 'congress:20034201');
  });

  it('uses the filing date as the sort key', () => {
    assert.equal(s.timestamp, Date.UTC(2026, 2, 31));
  });

  it('claims no ticker, because the keyless path has not read one', () => {
    // Inventing a ticker we have not actually parsed would be fabricating data.
    assert.equal(s.ticker, null);
    assert.equal(s.accent, null);
  });

  it('links to the filed pdf', () => {
    assert.match(s.url, /ptr-pdfs\/2026\/20034201\.pdf$/);
  });
});

describe('rangeMidpoint', () => {
  it('averages a disclosed band', () => {
    assert.equal(rangeMidpoint('$1,001 - $15,000'), 8001);
  });

  it('handles large bands with commas', () => {
    assert.equal(rangeMidpoint('$1,000,001 - $5,000,000'), 3000001);
  });

  it('returns the single figure when only one is given', () => {
    assert.equal(rangeMidpoint('$15,000'), 15000);
  });

  it('returns null for missing or unparseable input', () => {
    assert.equal(rangeMidpoint(null), null);
    assert.equal(rangeMidpoint(''), null);
    assert.equal(rangeMidpoint('unknown'), null);
  });
});

describe('isPurchase', () => {
  it('recognises the wordings the aggregators use', () => {
    assert.equal(isPurchase('Purchase'), true);
    assert.equal(isPurchase('purchase'), true);
    assert.equal(isPurchase('Buy'), true);
    assert.equal(isPurchase('Sale (Full)'), false);
    assert.equal(isPurchase('Sale (Partial)'), false);
  });
});

describe('disclosureLagDays', () => {
  const base: ParsedTrade = {
    representative: 'Nancy Pelosi',
    ticker: 'NVDA',
    transaction: 'Purchase',
    transactionDate: '2026-01-01',
    disclosureDate: '2026-02-01',
  };

  it('counts days between trade and disclosure', () => {
    assert.equal(disclosureLagDays(base), 31);
  });

  it('returns null when the disclosure date is missing', () => {
    assert.equal(disclosureLagDays({ ...base, disclosureDate: null }), null);
  });
});

describe('clusterBuyers', () => {
  const AT = Date.parse('2026-02-01');
  const day = (n: number) => new Date(AT - n * 86_400_000).toISOString().slice(0, 10);

  const trade = (rep: string, ticker: string, daysAgo: number, transaction = 'Purchase') => ({
    representative: rep,
    ticker,
    transaction,
    transactionDate: day(daysAgo + 20),
    disclosureDate: day(daysAgo),
  });

  it('counts distinct members who bought the same ticker in the window', () => {
    const trades = [
      trade('Nancy Pelosi', 'NVDA', 3),
      trade('Ro Khanna', 'NVDA', 10),
      trade('Josh Gottheimer', 'NVDA', 25),
    ];
    assert.equal(clusterBuyers(trades, 'NVDA', AT), 3);
  });

  it('counts a member once no matter how often they filed', () => {
    // Otherwise a single frequent filer manufactures the look of consensus.
    const trades = [
      trade('Ro Khanna', 'NVDA', 2),
      trade('Ro Khanna', 'NVDA', 5),
      trade('Ro Khanna', 'NVDA', 9),
    ];
    assert.equal(clusterBuyers(trades, 'NVDA', AT), 1);
  });

  it('ignores other tickers', () => {
    const trades = [trade('Nancy Pelosi', 'NVDA', 3), trade('Ro Khanna', 'AAPL', 3)];
    assert.equal(clusterBuyers(trades, 'NVDA', AT), 1);
  });

  it('ignores options — a bought put is not a buyer of the stock', () => {
    const trades = [trade('Nancy Pelosi', 'NVDA', 3), { ...trade('Ro Khanna', 'NVDA', 3), option: true }];
    assert.equal(clusterBuyers(trades, 'NVDA', AT), 1);
  });

  it('ignores sales', () => {
    const trades = [
      trade('Nancy Pelosi', 'NVDA', 3),
      trade('Ro Khanna', 'NVDA', 4, 'Sale (Full)'),
    ];
    assert.equal(clusterBuyers(trades, 'NVDA', AT), 1);
  });

  it('excludes filings outside the window on either side', () => {
    const trades = [
      trade('Nancy Pelosi', 'NVDA', 3),
      trade('Ro Khanna', 'NVDA', 90), // too old
      trade('Josh Gottheimer', 'NVDA', -5), // after the reference point
    ];
    assert.equal(clusterBuyers(trades, 'NVDA', AT), 1);
  });

  it('matches tickers and names case-insensitively', () => {
    const trades = [trade('NANCY PELOSI', 'nvda', 3), trade('Nancy Pelosi', 'NVDA', 5)];
    assert.equal(clusterBuyers(trades, 'NVDA', AT), 1);
  });

  it('returns zero for junk input rather than throwing', () => {
    assert.equal(clusterBuyers([], 'NVDA', AT), 0);
    assert.equal(clusterBuyers([trade('A', 'NVDA', 3)], '', AT), 0);
    assert.equal(clusterBuyers([trade('A', 'NVDA', 3)], 'NVDA', Number.NaN), 0);
  });
});

describe('clusterBadge', () => {
  it('says nothing for a single buyer', () => {
    // One buyer is just the trade the card already describes.
    assert.equal(clusterBadge(0), null);
    assert.equal(clusterBadge(1), null);
  });

  it('names the count and the window once it is a cluster', () => {
    assert.equal(clusterBadge(4), '4 MEMBERS BOUGHT · 30D');
    assert.equal(clusterBadge(2, 7), '2 MEMBERS BOUGHT · 7D');
  });
});

describe('normalizeTrade', () => {
  const actor = { handle: 'nancy-pelosi-ca11', displayName: 'Nancy Pelosi', subtitle: 'CA-11' };

  const onTime: ParsedTrade = {
    representative: 'Nancy Pelosi',
    ticker: 'nvda',
    transaction: 'Purchase',
    range: '$1,001 - $15,000',
    transactionDate: '2026-01-01',
    disclosureDate: '2026-01-20',
  };

  it('upcases the ticker', () => {
    assert.equal(normalizeTrade(onTime, actor).ticker, 'NVDA');
  });

  it('supersedes the filing card a scraped trade was read from', () => {
    assert.deepEqual(normalizeTrade({ ...onTime, filingId: '20033751' }, actor).supersedes, [
      'congress:20033751',
    ]);
    assert.equal(normalizeTrade(onTime, actor).supersedes, undefined);
  });

  it('sorts on the disclosure date, since that is the news event', () => {
    assert.equal(normalizeTrade(onTime, actor).timestamp, Date.parse('2026-01-20'));
  });

  it('falls back to the trade date when undisclosed', () => {
    const s = normalizeTrade({ ...onTime, disclosureDate: null }, actor);
    assert.equal(s.timestamp, Date.parse('2026-01-01'));
  });

  it('tags a purchase as up and a sale as down', () => {
    assert.equal(normalizeTrade(onTime, actor).accent?.tone, 'up');
    assert.equal(normalizeTrade({ ...onTime, transaction: 'Sale' }, actor).accent?.tone, 'down');
  });

  it('shows the range midpoint as the headline figure', () => {
    // Midpoint of $1,001–$15,000. Kept exact rather than abbreviated, because
    // under $10K the rounding would swamp the difference between bands.
    assert.equal(normalizeTrade(onTime, actor).accent?.label, '+$8,001');
  });

  it('abbreviates a large band', () => {
    const big = { ...onTime, range: '$1,000,001 - $5,000,000' };
    assert.equal(normalizeTrade(big, actor).accent?.label, '+$3M');
  });

  it('flags a filing past the STOCK Act deadline', () => {
    const late: ParsedTrade = { ...onTime, disclosureDate: '2026-06-01' };
    const s = normalizeTrade(late, actor);

    assert.ok(disclosureLagDays(late)! > STOCK_ACT_DEADLINE_DAYS);
    assert.ok(s.badges?.includes('LATE FILING'));
    assert.match(s.text, /past the 45-day STOCK Act deadline/);
  });

  it('does not flag a filing inside the deadline', () => {
    assert.ok(!normalizeTrade(onTime, actor).badges?.includes('LATE FILING'));
  });

  it('produces a stable id for the same trade', () => {
    assert.equal(normalizeTrade(onTime, actor).id, normalizeTrade(onTime, actor).id);
  });

  it('distinguishes a buy from a sell of the same ticker on the same day', () => {
    const sell: ParsedTrade = { ...onTime, transaction: 'Sale' };
    assert.notEqual(normalizeTrade(onTime, actor).id, normalizeTrade(sell, actor).id);
  });
});
