import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  badgeFor,
  normalizePolicyDocument,
  parseDay,
  parseScope,
  scopeLabel,
  type FederalRegisterDocument,
} from '../src/providers/policy/normalize.ts';

const actor = { handle: 'white-house', displayName: 'The White House', subtitle: 'Executive Orders' };

/** Shaped after a real Federal Register API response. */
const DOC: FederalRegisterDocument = {
  document_number: '2026-19342',
  title: 'Declaring a National Emergency To Secure the United States Bulk-Power System',
  subtype: 'Executive Order',
  publication_date: '2026-08-31',
  signing_date: '2026-08-26',
  html_url: 'https://www.federalregister.gov/documents/2026/08/31/2026-19342/declaring-a-national-emergency',
  executive_order_number: 14201,
};

describe('parseScope', () => {
  it('reads the all-actions scope', () => {
    assert.deepEqual(parseScope('all'), { kind: 'all' });
    assert.deepEqual(parseScope(''), { kind: 'all' });
  });

  it('reads a document-type scope', () => {
    assert.deepEqual(parseScope('type:executive_order'), {
      kind: 'type',
      documentType: 'executive_order',
    });
  });

  it('reads a free-text topic scope', () => {
    assert.deepEqual(parseScope('term:semiconductor'), { kind: 'term', term: 'semiconductor' });
  });

  it('treats an unrecognised handle as a topic rather than failing', () => {
    assert.deepEqual(parseScope('tariff'), { kind: 'term', term: 'tariff' });
  });

  it('round-trips a topic containing a colon', () => {
    assert.deepEqual(parseScope('term:section 232:steel'), {
      kind: 'term',
      term: 'section 232:steel',
    });
  });
});

describe('scopeLabel', () => {
  it('names each scope readably', () => {
    assert.equal(scopeLabel({ kind: 'all' }), 'All presidential actions');
    assert.equal(scopeLabel({ kind: 'type', documentType: 'executive_order' }), 'Executive Orders');
    assert.match(scopeLabel({ kind: 'term', term: 'tariff' }), /tariff/);
  });
});

describe('parseDay', () => {
  it('reads ISO dates as UTC midnight', () => {
    assert.equal(parseDay('2026-08-31'), Date.UTC(2026, 7, 31));
  });

  it('is timezone-independent', () => {
    assert.equal(parseDay('2026-08-31')! % 86_400_000, 0);
  });

  it('returns null for missing or malformed values', () => {
    assert.equal(parseDay(null), null);
    assert.equal(parseDay('August 2026'), null);
  });
});

describe('badgeFor', () => {
  it('upcases the subtype', () => {
    assert.equal(badgeFor(DOC), 'EXECUTIVE ORDER');
    assert.equal(badgeFor({ ...DOC, subtype: 'Proclamation' }), 'PROCLAMATION');
  });

  it('falls back when the subtype is absent', () => {
    assert.equal(badgeFor({ ...DOC, subtype: null }), 'PRESIDENTIAL ACTION');
  });
});

describe('normalizePolicyDocument', () => {
  const s = normalizePolicyDocument(DOC, actor)!;

  it('namespaces the id by document number', () => {
    assert.equal(s.id, 'policy:2026-19342');
  });

  it('prefers the signing date over publication', () => {
    // Publication can trail signing by days; the action is the news.
    assert.equal(s.timestamp, Date.UTC(2026, 7, 26));
  });

  it('falls back to publication when unsigned', () => {
    const s2 = normalizePolicyDocument({ ...DOC, signing_date: null }, actor)!;
    assert.equal(s2.timestamp, Date.UTC(2026, 7, 31));
  });

  it('uses the title as the card text', () => {
    assert.equal(s.text, DOC.title);
  });

  it('links to the Federal Register page', () => {
    assert.equal(s.url, DOC.html_url);
  });

  it('synthesises a link when html_url is missing', () => {
    const s2 = normalizePolicyDocument({ ...DOC, html_url: undefined }, actor)!;
    assert.equal(s2.url, 'https://www.federalregister.gov/d/2026-19342');
  });

  it('badges the subtype and the EO number', () => {
    assert.ok(s.badges?.includes('EXECUTIVE ORDER'));
    assert.ok(s.badges?.includes('EO 14201'));
  });

  it('carries no ticker or accent — policy is not a trade', () => {
    assert.equal(s.ticker, null);
    assert.equal(s.accent, null);
  });

  it('returns null when the document has no usable date', () => {
    assert.equal(
      normalizePolicyDocument({ ...DOC, signing_date: null, publication_date: undefined }, actor),
      null,
    );
  });

  it('returns null when the document number is missing', () => {
    assert.equal(normalizePolicyDocument({ ...DOC, document_number: undefined }, actor), null);
  });
});
