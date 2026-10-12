/**
 * A deliberately tiny XML reader.
 *
 * Two of our sources ship XML (SEC Form 4 ownership documents, the House Clerk
 * disclosure index) and neither needs a real parser: the documents are shallow,
 * machine-generated and schema-stable. Pulling in a DOM parser would cost more
 * bundle weight than the whole feature.
 *
 * `[^]` is used rather than `.` with the dotAll flag — it means the same thing,
 * needs no flag, and is safe on every engine including Hermes.
 *
 * Pure, no imports, unit-tested directly.
 */

/**
 * Namespace prefixes removed from every tag, so `<ns1:infoTable>` reads as
 * `<infoTable>`: the readers below match tag names exactly.
 */
export function stripNamespaces(xml: string): string {
  return xml.replace(/<(\/?)[\w.-]+:/g, '<$1');
}

/** First value of `<name>…</name>`, trimmed. Null when absent. */
export function tag(name: string, xml: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([^]*?)</${name}>`));
  return m?.[1] !== undefined ? decode(m[1].trim()) : null;
}

/** Every `<name>…</name>` body, in document order. */
export function tagAll(name: string, xml: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}[^>]*>([^]*?)</${name}>`, 'g');
  for (const m of xml.matchAll(re)) {
    if (m[1] !== undefined) out.push(decode(m[1].trim()));
  }
  return out;
}

/**
 * SEC ownership documents wrap most leaves as `<field><value>x</value></field>`,
 * but not all of them — some are bare. This reads either.
 */
export function tagValue(name: string, xml: string): string | null {
  const body = tag(name, xml);
  if (body === null) return null;
  return tag('value', body) ?? body;
}

/** Numeric `tagValue`, or null when missing/unparseable. */
export function tagNumber(name: string, xml: string): number | null {
  const raw = tagValue(name, xml);
  if (raw === null) return null;
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
};

/** Resolve the handful of entities these feeds actually emit. */
export function decode(text: string): string {
  return text.replace(/&(#?\w+);/g, (whole, name: string) => {
    const named = ENTITIES[name];
    if (named !== undefined) return named;
    if (name.startsWith('#')) {
      const code = Number(name.slice(1));
      if (Number.isFinite(code)) return String.fromCharCode(code);
    }
    return whole;
  });
}
