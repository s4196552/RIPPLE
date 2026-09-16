import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TRANSACTION_CODES,
  describeRole,
  normalizeForm4,
  parseFilingDay,
  parseForm4,
  principalTransaction,
} from '../src/providers/insider/form4.ts';

/**
 * Shaped after a real SEC ownership document. Includes an option exercise, the
 * sale that funded it and a tax withholding — the common three-line filing that
 * would otherwise produce three cards for one event.
 */
const FORM4 = `<?xml version="1.0"?>
<ownershipDocument>
  <schemaVersion>X0609</schemaVersion>
  <documentType>4</documentType>
  <periodOfReport>2026-09-01</periodOfReport>
  <issuer>
    <issuerCik>0000320193</issuerCik>
    <issuerName>Apple Inc.</issuerName>
    <issuerTradingSymbol>AAPL</issuerTradingSymbol>
  </issuer>
  <reportingOwner>
    <reportingOwnerId>
      <rptOwnerCik>0002148403</rptOwnerCik>
      <rptOwnerName>Ternus John</rptOwnerName>
    </reportingOwnerId>
    <reportingOwnerRelationship>
      <isDirector>0</isDirector>
      <isOfficer>1</isOfficer>
      <isTenPercentOwner>0</isTenPercentOwner>
      <officerTitle>CEO</officerTitle>
    </reportingOwnerRelationship>
  </reportingOwner>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <securityTitle><value>Common Stock</value></securityTitle>
      <transactionDate><value>2026-08-28</value></transactionDate>
      <transactionCoding><transactionCode>M</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>50000</value></transactionShares>
        <transactionPricePerShare><value>0</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
      <postTransactionAmounts>
        <sharesOwnedFollowingTransaction><value>180000</value></sharesOwnedFollowingTransaction>
      </postTransactionAmounts>
    </nonDerivativeTransaction>
    <nonDerivativeTransaction>
      <securityTitle><value>Common Stock</value></securityTitle>
      <transactionDate><value>2026-08-28</value></transactionDate>
      <transactionCoding><transactionCode>S</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>20000</value></transactionShares>
        <transactionPricePerShare><value>241.50</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
      <postTransactionAmounts>
        <sharesOwnedFollowingTransaction><value>160000</value></sharesOwnedFollowingTransaction>
      </postTransactionAmounts>
    </nonDerivativeTransaction>
    <nonDerivativeTransaction>
      <securityTitle><value>Common Stock</value></securityTitle>
      <transactionDate><value>2026-08-28</value></transactionDate>
      <transactionCoding><transactionCode>F</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>629</value></transactionShares>
        <transactionPricePerShare><value>209.08</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>`;

/** A filing reporting only routine compensation mechanics. */
const AWARD_ONLY = FORM4.replace(
  /<transactionCode>S<\/transactionCode>/,
  '<transactionCode>A</transactionCode>',
).replace(/<transactionCode>M<\/transactionCode>/, '<transactionCode>A</transactionCode>');

const actor = { handle: 'AAPL', displayName: 'Apple Inc.', subtitle: '$AAPL' };

describe('parseForm4', () => {
  const f = parseForm4(FORM4)!;

  it('reads issuer and ticker', () => {
    assert.equal(f.issuerName, 'Apple Inc.');
    assert.equal(f.ticker, 'AAPL');
  });

  it('reads the reporting owner and their role flags', () => {
    assert.equal(f.ownerName, 'Ternus John');
    assert.equal(f.ownerTitle, 'CEO');
    assert.equal(f.isOfficer, true);
    assert.equal(f.isDirector, false);
    assert.equal(f.isTenPercentOwner, false);
  });

  it('unwraps <value> leaves', () => {
    assert.equal(f.transactions[1]?.pricePerShare, 241.5);
  });

  it('reads every non-derivative transaction', () => {
    assert.equal(f.transactions.length, 3);
    assert.deepEqual(f.transactions.map((t) => t.code), ['M', 'S', 'F']);
  });

  it('computes value from shares times price', () => {
    assert.equal(f.transactions[1]?.value, 20000 * 241.5);
  });

  it('reads acquired/disposed rather than inferring it from the code', () => {
    assert.equal(f.transactions[0]?.acquired, true);
    assert.equal(f.transactions[1]?.acquired, false);
  });

  it('returns null for XML that is not an ownership document', () => {
    assert.equal(parseForm4('<html><body>404</body></html>'), null);
  });
});

