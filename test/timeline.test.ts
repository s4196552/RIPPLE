import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bucketAxisLabel,
  bucketUnitFor,
  busiestBuckets,
  fillBuckets,
  fixedSpans,
  monthSpans,
  spanLabel,
  windowFor,
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

describe('fixedSpans', () => {
  it('lays whole weeks back from the end, oldest first', () => {
    const spans = fixedSpans(windowOf(90), 'week');
    assert.equal(spans.length, 13);
    assert.ok(spans[0]!.start < spans[1]!.start);
    assert.equal(spans[12]!.end, NOW + DAY, 'the last span runs to the end of the final day');
    assert.equal(spans[12]!.end - spans[12]!.start, 7 * DAY);
  });

  it('gives 30 days a column per calendar day', () => {
    const spans = fixedSpans({ start: NOW - 30 * DAY + 5000, end: NOW + 5000, days: 30 }, 'day');
    assert.equal(spans.length, 30);
    assert.equal(spans[29]!.start, NOW, 'breaks fall on UTC midnight');
  });
});

describe('bucketUnitFor', () => {
  it('follows the range, and the data for all-time', () => {
    assert.equal(bucketUnitFor('30d', windowOf(30)), 'day');
    assert.equal(bucketUnitFor('90d', windowOf(90)), 'week');
    assert.equal(bucketUnitFor('1y', windowOf(365)), 'month');
    assert.equal(bucketUnitFor('all', windowOf(60)), 'week');
    assert.equal(bucketUnitFor('all', windowOf(900)), 'quarter');
  });
});

describe('monthSpans', () => {
  it('covers whole calendar months, ending with the current one', () => {
    const spans = monthSpans(12, NOW);
    assert.equal(spans.length, 12);
    assert.equal(spans[11]!.start, Date.UTC(2026, 5, 1));
    assert.equal(spans[0]!.start, Date.UTC(2025, 6, 1));
    assert.equal(spans[0]!.end, Date.UTC(2025, 7, 1));
  });
});

describe('fillBuckets', () => {
  const spans = fixedSpans(windowOf(14), 'week');

  it('counts by direction and by source', () => {
    const [older, newer] = fillBuckets(
      [
        signal('a', NOW - 1 * DAY, 'congress', 'up'),
        signal('b', NOW - 2 * DAY, 'insider', 'down'),
        signal('c', NOW - 3 * DAY, 'policy'),
        signal('d', NOW - 10 * DAY, 'congress', 'up'),
      ],
      spans,
    );
    assert.deepEqual([newer!.up, newer!.down, newer!.neutral, newer!.total], [1, 1, 1, 3]);
    assert.deepEqual(newer!.bySource, { congress: 1, insider: 1, policy: 1 });
    assert.equal(older!.total, 1);
  });

  it('includes a signal stamped exactly at the window end', () => {
    const buckets = fillBuckets([signal('a', NOW, 'congress', 'up')], spans);
    assert.equal(buckets[1]!.up, 1);
  });

  it('drops signals outside every span', () => {
    const buckets = fillBuckets([signal('old', NOW - 400 * DAY)], spans);
    assert.equal(buckets.reduce((n, b) => n + b.total, 0), 0);
  });

  it('keeps each bucket newest first', () => {
    const [, newer] = fillBuckets(
      [signal('a', NOW - 3 * DAY), signal('b', NOW - 1 * DAY)],
      spans,
    );
    assert.deepEqual(newer!.signals.map((s) => s.id), ['b', 'a']);
  });
});

describe('busiestBuckets', () => {
  it('ranks by count, breaks ties toward the recent, and skips empty columns', () => {
    const buckets = fillBuckets(
      [
        signal('a', NOW - 1 * DAY),
        signal('b', NOW - 8 * DAY),
        signal('c', NOW - 9 * DAY),
        signal('d', NOW - 15 * DAY),
      ],
      fixedSpans(windowOf(28), 'week'),
    );
    const top = busiestBuckets(buckets);
    assert.deepEqual(top.map((b) => b.total), [2, 1, 1]);
    assert.ok(top[1]!.start > top[2]!.start);
  });
});

describe('spanLabel', () => {
  it('reads the way people say a range', () => {
    const at = (m: number, d: number) => Date.UTC(2026, m, d);
    assert.equal(spanLabel({ start: at(9, 7), end: at(9, 8) }), '7 Oct');
    assert.equal(spanLabel({ start: at(9, 1), end: at(9, 8) }), '1–7 Oct');
    assert.equal(spanLabel({ start: at(8, 28), end: at(9, 5) }), '28 Sep – 4 Oct');
  });

  it('labels the axis by start date, or month and year for quarters', () => {
    const span = { start: Date.UTC(2026, 6, 9), end: Date.UTC(2026, 6, 16) };
    assert.equal(bucketAxisLabel(span, 'week'), '9 Jul');
    assert.equal(bucketAxisLabel(span, 'quarter'), 'Jul 26');
  });
});
