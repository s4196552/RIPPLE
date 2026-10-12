import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TAB_ICONS, TAB_ORDER } from '../src/ui/tabIcons.ts';
import { cleanAvatarUri } from '../src/store/profileValues.ts';

/** SVG path data: commands, numbers, separators — nothing else. */
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\-\s]+$/;

describe('tab icons', () => {
  it('has an icon for every tab, Profile last', () => {
    assert.deepEqual(TAB_ORDER, ['index', 'trades', 'timeline', 'watchlist', 'profile']);
    for (const tab of TAB_ORDER) assert.ok(TAB_ICONS[tab], `${tab} has no icon`);
  });

  it('draws every icon from plain path data', () => {
    for (const [tab, spec] of Object.entries(TAB_ICONS)) {
      for (const d of [spec.stroke, spec.fill, spec.knock].filter(Boolean) as string[]) {
        assert.match(d, PATH, `${tab} has a malformed path`);
        assert.match(d, /^M/, `${tab} path must start with a move`);
      }
    }
  });

  it('changes shape when selected, not only colour', () => {
    for (const [tab, spec] of Object.entries(TAB_ICONS)) {
      assert.ok(spec.fillSelected > spec.fillIdle, `${tab} looks the same selected and idle`);
      assert.ok(spec.fillSelected <= 1 && spec.fillIdle >= 0, `${tab} has an opacity out of range`);
    }
  });
});

describe('cleanAvatarUri', () => {
  it('keeps a photo the app stored itself', () => {
    assert.equal(cleanAvatarUri({ avatarUri: 'file:///data/user/0/com.ripple.app/files/avatar-1.jpg' }), 'file:///data/user/0/com.ripple.app/files/avatar-1.jpg');
    assert.equal(cleanAvatarUri({ avatarUri: 'data:image/jpeg;base64,AAAA' }), 'data:image/jpeg;base64,AAAA');
  });

  it('drops anything else, so a stored value can never make the app fetch a URL', () => {
    assert.equal(cleanAvatarUri({ avatarUri: 'https://example.com/me.jpg' }), null);
    assert.equal(cleanAvatarUri({ avatarUri: 'data:text/html;base64,AAAA' }), null);
    assert.equal(cleanAvatarUri({ avatarUri: 42 }), null);
    assert.equal(cleanAvatarUri(null), null);
    assert.equal(cleanAvatarUri(undefined), null);
  });
});