describe('principalTransaction', () => {
  it('prefers a discretionary trade over compensation mechanics', () => {
    // The M line is larger in share count, but only the S line is a decision.
    const tx = principalTransaction(parseForm4(FORM4)!)!;
    assert.equal(tx.code, 'S');
  });

  it('falls back to the largest line when nothing is discretionary', () => {
    const tx = principalTransaction(parseForm4(AWARD_ONLY)!)!;
    assert.equal(tx.code, 'A');
  });

  it('returns null when there are no transactions', () => {
    const empty = parseForm4(FORM4.replace(/<nonDerivativeTransaction>[^]*<\/nonDerivativeTable>/, '</nonDerivativeTable>'));
    assert.equal(principalTransaction(empty!), null);
  });
});

describe('TRANSACTION_CODES', () => {
  it('marks only open-market buys and sells as discretionary', () => {
    assert.equal(TRANSACTION_CODES.P?.discretionary, true);
    assert.equal(TRANSACTION_CODES.S?.discretionary, true);
    assert.equal(TRANSACTION_CODES.A?.discretionary, false);
    assert.equal(TRANSACTION_CODES.M?.discretionary, false);
    assert.equal(TRANSACTION_CODES.F?.discretionary, false);
  });
});

describe('describeRole', () => {
  it('prefers an explicit officer title', () => {
    assert.equal(describeRole(parseForm4(FORM4)!), 'CEO');
  });

  it('falls back through the role flags', () => {
    const f = parseForm4(FORM4)!;
    assert.equal(describeRole({ ...f, ownerTitle: null, isOfficer: false, isDirector: true }), 'Director');
    assert.equal(
      describeRole({ ...f, ownerTitle: null, isOfficer: false, isDirector: false, isTenPercentOwner: true }),
      '10% owner',
    );
  });
});

describe('parseFilingDay', () => {
  it('reads ISO dates as UTC midnight', () => {
    assert.equal(parseFilingDay('2026-08-28'), Date.UTC(2026, 7, 28));
  });

  it('is timezone-independent', () => {
    assert.equal(parseFilingDay('2026-08-28')! % 86_400_000, 0);
  });

  it('returns null rather than NaN for junk', () => {
    assert.equal(parseFilingDay('nope'), null);
    assert.equal(parseFilingDay(null), null);
  });
});

describe('normalizeForm4', () => {
  const filedAt = Date.UTC(2026, 8, 1);
  const s = normalizeForm4(parseForm4(FORM4)!, '0001140361-26-035362', actor, filedAt)!;

  it('makes the id unique per filing', () => {
    assert.equal(s.id, 'insider:0001140361-26-035362');
  });

  it('emits one signal per filing, not one per transaction line', () => {
    // Three lines describe a single event; three cards would be three times the
    // noise for one piece of news.
    assert.ok(s.text.includes('sold'));
    assert.ok(s.badges?.includes('+2 MORE'));
  });

  it('reports the insider, their role and the ticker', () => {
    assert.match(s.text, /Ternus John \(CEO\)/);
    assert.equal(s.ticker, 'AAPL');
  });

  it('uses the transaction date as the sort key, not the filing date', () => {
    assert.equal(s.timestamp, Date.UTC(2026, 7, 28));
  });

  it('tags a disposal as down', () => {
    assert.equal(s.accent?.tone, 'down');
    assert.match(s.accent!.label, /^-\$/);
  });

  it('labels the transaction type', () => {
    assert.ok(s.badges?.includes('OPEN-MARKET SELL'));
  });

  it('returns null when the filing has no reportable transaction', () => {
    const empty = parseForm4(
      FORM4.replace(/<nonDerivativeTransaction>[^]*<\/nonDerivativeTable>/, '</nonDerivativeTable>'),
    )!;
    assert.equal(normalizeForm4(empty, 'acc', actor, filedAt), null);
  });
});
