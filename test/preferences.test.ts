import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_PREFERENCES,
  pollIntervalMs,
  sanitize,
  type Preferences,
} from '../src/store/preferenceValues.ts';

describe('default preferences', () => {
  it('defaults the theme to the device setting', () => {
    // Not 'dark'. The app was dark-only for its whole life, so anything else
    // would be Ripple overriding a choice the user already made on their phone.
    assert.equal(DEFAULT_PREFERENCES.theme, 'system');
  });

  it('keeps polling slow enough not to burn the SEC rate limit', () => {
    assert.equal(DEFAULT_PREFERENCES.refreshInterval, 10);
  });

  it('opens on the feed', () => {
    assert.equal(DEFAULT_PREFERENCES.startTab, 'index');
  });
});

describe('pollIntervalMs', () => {
  it('converts minutes to milliseconds', () => {
    assert.equal(pollIntervalMs(5), 300_000);
    assert.equal(pollIntervalMs(10), 600_000);
    assert.equal(pollIntervalMs(30), 1_800_000);
  });

  it('returns null for manual, so the caller starts no timer at all', () => {
    // The point of switching polling off is to stop spending requests, not to
    // spend them less often, so this has to be distinguishable from a big
    // number rather than expressed as one.
    assert.equal(pollIntervalMs('off'), null);
  });
});

describe('sanitize', () => {
  it('keeps every valid value', () => {
    const stored: Preferences = {
      theme: 'light',
      tones: 'accessible',
      haptics: false,
      refreshInterval: 30,
      startTab: 'trades',
      linkTarget: 'system',
      dailyDigest: false,
    };
    assert.deepEqual(sanitize(stored), stored);
  });

  it('drops a value this version no longer recognises', () => {
    // Persisted preferences outlive the code that wrote them. An install that
    // used a 60-minute refresh, or a tab since removed, must not be able to put
    // the app in a state no screen can render.
    const cleaned = sanitize({ refreshInterval: 60, startTab: 'account', theme: 'midnight' });
    assert.equal(cleaned.refreshInterval, undefined);
    assert.equal(cleaned.startTab, undefined);
    assert.equal(cleaned.theme, undefined);
  });

  it('keeps the good keys from a partly invalid blob', () => {
    // One bad value must not discard the whole file.
    const cleaned = sanitize({ theme: 'dark', refreshInterval: 'sometimes' });
    assert.equal(cleaned.theme, 'dark');
    assert.equal(cleaned.refreshInterval, undefined);
  });

  it('rejects a non-boolean where a boolean belongs', () => {
    // JSON round-trips can turn a flag into a string; `'false'` is truthy.
    const cleaned = sanitize({ haptics: 'false', dailyDigest: 1 });
    assert.equal(cleaned.haptics, undefined);
    assert.equal(cleaned.dailyDigest, undefined);
  });

  it('survives anything at all in the stored slot', () => {
    for (const junk of [null, undefined, 'a string', 42, []]) {
      assert.deepEqual(sanitize(junk), {});
    }
  });

  it('never invents a key that is not a preference', () => {
    const cleaned = sanitize({ theme: 'dark', apiKey: 'leaked', admin: true });
    assert.deepEqual(Object.keys(cleaned), ['theme']);
  });

  it('accepts the defaults themselves, or a first run would reset every launch', () => {
    assert.deepEqual(sanitize(DEFAULT_PREFERENCES), DEFAULT_PREFERENCES);
  });
});
