/**
 * Builds the default profile pictures in assets/avatars/ and a comparison
 * sheet (assets/avatars/preview.html) that shows each one at 128, 64, 40 and
 * 24px against all three app modes.
 *
 * Every avatar is two colours on a 256-unit circle: one plate, one motif.
 * Plates range across blues, purples, berry, blush, sand and greys so the set
 * tells people apart. Teal, orange, green, red and amber are left out on
 * purpose — in the app they mean up, down and warning.
 *
 *   node scripts/build-default-avatars.cjs
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'avatars');

// ── Geometry helpers ─────────────────────────────────────────────────────────

const f = (n) => Number(n.toFixed(2));

/** A closed, smooth path through `pts` (Catmull-Rom converted to cubics). */
function smoothClosed(pts) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

/**
 * An irregular closed loop: a circle of radius `r` whose radius wobbles by
 * the given harmonics [k, amplitude, phase], optionally squashed vertically.
 */
function blob(cx, cy, r, harmonics, squash = 1, steps = 36) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    let k = 1;
    for (const [h, a, p] of harmonics) k += a * Math.sin(h * t + p);
    pts.push([cx + Math.cos(t) * r * k, cy + Math.sin(t) * r * k * squash]);
  }
  return smoothClosed(pts);
}

/** A sine-like wave of `halves` half-periods, each `w` wide, peaking at ±`amp`. */
function wave(x, y, w, amp, halves) {
  let d = `M${x} ${y}q${w / 2} ${-amp * 2} ${w} 0`;
  for (let i = 1; i < halves; i++) d += `t${w} 0`;
  return d;
}

// ── The set ──────────────────────────────────────────────────────────────────


