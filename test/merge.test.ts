import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_SIGNALS,
  countBySource,
  liftExpiredMutes,
  mergeSignals,
  pruneUnwatched,
  subjectKey,
  visibleSignals,
} from '../src/store/merge.ts';
import type { Signal, SourceId } from '../src/providers/types.ts';
import type { WatchedSubject } from '../src/store/watchlist.ts';

function signal(
  id: string,
  timestamp: number,
  source: SourceId = 'congress',
  handle = 'nancy-pelosi-ca11',
  extra: Partial<Signal> = {},
): Signal {
  return {
    id,
    source,
    actor: { handle, displayName: handle },
    text: `signal ${id}`,
    url: `https://example.test/${id}`,
    timestamp,
    ...extra,
  };
}

function subject(source: SourceId, handle: string, muted = false): WatchedSubject {
  return { source, handle, displayName: handle, addedAt: 0, muted };
}

describe('subjectKey', () => {
  it('is case-insensitive on the handle', () => {
    assert.equal(subjectKey('insider', 'aapl'), subjectKey('insider', 'AAPL'));
  });

  it('separates the same handle on different sources', () => {
    assert.notEqual(subjectKey('insider', 'AAPL'), subjectKey('stocks', 'AAPL'));
  });
});

describe('mergeSignals', () => {
  it('sorts newest first regardless of input order', () => {
    const merged = mergeSignals([], [signal('a', 100), signal('c', 300), signal('b', 200)]);
    assert.deepEqual(merged.map((s) => s.id), ['c', 'b', 'a']);
  });

  it('interleaves sources strictly by timestamp', () => {
    const existing = [signal('c1', 300, 'congress'), signal('c2', 100, 'congress')];
    const incoming = [signal('i1', 400, 'insider', 'AAPL'), signal('i2', 200, 'insider', 'AAPL')];

    assert.deepEqual(
      mergeSignals(existing, incoming).map((s) => s.id),
      ['i1', 'c1', 'i2', 'c2'],
    );
  });

  it('dedupes by id so overlapping polls do not duplicate signals', () => {
    const merged = mergeSignals(
      [signal('a', 100), signal('b', 200)],
      [signal('b', 200), signal('c', 300)],
    );
    assert.equal(merged.length, 3);
    assert.deepEqual(merged.map((s) => s.id), ['c', 'b', 'a']);
  });

  it('lets incoming win on collision, so corrected figures are kept', () => {
    const stale = signal('a', 100, 'congress', 'x', { text: 'old' });
    const fresh = signal('a', 100, 'congress', 'x', { text: 'corrected' });

    const merged = mergeSignals([stale], [fresh]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.text, 'corrected');
  });

  it('breaks timestamp ties deterministically', () => {
    // These sources are day-resolution, so same-timestamp ties are the norm,
    // not an edge case — an unstable sort would make the list jump constantly.
    const first = mergeSignals([], [signal('b', 500), signal('a', 500), signal('c', 500)]);
    const second = mergeSignals([], [signal('c', 500), signal('b', 500), signal('a', 500)]);

    assert.deepEqual(first.map((s) => s.id), ['a', 'b', 'c']);
    assert.deepEqual(first.map((s) => s.id), second.map((s) => s.id));
  });

  it('caps retention so a long session cannot grow unbounded', () => {
    const many = Array.from({ length: MAX_SIGNALS + 50 }, (_, i) => signal(`s${i}`, i));
    const merged = mergeSignals([], many);

    assert.equal(merged.length, MAX_SIGNALS);
    // The cap must drop the oldest, never the newest.
    assert.equal(merged[0]?.timestamp, MAX_SIGNALS + 49);
  });

  it('treats an empty incoming batch as a no-op', () => {
    const existing = [signal('a', 100), signal('b', 200)];
    assert.deepEqual(mergeSignals(existing, []).map((s) => s.id), ['b', 'a']);
  });
  it('drops a card that an incoming one supersedes', () => {
    // A filing's "report exists" card, then the trades read from its PDF.
    const filing = signal('congress:2002', 100);
    const trade = signal('congress:2002-0', 100, 'congress', 'nancy-pelosi-ca11', {
      supersedes: ['congress:2002'],
    });
    assert.deepEqual(mergeSignals([filing], [trade]).map((s) => s.id), ['congress:2002-0']);
  });
});

