import type { Actor, Signal } from '@/providers/types';

/**
 * Federal Register presidential documents -> feed signals.
 *
 * Only `import type`, so this is unit-tested with no network.
 */

/** A document as returned by the Federal Register API. */
export interface FederalRegisterDocument {
  document_number?: string;
  title?: string;
  subtype?: string | null;
  publication_date?: string;
  signing_date?: string | null;
  html_url?: string;
  executive_order_number?: number | null;
  /** Agencies or topics the document is filed under. */
  topics?: string[] | null;
}

/** Subject kinds a user can watch. */
export type PolicyScope =
  | { kind: 'all' }
  | { kind: 'type'; documentType: string }
  | { kind: 'term'; term: string };

/**
 * Subject handles are encoded as strings so they can live in the watchlist and
 * in a route param. `all`, `type:executive_order`, `term:semiconductor`.
 */
export function parseScope(handle: string): PolicyScope {
  const value = handle.trim();
  if (!value || value === 'all') return { kind: 'all' };
  if (value.startsWith('type:')) return { kind: 'type', documentType: value.slice(5) };
  if (value.startsWith('term:')) return { kind: 'term', term: value.slice(5) };
  // Anything unrecognised is treated as a free-text topic rather than an error.
  return { kind: 'term', term: value };
}

export function scopeLabel(scope: PolicyScope): string {
  switch (scope.kind) {
    case 'all':
      return 'All presidential actions';
    case 'type':
      return titleCase(scope.documentType.replace(/_/g, ' ')) + 's';
    case 'term':
      return `“${scope.term}” in presidential actions`;
  }
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * `YYYY-MM-DD` -> epoch ms at UTC midnight, built explicitly so the value
 * doesn't shift with the device's timezone. The feed sorts on this.
 */
export function parseDay(value: string | null | undefined): number | null {
  const m = (value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const ts = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(ts) ? ts : null;
}

/** `Executive Order` -> `EXECUTIVE ORDER`. Falls back to a generic label. */
export function badgeFor(doc: FederalRegisterDocument): string {
  const subtype = (doc.subtype ?? '').trim();
  return subtype ? subtype.toUpperCase() : 'PRESIDENTIAL ACTION';
}

export function normalizePolicyDocument(
  doc: FederalRegisterDocument,
  actor: Actor,
): Signal | null {
  // Sort on signing date when present — that's when the action actually
  // happened. Publication can trail it by several days.
  const timestamp = parseDay(doc.signing_date) ?? parseDay(doc.publication_date);
  if (timestamp === null || !doc.document_number) return null;

  const badges = [badgeFor(doc)];
  if (doc.executive_order_number) badges.push(`EO ${doc.executive_order_number}`);

  return {
    id: `policy:${doc.document_number}`,
    source: 'policy',
    actor,
    text: doc.title?.trim() || 'Untitled presidential document',
    url: doc.html_url ?? `https://www.federalregister.gov/d/${doc.document_number}`,
    timestamp,
    ticker: null,
    accent: null,
    badges,
  };
}
