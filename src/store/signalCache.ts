import type { Signal } from '@/providers/types';
import { useFeed } from './feed';

/**
 * Signals a screen has shown, by id, so the filing view can open one by id.
 *
 * The member page fetches straight from its provider, deeper than the merged
 * feed goes, so a filing it lists may not be in the feed store at all. Routes
 * carry only the id; this is where the rest is found. In memory only — after a
 * cold start the feed store is the fallback, and the filing view says so when
 * neither has it.
 */
const seen = new Map<string, Signal>();

export function rememberSignals(signals: readonly Signal[]): void {
  for (const signal of signals) seen.set(signal.id, signal);
}

export function findSignal(id: string): Signal | undefined {
  return seen.get(id) ?? useFeed.getState().signals.find((s) => s.id === id);
}
