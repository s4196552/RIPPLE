import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shareText } from '../src/lib/share.ts';
import type { Signal } from '../src/providers/types.ts';

function signal(over: Partial<Signal> & Pick<Signal, 'text'>): Signal {
  return {
    id: 'congress:1',
    source: 'congress',
    actor: { handle: 'ro-khanna-ca17', displayName: 'Ro Khanna', subtitle: 'CA-17', avatarUrl: null },
    url: 'https://example.test/filing.pdf',
    timestamp: 0,
    ticker: null,
    accent: null,
    ...over,
  } as Signal;
}

describe('shareText', () => {
  it('always ends with the source document', () => {
    const out = shareText(signal({ text: 'Ro Khanna bought NVDA.' }));
    assert.ok(out.endsWith('https://example.test/filing.pdf'), out);
  });

  it('does not repeat the name when the text already opens with it', () => {
    // Most sources write "Ro Khanna bought NVDA", so prefixing the actor again
    // would share "Ro Khanna (CA-17): Ro Khanna bought NVDA".
    const out = shareText(signal({ text: 'Ro Khanna bought NVDA.' }));
    assert.equal(out.startsWith('Ro Khanna bought NVDA.'), true);
    assert.equal(out.indexOf('Ro Khanna'), out.lastIndexOf('Ro Khanna'), 'named twice');
  });

  it('names the actor when the text does not, so the share stands alone', () => {
    const out = shareText(signal({ text: 'Filed a periodic transaction report.' }));
    assert.ok(out.startsWith('Ro Khanna (CA-17): Filed a periodic transaction report.'), out);
  });

  it('omits the empty parenthetical when there is no subtitle', () => {
    const out = shareText(
      signal({
        text: 'Filed a report.',
        actor: {
          handle: 'x',
          displayName: 'The White House',
          subtitle: null,
          avatarUrl: null,
        },
      }),
    );
    assert.ok(out.startsWith('The White House: Filed a report.'), out);
    assert.equal(out.includes('()'), false);
  });

  it('separates the text and the link, so neither runs into the other', () => {
    const out = shareText(signal({ text: 'Ro Khanna bought NVDA.' }));
    assert.equal(out.includes('\n\n'), true);
  });
});
