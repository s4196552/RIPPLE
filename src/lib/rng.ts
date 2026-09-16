/**
 * Deterministic PRNG used by the mock adapters.
 *
 * Mock posts must be *stable*: refreshing the feed should not reshuffle
 * everything under the user, and two calls for the same handle within the same
 * time bucket must produce identical ids so dedupe works. Seeding from the
 * handle gives us that for free.
 */

/** FNV-1a — small, fast, good enough spread for string -> seed. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: returns a function producing floats in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  // Callers always pass a non-empty literal array; the assertion keeps
  // noUncheckedIndexedAccess from leaking `undefined` into every call site.
  return items[Math.floor(rand() * items.length)] as T;
}
