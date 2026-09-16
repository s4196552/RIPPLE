import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRoster,
  districtKey,
  findByName,
  findLegislator,
  parseScope,
  parseStateDst,
  photoUrl,
  scopeIncludes,
  surnamesMatch,
  type RawLegislator,
} from '../src/providers/congress/roster.ts';

/** Shaped like the published `legislators-current.json`. */
function raw(
  bioguide: string,
  first: string,
  last: string,
  party: string,
  state: string,
  district: number | null,
  type = 'rep',
): RawLegislator {
  return {
    id: { bioguide },
    name: { first, last, official_full: `${first} ${last}` },
    terms: [{ type, state, district, party }],
  };
}

const ROSTER = buildRoster([
  raw('K000389', 'Ro', 'Khanna', 'Democrat', 'CA', 17),
  raw('P000608', 'Scott', 'Peters', 'Democrat', 'CA', 50),
  raw('S000344', 'Linda', 'Sánchez', 'Democrat', 'CA', 38),
  raw('D000230', 'April', 'McClain Delaney', 'Democrat', 'MD', 6),
  raw('M001208', 'Lucy', 'McBath', 'Democrat', 'GA', 6),
  raw('M001217', 'Rich', 'McCormick', 'Republican', 'GA', 7),
  raw('K000401', 'Kevin', 'Kiley', 'Independent', 'CA', 3),
  raw('Y000064', 'Young', 'At-Large', 'Republican', 'AK', 0),
  raw('S000033', 'Bernard', 'Sanders', 'Independent', 'VT', null, 'sen'),
]);

describe('buildRoster', () => {
  it('indexes House members by state and district', () => {
    assert.equal(ROSTER.byDistrict.get('CA17')?.bioguide, 'K000389');
    assert.equal(ROSTER.byDistrict.get('AK0')?.bioguide, 'Y000064', 'at-large is district 0');
  });

  it('leaves senators out of the district index — they have no district', () => {
    const senator = ROSTER.all.find((l) => l.bioguide === 'S000033');
    assert.equal(senator?.chamber, 'senate');
    assert.equal(senator?.district, null);
    assert.equal([...ROSTER.byDistrict.values()].some((l) => l.chamber === 'senate'), false);
  });

  it('reads party and chamber from the most recent term', () => {
    const moved: RawLegislator = {
      id: { bioguide: 'X000001' },
      name: { first: 'Jane', last: 'Doe', official_full: 'Jane Doe' },
      terms: [
        { type: 'rep', state: 'TX', district: 1, party: 'Democrat' },
        { type: 'sen', state: 'TX', district: null, party: 'Republican' },
      ],
    };
    const [current] = buildRoster([moved]).all;
    assert.equal(current?.party, 'Republican', 'the old term must not win');
    assert.equal(current?.chamber, 'senate');
  });

  it('skips entries with no party, rather than inventing one', () => {
    const noParty: RawLegislator = {
      id: { bioguide: 'X000002' },
      name: { first: 'No', last: 'Party' },
      terms: [{ type: 'rep', state: 'NY', district: 1 }],
    };
    assert.equal(buildRoster([noParty]).all.length, 0);
  });
});

describe('surnamesMatch', () => {
  it('ignores accents, which the two sources spell differently', () => {
    assert.equal(surnamesMatch('Sánchez', 'Sanchez'), true);
  });

  it('ignores case and punctuation', () => {
    assert.equal(surnamesMatch("O'Halleran", 'OHALLERAN'), true);
  });

  it('matches a compound surname against its final word', () => {
    assert.equal(surnamesMatch('McClain Delaney', 'Delaney'), true);
    assert.equal(surnamesMatch('Delaney', 'April McClain Delaney'), true);
  });

  it('does not match on a bare suffix — Smith is not Goldsmith', () => {
    assert.equal(surnamesMatch('Goldsmith', 'Smith'), false);
    assert.equal(surnamesMatch('Smith', 'Goldsmith'), false);
  });

  it('is false for empty input rather than matching everything', () => {
    assert.equal(surnamesMatch('', 'Khanna'), false);
    assert.equal(surnamesMatch('Khanna', '   '), false);
  });
});

