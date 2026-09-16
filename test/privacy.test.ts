import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  ALL_RECIPIENTS,
  PRIVACY_CONTACT,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_RECIPIENTS,
  PRIVACY_SECTIONS,
} from '../src/legal/privacy.ts';

/**
 * The privacy policy is prose, so most of it cannot be asserted on. What can
 * be is the shape, and — the reason this file earns its place — whether the
 * disclosure still matches the hosts the app actually contacts.
 */
describe('privacy policy', () => {
  it('gives every section a title and at least one paragraph', () => {
    for (const section of PRIVACY_SECTIONS) {
      assert.ok(section.title.trim().length > 0, `${section.id} has no title`);
      assert.ok(section.body.length > 0, `${section.id} has no body`);
      for (const paragraph of section.body) {
        assert.ok(paragraph.trim().length > 0, `${section.id} has an empty paragraph`);
      }
    }
  });

  it('keys sections uniquely, since the list renders by id', () => {
    const ids = PRIVACY_SECTIONS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('carries a parseable effective date', () => {
    assert.ok(!Number.isNaN(Date.parse(PRIVACY_EFFECTIVE_DATE)), PRIVACY_EFFECTIVE_DATE);
  });

  it('keeps the section the recipient table renders into', () => {
    // app/privacy.tsx hangs the recipient rows off this exact id. Renaming the
    // section without updating the screen would silently drop the entire
    // third-party disclosure from the page while every other test passed.
    assert.ok(PRIVACY_SECTIONS.some((s) => s.id === 'third-parties'));
  });

  it('says the things a policy has to say', () => {
    const all = PRIVACY_SECTIONS.flatMap((s) => s.body).join('\n').toLowerCase();

    assert.match(all, /ip address/); // the substance of the third-party section
    assert.match(all, /no server|server of its own/); // why there is nothing to request
    assert.match(all, /advertising identifier/); // Apple/Play both ask about this
    assert.match(all, /uninstall/); // the actual deletion mechanism
    assert.match(all, /under 13|children/); // children's-data statement
  });

  it('shares the terms' + "' contact rather than inventing a second one", () => {
    assert.equal(typeof PRIVACY_CONTACT, 'string');
    assert.ok(PRIVACY_CONTACT.length > 0);
  });
});

describe('disclosed data recipients', () => {
  it('describes every recipient completely', () => {
    for (const r of ALL_RECIPIENTS) {
      assert.ok(r.name.trim().length > 0, `${r.host} has no name`);
      assert.ok(r.receives.trim().length > 0, `${r.host} does not say what it receives`);
      assert.match(r.policyUrl, /^https:\/\//, `${r.host} has no https policy link`);
      assert.ok(!r.host.includes('/'), `${r.host} should be a bare host, not a URL`);
    }
  });

  it('gives every registered source at least one disclosed recipient', () => {
    for (const [source, recipients] of Object.entries(PRIVACY_RECIPIENTS)) {
      assert.ok(recipients.length > 0, `${source} contacts nobody, which cannot be right`);
    }
  });

  /*
   * The one that matters.
   *
   * A provider added or re-pointed without updating the policy would start
   * sending users' requests to a third party the policy does not name — the
   * exact failure the policy exists to prevent, and one nothing else in the
   * suite can see. So this reads the provider sources as text and checks every
   * literal host against the disclosure.
   *
   * It has already earned its keep: it found the company-logo CDN (requested
   * for essentially every card in the feed, key or no key) and the GitHub
   * Pages host serving the congressional roster and member portraits, neither
   * of which had been disclosed.
   */
  it('discloses every host the providers actually contact', () => {
    const disclosed = ALL_RECIPIENTS.map((r) => r.host.toLowerCase());

    /*
     * Hosts that appear in provider source but are never fetched by the app:
     * they are destinations for a link the user chooses to open, which the
     * policy covers in its own paragraph rather than in the recipient table.
     */
    const linkOnly = ['www.capitoltrades.com', 'finance.yahoo.com'];

    for (const host of hostsReferencedIn('src/providers')) {
      if (linkOnly.includes(host)) continue;

      const covered = disclosed.some((d) => host === d || host.endsWith(`.${d}`));
      assert.ok(
        covered,
        `${host} is contacted by a provider but is not named in the privacy policy. ` +
          'Add it to PRIVACY_RECIPIENTS or SHARED_RECIPIENTS, or add it to linkOnly if the ' +
          'user has to tap something for the request to happen.',
      );
    }
  });
});

/** Every `https://host` literal under `dir`, lowercased and deduped. */
function hostsReferencedIn(dir: string): string[] {
  const hosts = new Set<string>();

  const walk = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;

      for (const match of readFileSync(full, 'utf8').matchAll(/https:\/\/([a-z0-9.-]+)/gi)) {
        hosts.add(match[1]!.toLowerCase());
      }
    }
  };

  walk(dir);
  return [...hosts];
}
