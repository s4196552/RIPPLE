import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildLanes,
  clusterDateLabel,
  clusterSignals,
  positionOf,
  ticksFor,
  windowFor,
  withinWindow,
  type TimelineWindow,
} from '../src/lib/timeline.ts';
import type { Signal, SourceId } from '../src/providers/types.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 5, 15); // 15 Jun 2026

function signal(
  id: string,
  at: number,
  source: SourceId = 'congress',
  tone?: 'up' | 'down' | 'neutral',
): Signal {
  return {
    id,
    source,
    actor: { handle: 'a', displayName: 'A' },
    text: `signal ${id}`,
    url: 'https://example.test',
    timestamp: at,
    ...(tone ? { accent: { label: 'x', tone } } : {}),
  };
}

const windowOf = (startDaysAgo: number, endDaysAgo = 0): TimelineWindow => ({
  start: NOW - startDaysAgo * DAY,
  end: NOW - endDaysAgo * DAY,
  days: startDaysAgo - endDaysAgo,
});

describe('windowFor', () => {
  it('spans the requested number of days back from now', () => {
    const w = windowFor('30d', [signal('a', NOW - 2 * DAY)], NOW)!;
    assert.equal(w.end, NOW);
    assert.equal(Math.round((w.end - w.start) / DAY), 30);
  });

  it('anchors to the newest signal when the data is stale', () => {
    // A subject that stopped filing months ago would otherwise show an empty
    // track with every marker off the left edge.
    const last = NOW - 200 * DAY;
    const w = windowFor('30d', [signal('a', last)], NOW)!;

    assert.equal(w.end, last);
    assert.ok(w.start < last);
  });

  it('derives the all-time window from the data, padded so edges stay visible', () => {
    const oldest = NOW - 500 * DAY;
    const w = windowFor('all', [signal('a', oldest), signal('b', NOW)], NOW)!;

    assert.equal(w.start, oldest - DAY);
    assert.equal(w.end, NOW + DAY);
  });

  it('returns null when there is nothing to place', () => {
    assert.equal(windowFor('30d', [], NOW), null);
  });

  it('never reports a zero-day span', () => {
    const w = windowFor('all', [signal('a', NOW)], NOW)!;
    assert.ok(w.days >= 1, 'a zero span would divide by zero when positioning');
  });
});

describe('positionOf', () => {
  const w = windowOf(10);

  it('places the window start at 0 and the end at 1', () => {
    assert.equal(positionOf(w.start, w), 0);
    assert.equal(positionOf(w.end, w), 1);
  });

  it('places the midpoint at 0.5', () => {
    assert.equal(positionOf(NOW - 5 * DAY, w), 0.5);
  });

  it('clamps anything outside the window', () => {
    assert.equal(positionOf(w.start - 100 * DAY, w), 0);
    assert.equal(positionOf(w.end + 100 * DAY, w), 1);
  });

  it('returns 0 rather than NaN for a degenerate window', () => {
    assert.equal(positionOf(NOW, { start: NOW, end: NOW, days: 1 }), 0);
  });
});

describe('withinWindow', () => {
  const w = windowOf(10);

  it('keeps only signals inside the window, newest first', () => {
    const inside = [signal('a', NOW - 1 * DAY), signal('b', NOW - 8 * DAY)];
    const outside = [signal('c', NOW - 40 * DAY), signal('d', NOW + 5 * DAY)];

    const kept = withinWindow([...outside, ...inside], w);
    assert.deepEqual(kept.map((s) => s.id), ['a', 'b']);
  });

  it('includes signals exactly on the boundaries', () => {
    const kept = withinWindow([signal('start', w.start), signal('end', w.end)], w);
    assert.equal(kept.length, 2);
  });
});

describe('ticksFor', () => {
  it('spans the window end to end', () => {
    const ticks = ticksFor(windowOf(30), 4);

    assert.equal(ticks.length, 4);
    assert.equal(ticks[0]?.position, 0);
    assert.equal(ticks[3]?.position, 1);
  });

  it('labels a short window with a day number', () => {
    assert.match(ticksFor(windowOf(30), 4)[0]!.label, /^\d{1,2} [A-Z][a-z]{2}$/);
  });

  it('labels a mid window with the month alone', () => {
    assert.match(ticksFor(windowOf(200), 4)[0]!.label, /^[A-Z][a-z]{2}$/);
  });

  it('adds a year once the window is longer than one', () => {
    assert.match(ticksFor(windowOf(500), 4)[0]!.label, /^[A-Z][a-z]{2} \d{2}$/);
  });

  it('returns nothing when asked for fewer than two', () => {
    assert.deepEqual(ticksFor(windowOf(30), 1), []);
  });
});