describe('pruneUnwatched', () => {
  it('drops signals whose subject is no longer watched', () => {
    const signals = [
      signal('a', 100, 'congress', 'pelosi'),
      signal('b', 200, 'congress', 'greene'),
    ];
    const pruned = pruneUnwatched(signals, [subject('congress', 'pelosi')]);
    assert.deepEqual(pruned.map((s) => s.id), ['a']);
  });

  it('matches handles case-insensitively', () => {
    const signals = [signal('a', 100, 'insider', 'AAPL')];
    assert.equal(pruneUnwatched(signals, [subject('insider', 'aapl')]).length, 1);
  });

  it('drops signals whose actor handle differs from the watched handle', () => {
    // Regression: PolicyProvider stamped every signal with a decorative actor
    // handle ('white-house') while the watched subject was 'type:executive_order'.
    // Fetches succeeded, then every signal was pruned here — silently, with no
    // error surfaced. Providers must echo back the handle they were given.
    const decorative = [signal('p1', 100, 'policy', 'white-house')];
    assert.equal(pruneUnwatched(decorative, [subject('policy', 'type:executive_order')]).length, 0);

    const correct = [signal('p1', 100, 'policy', 'type:executive_order')];
    assert.equal(pruneUnwatched(correct, [subject('policy', 'type:executive_order')]).length, 1);
  });

  it('does not confuse the same handle on two sources', () => {
    const signals = [
      signal('i', 100, 'insider', 'AAPL'),
      signal('s', 200, 'stocks', 'AAPL'),
    ];
    assert.deepEqual(
      pruneUnwatched(signals, [subject('stocks', 'AAPL')]).map((s) => s.id),
      ['s'],
    );
  });
});

describe('visibleSignals', () => {
  const signals = [
    signal('c', 300, 'congress', 'pelosi'),
    signal('i', 200, 'insider', 'AAPL'),
  ];
  const subjects = [subject('congress', 'pelosi'), subject('insider', 'AAPL')];

  it('returns everything when nothing is filtered', () => {
    assert.equal(visibleSignals(signals, [], subjects).length, 2);
  });

  it('hides signals from a toggled-off source', () => {
    assert.deepEqual(
      visibleSignals(signals, ['insider'], subjects).map((s) => s.id),
      ['c'],
    );
  });

  it('hides signals from a muted subject without unfollowing it', () => {
    const muted = [subject('congress', 'pelosi', true), subject('insider', 'AAPL')];
    assert.deepEqual(visibleSignals(signals, [], muted).map((s) => s.id), ['i']);
  });

  it('preserves sort order after filtering', () => {
    const shown = visibleSignals(signals, [], subjects);
    assert.ok(shown[0]!.timestamp > shown[1]!.timestamp);
  });
});

describe('countBySource', () => {
  it('tallies per source', () => {
    const counts = countBySource([
      signal('a', 1, 'congress'),
      signal('b', 2, 'congress'),
      signal('c', 3, 'policy'),
    ]);
    assert.equal(counts.congress, 2);
    assert.equal(counts.policy, 1);
    assert.equal(counts.insider, undefined);
  });

  it('returns an empty tally for no signals', () => {
    assert.deepEqual(countBySource([]), {});
  });
});

describe('liftExpiredMutes', () => {
  const base: WatchedSubject = {
    source: 'congress',
    handle: 'nancy-pelosi-ca11',
    displayName: 'Nancy Pelosi',
    addedAt: 0,
    muted: true,
  };

  it('unmutes a timed mute once its time has passed', () => {
    const lifted = liftExpiredMutes([{ ...base, mutedUntil: 1_000 }], 2_000);
    assert.equal(lifted?.[0]?.muted, false);
    assert.equal(lifted?.[0]?.mutedUntil, null);
  });

  it('leaves a mute that has not run out, and one with no end', () => {
    assert.equal(liftExpiredMutes([{ ...base, mutedUntil: 5_000 }], 2_000), null);
    assert.equal(liftExpiredMutes([{ ...base, mutedUntil: null }], 2_000), null);
    assert.equal(liftExpiredMutes([base], 2_000), null);
  });
});
