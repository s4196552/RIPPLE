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

/**
 * The mark for any subject without a face: a Congress group, a policy watch,
 * a fund. Drawn in place of the monogram, and behind a logo while it loads or
 * when it fails — "EX" for Executive Orders, or "BA" for a fund with no logo,
 * says nothing a symbol couldn't say better.
 *
 * Null for subjects that have a portrait or logo of their own to fall back
 * from: members, tickers.
 */
export function subjectGlyph(source: SourceId, handle: string): GroupGlyph | null {
  switch (source) {
    case 'congress':
      return groupGlyph(source, handle);
    case 'policy':
      return { glyph: policyGlyph(handle.trim().toLowerCase()) };
    case 'funds':
      return { glyph: { family: 'fa6', name: 'building-columns' } };
    default:
      return null;
  }
}

function policyGlyph(handle: string): GlyphSpec {
  switch (handle) {
    case '':
    case 'all':
      return { family: 'fa6', name: 'landmark' };
    case 'type:executive_order':
      return { family: 'fa6', name: 'file-signature' };
    case 'type:proclamation':
      return { family: 'fa6', name: 'bullhorn' };
    case 'type:presidential_memorandum':
      return { family: 'ion', name: 'mail-open' };
    case 'type:determination':
      return { family: 'fa6', name: 'gavel' };
    default:
      // A topic watch, typed or suggested.
      return { family: 'ion', name: 'pricetag' };
  }
}
