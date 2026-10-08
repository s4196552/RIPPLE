// Rebuild the app assets from the approved Original 1 vector master.
// Requires sharp (available in Codex's bundled Node package directory).
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const master = path.join(root, 'assets/logo/ripple-original-1.svg');
const importPath = process.argv[2];
if (importPath) {
  const source = fs.readFileSync(importPath, 'utf8');
  const paths = source.match(/<path\b[^>]*\/>/g);
  if (!paths || paths.length !== 8 || !paths[0].includes('M0 0L1024')) {
    throw new Error('Expected the approved Original 1 SVG with its white canvas and seven artwork paths.');
  }
  // Only discard the source canvas and provenance metadata. Keep the artwork exact.
  fs.writeFileSync(master, [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="219 216 586 586" role="img" aria-label="Ripple logo">',
    '  <title>Ripple — Original 1</title>',
    ...paths.slice(1).map(p => `  ${p}`),
    '</svg>\n',
  ].join('\n'));
}
const svg = fs.readFileSync(master);
function render(size) {
  return sharp(svg, { density: Math.ceil(size / 1024 * 72) }).resize(size, size);
}
async function tile(size, fraction, background, destination) {
  const markSize = Math.round(size * fraction);
  const logo = await render(markSize).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, gravity: 'centre' }])
    .toFile(path.join(root, destination));
}
async function main() {
  await render(1024).png().toFile(path.join(root, 'assets/logo/ripple-original-1.png'));
  await tile(1024, 0.82, '#FFFFFF', 'assets/icon.png');
  await tile(1024, 0.5, '#00000000', 'assets/adaptive-icon.png');
  await render(48).png().toFile(path.join(root, 'assets/favicon.png'));
  await render(512).png().toFile(path.join(root, 'assets/splash-icon.png'));

  // The checked-in Android project also needs regenerated resources; Expo config
  // alone only changes a subsequent prebuild, not this native project's builds.
  const res = 'android/app/src/main/res';
  for (const [density, scale] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
    const mipmap = `${res}/mipmap-${density}`;
    const drawable = `${res}/drawable-${density}`;
    fs.mkdirSync(path.join(root, mipmap), { recursive: true });
    fs.mkdirSync(path.join(root, drawable), { recursive: true });
    for (const filename of ['ic_launcher.webp', 'ic_launcher_round.webp']) {
      await tile(48 * scale, 0.82, '#FFFFFF', `${mipmap}/${filename}`);
    }
    await tile(108 * scale, 0.5, '#00000000', `${drawable}/ic_launcher_foreground.png`);
    await tile(224 * scale, 160 / 224, '#00000000', `${drawable}/splashscreen_logo.png`);
  }
  console.log('Built Original 1 logo, launcher, adaptive icon, favicon, and splash assets.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
