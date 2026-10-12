import { getJson } from '@/lib/http';
import { orderLinks, socialLink } from '@/lib/social';
import type {
  Actor,
  GetSignalsOptions,
  Provider,
  ProviderMode,
  Signal,
  SubjectProfile,
  SubjectResult,
} from '@/providers/types';
import {
  normalizePolicyDocument,
  parseScope,
  scopeLabel,
  type FederalRegisterDocument,
  type PolicyScope,
} from './normalize';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅  NO API KEY REQUIRED — fully public
 * ═══════════════════════════════════════════════════════════════════════════
 * Executive orders, proclamations, determinations and memoranda from the
 * Federal Register's public API (federalregister.gov/developers/api/v1).
 * No key, no rate limit published, generous CORS — the friendliest source here.
 *
 * This is the policy half of the picture: the trades tell you what people with
 * information did, this tells you what the government actually announced.
 *
 * Two kinds of subject can be watched:
 *   • a document type  — `type:executive_order`, `type:proclamation`
 *   • a free-text topic — `term:semiconductor`, `term:tariff`
 * The topic watch is the powerful one: it surfaces every presidential action
 * mentioning an industry you care about.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const API = 'https://www.federalregister.gov/api/v1/documents.json';

/** Curated starting points offered before the user types anything specific. */
const PRESETS: { handle: string; label: string; subtitle: string }[] = [
  { handle: 'all', label: 'All presidential actions', subtitle: 'Every executive document' },
  { handle: 'type:executive_order', label: 'Executive Orders', subtitle: 'Signed executive orders' },
  { handle: 'type:proclamation', label: 'Proclamations', subtitle: 'Including tariff adjustments' },
  { handle: 'type:presidential_memorandum', label: 'Memoranda', subtitle: 'Presidential memoranda' },
  { handle: 'type:determination', label: 'Determinations', subtitle: 'Presidential determinations' },
];

/** Topic suggestions with obvious market relevance. */
const TOPIC_HINTS = [
  'semiconductor',
  'tariff',
  'energy',
  'pharmaceutical',
  'defense',
  'artificial intelligence',
  'crypto',
  'steel',
  'immigration',
  'shipbuilding',
];

/**
 * Where the White House and the President post. Every policy subject is
 * attributed to the White House, so every one shares this card.
 *
 * Curated by hand — no dataset publishes these — and checked October 2026. The
 * President's personal account is where tariff and policy news often lands
 * first, hours before anything reaches the Federal Register, which is why it is
 * here at all.
 */
const WHITE_HOUSE_PROFILE: SubjectProfile = {
  facts: ['Executive Office of the President', 'Signals are documents published in the Federal Register'],
  links: orderLinks([
    socialLink('website', 'https://www.whitehouse.gov'),
    socialLink('x', 'WhiteHouse'),
    socialLink('instagram', 'whitehouse'),
    socialLink('facebook', 'WhiteHouse'),
    socialLink('youtube', 'WhiteHouse'),
    socialLink('tiktok', 'whitehouse'),
    socialLink('truth', 'realDonaldTrump', 'President Trump'),
    socialLink('x', 'POTUS', 'The President'),
  ]),
  provenance: 'Official accounts, listed by Ripple',
};

interface FederalRegisterResponse {
  count?: number;
  results?: FederalRegisterDocument[];
}

function buildUrl(scope: PolicyScope, limit: number): string {
  const params = new URLSearchParams();
  params.set('per_page', String(Math.min(100, Math.max(1, limit))));
  params.set('order', 'newest');
  params.append('conditions[type][]', 'PRESDOCU');

  for (const field of [
    'document_number',
    'title',
    'subtype',
    'publication_date',
    'signing_date',
    'html_url',
    'executive_order_number',
  ]) {
    params.append('fields[]', field);
  }

  if (scope.kind === 'type') {
    params.append('conditions[presidential_document_type][]', scope.documentType);
  } else if (scope.kind === 'term') {
    params.set('conditions[term]', scope.term);
  }

  return `${API}?${params.toString()}`;
}

/**
 * `handle` MUST be the watched subject's handle, not a friendly name.
 *
 * The feed prunes any signal whose `actor.handle` doesn't match a watched
 * subject (see `pruneUnwatched`), so returning a decorative handle here would
 * make every policy signal vanish after a successful fetch — silently, with no
 * error. The display name is where the friendly label belongs.
 */
function actorFor(handle: string, scope: PolicyScope): Actor {
  return {
    handle,
    displayName: 'The White House',
    subtitle: scopeLabel(scope),
    avatarUrl: null,
  };
}

export const PolicyProvider: Provider<FederalRegisterDocument> = {
  id: 'policy',
  label: 'Policy',
  sigil: '',
  color: '#5B8DEF',
  icon: 'fa6:scale-balanced',
  blurb: 'Executive orders and proclamations as they are signed',
  subjectNoun: 'a document type or topic',
  provenance: 'Federal Register API, no key required',

  mode(): ProviderMode {
    return 'public';
  },

  async searchSubjects(query: string): Promise<SubjectResult[]> {
    const term = query.trim();
    const lower = term.toLowerCase();

    const presets = PRESETS.filter(
      (p) => !lower || p.label.toLowerCase().includes(lower) || p.subtitle.toLowerCase().includes(lower),
    ).map((p) => ({
      source: 'policy' as const,
      handle: p.handle,
      displayName: p.label,
      subtitle: p.subtitle,
      avatarUrl: null,
    }));

    const hints = TOPIC_HINTS.filter((t) => lower && t.includes(lower) && t !== lower).map((t) => ({
      source: 'policy' as const,
      handle: `term:${t}`,
      displayName: `“${t}” in presidential actions`,
      subtitle: 'Topic watch',
      avatarUrl: null,
    }));

    // Any free text is a valid topic watch, so always offer it as the top row.
    const freeText =
      term.length >= 3 && !PRESETS.some((p) => p.label.toLowerCase() === lower)
        ? [
            {
              source: 'policy' as const,
              handle: `term:${term}`,
              displayName: `“${term}” in presidential actions`,
              subtitle: 'Topic watch — every action mentioning this',
              avatarUrl: null,
            },
          ]
        : [];

    const seen = new Set<string>();
    return [...freeText, ...presets, ...hints]
      .filter((r) => (seen.has(r.handle) ? false : (seen.add(r.handle), true)))
      .slice(0, 12);
  },

  async profile(): Promise<SubjectProfile> {
    return WHITE_HOUSE_PROFILE;
  },

  async getSignals(handle: string, options: GetSignalsOptions = {}): Promise<Signal[]> {
    const scope = parseScope(handle);
    const limit = options.limit ?? 15;

    const res = await getJson<FederalRegisterResponse>(buildUrl(scope, limit), {
      signal: options.signal,
      timeoutMs: 20_000,
    });

    const actor = actorFor(handle, scope);
    let signals = (res.results ?? [])
      .map((doc) => normalizePolicyDocument(doc, actor))
      .filter((s): s is Signal => s !== null);

    if (options.since !== undefined) {
      const since = options.since;
      signals = signals.filter((s) => s.timestamp > since);
    }

    return signals.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  },

  normalizeSignal(raw: FederalRegisterDocument, actor: Actor): Signal {
    const signal = normalizePolicyDocument(raw, actor);
    if (!signal) throw new Error('Federal Register document is missing a usable date');
    return signal;
  },
};
