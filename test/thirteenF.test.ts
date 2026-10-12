import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildTickerIndex,
  concentration,
  concentrationVerdict,
  daysToFile,
  diffHoldings,
  findStreaks,
  fundName,
  normalizeIssuer,
  parseInfoTable,
  positionLabel,
  quarterLabel,
  tickerForIssuer,
  valueScaleFor,
  withWeights,
  type Holding,
} from '../src/providers/funds/thirteenF.ts';

const fixture = (name: string) => readFileSync(`test/fixtures/${name}`, 'utf8');
const totalOf = (xml: string) => Number(/<tableValueTotal>(\d+)</.exec(xml)?.[1]);

function holding(key: string, value: number, shares: number, extra: Partial<Holding> = {}): Holding {
  return { key, issuer: key, classTitle: 'COM', cusip: key, putCall: null, value, shares, ...extra };
}

describe('parseInfoTable', () => {
  it('reads Pershing Square’s Q1 2026 filing, matching its own cover total', () => {
    const holdings = parseInfoTable(fixture('13f-pershing-2026q1-infotable.xml'), 1);
    assert.equal(holdings.length, 11);
    const sum = holdings.reduce((s, h) => s + h.value, 0);
    assert.equal(sum, totalOf(fixture('13f-pershing-2026q1-primary.xml')));
    assert.ok(holdings[0]!.value >= holdings[1]!.value, 'largest first');
  });

  it('keeps share classes apart, by CUSIP', () => {
    const holdings = parseInfoTable(fixture('13f-pershing-2026q1-infotable.xml'), 1);
    const alphabet = holdings.filter((h) => h.issuer === 'ALPHABET INC');
    assert.equal(alphabet.length, 2);
  });

  it('scales a pre-2023 filing from thousands to dollars', () => {
    const scale = valueScaleFor('2022-11-14');
    assert.equal(scale, 1000);
    const holdings = parseInfoTable(fixture('13f-pershing-2022q3-infotable.xml'), scale);
    const sum = holdings.reduce((s, h) => s + h.value, 0);
    assert.equal(sum, totalOf(fixture('13f-pershing-2022q3-primary.xml')) * 1000);
  });

  it('sums a security Berkshire files on several rows into one position', () => {
    const xml = fixture('13f-berkshire-2026q2-infotable.xml');
    const rows = (xml.match(/<infoTable>/g) ?? []).length;
    const holdings = parseInfoTable(xml, 1);
    assert.ok(holdings.length < rows, `${holdings.length} positions from ${rows} rows`);
    assert.equal(new Set(holdings.map((h) => h.key)).size, holdings.length);
  });

  it('reads namespace-prefixed tables and keeps options apart from the stock', () => {
    const xml = `<ns1:informationTable>
      <ns1:infoTable><ns1:nameOfIssuer>ACME INC</ns1:nameOfIssuer><ns1:titleOfClass>COM</ns1:titleOfClass>
        <ns1:cusip>000000AA1</ns1:cusip><ns1:value>100</ns1:value><ns1:shrsOrPrnAmt><ns1:sshPrnamt>10</ns1:sshPrnamt></ns1:shrsOrPrnAmt></ns1:infoTable>
      <ns1:infoTable><ns1:nameOfIssuer>ACME INC</ns1:nameOfIssuer><ns1:titleOfClass>COM</ns1:titleOfClass>
        <ns1:cusip>000000AA1</ns1:cusip><ns1:value>40</ns1:value><ns1:shrsOrPrnAmt><ns1:sshPrnamt>4</ns1:sshPrnamt></ns1:shrsOrPrnAmt><ns1:putCall>Put</ns1:putCall></ns1:infoTable>
    </ns1:informationTable>`;
    const holdings = parseInfoTable(xml);
    assert.deepEqual(
      holdings.map((h) => [h.key, h.value, h.putCall]),
      [
        ['000000AA1', 100, null],
        ['000000AA1:PUT', 40, 'PUT'],
      ],
    );
  });
});

