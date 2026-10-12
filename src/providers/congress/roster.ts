/**
 * The congressional roster: who currently serves, for which party, and what
 * they look like.
 *
 * The House Clerk's disclosure index says only "Khanna, Ro, CA17" — no party,
 * no photo. Both come from the `unitedstates/congress-legislators` dataset, a
 * long-running public-domain roster with no key and no rate limit, plus the
 * matching official portraits at `unitedstates.github.io/images`.
 *
 * Free of network and framework imports so it can be unit-tested directly.
 * This is where the correctness risk lives: matching a Clerk row to a sitting
 * member is fuzzy, and a wrong match would put the wrong face and the wrong
 * party on somebody's trade.
 */

import { orderLinks, socialLink, youtubeChannel } from '../../lib/social.ts';
import type { SocialLink, SubjectProfile } from '../types.ts';

/** The three parties covering the entire current Congress. */
export type Party = 'Republican' | 'Democrat' | 'Independent';

export type Chamber = 'house' | 'senate';

export interface Legislator {
  /** Bioguide ID — the stable federal identifier, and the photo's filename. */
  bioguide: string;
  /** Full display name, e.g. `Ro Khanna`. */
  name: string;
  /** Surname as the roster spells it, which may be compound or accented. */
  surname: string;
  party: Party;
  /** Two-letter postal code. */
  state: string;
  /** House district; 0 for at-large, null for senators. */
  district: number | null;
  chamber: Chamber;
  /** Official site from the current term, e.g. `www.cantwell.senate.gov`. */
  website: string | null;
  /** First day of the member's first term in either chamber, `YYYY-MM-DD`. */
  firstServed: string | null;
  /** Last day of the current term, `YYYY-MM-DD`. */
  termEnds: string | null;
}

/** The subset of the published JSON this module reads. */
export interface RawLegislator {
  id?: { bioguide?: string };
  name?: { official_full?: string; first?: string; last?: string };
  terms?: {
    type?: string;
    state?: string;
    district?: number | null;
    party?: string;
    url?: string;
    start?: string;
    end?: string;
  }[];
}

export interface Roster {
  all: Legislator[];
  /** Keyed by `districtKey` — the strongest signal available. */
  byDistrict: Map<string, Legislator>;
  /** Folded surname -> everyone with it, for the ambiguity check. */
  bySurname: Map<string, Legislator[]>;
}

const PARTIES: Record<string, Party> = {
  Republican: 'Republican',
  Democrat: 'Democrat',
  Independent: 'Independent',
};

/**
 * Casing, punctuation and accents all differ between the two sources — the
 * Clerk writes `Sanchez` where the roster writes `Sánchez` — so every name
 * comparison happens on this folded form.
 */
