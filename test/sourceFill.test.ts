import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { LIGHT_FILL, sourceFill } from '../src/ui/sourceFill.ts';
import { darkPalette, lightPalette } from '../src/ui/theme.ts';

/** WCAG 2.1 relative luminance of an #rrggbb colour. */
function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => {
    const srgb = parseInt(clean.slice(i, i + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const AA_TEXT = 4.5;
/** WCAG 1.4.11: the boundary of a UI component needs 3:1 against its ground. */
const AA_COMPONENT = 3;

/**
 * The descriptor colours, read out of the provider sources as text.
 *
 * Importing the registry would pull in all four providers, and those import
 * `@/lib/http` — a path alias Node's TypeScript stripping cannot resolve. The
 * same trick `test/privacy.test.ts` uses to find hosts is used here to find
 * colours, which keeps the assertion on the real values rather than a copy.
 */
function brandColours(): Record<string, string> {
  const found: Record<string, string> = {};

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith('Provider.ts')) continue;

      const src = readFileSync(full, 'utf8');
      const id = /\bid:\s*'([a-z]+)'/.exec(src)?.[1];
      const color = /\bcolor:\s*'(#[0-9A-Fa-f]{6})'/.exec(src)?.[1];
      if (id && color) found[id] = color;
    }
  };

  walk('src/providers');
  return found;
}

describe('solid source chips', () => {
  it('found a descriptor colour for every source that has a fill', () => {
    // Guards the guard: if the regex stops matching, every assertion below
    // would pass vacuously.
    const brands = brandColours();
    for (const source of Object.keys(LIGHT_FILL)) {
      assert.ok(brands[source], `no descriptor colour found for ${source}`);
    }
  });

  it('carries its label at AA in the dark theme', () => {
    const brands = brandColours();
    for (const [source, brand] of Object.entries(brands)) {
      const ratio = contrast(darkPalette.onAccent, brand);
      assert.ok(
        ratio >= AA_TEXT,
        `${source}: onAccent on ${brand} is ${ratio.toFixed(2)}:1, below AA`,
      );
    }
  });

  it('carries its label at AA in the light theme', () => {
    for (const [source, fill] of Object.entries(LIGHT_FILL)) {
      const ratio = contrast(lightPalette.onAccent, fill);
      assert.ok(
        ratio >= AA_TEXT,
        `${source}: onAccent on ${fill} is ${ratio.toFixed(2)}:1, below AA`,
      );
    }
  });

  it('stands off the page it sits on, in both themes', () => {
    const brands = brandColours();
    for (const [source, fill] of Object.entries(LIGHT_FILL)) {
      const light = contrast(fill, lightPalette.bg);
      assert.ok(
        light >= AA_COMPONENT,
        `${source}: light fill ${fill} is ${light.toFixed(2)}:1 against the page, ` +
          `below the ${AA_COMPONENT}:1 a UI boundary needs`,
      );

      const dark = contrast(brands[source]!, darkPalette.bg);
      assert.ok(dark >= AA_COMPONENT, `${source}: dark fill is ${dark.toFixed(2)}:1 against the page`);
    }
  });

  it('does not reuse the bright descriptor colour as a light-theme fill', () => {
    // The mistake this module exists to prevent. Measured on the light ground
    // the originals run 1.76–3.04:1, so a solid mint chip on white is a smudge.
    const brands = brandColours();
    for (const [source, fill] of Object.entries(LIGHT_FILL)) {
      assert.notEqual(
        fill.toLowerCase(),
        brands[source]!.toLowerCase(),
        `${source} reverted to its descriptor colour for the light fill`,
      );
    }
  });

  it('hands the dark theme the source’s own colour, unchanged', () => {
    // Identity still belongs to the provider; only the light theme overrides.
    const brands = brandColours();
    for (const [source, brand] of Object.entries(brands)) {
      assert.equal(sourceFill(source as keyof typeof LIGHT_FILL, brand, 'dark'), brand);
      assert.equal(
        sourceFill(source as keyof typeof LIGHT_FILL, brand, 'light'),
        LIGHT_FILL[source as keyof typeof LIGHT_FILL],
      );
    }
  });
});
