import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parseGlyph } from '../src/ui/glyphSpec.ts';

const GLYPHMAPS = 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/';
const load = (file: string): Record<string, unknown> => JSON.parse(readFileSync(GLYPHMAPS + file, 'utf8'));
const MAPS = {
  ion: load('Ionicons.json'),
  mci: load('MaterialCommunityIcons.json'),
  fa6: load('FontAwesome6Free.json'),
};
const FA6_SOLID = new Set(
  (JSON.parse(readFileSync(GLYPHMAPS + 'FontAwesome6Free_meta.json', 'utf8')) as { solid: string[] }).solid,
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}
const SOURCES = [...sourceFiles('src'), ...sourceFiles('app')].map((path) => ({
  path,
  text: readFileSync(path, 'utf8'),
}));

describe('parseGlyph', () => {
  it('reads a family prefix', () => {
    assert.deepEqual(parseGlyph('fa6:landmark-dome'), { family: 'fa6', name: 'landmark-dome' });
    assert.deepEqual(parseGlyph('mci:access-point'), { family: 'mci', name: 'access-point' });
    assert.deepEqual(parseGlyph('ion:pulse'), { family: 'ion', name: 'pulse' });
  });

  it('treats a bare name as Ionicons, so older icon strings keep their meaning', () => {
    assert.deepEqual(parseGlyph('stats-chart'), { family: 'ion', name: 'stats-chart' });
  });

  it('does not mistake an unknown prefix for a family', () => {
    assert.deepEqual(parseGlyph('foo:bar'), { family: 'ion', name: 'foo:bar' });
  });
});

describe('icon names in the app', () => {
  it('every provider icon exists in the set that draws it', () => {
    const providers = SOURCES.filter((f) => /Provider\.ts$/.test(f.path));
    assert.ok(providers.length >= 4, 'expected to find the source providers');
    for (const { path, text } of providers) {
      for (const [, spec] of text.matchAll(/^\s*icon: '([^']+)',$/gm)) {
        const { family, name } = parseGlyph(spec!);
        assert.ok(name in MAPS[family], `${path}: ${spec} is not a glyph`);
        if (family === 'fa6') assert.ok(FA6_SOLID.has(name), `${path}: ${spec} has no solid style`);
      }
    }
  });

  // FontAwesome6 names are the only ones TypeScript cannot check, so every one
  // written anywhere in the app is checked here, in both spellings.
  it('every FontAwesome6 name exists in its solid style', () => {
    let seen = 0;
    for (const { path, text } of SOURCES) {
      const names = [
        ...[...text.matchAll(/family: 'fa6', name: '([^']+)'/g)].map((m) => m[1]!),
        ...[...text.matchAll(/'fa6:([^']+)'/g)].map((m) => m[1]!),
      ];
      for (const name of names) {
        seen++;
        assert.ok(FA6_SOLID.has(name), `${path}: fa6 "${name}" has no solid glyph`);
      }
    }
    assert.ok(seen > 0, 'expected to find FontAwesome6 icons');
  });
});
