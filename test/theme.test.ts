import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCESSIBLE_PALETTES,
  darkPalette as colors,
  lightPalette,
  tapSlop,
  tint,
  type,
} from '../src/ui/theme.ts';

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

/**
 * Dichromacy simulation — Viénot, Brettel & Mollon (1999), the linear-RGB
 * approximation. Operates on linearised channels, which `luminance` above
 * already knows how to produce.
 */
const CVD_MATRICES = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const;

function linearise(hex: string): number[] {
  const clean = hex.replace('#', '');
  return [0, 2, 4].map((i) => {
    const srgb = parseInt(clean.slice(i, i + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
}

function simulate(hex: string, kind: keyof typeof CVD_MATRICES): number[] {
  const lin = linearise(hex);
  return CVD_MATRICES[kind].map((row) => row[0]! * lin[0]! + row[1]! * lin[1]! + row[2]! * lin[2]!);
}

/** CIELAB of a linear-sRGB triple, D65. */
function lab(lin: number[]): [number, number, number] {
  const X = 0.4124 * lin[0]! + 0.3576 * lin[1]! + 0.1805 * lin[2]!;
  const Y = 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  const Z = 0.0193 * lin[0]! + 0.1192 * lin[1]! + 0.9505 * lin[2]!;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / 0.95047);
  const fy = f(Y);
  const fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 dE*ab. Below ~11 is "hard to tell apart at a glance". */
function separation(a: string, b: string, kind: keyof typeof CVD_MATRICES): number {
  const [l1, a1, b1] = lab(simulate(a, kind));
  const [l2, a2, b2] = lab(simulate(b, kind));
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

describe('accessible tone palettes', () => {
  it('meets AA against their own background', () => {
    for (const [name, palette] of Object.entries(ACCESSIBLE_PALETTES)) {
      for (const token of ['up', 'down'] as const) {
        const ratio = contrast(palette[token], palette.bg);
        assert.ok(
          ratio >= AA_TEXT,
          `${name}.${token} is ${ratio.toFixed(2)}:1 against bg, below AA (${AA_TEXT}:1). ` +
            'These carry meaning, so they are held to the normal-text bar.',
        );
      }
    }
  });

  it('keeps up and down apart for every dichromacy', () => {
    // The whole reason this palette exists. 25 is the "clearly different"
    // threshold; the shipped pair measures 41-63, so there is real headroom
    // and this only fails on a genuinely bad edit.
    const FLOOR = 25;

    for (const [name, palette] of Object.entries(ACCESSIBLE_PALETTES)) {
      for (const kind of ['deuteranopia', 'protanopia', 'tritanopia'] as const) {
        const dE = separation(palette.up, palette.down, kind);
        assert.ok(
          dE >= FLOOR,
          `${name} up/down measure dE ${dE.toFixed(1)} under ${kind}, below ${FLOOR}. ` +
            'A reader with this deficiency could not tell a gain from a loss.',
        );
      }
    }
  });

  it('keeps up clear of the accent, which is also blue-ish', () => {
    // Teal was chosen over a blue `up` for exactly this reason; a sky-blue
    // `up` measured dE 18.8 against the accent under deuteranopia.
    for (const [name, palette] of Object.entries(ACCESSIBLE_PALETTES)) {
      for (const kind of ['deuteranopia', 'protanopia'] as const) {
        const dE = separation(palette.up, palette.accent, kind);
        assert.ok(
          dE >= 25,
          `${name} up is only dE ${dE.toFixed(1)} from accent under ${kind}. ` +
            'A gain chip would read as an ordinary interactive element.',
        );
      }
    }
  });

  it('is what the classic palette fails, which is why it exists', () => {
    // Guards the premise rather than the fix: if this ever stops being true,
    // the second palette has no reason to exist and should be reconsidered
    // rather than silently maintained.
    const worst = Math.min(
      ...(['deuteranopia', 'protanopia'] as const).map((kind) =>
        separation(lightPalette.up, lightPalette.down, kind),
      ),
    );
    assert.ok(
      worst < 25,
      `The classic light pair now measures dE ${worst.toFixed(1)} under dichromacy, ` +
        'which is no longer a failure. Re-evaluate whether two tone palettes are needed.',
    );
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