describe('parseStateDst', () => {
  it('strips the Clerk zero-padding so it can meet the roster integer', () => {
    assert.deepEqual(parseStateDst('CA07'), { state: 'CA', district: 7 });
    assert.deepEqual(parseStateDst('CA17'), { state: 'CA', district: 17 });
  });

  it('reads an at-large seat as district 0', () => {
    assert.deepEqual(parseStateDst('AK00'), { state: 'AK', district: 0 });
  });

  it('returns null for anything that is not a district', () => {
    assert.equal(parseStateDst('Senate'), null);
    assert.equal(parseStateDst(''), null);
  });
});

describe('findLegislator', () => {
  it('matches on state, district and surname together', () => {
    const found = findLegislator(ROSTER, { first: 'Ro', last: 'Khanna', stateDst: 'CA17' });
    assert.equal(found?.bioguide, 'K000389');
    assert.equal(found?.party, 'Democrat');
  });

  it('matches an accented roster surname against the Clerk spelling', () => {
    assert.equal(
      findLegislator(ROSTER, { first: 'Linda T.', last: 'Sanchez', stateDst: 'CA38' })?.bioguide,
      'S000344',
    );
  });

  it('matches a surname the Clerk split across first and last', () => {
    assert.equal(
      findLegislator(ROSTER, { first: 'April McClain', last: 'Delaney', stateDst: 'MD06' })
        ?.bioguide,
      'D000230',
    );
  });

  it('refuses the seat when the surname disagrees, then finds the member elsewhere', () => {
    // Real case: GA-06 filings from Rich McCormick, whose district is now
    // McBath's. Taking the district match on trust would caption his trade
    // with her face and her party.
    const found = findLegislator(ROSTER, { first: 'Richard', last: 'McCormick', stateDst: 'GA06' });
    assert.equal(found?.bioguide, 'M001217', 'should fall through to the surname index');
    assert.equal(found?.party, 'Republican', 'and carry his party, not the seat-holder’s');
  });

  it('returns null when a surname is ambiguous, rather than guessing', () => {
    const twoSmiths = buildRoster([
      raw('A000001', 'Adam', 'Smith', 'Democrat', 'WA', 9),
      raw('B000002', 'Brad', 'Smith', 'Republican', 'MO', 8),
    ]);
    assert.equal(findLegislator(twoSmiths, { first: 'Chris', last: 'Smith', stateDst: 'NJ04' }), null);
  });

  it('separates two members sharing a surname by the state on the filing', () => {
    // Real case: Rich McCormick sits for GA-07 and Dave McCormick is a senator
    // for PA, so the surname alone is ambiguous and the seat decides it.
    const bothMcCormicks = buildRoster([
      raw('M001217', 'Rich', 'McCormick', 'Republican', 'GA', 7),
      raw('M001243', 'Dave', 'McCormick', 'Republican', 'PA', null, 'sen'),
    ]);
    const found = findLegislator(bothMcCormicks, {
      first: 'Richard Dean Dr',
      last: 'McCormick',
      stateDst: 'GA06',
    });
    assert.equal(found?.bioguide, 'M001217');
  });

  it('still gives up when the shared surname is shared within one state', () => {
    const twoInOhio = buildRoster([
      raw('A000001', 'Anna', 'Jones', 'Democrat', 'OH', 1),
      raw('B000002', 'Ben', 'Jones', 'Republican', 'OH', 2),
    ]);
    assert.equal(findLegislator(twoInOhio, { first: 'Carl', last: 'Jones', stateDst: 'OH09' }), null);
  });

  it('returns null for an unknown member instead of the wrong one', () => {
    assert.equal(findLegislator(ROSTER, { first: 'Nobody', last: 'Nowhere', stateDst: 'ZZ99' }), null);
  });

  it('returns null with no surname to go on', () => {
    assert.equal(findLegislator(ROSTER, { first: 'Ro', last: '', stateDst: 'CA17' }), null);
  });
});

