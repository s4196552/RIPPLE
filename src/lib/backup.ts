import type { SourceId } from '@/providers/types';
import type { WatchedSubject } from '@/store/watchlist.ts';

/**
 * Taking a watchlist off one device and putting it on another.
 *
 * Ripple has no account and no server, which is the right trade for a privacy
 * standpoint and a bad one the day someone changes phone: the watchlist exists
 * in exactly one place and nothing anywhere else knows it existed. This is the
 * escape hatch — a small text document the user holds, rather than a sync
 * service the app would have to become something else to offer.
 *
 * Only `import type`, so both halves are unit-tested with no store.
 */

/** Bumped only when the shape below changes incompatibly. */
export const BACKUP_VERSION = 1;

export interface Backup {
  app: 'ripple';
  version: number;
  exportedAt: number;
  subjects: BackupSubject[];
}

/**
 * What is worth carrying across.
 *
 * Deliberately not the whole `WatchedSubject`. `addedAt` describes the old
 * install, and the avatar is a URL the provider will re-derive anyway — a
 * stale one baked into a backup would outlive the endpoint that served it.
 */
export interface BackupSubject {
  source: SourceId;
  handle: string;
  displayName: string;
  subtitle?: string | null;
  muted?: boolean;
  /**
   * When a timed mute lifts, epoch ms. Additive, so the version is unchanged:
   * a build that predates it reads the follow as muted until unmuted.
   */
  mutedUntil?: number;
}

export function createBackup(
  subjects: readonly WatchedSubject[],
  now: number = Date.now(),
): Backup {
  return {
    app: 'ripple',
    version: BACKUP_VERSION,
    exportedAt: now,
    subjects: subjects.map((s) => ({
      source: s.source,
      handle: s.handle,
      displayName: s.displayName,
      subtitle: s.subtitle ?? null,
      ...(s.muted ? { muted: true } : {}),
      ...(s.muted && s.mutedUntil != null ? { mutedUntil: s.mutedUntil } : {}),
    })),
  };
}

/** Pretty-printed, because a human is going to be looking at this in a note app. */
export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

export type ParseResult =
  | { ok: true; subjects: BackupSubject[] }
  | { ok: false; error: string };

const SOURCES: SourceId[] = ['congress', 'insider', 'policy', 'stocks', 'funds'];

/**
 * Read a backup back, refusing anything it cannot vouch for.
 *
 * Every message here is written to be shown to the user as-is. "Invalid JSON"
 * is not a useful thing to tell someone who has just pasted a block of text
 * they did not write, so each failure says what was wrong with *their* input.
 *
 * Restoring is additive at the call site, and this deliberately does no
 * merging: deciding what happens to a handle that already exists is the
 * store's business, not the parser's.
 */
export function parseBackup(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Nothing pasted yet.' };

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "That doesn't look like a Ripple backup — it isn't valid JSON." };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'A backup should be a single JSON object.' };
  }

  const backup = raw as Partial<Backup>;

  if (backup.app !== 'ripple') {
    return { ok: false, error: 'That backup was not made by Ripple.' };
  }

  // Forward-only. A file from a later version may use fields this build would
  // silently drop, and silently dropping half of someone's watchlist is worse
  // than declining to read it.
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: 'That backup was made by a newer version of Ripple. Update the app and try again.',
    };
  }

  if (!Array.isArray(backup.subjects)) {
    return { ok: false, error: 'That backup has no subjects in it.' };
  }

  const subjects: BackupSubject[] = [];
  const seen = new Set<string>();

  for (const entry of backup.subjects) {
    if (!entry || typeof entry !== 'object') continue;
    const s = entry as Partial<BackupSubject>;

    if (typeof s.handle !== 'string' || !s.handle.trim()) continue;
    if (typeof s.source !== 'string' || !SOURCES.includes(s.source as SourceId)) continue;

    // One row per subject, so a hand-edited file cannot produce duplicates the
    // watchlist would then have to de-duplicate on every render.
    const key = `${s.source}:${s.handle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    subjects.push({
      source: s.source as SourceId,
      handle: s.handle.trim(),
      displayName:
        typeof s.displayName === 'string' && s.displayName.trim()
          ? s.displayName.trim()
          : // A backup missing a name is still restorable — the handle is what
            // the provider actually fetches by, and the real name arrives with
            // the first signal.
            s.handle.trim(),
      subtitle: typeof s.subtitle === 'string' ? s.subtitle : null,
      ...(s.muted === true ? { muted: true } : {}),
      ...(s.muted === true && typeof s.mutedUntil === 'number' && Number.isFinite(s.mutedUntil)
        ? { mutedUntil: s.mutedUntil }
        : {}),
    });
  }

  if (subjects.length === 0) {
    return { ok: false, error: 'That backup has no subjects this version can read.' };
  }

  return { ok: true, subjects };
}

/** `4 subjects · 2 already followed` — what a restore is about to do. */
export function restorePreview(
  incoming: readonly BackupSubject[],
  existing: readonly WatchedSubject[],
): { total: number; added: number; already: number; summary: string } {
  const have = new Set(existing.map((s) => `${s.source}:${s.handle.toLowerCase()}`));
  const already = incoming.filter((s) => have.has(`${s.source}:${s.handle.toLowerCase()}`)).length;
  const added = incoming.length - already;

  const parts = [`${added} to add`];
  if (already > 0) parts.push(`${already} already followed`);

  return { total: incoming.length, added, already, summary: parts.join(' · ') };
}
