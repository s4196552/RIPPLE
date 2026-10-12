import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_SUBJECTS, feedSubjects, isStarterFeed } from '../src/store/defaults.ts';
import { subjectKey } from '../src/store/merge.ts';
import type { WatchedSubject } from '../src/store/watchlist.ts';

function watched(source: WatchedSubject['source'], handle: string): WatchedSubject {
  return {
    source,
    handle,
    displayName: handle,
    subtitle: null,
    avatarUrl: null,
    addedAt: 1,
    muted: false,
  };
}

describe('DEFAULT_SUBJECTS', () => {
  it('is not empty — an empty starter set is an empty app', () => {
    assert.ok(DEFAULT_SUBJECTS.length > 0);
  });

  it('covers every registered source, so no filter chip opens onto nothing', () => {
    const sources = new Set(DEFAULT_SUBJECTS.map((s) => s.source));
    assert.deepEqual([...sources].sort(), ['congress', 'funds', 'insider', 'policy', 'stocks']);
  });

  it('holds no duplicate subject', () => {
    const keys = DEFAULT_SUBJECTS.map((s) => subjectKey(s.source, s.handle));
    assert.equal(new Set(keys).size, keys.length);
  });

  it('carries exactly one insider ticker', () => {
    // Each ticker costs roughly nine SEC requests behind a 120ms queue, and
    // this set is fetched by every install on every cold start.
    const insider = DEFAULT_SUBJECTS.filter((s) => s.source === 'insider');
    assert.equal(insider.length, 1);
  });

  it('is never muted — a starter subject the user cannot unmute would be a trap', () => {
    assert.ok(DEFAULT_SUBJECTS.every((s) => !s.muted));
  });

  it('is marked as never added, because nobody added it', () => {
    assert.ok(DEFAULT_SUBJECTS.every((s) => s.addedAt === 0));
  });

  it('names every subject, so no card renders against a blank handle', () => {
    assert.ok(DEFAULT_SUBJECTS.every((s) => s.displayName.trim().length > 0));
    assert.ok(DEFAULT_SUBJECTS.every((s) => s.handle.trim().length > 0));
  });
});

describe('feedSubjects', () => {
  it('falls back to the starter set when nothing is followed', () => {
    assert.equal(feedSubjects([]), DEFAULT_SUBJECTS);
  });

  it('hands back the watchlist untouched once there is one', () => {
    const mine = [watched('congress', 'nancy-pelosi-ca11')];
    assert.equal(feedSubjects(mine), mine);
  });

  it('does not blend the starter set into a real watchlist', () => {
    // Following one subject means the feed is theirs. Topping it up with
    // defaults would put signals in front of them that they cannot unfollow.
    const mine = [watched('stocks', 'TSLA')];
    assert.deepEqual(feedSubjects(mine), mine);
  });

  it('stays out of the way when every followed subject is muted', () => {
    // Muting is applied by the caller, after this. Falling back here would
    // resurrect the starter feed for a user who deliberately silenced
    // everything — a default overriding a choice.
    const allMuted = [{ ...watched('stocks', 'TSLA'), muted: true }];
    const fetchable = feedSubjects(allMuted).filter((s) => !s.muted);
    assert.deepEqual(fetchable, []);
  });
});

describe('isStarterFeed', () => {
  it('is true only while the watchlist is empty', () => {
    assert.equal(isStarterFeed([]), true);
    assert.equal(isStarterFeed([watched('policy', 'type:proclamation')]), false);
  });

  it('agrees with what feedSubjects chose', () => {
    // The banner claims the feed is the starter set; if these two ever
    // disagreed it would either lie or fail to appear.
    for (const list of [[], [watched('insider', 'AAPL')]]) {
      assert.equal(isStarterFeed(list), feedSubjects(list) === DEFAULT_SUBJECTS);
    }
  });
});
