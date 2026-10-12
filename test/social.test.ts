import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { orderLinks, socialLink, youtubeChannel } from '../src/lib/social.ts';
import {
  buildRoster,
  buildSocialIndex,
  legislatorProfile,
  type RawLegislator,
} from '../src/providers/congress/roster.ts';

describe('socialLink', () => {
  it('builds each platform’s address from a bare account name', () => {
    assert.equal(socialLink('x', 'RepAmata')?.url, 'https://x.com/RepAmata');
    assert.equal(socialLink('truth', 'realDonaldTrump')?.url, 'https://truthsocial.com/@realDonaldTrump');
    assert.equal(socialLink('instagram', 'sentoddyoung')?.url, 'https://www.instagram.com/sentoddyoung');
    assert.equal(socialLink('facebook', 'aumuaamata')?.url, 'https://www.facebook.com/aumuaamata');
    assert.equal(socialLink('youtube', 'RepToddYoung')?.url, 'https://www.youtube.com/@RepToddYoung');
    assert.equal(socialLink('tiktok', 'whitehouse')?.url, 'https://www.tiktok.com/@whitehouse');
  });

  it('accepts a leading @ or a whole profile URL, and shows one @ either way', () => {
    assert.equal(socialLink('x', '@RepAmata')?.handle, '@RepAmata');
    assert.equal(socialLink('x', 'https://twitter.com/RepAmata/')?.url, 'https://x.com/RepAmata');
  });

  it('shows a Facebook page by its name, which has no @ of its own', () => {
    assert.equal(socialLink('facebook', 'WhiteHouse')?.handle, 'WhiteHouse');
  });

  it('sends a Mastodon account to its own server', () => {
    const link = socialLink('mastodon', '@repthompson@mastodon.social');
    assert.deepEqual(link, {
      platform: 'mastodon',
      handle: '@repthompson@mastodon.social',
      url: 'https://mastodon.social/@repthompson',
    });
  });

  it('shows a website without its scheme, and keeps a URL it was given', () => {
    const link = socialLink('website', 'https://www.cantwell.senate.gov/');
    assert.equal(link?.handle, 'cantwell.senate.gov');
    assert.equal(link?.url, 'https://www.cantwell.senate.gov/');
    assert.equal(socialLink('website', 'ark-invest.com')?.url, 'https://ark-invest.com');
  });

  it('refuses a value that cannot make a working link', () => {
    assert.equal(socialLink('x', ''), null);
    assert.equal(socialLink('x', null), null);
    assert.equal(socialLink('x', 'two words'), null);
    assert.equal(socialLink('mastodon', 'repthompson'), null);
  });

  it('records whose account it is when that is not the subject', () => {
    assert.equal(socialLink('truth', 'realDonaldTrump', 'President Trump')?.owner, 'President Trump');
    assert.equal('owner' in socialLink('x', 'WhiteHouse')!, false);
  });
});

describe('youtubeChannel', () => {
  it('opens a channel by its id, the one address sure to be right', () => {
    const link = youtubeChannel('UCGdrLQbt1PYDTPsampx4t1A');
    assert.equal(link?.url, 'https://www.youtube.com/channel/UCGdrLQbt1PYDTPsampx4t1A');
    assert.equal(link?.handle, 'YouTube channel');
  });

  it('labels it by the legacy username, which is not an @handle', () => {
    const link = youtubeChannel('UCuknj4PGn91gHDNAfboZEgQ', 'RepToddYoung');
    assert.equal(link?.handle, 'RepToddYoung');
    assert.equal(link?.url, 'https://www.youtube.com/channel/UCuknj4PGn91gHDNAfboZEgQ');
  });

  it('falls back to the legacy /user/ address with no id', () => {
    assert.equal(youtubeChannel(null, 'nancypelosi')?.url, 'https://www.youtube.com/user/nancypelosi');
    assert.equal(youtubeChannel('not-an-id'), null);
  });
});

describe('orderLinks', () => {
  it('puts the website first, drops nulls, and keeps one link per address', () => {
    const links = orderLinks([
      socialLink('instagram', 'a'),
      null,
      socialLink('x', 'a'),
      socialLink('website', 'example.com'),
      socialLink('x', '@a'),
    ]);
    assert.deepEqual(
      links.map((l) => l.platform),
      ['website', 'x', 'instagram'],
    );
  });

  it('keeps two accounts on one platform in the order given', () => {
    const links = orderLinks([socialLink('x', 'ARKInvest'), socialLink('x', 'CathieDWood')]);
    assert.deepEqual(
      links.map((l) => l.handle),
      ['@ARKInvest', '@CathieDWood'],
    );
  });
});

describe('Congress profiles', () => {
  const raw: RawLegislator[] = [
    {
      id: { bioguide: 'C000127' },
      name: { official_full: 'Maria Cantwell', last: 'Cantwell' },
      terms: [
        { type: 'rep', state: 'WA', district: 1, party: 'Democrat', start: '1993-01-05', end: '1995-01-03' },
        {
          type: 'sen',
          state: 'WA',
          party: 'Democrat',
          start: '2025-01-03',
          end: '2031-01-03',
          url: 'https://www.cantwell.senate.gov',
        },
      ],
    },
    {
      id: { bioguide: 'R000600' },
      name: { official_full: 'Aumua Amata Coleman Radewagen', last: 'Radewagen' },
      terms: [{ type: 'rep', state: 'AS', district: 0, party: 'Republican', start: '2015-01-06', end: '2027-01-03' }],
    },
  ];
  const roster = buildRoster(raw);
  const social = buildSocialIndex([
    {
      id: { bioguide: 'C000127' },
      social: { twitter: 'SenatorCantwell', youtube_id: 'UCN52UDqKgvHRk39ncySrIMw', facebook: 'senatorcantwell' },
    },
    // A member with no accounts on file has no entry at all.
    { id: { bioguide: 'X000001' }, social: {} },
  ]);

  it('carries the site and service dates from the roster', () => {
    const cantwell = roster.all[0]!;
    assert.equal(cantwell.website, 'https://www.cantwell.senate.gov');
    assert.equal(cantwell.firstServed, '1993-01-05');
    assert.equal(cantwell.termEnds, '2031-01-03');
  });

  it('indexes accounts by bioguide, falling back to a channel id for YouTube', () => {
    assert.deepEqual(
      social.get('C000127')?.map((l) => l.platform),
      ['x', 'facebook', 'youtube'],
    );
    assert.equal(social.has('X000001'), false);
  });

  it('describes a senator’s seat and service, and lists the site before the accounts', () => {
    const profile = legislatorProfile(roster.all[0]!, social.get('C000127') ?? []);
    assert.deepEqual(profile.facts, [
      'Senator for WA · Democrat',
      'In Congress since 1993',
      'Current term ends Jan 2031',
    ]);
    assert.deepEqual(
      profile.links.map((l) => l.handle),
      ['cantwell.senate.gov', '@SenatorCantwell', 'senatorcantwell', 'YouTube channel'],
    );
  });

  it('names an at-large seat as such, and still makes a card with no links', () => {
    const profile = legislatorProfile(roster.all[1]!, []);
    assert.equal(profile.facts[0], 'Representative for AS (at large) · Republican');
    assert.deepEqual(profile.links, []);
  });
});