function fold(value: string): string {
  // `normalize` splits an accented letter into letter + combining mark, which
  // the character class then drops. Guarded because it is the one String method
  // here that an older JS engine might not ship.
  const decomposed = typeof value.normalize === 'function' ? value.normalize('NFD') : value;
  return (
    decomposed
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      // Apostrophes and periods close up rather than splitting: one source
      // writes `O'Halleran` and the other `OHalleran`, and turning the
      // apostrophe into a space would leave those two names unequal forever.
      .replace(/['’.]/g, '')
      // Hyphens do the opposite: `Garcia-Lopez` and `Garcia Lopez` are the same
      // name, so a hyphen has to become the separator it stands for.
      .replace(/[^a-z ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Whether two surnames refer to the same person.
 *
 * Compound surnames are the reason this is not `===`: the Clerk splits
 * "April McClain Delaney" into first `April McClain` / last `Delaney`, while
 * the roster keeps `McClain Delaney` whole. So one name ending in the other
 * counts — but only on a word boundary, or `Smith` would match `Goldsmith`.
 */
export function surnamesMatch(a: string, b: string): boolean {
  const x = fold(a);
  const y = fold(b);
  if (!x || !y) return false;
  return x === y || x.endsWith(` ${y}`) || y.endsWith(` ${x}`);
}

/** `CA` + `17` -> `CA17`. At-large districts are 0, matching both sources. */
export function districtKey(state: string, district: number): string {
  return `${state.toUpperCase()}${district}`;
}

/**
 * `CA07` -> `{ state: 'CA', district: 7 }`.
 *
 * The Clerk zero-pads to two digits and the roster stores an integer, so the
 * padding has to come off before the two can be compared.
 */
export function parseStateDst(stateDst: string): { state: string; district: number } | null {
  const m = stateDst.trim().toUpperCase().match(/^([A-Z]{2})(\d{1,2})$/);
  if (!m) return null;
  return { state: m[1]!, district: Number(m[2]) };
}

export function buildRoster(raw: readonly RawLegislator[]): Roster {
  const all: Legislator[] = [];
  const byDistrict = new Map<string, Legislator>();
  const bySurname = new Map<string, Legislator[]>();

  for (const entry of raw) {
    const bioguide = entry.id?.bioguide?.trim();
    // The last term is the current one; earlier terms may carry a stale party
    // or a district the member no longer holds.
    const term = entry.terms?.[entry.terms.length - 1];
    const party = term?.party ? PARTIES[term.party] : undefined;
    const state = term?.state?.trim().toUpperCase();
    if (!bioguide || !party || !state) continue;

    const surname = entry.name?.last?.trim() ?? '';
    const name = entry.name?.official_full?.trim() || [entry.name?.first, surname].filter(Boolean).join(' ');
    if (!name) continue;

    const chamber: Chamber = term?.type === 'sen' ? 'senate' : 'house';
    const district = chamber === 'house' && typeof term?.district === 'number' ? term.district : null;

    const legislator: Legislator = {
      bioguide,
      name,
      surname,
      party,
      state,
      district,
      chamber,
      website: term?.url?.trim() || null,
      firstServed: entry.terms?.[0]?.start ?? null,
      termEnds: term?.end ?? null,
    };
    all.push(legislator);

    if (district !== null) byDistrict.set(districtKey(state, district), legislator);

    const key = fold(surname);
    if (key) {
      const bucket = bySurname.get(key);
      if (bucket) bucket.push(legislator);
      else bySurname.set(key, [legislator]);
    }
  }

  return { all, byDistrict, bySurname };
}

/**
 * Match one Clerk filing row to a sitting member.
 *
 * State-plus-district is the strong key, but it is not sufficient on its own:
 * redistricting and mid-term departures mean last year's filer may not hold
 * the seat today. (Observed: GA-06 filings from Rich McCormick, whose old
 * district is now McBath's.) So the district match must agree with the
 * surname, and when it does not we fall back to the surname alone — accepted
 * only when exactly one sitting member has it, because a wrong face on
 * somebody's trade is worse than no face at all.
 */
export function findLegislator(
  roster: Roster,
  row: { first?: string; last?: string; stateDst?: string },
): Legislator | null {
  const last = row.last?.trim() ?? '';
  if (!last) return null;

  const parsed = row.stateDst ? parseStateDst(row.stateDst) : null;
  if (parsed) {
    const candidate = roster.byDistrict.get(districtKey(parsed.state, parsed.district));
    if (candidate) {
      const full = [row.first, last].filter(Boolean).join(' ');
      if (surnamesMatch(candidate.surname, last) || surnamesMatch(candidate.surname, full)) {
        return candidate;
      }
    }
  }

  const sameSurname = roster.bySurname.get(fold(last)) ?? [];
  if (sameSurname.length === 1) return sameSurname[0]!;

  // A surname can be shared — Rich McCormick sits for GA-07 while Dave
  // McCormick is a senator for PA — and the seat on the filing is then the
  // only thing separating them. The district may have moved under the member,
  // but the state has not, so narrowing on state alone is the safe cut.
  if (parsed && sameSurname.length > 1) {
    const inState = sameSurname.filter((l) => l.state === parsed.state);
    if (inState.length === 1) return inState[0]!;
  }

  return null;
}

/**
 * Match a free-form full name to a sitting member.
 *
 * For the keyed aggregators, which give a single `representative` string and no
 * seat. Surname alone is not enough — there is a Rich McCormick and a Dave
 * McCormick — so a shared surname is broken by the forename, and anything still
 * ambiguous returns null rather than picking one.
 */
export function findByName(roster: Roster, fullName: string): Legislator | null {
  const folded = fold(fullName);
  if (!folded) return null;

  const bySurname = roster.all.filter((l) => surnamesMatch(folded, l.surname));
  if (bySurname.length === 1) return bySurname[0]!;
  if (bySurname.length === 0) return null;

  const forename = folded.split(' ')[0];
  const narrowed = bySurname.filter((l) => fold(l.name).split(' ')[0] === forename);
  return narrowed.length === 1 ? narrowed[0]! : null;
}

/**
 * Official portrait, 225×275.
 *
 * Sized for an avatar rather than the 450×550 or original the same repository
 * offers — a feed can show dozens at once and they are fetched per device.
 */
export function photoUrl(bioguide: string): string {
  return `https://unitedstates.github.io/images/congress/225x275/${bioguide}.jpg`;
}

// ───────────────────────────────────────────────────────────────────────────
// Public accounts
// ───────────────────────────────────────────────────────────────────────────

/**
 * One entry of `legislators-social-media.json`, the roster's companion file:
 * the accounts each sitting member's office runs, keyed by the same bioguide
 * ID. Maintained by hand by the same project, so it lags a new account by a
 * few weeks but rarely carries a wrong one.
 */
export interface RawSocialEntry {
  id?: { bioguide?: string };
  social?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    youtube_id?: string;
    mastodon?: string;
  };
}

/** Bioguide ID -> that member's accounts, in card order. */
export function buildSocialIndex(raw: readonly RawSocialEntry[]): Map<string, SocialLink[]> {
  const index = new Map<string, SocialLink[]>();
  for (const entry of raw) {
    const bioguide = entry.id?.bioguide?.trim();
    const s = entry.social;
    if (!bioguide || !s) continue;
    const links = orderLinks([
      socialLink('x', s.twitter),
      socialLink('instagram', s.instagram),
      socialLink('facebook', s.facebook),
      youtubeChannel(s.youtube_id, s.youtube),
      socialLink('mastodon', s.mastodon),
    ]);
    if (links.length > 0) index.set(bioguide, links);
  }
  return index;
}

/** `2031-01-03` -> `Jan 2031`. Null for anything that is not a date. */
function monthYear(iso: string | null): string | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!m) return null;
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : null;
}

/**
 * A member's profile card: their seat and service, their official site, and
 * the accounts their office runs.
 */
export function legislatorProfile(legislator: Legislator, accounts: readonly SocialLink[]): SubjectProfile {
  const seat =
    legislator.chamber === 'senate'
      ? `Senator for ${legislator.state}`
      : legislator.district === null || legislator.district === 0
        ? `Representative for ${legislator.state} (at large)`
        : `Representative for ${legislator.state}-${legislator.district}`;
  const since = legislator.firstServed?.slice(0, 4);
  const ends = monthYear(legislator.termEnds);

  return {
    facts: [
      `${seat} · ${legislator.party}`,
      since ? `In Congress since ${since}` : null,
      ends ? `Current term ends ${ends}` : null,
    ].filter((f): f is string => f !== null),
    links: orderLinks([socialLink('website', legislator.website), ...accounts]),
    provenance: 'Official accounts from the @unitedstates congress-legislators project',
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Subject scopes
// ───────────────────────────────────────────────────────────────────────────

/**
 * What a watched Congress subject refers to.
 *
 * Group scopes use a `kind:value` handle, which cannot collide with a member's
 * handle because `slug()` strips every character except letters, digits and
 * hyphens — a colon can never appear in one.
 */
export type CongressScope =
  | { kind: 'member'; handle: string }
  | { kind: 'party'; party: Party }
  | { kind: 'chamber'; chamber: Chamber }
  | { kind: 'all' };

const PARTY_BY_HANDLE: Record<string, Party> = {
  republican: 'Republican',
  democrat: 'Democrat',
  independent: 'Independent',
};

const CHAMBER_BY_HANDLE: Record<string, Chamber> = {
  house: 'house',
  senate: 'senate',
};

export function parseScope(handle: string): CongressScope {
  const value = handle.trim();
  if (value.toLowerCase() === 'all') return { kind: 'all' };

  const colon = value.indexOf(':');
  if (colon > 0) {
    const key = value.slice(0, colon).toLowerCase();
    const rest = value.slice(colon + 1).toLowerCase();

    if (key === 'party') {
      const party = PARTY_BY_HANDLE[rest];
      if (party) return { kind: 'party', party };
    }
    if (key === 'chamber') {
      const chamber = CHAMBER_BY_HANDLE[rest];
      if (chamber) return { kind: 'chamber', chamber };
    }
  }

  // Anything unrecognised is a member handle. Falling back rather than
  // throwing keeps a subject saved by an older build from breaking the feed.
  return { kind: 'member', handle: value };
}

/** True when `legislator` belongs to the group `scope` describes. */
export function scopeIncludes(scope: CongressScope, legislator: Legislator | null): boolean {
  switch (scope.kind) {
    case 'all':
      return true;
    case 'party':
      // An unmatched filer has no known party, so it cannot be claimed for one.
      return legislator?.party === scope.party;
    case 'chamber':
      return legislator?.chamber === scope.chamber;
    case 'member':
      return false;
  }
}

/** The group subjects offered in the add flow, before any typing. */
export const CONGRESS_SCOPES: { handle: string; label: string; subtitle: string }[] = [
  // "All members" rather than "All of Congress" so the monogram fallback reads
  // as initials (AM) beside RE / DE / IN, instead of the meaningless "AO".
  { handle: 'all', label: 'All members', subtitle: 'Every disclosed trade, any party' },
  { handle: 'party:republican', label: 'Republicans', subtitle: 'Trades filed by Republican members' },
  { handle: 'party:democrat', label: 'Democrats', subtitle: 'Trades filed by Democratic members' },
  {
    handle: 'party:independent',
    label: 'Independents',
    subtitle: 'Trades filed by independent members',
  },
];

/** Colour for a party chip. Deliberately muted — these are not campaign logos. */
export const PARTY_TONE: Record<Party, string> = {
  Republican: '#F2708A',
  Democrat: '#6FA8FF',
  Independent: '#B8A6FF',
};

/** Short form for a subtitle: `CA-17 · Democrat`. */
export function partyLabel(party: Party): string {
  return party;
}
