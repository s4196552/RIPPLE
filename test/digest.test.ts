import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dayHeadline,
  dayLabel,
  dayStartOf,
  daySummary,
  groupByDay,
} from '../src/lib/digest.ts';
import type { Signal, SourceId } from '../src/providers/types.ts';

const DAY = 86_400_000;
const TODAY = Date.UTC(2026, 5, 15); // Mon 15 Jun 2026, UTC midnight

function signal(
  id: string,
  at: number,
  source: SourceId = 'policy',
  extra: Partial<Signal> = {},
): Signal {
  return {
    id,
    source,
    actor: { handle: 'a', displayName: 'A' },
    text: `signal ${id}`,
    url: 'https://example.test',
    timestamp: at,
    ...extra,
  };
}

/** Stand-in for the provider registry, which the module deliberately avoids. */
const labelFor = (source: SourceId) =>
  ({ congress: 'Congress', insider: 'Insiders', policy: 'Policy', stocks: 'Stocks', funds: 'Funds' })[source];

describe('dayStartOf', () => {
  it('snaps to UTC midnight', () => {
    assert.equal(dayStartOf(TODAY + 13 * 3600_000), TODAY);
    assert.equal(dayStartOf(TODAY), TODAY);
  });

  it('is timezone-independent', () => {
    // Bucketing by local day would drop a UTC-midnight filing into the previous
    // day for every user west of UTC.
    assert.equal(dayStartOf(TODAY) % DAY, 0);
  });
});

describe('groupByDay', () => {
  it('buckets signals into days, newest day first', () => {
    const days = groupByDay([
      signal('a', TODAY),
      signal('b', TODAY - DAY),
      signal('c', TODAY - 2 * DAY),
    ]);

    assert.deepEqual(days.map((d) => d.dayStart), [TODAY, TODAY - DAY, TODAY - 2 * DAY]);
  });

  it('puts signals from the same day in one bucket', () => {
    const days = groupByDay([
      signal('a', TODAY + 3600_000),
      signal('b', TODAY + 20 * 3600_000),
    ]);

    assert.equal(days.length, 1);
    assert.equal(days[0]?.signals.length, 2);
  });

  it('preserves the order the feed gave, never re-sorting the stream', () => {
    const days = groupByDay([signal('first', TODAY + 1000), signal('second', TODAY)]);
    assert.deepEqual(days[0]?.signals.map((s) => s.id), ['first', 'second']);
  });

  it('counts sources within a day, busiest first', () => {
    const days = groupByDay([
      signal('a', TODAY, 'policy'),
      signal('b', TODAY, 'congress'),
      signal('c', TODAY, 'congress'),
    ]);

    assert.deepEqual(days[0]?.bySource, [
      { source: 'congress', count: 2 },
      { source: 'policy', count: 1 },
    ]);
  });

  it('skips signals with an unusable timestamp', () => {
    assert.deepEqual(groupByDay([signal('bad', Number.NaN)]), []);
  });

  it('handles an empty feed', () => {
    assert.deepEqual(groupByDay([]), []);
  });
});

describe('dayLabel', () => {
  it('names today and yesterday', () => {
    assert.equal(dayLabel(TODAY, TODAY + 3600_000), 'Today');
    assert.equal(dayLabel(TODAY - DAY, TODAY), 'Yesterday');
  });

  it('uses weekday and date within the year', () => {
    assert.equal(dayLabel(TODAY - 5 * DAY, TODAY), 'Wed 10 Jun');
  });

  it('drops the weekday and adds the year once it differs', () => {
    assert.equal(dayLabel(Date.UTC(2024, 2, 3), TODAY), '3 Mar 2024');
  });
});

describe('daySummary', () => {
  it('gives the total and the per-source breakdown', () => {
    const [day] = groupByDay([
      signal('a', TODAY, 'policy'),
      signal('b', TODAY, 'policy'),
      signal('c', TODAY, 'insider'),
    ]);

    assert.equal(daySummary(day!, labelFor), '3 filings · Policy 2, Insiders 1');
  });

  it('singularises a lone filing', () => {
    const [day] = groupByDay([signal('a', TODAY, 'policy')]);
    assert.equal(daySummary(day!, labelFor), '1 filing · Policy');
  });
});

describe('dayHeadline', () => {
  it('leads with late filings, which are the point of the disclosure rule', () => {
    const [day] = groupByDay([
      signal('a', TODAY, 'congress', { badges: ['BUY', 'LATE FILING'] }),
      signal('b', TODAY, 'congress', { badges: ['SELL'] }),
    ]);

    assert.equal(dayHeadline(day!), '1 late filing');
  });

  it('pluralises several late filings', () => {
    const [day] = groupByDay([
      signal('a', TODAY, 'congress', { badges: ['LATE FILING'] }),
      signal('b', TODAY, 'congress', { badges: ['LATE FILING'] }),
    ]);

    assert.equal(dayHeadline(day!), '2 late filings');
  });

  it('otherwise surfaces a ticker several filings landed on', () => {
    const [day] = groupByDay([
      signal('a', TODAY, 'insider', { ticker: 'NVDA' }),
      signal('b', TODAY, 'insider', { ticker: 'NVDA' }),
      signal('c', TODAY, 'insider', { ticker: 'AAPL' }),
    ]);

    assert.equal(dayHeadline(day!), '2 filings on NVDA');
  });

  it('says nothing when a ticker appears only once', () => {
    // One filing on a ticker is not a pattern.
    const [day] = groupByDay([
      signal('a', TODAY, 'insider', { ticker: 'NVDA' }),
      signal('b', TODAY, 'insider', { ticker: 'AAPL' }),
    ]);

    assert.equal(dayHeadline(day!), null);
  });

  it('says nothing for an ordinary day', () => {
    const [day] = groupByDay([signal('a', TODAY, 'policy')]);
    assert.equal(dayHeadline(day!), null);
  });

  it('breaks a tie between tickers deterministically', () => {
    const [day] = groupByDay([
      signal('a', TODAY, 'insider', { ticker: 'NVDA' }),
      signal('b', TODAY, 'insider', { ticker: 'NVDA' }),
      signal('c', TODAY, 'insider', { ticker: 'AAPL' }),
      signal('d', TODAY, 'insider', { ticker: 'AAPL' }),
    ]);

    assert.equal(dayHeadline(day!), '2 filings on AAPL');
  });
});