describe('diffHoldings', () => {
  const prior = [holding('A', 100, 10), holding('B', 50, 10), holding('C', 30, 10), holding('X', 80, 5)];
  const current = [holding('A', 120, 12), holding('B', 60, 9), holding('C', 33, 10), holding('N', 70, 7)];
  const moves = diffHoldings(prior, current);
  const kindOf = (k: string) => moves.find((m) => m.cusip === k)?.kind;

  it('sorts every position into new, added, trimmed, unchanged and exited', () => {
    assert.equal(kindOf('A'), 'added');
    assert.equal(kindOf('B'), 'trimmed');
    assert.equal(kindOf('C'), 'unchanged');
    assert.equal(kindOf('N'), 'new');
    assert.equal(kindOf('X'), 'exited');
  });

  it('judges by shares, so a stake trimmed into a rising price is still trimmed', () => {
    const b = moves.find((m) => m.cusip === 'B')!;
    assert.equal(b.kind, 'trimmed');
    assert.ok(b.value > b.valueBefore);
    assert.equal(b.sharesChangePct, -10);
  });

  it('puts the biggest dollar move first', () => {
    assert.deepEqual(
      moves.map((m) => m.cusip),
      ['X', 'N', 'A', 'B', 'C'],
    );
  });

  it('matches the post: Q1 2026 opened Microsoft, exited Hilton and cut Alphabet C by 95%', () => {
    const q4 = parseInfoTable(fixture('13f-pershing-2025q4-infotable.xml'));
    const q1 = parseInfoTable(fixture('13f-pershing-2026q1-infotable.xml'));
    const moves = diffHoldings(q4, q1);
    const find = (issuer: string, cls?: string) =>
      moves.find((m) => m.issuer.startsWith(issuer) && (!cls || m.classTitle.includes(cls)));

    assert.equal(find('MICROSOFT')?.kind, 'new');
    assert.equal(Math.round(find('MICROSOFT')!.shares / 10_000), 565);
    assert.equal(find('HILTON')?.kind, 'exited');
    assert.equal(find('ALPHABET', 'CL C')?.kind, 'trimmed');
    assert.equal(Math.round(find('ALPHABET', 'CL C')!.sharesChangePct! * 10) / 10, -94.9);
    assert.equal(find('AMAZON')?.kind, 'added');
    assert.equal(moves.filter((m) => m.kind !== 'unchanged').length, 9, 'the post’s nine moves');
  });
});

describe('concentration', () => {
  it('reports top-5, top-10 and the HHI on percentage weights', () => {
    const ten = Array.from({ length: 10 }, () => ({ weight: 0.1 }));
    const c = concentration(ten);
    assert.ok(Math.abs(c.top5 - 0.5) < 1e-9);
    assert.ok(Math.abs(c.top10 - 1) < 1e-9);
    assert.equal(c.hhi, 1000);
    assert.equal(concentrationVerdict(c.hhi), 'A conviction book');
  });

  it('gives Pershing’s Q1 2026 book the top-five share the post reports', () => {
    const positions = withWeights(parseInfoTable(fixture('13f-pershing-2026q1-infotable.xml')));
    assert.equal(Math.round(concentration(positions).top5 * 100), 78);
  });

  it('calls a wide book index-like', () => {
    assert.equal(concentrationVerdict(40), 'Spread like an index fund');
  });
});

