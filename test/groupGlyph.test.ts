import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { CONGRESS_SCOPES, PARTY_TONE } from '../src/providers/congress/roster.ts';
import { groupGlyph } from '../src/ui/groupGlyph.ts';

const GLYPHMAPS = 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/';
const load = (file: string): Record<string, unknown> => JSON.parse(readFileSync(GLYPHMAPS + file, 'utf8'));
const MAPS = {
  ion: load('Ionicons.json'),
  mci: load('MaterialCommunityIcons.json'),
  fa6: load('FontAwesome6Free.json'),
};
// FontAwesome6 is drawn with `solid`; a name that exists only in the regular
// or brand styles would render as a blank box.
const FA6_SOLID = new Set((JSON.parse(readFileSync(GLYPHMAPS + 'FontAwesome6Free_meta.json', 'utf8')) as { solid: string[] }).solid);

describe('groupGlyph', () => {
  it('gives every group in the add flow a mark', () => {
    for (const scope of CONGRESS_SCOPES) {
      assert.ok(groupGlyph('congress', scope.handle), `${scope.handle} has no glyph`);
    }
  });

  it('names glyphs that exist in the font that draws them', () => {
    for (const scope of CONGRESS_SCOPES) {
      const { glyph } = groupGlyph('congress', scope.handle)!;
      assert.ok(glyph.name in MAPS[glyph.family], `${glyph.family}:${glyph.name} is not a glyph`);
      if (glyph.family === 'fa6') assert.ok(FA6_SOLID.has(glyph.name), `${glyph.name} has no solid style`);
    }
  });

  it('colours parties with their muted chip tone, and leaves All members to the source colour', () => {
    assert.equal(groupGlyph('congress', 'party:republican')!.tone, PARTY_TONE.Republican);
    assert.equal(groupGlyph('congress', 'party:democrat')!.tone, PARTY_TONE.Democrat);
    assert.equal(groupGlyph('congress', 'party:independent')!.tone, PARTY_TONE.Independent);
    assert.equal(groupGlyph('congress', 'all')!.tone, undefined);
  });

  it('matches handles case-insensitively, as the watchlist stores them as typed', () => {
    assert.deepEqual(groupGlyph('congress', 'Party:Democrat'), groupGlyph('congress', 'party:democrat'));
  });

  it('leaves individual members and other sources to their portraits and monograms', () => {
    assert.equal(groupGlyph('congress', 'nancy-pelosi'), null);
    assert.equal(groupGlyph('stocks', 'all'), null);
    assert.equal(groupGlyph('insider', 'party:democrat'), null);
  });
});
