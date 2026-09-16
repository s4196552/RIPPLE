import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compact, district, money, personName, pct, slug } from '../src/lib/format.ts';
import { decode, tag, tagAll, tagNumber, tagValue } from '../src/lib/xml.ts';

describe('money', () => {
  it('abbreviates at each magnitude', () => {
    assert.equal(money(8_001), '$8,001');
    assert.equal(money(85_000), '$85K');
    assert.equal(money(3_200_000), '$3.2M');
    assert.equal(money(2_500_000_000), '$2.5B');
  });

  it('drops a trailing .0', () => {
    assert.equal(money(3_000_000), '$3M');
  });

  it('keeps the sign', () => {
    assert.equal(money(-3_200_000), '-$3.2M');
  });
});

describe('compact', () => {
  it('abbreviates share counts', () => {
    assert.equal(compact(950), '950');
    assert.equal(compact(12_400), '12K');
    assert.equal(compact(3_200_000), '3.2M');
  });
});

describe('pct', () => {
  it('signs percentages explicitly', () => {
    assert.equal(pct(3.456), '+3.46%');
    assert.equal(pct(-3.456), '-3.46%');
    assert.equal(pct(0), '+0.00%');
  });
});

describe('slug', () => {
  it('joins and normalises parts', () => {
    assert.equal(slug('Nancy', 'Pelosi', 'CA11'), 'nancy-pelosi-ca11');
  });

  it('strips punctuation and collapses separators', () => {
    assert.equal(slug("Richard W.", "O'Brien"), 'richard-w-o-brien');
  });

  it('ignores empty parts', () => {
    assert.equal(slug('Mark', '', null, undefined, 'MO04'), 'mark-mo04');
  });
});

describe('personName', () => {
  it('joins first and last', () => {
    assert.equal(personName('Nancy', 'Pelosi'), 'Nancy Pelosi');
  });

  it('tolerates a missing half', () => {
    assert.equal(personName(null, 'Pelosi'), 'Pelosi');
    assert.equal(personName('Nancy', null), 'Nancy');
    assert.equal(personName(null, null), 'Unknown');
  });
});

describe('district', () => {
  it('formats a state-district code', () => {
    assert.equal(district('CA11'), 'CA-11');
  });

  it('drops the Clerk zero-padding, which no other source uses', () => {
    // The aggregators write `MN-3`; leaving the pad in showed `MN-03` and
    // `MN-3` on adjacent cards describing the same seat.
    assert.equal(district('MO04'), 'MO-4');
    assert.equal(district('CA07'), 'CA-7');
  });

  it('reads 00 as an at-large state, which has no district number', () => {
    assert.equal(district('AK00'), 'AK');
    assert.equal(district('WY00'), 'WY');
  });

  it('leaves unexpected shapes alone', () => {
    assert.equal(district('SENATE'), 'SENATE');
    assert.equal(district(null), null);
  });
});

describe('xml helpers', () => {
  const doc = `<root>
    <name>Apple Inc.</name>
    <empty></empty>
    <wrapped><value>241.50</value></wrapped>
    <item>one</item>
    <item>two</item>
    <escaped>AT&amp;T &lt;Inc&gt;</escaped>
  </root>`;

  it('reads a tag body', () => {
    assert.equal(tag('name', doc), 'Apple Inc.');
  });

  it('returns null for an absent tag, empty string for an empty one', () => {
    assert.equal(tag('missing', doc), null);
    assert.equal(tag('empty', doc), '');
  });

  it('reads every occurrence in order', () => {
    assert.deepEqual(tagAll('item', doc), ['one', 'two']);
  });

  it('unwraps a <value> leaf but reads bare tags too', () => {
    assert.equal(tagValue('wrapped', doc), '241.50');
    assert.equal(tagValue('name', doc), 'Apple Inc.');
  });

  it('parses numbers, stripping commas', () => {
    assert.equal(tagNumber('wrapped', doc), 241.5);
    assert.equal(tagNumber('name', doc), null);
    assert.equal(tagNumber('missing', doc), null);
  });

  it('decodes the entities these feeds emit', () => {
    assert.equal(tag('escaped', doc), 'AT&T <Inc>');
    assert.equal(decode('a &amp; b &#39;c&#39;'), "a & b 'c'");
  });

  it('leaves unknown entities untouched rather than mangling them', () => {
    assert.equal(decode('100 &euro;'), '100 &euro;');
  });

  it('matches tags carrying attributes', () => {
    assert.equal(tag('name', '<name xml:lang="en">Hello</name>'), 'Hello');
  });
});