describe('clusterSignals', () => {
  const w = windowOf(100);

  it('keeps well-separated signals apart', () => {
    const clusters = clusterSignals(
      [signal('a', NOW - 90 * DAY), signal('b', NOW - 50 * DAY), signal('c', NOW - 5 * DAY)],
      w,
      0.03,
    );
    assert.equal(clusters.length, 3);
  });

  it('collapses signals that would overlap into one', () => {
    // Three filings in the same couple of days: one tappable marker, not a smear.
    const clusters = clusterSignals(
      [signal('a', NOW - 50 * DAY), signal('b', NOW - 49 * DAY), signal('c', NOW - 48 * DAY)],
      w,
      0.05,
    );

    assert.equal(clusters.length, 1);
    assert.equal(clusters[0]?.signals.length, 3);
  });

  it('orders a cluster newest first, so the lead is the latest', () => {
    const clusters = clusterSignals(
      [signal('old', NOW - 50 * DAY), signal('new', NOW - 48 * DAY)],
      w,
      0.05,
    );
    assert.equal(clusters[0]?.signals[0]?.id, 'new');
    assert.equal(clusters[0]?.at, NOW - 48 * DAY);
  });

  it('returns clusters in left-to-right order', () => {
    const clusters = clusterSignals(
      [signal('c', NOW - 5 * DAY), signal('a', NOW - 90 * DAY), signal('b', NOW - 50 * DAY)],
      w,
      0.01,
    );
    assert.deepEqual(clusters.map((c) => c.signals[0]!.id), ['a', 'b', 'c']);
  });

  it('takes a direction only when the whole cluster agrees', () => {
    const agree = clusterSignals(
      [signal('a', NOW - 50 * DAY, 'congress', 'up'), signal('b', NOW - 49 * DAY, 'congress', 'up')],
      w,
      0.05,
    );
    assert.equal(agree[0]?.tone, 'up');

    const mixed = clusterSignals(
      [signal('a', NOW - 50 * DAY, 'congress', 'up'), signal('b', NOW - 49 * DAY, 'congress', 'down')],
      w,
      0.05,
    );
    assert.equal(mixed[0]?.tone, 'neutral', 'a mixed cluster must not claim a direction');
  });

  it('treats an accentless signal as neutral', () => {
    assert.equal(clusterSignals([signal('a', NOW - 50 * DAY)], w, 0.05)[0]?.tone, 'neutral');
  });

  it('handles an empty input', () => {
    assert.deepEqual(clusterSignals([], w), []);
  });
});

describe('buildLanes', () => {
  const w = windowOf(100);

  it('gives each source its own lane', () => {
    const lanes = buildLanes(
      [
        signal('a', NOW - 10 * DAY, 'congress'),
        signal('b', NOW - 20 * DAY, 'insider'),
        signal('c', NOW - 30 * DAY, 'policy'),
      ],
      w,
    );
    assert.equal(lanes.length, 3);
  });

  it('drops sources with nothing in the window', () => {
    // A blank row reads as a rendering failure.
    const lanes = buildLanes([signal('a', NOW - 10 * DAY, 'congress')], w);
    assert.deepEqual(lanes.map((l) => l.source), ['congress']);
  });

  it('orders the busiest lane first', () => {
    const lanes = buildLanes(
      [
        signal('a', NOW - 10 * DAY, 'insider'),
        signal('b', NOW - 20 * DAY, 'congress'),
        signal('c', NOW - 30 * DAY, 'congress'),
      ],
      w,
    );
    assert.equal(lanes[0]?.source, 'congress');
    assert.equal(lanes[0]?.count, 2);
  });

  it('counts signals, not clusters', () => {
    const lanes = buildLanes(
      [
        signal('a', NOW - 50 * DAY, 'congress'),
        signal('b', NOW - 49 * DAY, 'congress'),
        signal('c', NOW - 48 * DAY, 'congress'),
      ],
      w,
      0.5,
    );
    assert.equal(lanes[0]?.clusters.length, 1, 'they collapse visually');
    assert.equal(lanes[0]?.count, 3, 'but the count reports all three');
  });

  it('excludes signals outside the window from the count', () => {
    const lanes = buildLanes(
      [signal('a', NOW - 10 * DAY, 'congress'), signal('old', NOW - 900 * DAY, 'congress')],
      w,
    );
    assert.equal(lanes[0]?.count, 1);
  });

  it('returns nothing for no signals', () => {
    assert.deepEqual(buildLanes([], w), []);
  });
});

describe('clusterDateLabel', () => {
  const w = windowOf(30);

  it('omits the year within the window year', () => {
    const [cluster] = clusterSignals([signal('a', Date.UTC(2026, 2, 3))], w);
    assert.equal(clusterDateLabel(cluster!, w), '3 Mar');
  });

  it('includes the year when it differs', () => {
    const [cluster] = clusterSignals([signal('a', Date.UTC(2024, 2, 3))], w);
    assert.equal(clusterDateLabel(cluster!, w), '3 Mar 2024');
  });
});
