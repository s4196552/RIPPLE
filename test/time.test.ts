import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { relativeTime, spokenTime } from '../src/lib/time.ts';

const NOW = Date.parse('2026-06-15T12:00:00.000Z');
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
  it('uses seconds under a minute', () => {
    assert.equal(relativeTime(NOW - 30 * SECOND, NOW), '30s');
  });

  it('uses minutes under an hour', () => {
    assert.equal(relativeTime(NOW - 12 * MINUTE, NOW), '12m');
  });

  it('uses hours under a day', () => {
    assert.equal(relativeTime(NOW - 5 * HOUR, NOW), '5h');
  });

  it('uses days under a week', () => {
    assert.equal(relativeTime(NOW - 3 * DAY, NOW), '3d');
  });

  it('switches to a calendar date past a week', () => {
    assert.match(relativeTime(NOW - 30 * DAY, NOW), /^[A-Z][a-z]{2} \d{1,2}$/);
  });

  it('includes the year once the date is in a different one', () => {
    assert.match(relativeTime(Date.parse('2024-02-09T00:00:00Z'), NOW), /2024$/);
  });

  it('dates by the UTC day, matching the feed day headers', () => {
    // A US close (20:00 UTC) is the next morning east of UTC; the card must
    // still print the day its header does.
    assert.equal(relativeTime(Date.parse('2026-05-24T20:00:00Z'), NOW), 'May 24');
    // A date-only filing at UTC midnight is the evening before west of UTC.
    assert.equal(relativeTime(Date.parse('2026-05-17T00:00:00Z'), NOW), 'May 17');
  });

  it('never renders 0s — a just-posted item reads as 1s', () => {
    assert.equal(relativeTime(NOW - 100, NOW), '1s');
  });

  it('clamps clock skew from the future to "now"', () => {
    assert.equal(relativeTime(NOW + 60 * SECOND, NOW), 'now');
  });
});

describe('spokenTime', () => {
  it('expands the compact units, which are unreadable aloud', () => {
    // "3 d ago" is announced as the letter d.
    assert.equal(spokenTime(NOW - 30 * SECOND, NOW), '30 seconds ago');
    assert.equal(spokenTime(NOW - 12 * MINUTE, NOW), '12 minutes ago');
    assert.equal(spokenTime(NOW - 5 * HOUR, NOW), '5 hours ago');
    assert.equal(spokenTime(NOW - 3 * DAY, NOW), '3 days ago');
  });

  it('says "on <date>" past a week, never "<date> ago"', () => {
    // Regression: the card label appended "ago" unconditionally and announced
    // "Aug 27 ago", because relativeTime switches to a calendar date past a week.
    const spoken = spokenTime(NOW - 30 * DAY, NOW);

    assert.match(spoken, /^on [A-Z][a-z]{2} \d{1,2}$/);
    assert.ok(!spoken.endsWith('ago'), 'a calendar date must not take "ago"');
  });

  it('singularises a value of one', () => {
    assert.equal(spokenTime(NOW - 1 * DAY, NOW), '1 day ago');
    assert.equal(spokenTime(NOW - 1 * HOUR, NOW), '1 hour ago');
  });

  it('reads clock skew as "just now"', () => {
    assert.equal(spokenTime(NOW + 60 * SECOND, NOW), 'just now');
  });
});
