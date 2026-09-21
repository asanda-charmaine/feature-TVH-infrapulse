// Procedurally drawn "photographs" (SVG) used for seeded reports and demo sample photos.
// Images are referenced as "scene:<kind>:<seed>" and only rendered when displayed, which keeps
// stored data tiny. Real uploads are stored as (downscaled) data URLs instead.

export const SCENE_KINDS = {
  pothole: 'Pothole',
  traffic: 'Traffic light (fault)',
  street: 'Street light (fault)',
  unrelated: 'Unrelated scene',
  'pothole-fixed': 'Pothole repaired',
  'traffic-fixed': 'Traffic light working',
  'street-fixed': 'Street light working',
  blurry: 'Blurry image',
};

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const wrap = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600"><defs>${defs}</defs>${body}</svg>`;

function roadBase(r, { dusk = false } = {}) {
  const sky1 = dusk ? '#f2b98a' : '#bcd9ee';
  const sky2 = dusk ? '#5b5f8f' : '#e9f3fa';
  let buildings = '';
  let x = -20;
  while (x < 820) {
    const w = 60 + r() * 90;
    const h = 60 + r() * 130;
    buildings += `<rect x="${x.toFixed(0)}" y="${(250 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${dusk ? '#3b3f66' : '#9fb4c4'}" opacity=".85"/>`;
    x += w + 4;
  }
  return `
    <defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky2}"/><stop offset="1" stop-color="${sky1}"/></linearGradient></defs>
    <rect width="800" height="600" fill="url(#sk)"/>
    ${buildings}
    <rect y="248" width="800" height="352" fill="#6b7078"/>
    <polygon points="0,248 800,248 800,268 0,268" fill="#8d9299"/>
    <polygon points="330,268 470,268 800,600 0,600" fill="#4b4f57"/>
    <polygon points="392,268 408,268 440,600 360,600" fill="#e9d36a" opacity=".85"/>
    <polygon points="394,268 406,268 424,600 376,600" fill="#4b4f57"/>
    <polygon points="396,268 404,268 410,340 390,340" fill="#e9d36a" opacity=".9"/>`;
}

function texture(r, n = 90) {
  let dots = '';
  for (let i = 0; i < n; i++) {
    const x = r() * 800;
    const y = 300 + r() * 300;
    dots += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.8 + r() * 1.6).toFixed(1)}" fill="#2f3238" opacity=".35"/>`;
  }
  return dots;
}

function pothole(seed, fixed) {
  const r = rng(seed);
  let out = roadBase(r) + texture(r);
  const cx = 300 + r() * 220;
  const cy = 440 + r() * 50;
  const rx = 90 + r() * 70;
  const ry = rx * (0.32 + r() * 0.12);
  if (fixed) {
    out += `
      <ellipse cx="${cx}" cy="${cy}" rx="${rx + 14}" ry="${ry + 8}" fill="#2e3136"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx + 4}" ry="${ry + 2}" fill="#3a3e45"/>
      <ellipse cx="${cx - 20}" cy="${cy - 6}" rx="${rx * 0.55}" ry="${ry * 0.35}" fill="#454a52" opacity=".7"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx + 14}" ry="${ry + 8}" fill="none" stroke="#1f2226" stroke-width="2" stroke-dasharray="14 6"/>`;
    return wrap(out);
  }
  let cracks = '';
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const len = 40 + r() * 90;
    const x1 = cx + Math.cos(a) * rx;
    const y1 = cy + Math.sin(a) * ry;
    const x2 = x1 + Math.cos(a + (r() - 0.5)) * len;
    const y2 = y1 + Math.sin(a + (r() - 0.5)) * len * 0.5;
    cracks += `<path d="M${x1.toFixed(0)} ${y1.toFixed(0)} L${((x1 + x2) / 2 + (r() - 0.5) * 16).toFixed(0)} ${((y1 + y2) / 2 + (r() - 0.5) * 8).toFixed(0)} L${x2.toFixed(0)} ${y2.toFixed(0)}" stroke="#1d1f23" stroke-width="${(1.5 + r() * 2).toFixed(1)}" fill="none" stroke-linecap="round"/>`;
  }
  out += `
    ${cracks}
    <ellipse cx="${cx}" cy="${cy + 4}" rx="${rx + 16}" ry="${ry + 10}" fill="#6f747c"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx + 8}" ry="${ry + 4}" fill="#24272b"/>
    <ellipse cx="${cx + 8}" cy="${cy + 6}" rx="${rx - 14}" ry="${ry - 8}" fill="#121417"/>
    <path d="M${cx - rx} ${cy} Q${cx} ${cy - ry - 10} ${cx + rx} ${cy}" stroke="#8f949b" stroke-width="4" fill="none" opacity=".7"/>
    <ellipse cx="${cx - 30}" cy="${cy + 10}" rx="${rx * 0.3}" ry="${ry * 0.25}" fill="#2a3b47" opacity=".8"/>`;
  return wrap(out);
}

