import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TERMS_CONTACT,
  TERMS_EFFECTIVE_DATE,
  TERMS_JURISDICTION,
  TERMS_SECTIONS,
} from '../src/legal/terms.ts';

/**
 * The terms are prose, so most of them cannot be asserted on. What can be is
 * the shape: that the screen has something to render for every section, that
 * the two placeholders nobody can invent are still visibly unfinished, and
 * that the promises made here match what the app actually does.
 */
describe('terms of service', () => {
  it('gives every section a title and at least one paragraph', () => {
    for (const section of TERMS_SECTIONS) {
      assert.ok(section.title.trim().length > 0, `${section.id} has no title`);
      assert.ok(section.body.length > 0, `${section.id} has no body`);
      for (const paragraph of section.body) {
        assert.ok(paragraph.trim().length > 0, `${section.id} has an empty paragraph`);
      }
    }
  });

  it('keys sections uniquely, since the list renders by id', () => {
    const ids = TERMS_SECTIONS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('carries a parseable effective date', () => {
    assert.ok(!Number.isNaN(Date.parse(TERMS_EFFECTIVE_DATE)), TERMS_EFFECTIVE_DATE);
  });

  /*
   * The release gate. A terms page that tells a user to write to
   * "TODO: support email address" is worse than no terms page, and this is the
   * only check standing between a draft and a store submission. Filling both
   * placeholders in is what makes this test pass — do not delete it to get
   * there.
   */
  it('still marks the placeholders that must be filled in before release', () => {
    assert.ok(
      TERMS_CONTACT.startsWith('TODO'),
      'contact address is filled in — remove this assertion and the dev banner in app/terms.tsx',
    );
    assert.ok(
      TERMS_JURISDICTION.startsWith('TODO'),
      'jurisdiction is filled in — remove this assertion and the dev banner in app/terms.tsx',
    );
  });

  it('says the things the app depends on being said', () => {
    const all = TERMS_SECTIONS.flatMap((s) => s.body).join('\n').toLowerCase();

    // Each of these corresponds to a real behaviour or a real risk elsewhere in
    // the codebase, so a rewrite that drops one is a rewrite that misdescribes
    // the app.
    assert.match(all, /not .*advice|no.* advice/); // src/ui/components/SignalCard.tsx
    assert.match(all, /45 days/); // congress filing window
    assert.match(all, /sample data/); // ProviderMode 'mock'
    assert.match(all, /stored on your device/); // AsyncStorage-only persistence
    assert.match(all, /as is/); // warranty disclaimer
  });
});
