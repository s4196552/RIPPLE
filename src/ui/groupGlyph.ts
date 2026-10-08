// Relative `.ts` imports, so `node --test` can load this without the bundler.
import { PARTY_TONE } from '../providers/congress/roster.ts';
import type { SourceId } from '../providers/types.ts';
import type { GlyphSpec } from './components/Glyph.tsx';

export interface GroupGlyph {
  glyph: GlyphSpec;
  /** The group's own colour. Absent for "All members", which takes the source's. */
  tone?: string;
}

/**
 * The mark for a Congress group subject — All members, or a party — in place of
 * the AM / RE / DE / IN monogram, which read as noise rather than as a party.
 *
 * The two major parties get their own marks — the starred elephant and donkey —
 * because those are what people recognise them by. They are drawn in the same
 * muted `PARTY_TONE` as the party chips rather than in campaign red and blue:
 * identifying, not campaigning. Independents have no shared mark, so they get
 * a letter, and "All members" a group of people.
 *
 * Returns null for anything that is not a Congress group, including individual
 * members, who have portraits.
 */
export function groupGlyph(source: SourceId, handle: string): GroupGlyph | null {
  if (source !== 'congress') return null;
  switch (handle.toLowerCase()) {
    case 'all':
      return { glyph: { family: 'mci', name: 'account-group' } };
    case 'party:republican':
      return { glyph: { family: 'fa6', name: 'republican' }, tone: PARTY_TONE.Republican };
    case 'party:democrat':
      return { glyph: { family: 'fa6', name: 'democrat' }, tone: PARTY_TONE.Democrat };
    case 'party:independent':
      return { glyph: { family: 'mci', name: 'alpha-i-circle' }, tone: PARTY_TONE.Independent };
    default:
      return null;
  }
}
