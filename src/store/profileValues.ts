/**
 * The pure half of `./profile.ts`, split out so it can be tested without
 * AsyncStorage — the same split as `./preferenceValues.ts`.
 */

/**
 * A stored avatar URI, or null when it is not one this app writes: a file in
 * its own storage on native, or an image data URI on web. Anything else — a
 * remote URL, a hand-edited blob — would make the app fetch or render
 * something the user never chose.
 */
export function cleanAvatarUri(persisted: unknown): string | null {
  const uri = (persisted as { avatarUri?: unknown } | null)?.avatarUri;
  if (typeof uri !== 'string') return null;
  return /^(file:|data:image\/(jpeg|png|webp);base64,)/.test(uri) ? uri : null;
}
