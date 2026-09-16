import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  markedLabel,
  spokenLabel,
  toneColor,
  toneMark,
  toneShape,
  toneWord,
} from '../src/ui/tone.ts';
import { darkPalette, lightPalette } from '../src/ui/theme.ts';

describe('toneColor', () => {
  it('reads the pair off whichever palette it is handed', () => {
    // A plain function taking the palette, rather than a hook, is what lets the
    // same helper serve the card, the table and the timeline.
    assert.equal(toneColor('up', darkPalette), darkPalette.up);
    assert.equal(toneColor('down', lightPalette), lightPalette.down);
  });

  it('gives a directionless tone the muted text colour, not a third hue', () => {
    assert.equal(toneColor('neutral', darkPalette), darkPalette.textMuted);
  });
});

describe('toneMark', () => {
  it('marks the two directions and nothing else', () => {
    assert.equal(toneMark('up'), '▲');
    assert.equal(toneMark('down'), '▼');
    assert.equal(toneMark('neutral'), '');
  });

  it('never leaves a stray separator when there is no mark', () => {
    // The bug this guards: `${mark} ${label}` on a neutral tone renders a
    // leading space, which shifts every neutral chip half a character.
    assert.equal(markedLabel('neutral', 'GRANT'), 'GRANT');
    assert.equal(markedLabel('up', '+$50K'), '▲ +$50K');
    assert.equal(markedLabel('down', '-6.20%'), '▼ -6.20%');
  });
});

describe('spoken forms', () => {
  it('says the direction in words, because the glyph is read as its unicode name', () => {
    // VoiceOver renders ▲ as "black up-pointing triangle". Anything spoken has
    // to use this instead of the marked label.
    assert.equal(spokenLabel('up', '+$50K'), 'Up, +$50K');
    assert.equal(spokenLabel('down', '-6.20%'), 'Down, -6.20%');
  });

  it('leaves a directionless label exactly as it was', () => {
    assert.equal(spokenLabel('neutral', 'GRANT'), 'GRANT');
    assert.equal(toneWord('neutral'), '');
  });

  it('never puts a glyph into a spoken label', () => {
    for (const tone of ['up', 'down', 'neutral'] as const) {
      const spoken = spokenLabel(tone, 'x');
      assert.ok(
        !spoken.includes('▲') && !spoken.includes('▼'),
        `spokenLabel(${tone}) leaked a glyph: ${spoken}`,
      );
    }
  });
});

describe('toneShape', () => {
  it('points the way the tone points', () => {
    // The timeline has no room for a label, so the mark is the shape. Direction
    // must survive there or colour is the only cue, which is WCAG 1.4.1.
    assert.equal(toneShape('up'), 'triangle-up');
    assert.equal(toneShape('down'), 'triangle-down');
    assert.equal(toneShape('neutral'), 'circle');
  });

  it('gives the two directions distinguishable shapes', () => {
    assert.notEqual(toneShape('up'), toneShape('down'));
  });
});

describe('colour is never the only cue', () => {
  it('gives every directional tone a non-colour cue in both channels', () => {
    for (const tone of ['up', 'down'] as const) {
      assert.ok(toneMark(tone).length > 0, `${tone} has no visual mark`);
      assert.ok(toneWord(tone).length > 0, `${tone} has no spoken word`);
      assert.notEqual(toneShape(tone), 'circle', `${tone} has no distinct shape`);
    }
  });
});