const stroke = (w) =>
  `fill="none" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

const AVATARS = [
  {
    id: 'drop',
    name: 'Drop',
    plate: '#12306E',
    ink: '#2296E6',
    body: (m) => `
  <path fill="${m}" d="M128 50C128 50 98 92 98 116A30 30 0 0 0 158 116C158 92 128 50 128 50Z"/>
  <ellipse cx="128" cy="176" rx="64" ry="16" stroke="${m}" ${stroke(11)}/>
  <ellipse cx="128" cy="176" rx="30" ry="6" stroke="${m}" ${stroke(9)}/>`,
  },
  {
    id: 'rings',
    name: 'Rings',
    plate: '#E4DBFA',
    ink: '#3B2A8C',
    body: (m) => `
  <circle cx="112" cy="144" r="14" fill="${m}"/>
  <circle cx="112" cy="144" r="44" stroke="${m}" ${stroke(12)}/>
  <circle cx="112" cy="144" r="74" stroke="${m}" ${stroke(12)}/>`,
  },
  {
    id: 'tide-line',
    name: 'Tide line',
    plate: '#1B2844',
    ink: '#21A1E4',
    body: (m) => `
  <path d="${wave(60, 92, 34, 15, 4)}" stroke="${m}" ${stroke(12)}/>
  <path d="${wave(60, 128, 34, 10, 4)}" stroke="${m}" ${stroke(12)}/>
  <path d="${wave(60, 164, 34, 5, 4)}" stroke="${m}" ${stroke(12)}/>`,
  },
  {
    id: 'crest',
    name: 'Crest',
    plate: '#1F0766',
    ink: '#E8EEF9',
    body: (m) => `
  <path d="M44 184H90C108 184 112 160 116 132C122 92 150 70 180 78C206 86 210 120 188 130C172 137 156 126 162 110" stroke="${m}" ${stroke(16)}/>
  <path d="M142 184H212" stroke="${m}" ${stroke(16)}/>`,
  },
  {
    id: 'interference',
    name: 'Interference',
    plate: '#F9DCE5',
    ink: '#8E2C6E',
    body: (m) =>
      [96, 160]
        .map(
          (cx) => `
  <circle cx="${cx}" cy="128" r="9" fill="${m}"/>
  <circle cx="${cx}" cy="128" r="31" stroke="${m}" ${stroke(9)}/>
  <circle cx="${cx}" cy="128" r="54" stroke="${m}" ${stroke(9)}/>`,
        )
        .join(''),
  },
  {
    id: 'depth-sounding',
    name: 'Depth sounding',
    plate: '#26282E',
    ink: '#B9BCC4',
    body: (m) => {
      const h = [
        [2, 0.09, 0.6],
        [3, 0.06, 2.1],
      ];
      return `
  <path fill="${m}" d="${blob(120, 136, 16, h)}"/>
  <path d="${blob(122, 134, 40, h)}" stroke="${m}" ${stroke(9)}/>
  <path d="${blob(124, 132, 64, h)}" stroke="${m}" ${stroke(9)}/>
  <path d="${blob(126, 130, 88, [[2, 0.07, 0.6], [3, 0.04, 2.1]])}" stroke="${m}" ${stroke(9)}/>`;
    },
  },
  {
    id: 'moon-tide',
    name: 'Moon tide',
    plate: '#150438',
    ink: '#F1E3C6',
    body: (m, plate) => `
  <circle cx="128" cy="94" r="40" fill="${m}"/>
  <circle cx="148" cy="80" r="34" fill="${plate}"/>
  <path d="${wave(56, 172, 36, 9, 4)}" stroke="${m}" ${stroke(12)}/>`,
  },
  {
    id: 'buoy',
    name: 'Buoy',
    plate: '#8E2C6E',
    ink: '#FCE8EF',
    body: (m, plate) => `
  <path d="M128 126V172" stroke="${m}" ${stroke(14)}/>
  <circle cx="128" cy="100" r="30" fill="${m}"/>
  <path d="M96 100H160" stroke="${plate}" stroke-width="9"/>
  <path d="${wave(52, 180, 38, 6, 4)}" stroke="${m}" ${stroke(12)}/>`,
  },
  {
    id: 'current',
    name: 'Current',
    plate: '#2457D6',
    ink: '#E8EEF9',
    body: (m) => `
  <g transform="rotate(-45 128 128)">${[-42, -14, 14, 42]
    .map(
      (dy) => `
    <path d="M66 ${128 + dy}C96 ${100 + dy} 112 ${100 + dy} 128 ${128 + dy}S160 ${156 + dy} 190 ${128 + dy}" stroke="${m}" ${stroke(12)}/>`,
    )
    .join('')}
  </g>`,
  },
  {
    id: 'stone-skip',
    name: 'Stone skip',
    plate: '#4A5B80',
    ink: '#F2F3F5',
    body: (m) => `
  <path d="M64 150Q98 92 132 126Q160 92 182 104Q196 92 206 96" stroke="${m}" stroke-width="7" stroke-linecap="round" fill="none" stroke-dasharray="0 15"/>
  <ellipse cx="72" cy="172" rx="34" ry="10" stroke="${m}" ${stroke(9)}/>
  <ellipse cx="136" cy="146" rx="24" ry="7" stroke="${m}" ${stroke(8)}/>
  <ellipse cx="184" cy="122" rx="15" ry="4.5" stroke="${m}" ${stroke(7)}/>
  <ellipse cx="208" cy="96" rx="9" ry="6" fill="${m}"/>`,
  },
  {
    id: 'pebble',
    name: 'Pebble',
    plate: '#EFE6D2',
    ink: '#4A3826',
    body: (m) => `
  <g transform="rotate(-10 128 128)">
    <path fill="${m}" d="${blob(128, 128, 38, [[2, 0.05, 1.2], [3, 0.03, 0.4]], 0.76)}"/>
    <ellipse cx="128" cy="130" rx="80" ry="58" stroke="${m}" ${stroke(10)}/>
  </g>`,
  },
  {
    id: 'compass-rose',
    name: 'Compass rose',
    plate: '#21A1E4',
    ink: '#150438',
    body: (m) => {
      const R = 84;
      const r = 17;
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const t = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? R : r;
        pts.push(`${f(128 + Math.cos(t) * rad)} ${f(128 + Math.sin(t) * rad)}`);
      }
      return `
  <circle cx="128" cy="128" r="56" stroke="${m}" ${stroke(7)}/>
  <path fill="${m}" stroke="${m}" stroke-width="4" stroke-linejoin="round" d="M${pts.join('L')}Z"/>`;
    },
  },
  {
    id: 'compass',
    name: 'Compass',
    plate: '#3B1238',
    ink: '#F6C9DA',
    body: (m, plate) => `
  <circle cx="128" cy="128" r="84" stroke="${m}" ${stroke(10)}/>
  <path d="M128 52V64M204 128H192M128 204V192M52 128H64" stroke="${m}" ${stroke(9)}/>
  <path fill="${m}" stroke="${m}" stroke-width="5" stroke-linejoin="round" d="M128 72L146 128H110Z"/>
  <path d="M110 128H146L128 184Z" stroke="${m}" ${stroke(7)}/>
  <circle cx="128" cy="128" r="7" fill="${plate}" stroke="${m}" stroke-width="5"/>`,
  },
  {
    id: 'magnifier',
    name: 'Magnifier',
    plate: '#D6E8FF',
    ink: '#12306E',
    body: (m) => `
  <circle cx="112" cy="112" r="46" stroke="${m}" ${stroke(15)}/>
  <path d="M146 146L188 188" stroke="${m}" ${stroke(24)}/>
  <path d="${wave(86, 114, 26, 6, 2)}" stroke="${m}" ${stroke(10)}/>`,
  },
];

// ── Contrast check (WCAG relative luminance) ────────────────────────────────

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ── Output ───────────────────────────────────────────────────────────────────

function svg(a, size) {
  const sz = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"${sz} role="img" aria-label="${a.name}">
  <circle cx="128" cy="128" r="128" fill="${a.plate}"/>${a.body(a.ink, a.plate)}
</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });

AVATARS.forEach((a, i) => {
  const file = `${String(i + 1).padStart(2, '0')}-${a.id}.svg`;
  fs.writeFileSync(path.join(OUT, file), svg(a) + '\n');
  a.file = file;
  a.contrast = ratio(a.plate, a.ink);
  console.log(`${file.padEnd(24)} ${a.contrast.toFixed(1)}:1`);
});

const cards = AVATARS.map(
  (a, i) => `
    <figure class="card">
      <div class="hero">${svg(a, 128)}</div>
      <div class="sizes">${[64, 40, 24].map((s) => svg(a, s)).join('')}</div>
      <figcaption><span class="num">${String(i + 1).padStart(2, '0')}</span> ${a.name}
        <small>${a.plate} / ${a.ink} · ${a.contrast.toFixed(1)}:1</small></figcaption>
    </figure>`,
).join('');

const rows = AVATARS.slice(0, 4)
  .map(
    (a, i) => `
      <div class="row">${svg(a, 40)}<div><b>${['Alex M.', 'You', 'Sam K.', 'Jordan P.'][i]}</b><span>Following 12 · joined Oct 2026</span></div></div>`,
  )
  .join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ripple default avatars</title>
<style>
  :root { --bg:#0A1222; --surface:#111C33; --surfaceAlt:#1B2844; --border:#2A3858; --text:#E8EEF9; --muted:#93A1BC; --accent:#3E78FF; }
  .m-black { --bg:#000000; --surface:#0E0E10; --surfaceAlt:#18191D; --border:#26282E; --text:#F2F3F5; --muted:#B9BCC4; }
  .m-white { --bg:#F2F5F4; --surface:#FFFFFF; --surfaceAlt:#E7EDEB; --border:#D3DCD9; --text:#0F1E1D; --muted:#41504D; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width:1120px; margin:0 auto; padding:24px 16px 48px; }
  header { display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; margin-bottom:20px; }
  h1 { font-size:20px; margin:0; }
  header p { margin:4px 0 0; color:var(--muted); }
  .seg { display:inline-flex; background:var(--surfaceAlt); border-radius:10px; padding:3px; }
  .seg button { border:0; background:none; color:var(--muted); font:inherit; padding:6px 12px; border-radius:8px; cursor:pointer; }
  .seg button[aria-pressed="true"] { background:var(--surface); color:var(--text); box-shadow:0 0 0 1px var(--border); }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:12px; }
  .card { margin:0; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px; }
  .hero { display:flex; justify-content:center; padding:4px 0 12px; }
  .sizes { display:flex; gap:14px; align-items:end; justify-content:center; padding-bottom:12px; border-bottom:1px solid var(--border); }
  figcaption { padding-top:10px; font-weight:600; }
  figcaption .num { color:var(--muted); font-variant-numeric:tabular-nums; margin-right:4px; }
  figcaption small { display:block; font-weight:400; color:var(--muted); font-variant-numeric:tabular-nums; }
  h2 { font-size:15px; margin:28px 0 10px; }
  .strip { display:flex; flex-wrap:wrap; gap:10px; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:14px; }
  .strip.bare { background:none; border-style:dashed; }
  .list { background:var(--surface); border:1px solid var(--border); border-radius:12px; max-width:420px; }
  .row { display:flex; gap:12px; align-items:center; padding:12px 14px; }
  .row + .row { border-top:1px solid var(--border); }
  .row b { display:block; font-weight:600; }
  .row span { color:var(--muted); font-size:13px; }
  svg { flex:none; display:block; }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <h1>Default avatars</h1>
      <p>${AVATARS.length} two-colour marks, each shown at 128 / 64 / 40 / 24px. Teal, orange, green, red and amber are kept out because they mean up, down and warning in the app.</p>
    </div>
    <div class="seg" role="group" aria-label="Mode">
      <button aria-pressed="true" data-m="">Dark blue</button>
      <button aria-pressed="false" data-m="m-black">True black</button>
      <button aria-pressed="false" data-m="m-white">White</button>
    </div>
  </header>
  <div class="grid">${cards}
  </div>
  <h2>All ${AVATARS.length} at 40px, on a card</h2>
  <div class="strip">${AVATARS.map((a) => svg(a, 40)).join('')}</div>
  <h2>On the page background</h2>
  <div class="strip bare">${AVATARS.map((a) => svg(a, 40)).join('')}</div>
  <h2>In a list</h2>
  <div class="list">${rows}
  </div>
</main>
<script>
  const btns = document.querySelectorAll('.seg button');
  btns.forEach((b) => b.addEventListener('click', () => {
    document.documentElement.className = b.dataset.m;
    btns.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  }));
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(OUT, 'preview.html'), html);
console.log('preview.html');