describe('tickers', () => {
  const index = buildTickerIndex([
    { cik_str: 1, ticker: 'QSR', title: 'Restaurant Brands International Inc.' },
    { cik_str: 2, ticker: 'HLT', title: 'Hilton Worldwide Holdings Inc.' },
    { cik_str: 3, ticker: 'GOOGL', title: 'Alphabet Inc.' },
    { cik_str: 3, ticker: 'GOOG', title: 'Alphabet Inc.' },
    { cik_str: 4, ticker: 'BN', title: 'Brookfield Corp /ON/' },
    { cik_str: 4, ticker: 'BNJ', title: 'Brookfield Corp /ON/' },
    { cik_str: 5, ticker: 'CP', title: 'CANADIAN PACIFIC KANSAS CITY LTD/CN' },
    { cik_str: 6, ticker: 'ABC', title: 'Same Name Inc' },
    { cik_str: 7, ticker: 'XYZ', title: 'Same Name Corp' },
  ]);

  it('matches a 13F’s abbreviated issuer to SEC’s spelled-out title', () => {
    assert.equal(tickerForIssuer(index, 'RESTAURANT BRANDS INTL INC'), 'QSR');
    assert.equal(tickerForIssuer(index, 'HILTON WORLDWIDE HLDGS INC'), 'HLT');
  });

  it('gives a company with several tickers its primary one for common stock', () => {
    assert.equal(tickerForIssuer(index, 'BROOKFIELD CORP', 'CL A LTD VT SH'), 'BN');
    assert.equal(tickerForIssuer(index, 'CANADIAN PACIFIC KANSAS CITY', 'COM'), 'CP');
    assert.equal(tickerForIssuer(index, 'ALPHABET INC', 'CAP STK CL A'), 'GOOGL');
  });

  it('declines a second share class rather than guess its ticker', () => {
    assert.equal(tickerForIssuer(index, 'ALPHABET INC', 'CAP STK CL C'), null);
  });

  it('declines a name two companies share', () => {
    assert.equal(tickerForIssuer(index, 'SAME NAME INC'), null);
  });

  it('normalises corporate words and EDGAR’s country tags away', () => {
    assert.equal(normalizeIssuer('The Coca-Cola Co.'), 'COCA COLA');
    assert.equal(normalizeIssuer('CANADIAN PACIFIC KANSAS CITY LTD/CN'), 'CANADIAN PACIFIC KANSAS CITY');
  });
});

describe('words', () => {
  it('labels quarters and counts the days to file', () => {
    assert.equal(quarterLabel('2026-03-31'), 'Q1 2026');
    assert.equal(quarterLabel('2025-12-31'), 'Q4 2025');
    assert.equal(daysToFile('2026-03-31', '2026-05-15'), 45);
  });

  it('softens all-caps fund names and drops EDGAR’s state tag', () => {
    assert.equal(fundName('BERKSHIRE HATHAWAY INC'), 'Berkshire Hathaway Inc');
    assert.equal(fundName('BAUPOST GROUP LLC/MA'), 'Baupost Group LLC');
    assert.equal(fundName('Pershing Square Capital Management, L.P.'), 'Pershing Square Capital Management, L.P.');
  });

  it('labels a position by ticker, else by name, and says when it is an option', () => {
    assert.equal(positionLabel({ ticker: 'MSFT', issuer: 'MICROSOFT CORP', putCall: null }), 'MSFT');
    assert.equal(positionLabel({ ticker: null, issuer: 'ALPHABET INC', putCall: null }), 'Alphabet Inc');
    assert.equal(positionLabel({ ticker: 'SPY', issuer: 'SPDR', putCall: 'PUT' }), 'SPY puts');
    assert.equal(
      positionLabel({ ticker: null, issuer: 'ALPHABET INC', putCall: null, classTitle: 'CAP STK CL C' }),
      'Alphabet Inc class C',
    );
  });
});

describe('findStreaks', () => {
  const move = (cusip: string, kind: 'added' | 'trimmed' | 'new') =>
    ({
      issuer: cusip, ticker: cusip, classTitle: 'COM', cusip, putCall: null, value: 1, shares: 1,
      weight: 0.1, kind, valueBefore: 1, sharesBefore: 1, sharesChangePct: -1,
    }) as const;
  const filing = (moves: ReturnType<typeof move>[]) => ({
    form: '13F-HR', period: '2026-03-31', totalValue: 1, priorValue: 1, positionCount: 1,
    positions: [], moves: [...moves], truncated: false,
  });

  it('finds a position trimmed three filings running, newest first', () => {
    const streaks = findStreaks([
      filing([move('QSR', 'trimmed'), move('AMZN', 'added')]),
      filing([move('QSR', 'trimmed'), move('AMZN', 'added')]),
      filing([move('QSR', 'trimmed'), move('AMZN', 'new')]),
    ]);
    assert.deepEqual(streaks.map((s) => [s.label, s.kind, s.count]), [['QSR', 'trimmed', 3]]);
  });

  it('stops at the first filing that breaks the run', () => {
    const streaks = findStreaks([
      filing([move('QSR', 'trimmed')]),
      filing([move('QSR', 'added')]),
      filing([move('QSR', 'trimmed')]),
      filing([move('QSR', 'trimmed')]),
    ]);
    assert.equal(streaks.length, 0);
  });
});
