import type { SocialLink, SocialPlatform } from '../providers/types.ts';

/**
 * Public accounts, from the handle a dataset stores to a link that opens.
 *
 * Datasets store a bare account name (`RepAmata`, `@RepAmata`, sometimes a
 * whole URL), and each platform builds its address differently, so this is the
 * one place that knows how. Free of framework imports so it can be unit-tested
 * directly.
 */

/** Spoken and printed name for each platform. */
export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  x: 'X',
  truth: 'Truth Social',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  threads: 'Threads',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  tiktok: 'TikTok',
  website: 'Website',
};

/**
 * Order on the card: the official site, then the platforms where people
 * with market-moving news tend to post it first.
 */
const ORDER: readonly SocialPlatform[] = [
  'website',
  'x',
  'truth',
  'instagram',
  'facebook',
  'youtube',
  'threads',
  'bluesky',
  'mastodon',
  'tiktok',
];

/** `@RepAmata`, `RepAmata`, `https://x.com/RepAmata/` -> `RepAmata`. */
function bareName(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '');
}

/** `https://www.cantwell.senate.gov/` -> `cantwell.senate.gov`. */
function siteName(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

/**
 * One account as a link, or null when the value cannot make a working one.
 *
 * Returning null rather than a half-built URL is the point: a link that opens
 * someone else's profile, or a 404, is worse than leaving the account out.
 */
export function socialLink(
  platform: SocialPlatform,
  value: string | null | undefined,
  owner?: string | null,
): SocialLink | null {
  const raw = value?.trim();
  if (!raw) return null;
  const extra = owner ? { owner } : {};

  if (platform === 'website') {
    const site = siteName(raw);
    if (!site || /\s/.test(site)) return null;
    return { platform, handle: site, url: /^https?:\/\//i.test(raw) ? raw : `https://${site}`, ...extra };
  }

  if (platform === 'mastodon') {
    // A Mastodon account lives on a server of its own: `@user@server`.
    const m = raw.match(/^@?([\w.-]+)@([\w.-]+\.[a-z]{2,})$/i);
    if (!m) return null;
    return { platform, handle: `@${m[1]}@${m[2]}`, url: `https://${m[2]}/@${m[1]}`, ...extra };
  }

  const name = bareName(raw);
  if (!name || !/^[\w.-]+$/.test(name)) return null;
  const handle = `@${name}`;
  const path = encodeURIComponent(name);

  switch (platform) {
    case 'x':
      return { platform, handle, url: `https://x.com/${path}`, ...extra };
    case 'truth':
      return { platform, handle, url: `https://truthsocial.com/@${path}`, ...extra };
    case 'instagram':
      return { platform, handle, url: `https://www.instagram.com/${path}`, ...extra };
    case 'facebook':
      // Facebook pages have no `@` of their own; the page name reads as is.
      return { platform, handle: name, url: `https://www.facebook.com/${path}`, ...extra };
    case 'youtube':
      return { platform, handle, url: `https://www.youtube.com/@${path}`, ...extra };
    case 'threads':
      return { platform, handle, url: `https://www.threads.net/@${path}`, ...extra };
    case 'bluesky':
      return { platform, handle, url: `https://bsky.app/profile/${path}`, ...extra };
    case 'tiktok':
      return { platform, handle, url: `https://www.tiktok.com/@${path}`, ...extra };
  }
}

/**
 * A YouTube channel as Congress records it: a channel id, a legacy username,
 * or both.
 *
 * Neither is an `@handle` — a legacy username can differ from the channel's
 * handle today — so the id is the address whenever there is one, as the only
 * value guaranteed to open the right channel. The username, when present, is
 * still the better label, and the old `/user/` address is the fallback.
 */
export function youtubeChannel(id: string | null | undefined, username?: string | null): SocialLink | null {
  const channel = id?.trim();
  const name = username ? bareName(username) : '';
  const label = name && /^[\w.-]+$/.test(name) ? name : '';
  if (channel && /^UC[\w-]{10,}$/.test(channel)) {
    return { platform: 'youtube', handle: label || 'YouTube channel', url: `https://www.youtube.com/channel/${channel}` };
  }
  if (label) {
    return { platform: 'youtube', handle: label, url: `https://www.youtube.com/user/${encodeURIComponent(label)}` };
  }
  return null;
}

/**
 * Drop the nulls, put the rest in card order, and keep one link per address —
 * two datasets can both name the same account.
 */
export function orderLinks(links: readonly (SocialLink | null | undefined)[]): SocialLink[] {
  const seen = new Set<string>();
  const kept: SocialLink[] = [];
  for (const link of links) {
    if (!link) continue;
    const key = link.url.toLowerCase().replace(/\/+$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(link);
  }
  // Stable, so two accounts on one platform keep the order they were given in.
  return kept
    .map((link, i) => ({ link, i }))
    .sort((a, b) => ORDER.indexOf(a.link.platform) - ORDER.indexOf(b.link.platform) || a.i - b.i)
    .map(({ link }) => link);
}
