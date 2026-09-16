import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BACKUP_VERSION,
  createBackup,
  parseBackup,
  restorePreview,
  serializeBackup,
} from '../src/lib/backup.ts';
import type { WatchedSubject } from '../src/store/watchlist.ts';

function watched(over: Partial<WatchedSubject> = {}): WatchedSubject {
  return {
    source: 'congress',
    handle: 'nancy-pelosi-ca11',
    displayName: 'Nancy Pelosi',
    subtitle: 'CA-11 · Democrat',
    avatarUrl: 'https://example.test/p.jpg',
    addedAt: 1_700_000_000_000,
    muted: false,
    ...over,
  };
}

describe('createBackup', () => {
  it('stamps the app and version so a stray file is recognisable', () => {
    const backup = createBackup([watched()], 42);
    assert.equal(backup.app, 'ripple');
    assert.equal(backup.version, BACKUP_VERSION);
    assert.equal(backup.exportedAt, 42);
  });

  it('carries what identifies a subject', () => {
    const [subject] = createBackup([watched()]).subjects;
    assert.equal(subject?.source, 'congress');
    assert.equal(subject?.handle, 'nancy-pelosi-ca11');
    assert.equal(subject?.displayName, 'Nancy Pelosi');
  });

  it('leaves behind what belongs to the old install', () => {
    // `addedAt` describes the device it came from, and a baked-in avatar URL
    // would outlive the endpoint that served it.
    const [subject] = createBackup([watched()]).subjects as unknown as Record<string, unknown>[];
    assert.equal(subject?.addedAt, undefined);
    assert.equal(subject?.avatarUrl, undefined);
  });

  it('keeps a mute, since that is a choice and not state', () => {
    const [muted] = createBackup([watched({ muted: true })]).subjects;
    assert.equal(muted?.muted, true);
  });

  it('omits mute when it is off, rather than writing false everywhere', () => {
    const [subject] = createBackup([watched()]).subjects as unknown as Record<string, unknown>[];
    assert.equal(subject?.muted, undefined);
  });

  it('handles an empty watchlist', () => {
    assert.deepEqual(createBackup([]).subjects, []);
  });
});

describe('round trip', () => {
  it('reads back exactly what it wrote', () => {
    const subjects = [
      watched(),
      watched({ source: 'insider', handle: 'NVDA', displayName: 'NVIDIA', muted: true }),
    ];
    const result = parseBackup(serializeBackup(createBackup(subjects)));

    assert.ok(result.ok);
    assert.equal(result.subjects.length, 2);
    assert.equal(result.subjects[1]?.handle, 'NVDA');
    assert.equal(result.subjects[1]?.muted, true);
  });

  it('serializes to something a human can read in a note app', () => {
    assert.match(serializeBackup(createBackup([watched()])), /\n {2}"app": "ripple"/);
  });
});

describe('parseBackup rejects', () => {
  const cases: [string, string, RegExp][] = [
    ['nothing at all', '   ', /Nothing pasted/],
    ['prose', 'here is my watchlist', /isn't valid JSON/],
    ['a bare array', '[]', /single JSON object/],
    ['another app', '{"app":"other","version":1,"subjects":[]}', /not made by Ripple/],
    [
      'a newer version',
      `{"app":"ripple","version":${BACKUP_VERSION + 1},"subjects":[]}`,
      /newer version/,
    ],
    ['no subjects key', '{"app":"ripple","version":1}', /no subjects/],
    ['only unreadable subjects', '{"app":"ripple","version":1,"subjects":[{"handle":"x"}]}', /no subjects this version can read/],
  ];

  for (const [name, input, expected] of cases) {
    it(name, () => {
      const result = parseBackup(input);
      assert.equal(result.ok, false);
      assert.match(result.ok ? '' : result.error, expected);
    });
  }

  it('explains itself in words meant for the user', () => {
    // Every message is shown as-is. "Invalid JSON" is not a useful thing to
    // tell someone who has just pasted a block of text they did not write.
    const result = parseBackup('not json');
    assert.equal(result.ok, false);
    assert.ok(!result.ok && /^[A-Z]/.test(result.error) && result.error.endsWith('.'));
  });
});

describe('parseBackup accepts', () => {
  it('skips a malformed row but keeps the good ones', () => {
    const result = parseBackup(
      JSON.stringify({
        app: 'ripple',
        version: 1,
        subjects: [
          { source: 'congress', handle: 'a', displayName: 'A' },
          null,
          { source: 'nonsense', handle: 'b', displayName: 'B' },
          { source: 'stocks', handle: '  SPY  ', displayName: 'SPY' },
        ],
      }),
    );

    assert.ok(result.ok);
    assert.deepEqual(result.subjects.map((s) => s.handle), ['a', 'SPY']);
  });

  it('falls back to the handle when a name is missing', () => {
    // The handle is what the provider actually fetches by, and the real name
    // arrives with the first signal, so this is restorable rather than junk.
    const result = parseBackup('{"app":"ripple","version":1,"subjects":[{"source":"stocks","handle":"SPY"}]}');
    assert.ok(result.ok);
    assert.equal(result.subjects[0]?.displayName, 'SPY');
  });

  it('collapses duplicates, case-insensitively', () => {
    const result = parseBackup(
      JSON.stringify({
        app: 'ripple',
        version: 1,
        subjects: [
          { source: 'insider', handle: 'NVDA', displayName: 'NVIDIA' },
          { source: 'insider', handle: 'nvda', displayName: 'NVIDIA again' },
        ],
      }),
    );
    assert.ok(result.ok);
    assert.equal(result.subjects.length, 1);
  });

  it('reads an older backup', () => {
    const result = parseBackup('{"app":"ripple","version":1,"subjects":[{"source":"policy","handle":"type:executive_order","displayName":"EOs"}]}');
    assert.ok(result.ok);
  });
});

describe('restorePreview', () => {
  it('separates what is new from what is already followed', () => {
    const incoming = [
      { source: 'congress' as const, handle: 'a', displayName: 'A' },
      { source: 'stocks' as const, handle: 'SPY', displayName: 'SPY' },
    ];
    const preview = restorePreview(incoming, [watched({ source: 'stocks', handle: 'spy' })]);

    assert.equal(preview.total, 2);
    assert.equal(preview.added, 1);
    assert.equal(preview.already, 1);
    assert.equal(preview.summary, '1 to add · 1 already followed');
  });

  it('says nothing about overlap when there is none', () => {
    const preview = restorePreview([{ source: 'congress', handle: 'a', displayName: 'A' }], []);
    assert.equal(preview.summary, '1 to add');
  });
});
