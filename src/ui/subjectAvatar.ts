import { getProvider } from '@/providers/registry';
import type { SourceId } from '@/providers/types';
import type { GlyphSpec } from './components/Glyph';
import { subjectGlyph } from './groupGlyph';

/** Sources whose subjects are drawn by a company or firm logo, not a face. */
const LOGO_SOURCES: ReadonlySet<SourceId> = new Set(['stocks', 'insider', 'funds']);

/**
 * Everything `Avatar` needs to draw a subject, decided in one place.
 *
 * The image comes from the provider's handle-derived URL when it has one, so a
 * subject followed before its source learned to supply logos still gets one;
 * the stored snapshot is the fallback. Logos sit square on a light plate, and
 * the glyph stands in for anything with no image, or whose image fails.
 */
export function subjectAvatar(
  source: SourceId,
  handle: string,
  storedUri?: string | null,
): { uri: string | null; glyph?: GlyphSpec; square: boolean; logo: boolean } {
  const derived = getProvider(source).subjectAvatarUrl?.(handle) ?? null;
  const isLogo = LOGO_SOURCES.has(source);
  return {
    uri: derived ?? storedUri ?? null,
    glyph: subjectGlyph(source, handle)?.glyph,
    square: isLogo,
    logo: isLogo,
  };
}