describe('findByName', () => {
  it('matches a plain full name', () => {
    assert.equal(findByName(ROSTER, 'Ro Khanna')?.bioguide, 'K000389');
  });

  it('matches regardless of how the aggregator formats the name', () => {
    assert.equal(findByName(ROSTER, 'Hon. Ro Khanna')?.bioguide, 'K000389');
    assert.equal(findByName(ROSTER, 'RO KHANNA')?.bioguide, 'K000389');
  });

  it('breaks a shared surname on the forename', () => {
    const bothMcCormicks = buildRoster([
      raw('M001217', 'Rich', 'McCormick', 'Republican', 'GA', 7),
      raw('M001243', 'Dave', 'McCormick', 'Republican', 'PA', null, 'sen'),
    ]);
    assert.equal(findByName(bothMcCormicks, 'Dave McCormick')?.bioguide, 'M001243');
    assert.equal(findByName(bothMcCormicks, 'Rich McCormick')?.bioguide, 'M001217');
  });

  it('gives up when the forename cannot separate them either', () => {
    const twoJohns = buildRoster([
      raw('A000001', 'John', 'Jones', 'Democrat', 'OH', 1),
      raw('B000002', 'John', 'Jones', 'Republican', 'TX', 2),
    ]);
    assert.equal(findByName(twoJohns, 'John Jones'), null);
  });

  it('returns null for an unknown name and for empty input', () => {
    assert.equal(findByName(ROSTER, 'Nobody At All'), null);
    assert.equal(findByName(ROSTER, '   '), null);
  });
});

describe('photoUrl', () => {
  it('builds the official portrait path from a bioguide id', () => {
    assert.equal(
      photoUrl('K000389'),
      'https://unitedstates.github.io/images/congress/225x275/K000389.jpg',
    );
  });
});

describe('districtKey', () => {
  it('is stable regardless of the case the state arrives in', () => {
    assert.equal(districtKey('ca', 17), districtKey('CA', 17));
  });
});

describe('parseScope', () => {
  it('reads the party scopes', () => {
    assert.deepEqual(parseScope('party:republican'), { kind: 'party', party: 'Republican' });
    assert.deepEqual(parseScope('party:democrat'), { kind: 'party', party: 'Democrat' });
    assert.deepEqual(parseScope('party:independent'), { kind: 'party', party: 'Independent' });
  });

  it('reads the chamber and all scopes', () => {
    assert.deepEqual(parseScope('chamber:senate'), { kind: 'chamber', chamber: 'senate' });
    assert.deepEqual(parseScope('all'), { kind: 'all' });
  });

  it('treats a member slug as a member', () => {
    assert.deepEqual(parseScope('ro-khanna-ca17'), { kind: 'member', handle: 'ro-khanna-ca17' });
  });

  it('falls back to a member rather than throwing on an unknown group', () => {
    // A subject saved by a future build must not break this one's feed.
    assert.deepEqual(parseScope('party:whig'), { kind: 'member', handle: 'party:whig' });
  });
});

describe('scopeIncludes', () => {
  const khanna = ROSTER.byDistrict.get('CA17')!;
  const mccormick = ROSTER.all.find((l) => l.bioguide === 'M001217')!;

  it('claims every filer for the all scope, matched or not', () => {
    assert.equal(scopeIncludes({ kind: 'all' }, khanna), true);
    assert.equal(scopeIncludes({ kind: 'all' }, null), true);
  });

  it('claims only members of that party', () => {
    const democrats = { kind: 'party', party: 'Democrat' } as const;
    assert.equal(scopeIncludes(democrats, khanna), true);
    assert.equal(scopeIncludes(democrats, mccormick), false);
  });

  it('never claims an unmatched filer for a party — their party is unknown', () => {
    assert.equal(scopeIncludes({ kind: 'party', party: 'Democrat' }, null), false);
    assert.equal(scopeIncludes({ kind: 'chamber', chamber: 'house' }, null), false);
  });

  it('never claims anyone for a member scope, which is handled separately', () => {
    assert.equal(scopeIncludes({ kind: 'member', handle: 'ro-khanna-ca17' }, khanna), false);
  });
});
