import type { Signal } from '@/providers/types';

/**
 * What a shared signal reads as.
 *
 * Kept free of framework imports so it can be unit-tested directly — the
 * presentation half (`Share.share`, and the platform's differing field
 * semantics) lives in `src/ui/signalActions.ts`.
 *
 * The shared message has to stand on its own in someone else's inbox, where
 * none of the app's surrounding context exists: who acted, what they did, and
 * the document it came from.
 */
export function shareText(signal: Signal): string {
  const who = signal.actor.displayName;
  const subtitle = signal.actor.subtitle ? ` (${signal.actor.subtitle})` : '';

  // Most sources already open with the actor's name ("Ro Khanna bought NVDA"),
  // so prefixing unconditionally produced "Ro Khanna (CA-17): Ro Khanna
  // bought NVDA". The header is added only when it is not a repeat.
  const lead = signal.text.startsWith(who) ? signal.text : `${who}${subtitle}: ${signal.text}`;

  return `${lead}\n\n${signal.url}`;
}
