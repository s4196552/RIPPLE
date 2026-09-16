import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { darkPalette as colors, tapSlop, tint, type } from '../src/ui/theme.ts';

/** WCAG 2.1 relative luminance of an #rrggbb colour. */
function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => {
    const srgb = parseInt(clean.slice(i, i + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/** WCAG contrast ratio between two colours, 1:1 to 21:1. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** WCAG AA for normal-size text. */
const AA_TEXT = 4.5;
/** WCAG AA for large text and for non-text UI components. */
const AA_LARGE = 3;

describe('theme contrast against the app background', () => {
  it('matches the ratios documented in theme.ts', () => {
    // These numbers are quoted in the file header and in the accessibility
    // notes on individual components. A token edit that moves them silently
    // makes all of that documentation wrong, so they are pinned here.
    const expected: Record<string, number> = {
      text: 16.5,
      textMuted: 6.6,
      textSubtle: 4.8,
      textFaint: 3.3,
      accent: 6.0,
      up: 10.3,
      down: 5.7,
      warning: 10.0,
    };

    for (const [token, ratio] of Object.entries(expected)) {
      const actual = contrast(colors[token as keyof typeof colors] as string, colors.bg);
      assert.ok(
        Math.abs(actual - ratio) < 0.1,
        `${token}: documented ${ratio}:1 but measured ${actual.toFixed(2)}:1`,
      );
    }
  });

  it('gives every token cleared for informational text at least AA', () => {
    for (const token of ['text', 'textMuted', 'textSubtle', 'accent', 'up', 'down'] as const) {
      const ratio = contrast(colors[token], colors.bg);
      assert.ok(ratio >= AA_TEXT, `${token} is ${ratio.toFixed(2)}:1, below AA ${AA_TEXT}:1`);
    }
  });

  it('keeps textSubtle usefully dimmer than textMuted, or it earns nothing', () => {
    const subtle = contrast(colors.textSubtle, colors.bg);
    const muted = contrast(colors.textMuted, colors.bg);
    assert.ok(subtle < muted, 'textSubtle should read quieter than textMuted');
    assert.ok(subtle >= AA_TEXT, 'textSubtle exists precisely to be a safe dim tone');
  });

  it('holds textFaint to the decorative-only threshold it is documented for', () => {
    const ratio = contrast(colors.textFaint, colors.bg);
    assert.ok(ratio < AA_TEXT, 'if textFaint ever passes AA, the warnings about it are stale');
    assert.ok(ratio >= AA_LARGE, `separators still need ${AA_LARGE}:1 to be visible at all`);
  });

  it('keeps text on accent-filled surfaces legible', () => {
    // The FAB, the new-signals pill and the primary buttons all paint
    // `onAccent` on `accent`.
    const ratio = contrast(colors.onAccent, colors.accent);
    assert.ok(ratio >= AA_TEXT, `onAccent on accent is ${ratio.toFixed(2)}:1`);
  });

  it('warning is readable, since it carries the "something failed" copy', () => {
    assert.ok(contrast(colors.warning, colors.bg) >= AA_TEXT);
  });
});

describe('type scale', () => {
  it('never goes below 10pt — the floor both platforms still render legibly', () => {
    for (const [name, style] of Object.entries(type)) {
      assert.ok(style.fontSize >= 10, `type.${name} is ${style.fontSize}pt`);
    }
  });
});

describe('tapSlop', () => {
  it('pads a small control out to the 44pt minimum', () => {
    assert.equal(tapSlop(32) * 2 + 32, 44);
    assert.equal(tapSlop(36) * 2 + 36, 44);
  });

  it('adds nothing to a control that is already big enough', () => {
    assert.equal(tapSlop(44), 0);
    assert.equal(tapSlop(56), 0, 'never negative — that would shrink the target');
  });
});

describe('tint', () => {
  it('keeps the source colour and applies the alpha', () => {
    assert.equal(tint('#5B8DEF', 0.2), 'rgba(91, 141, 239, 0.2)');
  });

  it('accepts a hex without the leading hash', () => {
    assert.equal(tint('3FD68C', 0.5), 'rgba(63, 214, 140, 0.5)');
  });
});