function traffic(seed, fixed) {
  const r = rng(seed);
  const tilt = fixed ? 0 : (r() - 0.5) * 8;
  const glow = fixed ? '<circle cx="400" cy="300" r="70" fill="#37e08a" opacity=".28"/>' : '';
  const dark = '#1d2126';
  const lens = (cy, on, color) =>
    `<circle cx="400" cy="${cy}" r="30" fill="${on ? color : '#0c0e10'}"/><circle cx="400" cy="${cy}" r="30" fill="none" stroke="#3a4149" stroke-width="3"/>${on ? '' : `<path d="M385 ${cy - 10} L400 ${cy + 2} L412 ${cy - 14}" stroke="#2c3238" stroke-width="2" fill="none"/>`}`;
  const out = `
    <defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5f8f"/><stop offset="1" stop-color="#f2b98a"/></linearGradient></defs>
    <rect width="800" height="600" fill="url(#sk)"/>
    <rect y="470" width="800" height="130" fill="#3b3f46"/>
    <rect y="455" width="800" height="16" fill="#8d9299"/>
    <rect x="80" y="230" width="110" height="230" fill="#3b3f66" opacity=".8"/><rect x="600" y="180" width="130" height="280" fill="#3b3f66" opacity=".8"/>
    <rect x="392" y="120" width="16" height="350" fill="#2c3238"/>
    <g transform="rotate(${tilt.toFixed(1)} 400 200)">
      ${glow}
      <rect x="352" y="90" width="96" height="250" rx="14" fill="${dark}" stroke="#3a4149" stroke-width="4"/>
      ${lens(140, false, '#ff4a4a')}${lens(215, false, '#ffb020')}${lens(290, fixed, '#37e08a')}
      ${fixed ? '' : '<path d="M448 100 q40 30 20 90 t30 80" stroke="#111" stroke-width="3" fill="none"/>'}
    </g>
    <rect x="300" y="470" width="200" height="12" rx="6" fill="#2a2e34"/>`;
  return wrap(out);
}

function street(seed, fixed) {
  const r = rng(seed);
  const lean = fixed ? 0 : (r() - 0.5) * 5;
  const cone = fixed
    ? '<polygon points="560,150 470,470 690,470" fill="#ffe9a0" opacity=".28"/><circle cx="560" cy="140" r="60" fill="#fff2b8" opacity=".35"/>'
    : '';
  const out = `
    <defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e2444"/><stop offset="1" stop-color="#d98a6c"/></linearGradient></defs>
    <rect width="800" height="600" fill="url(#sk)"/>
    <rect x="40" y="260" width="120" height="210" fill="#141833" opacity=".9"/><rect x="180" y="300" width="90" height="170" fill="#141833" opacity=".9"/>
    <rect y="470" width="800" height="130" fill="#2f333a"/>
    <rect y="455" width="800" height="16" fill="#767b83"/>
    <g transform="rotate(${lean.toFixed(1)} 300 470)">
      <rect x="292" y="140" width="16" height="335" fill="#2b3037"/>
      <path d="M300 150 Q300 110 360 110 L560 120" stroke="#2b3037" stroke-width="14" fill="none" stroke-linecap="round"/>
      ${cone}
      <rect x="520" y="118" width="86" height="26" rx="12" fill="#1a1d22" stroke="#3a4149" stroke-width="3"/>
      <ellipse cx="562" cy="146" rx="32" ry="8" fill="${fixed ? '#fff3b0' : '#0d0f12'}"/>
      ${fixed ? '' : '<path d="M540 148 L556 156 M572 148 L584 158" stroke="#3a4149" stroke-width="2"/>'}
    </g>`;
  return wrap(out);
}

function unrelated(seed) {
  const r = rng(seed);
  const blobs = [0, 1, 2, 3, 4]
    .map((i) => `<circle cx="${(330 + r() * 140).toFixed(0)}" cy="${(190 + r() * 90).toFixed(0)}" r="${(60 + r() * 40).toFixed(0)}" fill="${i % 2 ? '#3f8f4b' : '#2f7a3d'}"/>`)
    .join('');
  return wrap(`
    <defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec9f0"/><stop offset="1" stop-color="#e6f4fb"/></linearGradient></defs>
    <rect width="800" height="600" fill="url(#sk)"/>
    <ellipse cx="400" cy="640" rx="620" ry="240" fill="#6dbb63"/>
    <rect x="384" y="270" width="34" height="200" fill="#6b4a2f"/>
    ${blobs}
    <rect x="560" y="440" width="160" height="14" rx="4" fill="#8a5a33"/><rect x="570" y="454" width="10" height="34" fill="#6b4425"/><rect x="700" y="454" width="10" height="34" fill="#6b4425"/>
    <rect x="560" y="410" width="160" height="12" rx="4" fill="#a06a3b"/>
    <circle cx="120" cy="90" r="44" fill="#ffe27a"/>`);
}

const BUILDERS = {
  pothole: (s) => pothole(s, false),
  'pothole-fixed': (s) => pothole(s, true),
  traffic: (s) => traffic(s, false),
  'traffic-fixed': (s) => traffic(s, true),
  street: (s) => street(s, false),
  'street-fixed': (s) => street(s, true),
  unrelated,
  blurry: (s) => {
    const inner = pothole(s, false).replace(/^<svg[^>]*>|<\/svg>$/g, '');
    return wrap(`<filter id="bl"><feGaussianBlur stdDeviation="16"/></filter><g filter="url(#bl)">${inner}</g>`);
  },
};

const cache = new Map();

/** Build a data-URI image for a scene kind. */
export function sceneDataUri(kind, seed = 1) {
  const key = `${kind}:${seed}`;
  if (!cache.has(key)) {
    const svg = (BUILDERS[kind] || BUILDERS.unrelated)(seed);
    cache.set(key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  }
  return cache.get(key);
}

/** Turn a stored image reference ("scene:pothole:3" or a data URL) into an <img> src. */
export function resolveImage(ref) {
  if (!ref) return null;
  if (ref.startsWith('scene:')) {
    const [, kind, seed] = ref.split(':');
    return sceneDataUri(kind, Number(seed) || 1);
  }
  return ref;
}

/** Extract the scene kind from a stored image reference, if it is a generated scene. */
export const sceneKindOf = (ref) => (ref?.startsWith('scene:') ? ref.split(':')[1] : null);

export const sceneRef = (kind, seed = 1) => `scene:${kind}:${seed}`;
