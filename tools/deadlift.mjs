// Generates deadlift/index.html: two stick figures (side and front view) doing a
// conventional deadlift, rigged like the eap-web figures (nested <g> + CSS keyframes).
// The pose at each keyframe comes from a small IK solve so the bar path stays vertical.
// Usage: node tools/deadlift.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'deadlift', 'index.html');

// ---------- Body (viewBox 64x64, ground at y=60.5, rest pose = lockout, standing straight) ----------
const A = 28;                       // side view: ankle x
const Y = { ankle: 58, knee: 44.5, hip: 31, shoulder: 16, neck: 12, head: 7 };
const L = { shin: 13.5, thigh: 13.5, torso: 15, arm: 21, neck: 19, head: 24 }; // neck/head measured from hip
const HEAD_R = 4.5;
const PLATE_R = 6.5, PLATE_W = 2.2, GROUND = 60.5;
const BAR_X = A + 3;                                    // over midfoot, touching the shins
const BAR0 = GROUND - 0.6 - PLATE_W / 2 - PLATE_R;      // plates resting on the floor
const BAR1 = Y.shoulder + Math.sqrt(L.arm ** 2 - (BAR_X - A) ** 2); // lockout: hands at mid-thigh

// Front view x positions (centre 32); rest = lockout.
const F = { ankle: 5, knee: 5, kneeOut: 1.8, hip: 4, shoulder: 7.5, hand: 9.5 };

// ---------- Kinematics ----------
const deg = r => r * 180 / Math.PI;
const rad = d => d * Math.PI / 180;
const sm = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);

// u: 0 = bar on the floor, 1 = lockout.
function pose(u) {
  const h = BAR0 + (BAR1 - BAR0) * u;
  // Knees travel back until the bar clears them, then the hips finish the lift.
  const shinDeg = u < 0.35 ? 22 - 15 * sm(u / 0.35) : 7 * (1 - sm((u - 0.35) / 0.65));
  // Shoulders slightly ahead of the bar off the floor, behind it at lockout.
  const d = u < 0.35 ? 1.5 : 1.5 - 4.5 * sm((u - 0.35) / 0.65);
  const ts = rad(shinDeg);
  const knee = { x: A + L.shin * Math.sin(ts), y: Y.ankle - L.shin * Math.cos(ts) };
  const sh = { x: BAR_X + d, y: h - Math.sqrt(L.arm ** 2 - d * d) };
  // Hip: intersection of circle(knee, thigh) and circle(shoulder, torso), the one behind.
  const dx = sh.x - knee.x, dy = sh.y - knee.y, dist = Math.hypot(dx, dy);
  const a = (dist * dist + L.thigh ** 2 - L.torso ** 2) / (2 * dist);
  const off = Math.sqrt(Math.max(0, L.thigh ** 2 - a * a));
  const mx = knee.x + a * dx / dist, my = knee.y + a * dy / dist;
  const c1 = { x: mx - off * dy / dist, y: my + off * dx / dist };
  const c2 = { x: mx + off * dy / dist, y: my - off * dx / dist };
  const hip = c1.x < c2.x ? c1 : c2;
  // Absolute angles from vertical, positive = far end towards +x (facing right).
  const aShin = shinDeg;
  const aThigh = deg(Math.atan2(hip.x - knee.x, knee.y - hip.y));
  const aTorso = deg(Math.atan2(sh.x - hip.x, hip.y - sh.y));
  const aArm = deg(Math.atan2(sh.x - BAR_X, h - sh.y)); // hanging segment: rotate(θ) maps (0,1) to (-sinθ, cosθ)
  const ct = Math.cos(rad(aTorso));
  return {
    u, h, knee, hip, sh, shinDeg,
    rot: { shin: aShin, thigh: aThigh - aShin, torso: aTorso - aThigh, arm: aArm - aTorso },
    neckY: hip.y - L.neck * ct, headY: hip.y - L.head * ct,
  };
}

// Forward-kinematics check: the hand must land on the bar.
for (const u of [0, 0.25, 0.5, 0.75, 1]) {
  const p = pose(u);
  const t = rad(p.rot.shin + p.rot.thigh + p.rot.torso);
  const hx = p.sh.x - L.arm * Math.sin(rad(p.rot.shin + p.rot.thigh + p.rot.torso + p.rot.arm));
  const hy = p.sh.y + L.arm * Math.cos(rad(p.rot.shin + p.rot.thigh + p.rot.torso + p.rot.arm));
  const fkSh = { x: p.hip.x + L.torso * Math.sin(t), y: p.hip.y - L.torso * Math.cos(t) };
  const err = Math.hypot(hx - BAR_X, hy - p.h) + Math.hypot(fkSh.x - p.sh.x, fkSh.y - p.sh.y);
  if (err > 1e-6 || Number.isNaN(err)) throw new Error(`IK mismatch at u=${u}: ${err}`);
}

// ---------- Timeline (seconds) ----------
const T = 4.4;
const PHASES = [            // [start, end, u0, u1]
  [0.0, 0.5, 0, 0],         // set-up on the floor
  [0.5, 1.8, 0, 1],         // pull
  [1.8, 2.5, 1, 1],         // lockout
  [2.5, 3.9, 1, 0],         // lower, controlled
  [3.9, T, 0, 0],           // bar touches the floor
];
const N = 16;
const samples = [];
for (const [t0, t1, u0, u1] of PHASES) {
  const n = u0 === u1 ? 1 : N;
  for (let k = 0; k < n; k++) {
    const f = k / n;
    samples.push({ t: t0 + (t1 - t0) * f, u: u0 + (u1 - u0) * smoother(f) });
  }
}
samples.push({ t: T, u: 0 });

// ---------- Transforms ----------
const n2 = v => (Math.abs(v) < 0.005 ? 0 : +v.toFixed(2));
const rot = a => `rotate(${n2(a)}deg)`;
const tr = (x, y) => `translate(${n2(x)}px,${n2(y)}px)`;
// Segment drawn from P0 (top) to Q0 (bottom) at rest, shown from P to Q:
// translate(P-P0) skewX(a) scaleY(s) around P0 maps (Q0-P0) onto (Q-P).
function seg(P0, Q0, P, Q) {
  const vx0 = Q0.x - P0.x, vy0 = Q0.y - P0.y, vx = Q.x - P.x, vy = Q.y - P.y;
  const s = vy / vy0, a = deg(Math.atan((vx - vx0) / vy));
  return `${tr(P.x - P0.x, P.y - P0.y)} skewX(${n2(a)}deg) scaleY(${(+s.toFixed(3))})`;
}

const front = p => {
  const kx = F.knee + F.kneeOut * p.shinDeg / 22;
  const pt = (x, y) => ({ x, y });
  const out = {};
  for (const [side, sg] of [['l', -1], ['r', 1]]) {
    const ankle = pt(32 + sg * F.ankle, Y.ankle);
    const knee0 = pt(32 + sg * F.knee, Y.knee), knee = pt(32 + sg * kx, p.knee.y);
    const hip0 = pt(32 + sg * F.hip, Y.hip), hip = pt(32 + sg * F.hip, p.hip.y);
    const sh0 = pt(32 + sg * F.shoulder, Y.shoulder), sh = pt(32 + sg * F.shoulder, p.sh.y);
    const hand0 = pt(32 + sg * F.hand, BAR1), hand = pt(32 + sg * F.hand, p.h);
    out[`shin-${side}`] = seg(knee0, ankle, knee, ankle);
    out[`thigh-${side}`] = seg(hip0, knee0, hip, knee);
    out[`arm-${side}`] = seg(sh0, hand0, sh, hand);
    out[`knee-${side}`] = tr(knee.x - knee0.x, knee.y - knee0.y);
  }
  out.spine = seg(pt(32, Y.neck), pt(32, Y.hip), pt(32, p.neckY), pt(32, p.hip.y));
  out.pelvis = tr(0, p.hip.y - Y.hip);
  out.shoulders = tr(0, p.sh.y - Y.shoulder);
  out.head = tr(0, p.headY - Y.head);
  out.bar = tr(0, p.h - BAR1);
  return out;
};
const side = p => ({ shin: rot(p.rot.shin), thigh: rot(p.rot.thigh), torso: rot(p.rot.torso), arm: rot(p.rot.arm) });

function css(prefix, fn, origins) {
  const frames = samples.map(s => ({ pct: +(100 * s.t / T).toFixed(2), tf: fn(pose(s.u)) }));
  const lock = fn(pose(1));
  let out = '';
  for (const key of Object.keys(lock)) {
    const sel = `.dl.${prefix} .${key}`;
    const o = origins[key] ? `transform-origin:${origins[key][0]}px ${origins[key][1]}px;` : '';
    out += `${sel}{${o}transform:${lock[key]};animation:dl-${prefix}-${key} ${T}s linear infinite}\n`;
    out += `@keyframes dl-${prefix}-${key}{${frames.map(f => `${f.pct}%{transform:${f.tf[key]}}`).join('')}}\n`;
  }
  return out;
}

const sideCss = css('side', side, {
  shin: [A, Y.ankle], thigh: [A, Y.knee], torso: [A, Y.hip], arm: [A, Y.shoulder],
});
const frontOrigins = {};
for (const [s, sg] of [['l', -1], ['r', 1]]) {
  frontOrigins[`shin-${s}`] = [32 + sg * F.knee, Y.knee];
  frontOrigins[`thigh-${s}`] = [32 + sg * F.hip, Y.hip];
  frontOrigins[`arm-${s}`] = [32 + sg * F.shoulder, Y.shoulder];
}
frontOrigins.spine = [32, Y.neck];
const frontCss = css('front', front, frontOrigins);

// ---------- SVG ----------
const INK = '#C2410C', IRON = '#0F2A3D', FLOOR = '#AEB8C1';
const svgOpen = (cls, size) =>
  `<svg class="dl ${cls}" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;
const ground = `<line x1="0" y1="${GROUND}" x2="64" y2="${GROUND}" stroke="${FLOOR}" stroke-width="1.2"></line>`;

const sideSvg = size => `${svgOpen('side', size)}${ground}
<line x1="${A - 2}" y1="${Y.ankle}" x2="${A + 6}" y2="${Y.ankle}"></line>
<g class="shin"><line x1="${A}" y1="${Y.ankle}" x2="${A}" y2="${Y.knee}"></line>
<g class="thigh"><line x1="${A}" y1="${Y.knee}" x2="${A}" y2="${Y.hip}"></line>
<g class="torso"><line x1="${A}" y1="${Y.hip}" x2="${A}" y2="${Y.neck}"></line><circle cx="${A}" cy="${Y.head}" r="${HEAD_R}"></circle>
<g class="arm"><g stroke="${IRON}"><circle cx="${A}" cy="${Y.shoulder + L.arm}" r="${PLATE_R}" stroke-width="${PLATE_W}"></circle><circle cx="${A}" cy="${Y.shoulder + L.arm}" r="1.4" fill="${IRON}" stroke="none"></circle></g>
<line x1="${A}" y1="${Y.shoulder}" x2="${A}" y2="${Y.shoulder + L.arm}"></line></g></g></g></g></svg>`;

const x = (sg, v) => 32 + sg * v;
const dot = (cx, cy) => `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="1.7" fill="${INK}" stroke="none"></circle>`;
const frontLimbs = [['l', -1], ['r', 1]].map(([s, sg]) => `
<line class="shin-${s}" x1="${x(sg, F.knee)}" y1="${Y.knee}" x2="${x(sg, F.ankle)}" y2="${Y.ankle}"></line>
<line class="thigh-${s}" x1="${x(sg, F.hip)}" y1="${Y.hip}" x2="${x(sg, F.knee)}" y2="${Y.knee}"></line>
<g class="knee-${s}">${dot(x(sg, F.knee), Y.knee)}</g>
<line x1="${x(sg, F.ankle + 1.5)}" y1="${Y.ankle}" x2="${x(sg, F.ankle - 1.5)}" y2="${Y.ankle}"></line>`).join('');
const frontArms = [['l', -1], ['r', 1]].map(([s, sg]) =>
  `<line class="arm-${s}" x1="${x(sg, F.shoulder)}" y1="${Y.shoulder}" x2="${x(sg, F.hand)}" y2="${n2(BAR1)}"></line>`).join('');
const plate = sg => `<rect x="${n2(sg < 0 ? 5 : 59 - 3.6)}" y="${n2(BAR1 - PLATE_R - PLATE_W / 2)}" width="3.6" height="${n2(2 * PLATE_R + PLATE_W)}" rx="0.8" fill="${IRON}" stroke="none"></rect>`
  + `<line x1="${x(sg, 21)}" y1="${n2(BAR1 - 2.4)}" x2="${x(sg, 21)}" y2="${n2(BAR1 + 2.4)}" stroke="${IRON}" stroke-width="1.6"></line>`;

const frontSvg = size => `${svgOpen('front', size)}${ground}${frontLimbs}
<g class="pelvis"><line x1="${x(-1, F.hip)}" y1="${Y.hip}" x2="${x(1, F.hip)}" y2="${Y.hip}"></line></g>
<line class="spine" x1="32" y1="${Y.neck}" x2="32" y2="${Y.hip}"></line>
<g class="shoulders"><line x1="${x(-1, F.shoulder)}" y1="${Y.shoulder}" x2="${x(1, F.shoulder)}" y2="${Y.shoulder}"></line></g>
<g class="head"><circle cx="32" cy="${Y.head}" r="${HEAD_R}"></circle></g>
${frontArms}
<g class="bar"><line x1="2" y1="${n2(BAR1)}" x2="62" y2="${n2(BAR1)}" stroke="${IRON}" stroke-width="2"></line>${plate(-1)}${plate(1)}${dot(x(-1, F.hand), BAR1)}${dot(x(1, F.hand), BAR1)}</g></svg>`;

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Peso muerto</title>
<style>
:root{--ground:#F3F6F5;--card:#FFFFFF;--ink:#0F2A3D;--muted:#44596B}
body{margin:0;background:var(--ground);color:var(--ink);font-family:system-ui,'Segoe UI',Arial,sans-serif;padding:24px 16px}
main{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:20px}
h1{margin:0;font-size:28px}
p{margin:0;color:var(--muted);line-height:1.4}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.card{background:var(--card);border-radius:18px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:10px}
.card h2{margin:0;font-size:15px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.small{display:flex;gap:16px;align-items:flex-end}
/* --- Rig (generado por tools/deadlift.mjs) --- */
.dl{flex:none;overflow:visible}
.dl g,.dl line{transform-box:view-box}
${sideCss}${frontCss}@media (prefers-reduced-motion: reduce){.dl *{animation:none !important}}
</style>
</head>
<body>
<main>
<h1>Peso muerto</h1>
<p>Monigotes SVG con el mismo método que eap-web: grupos anidados y animación CSS. El ciclo dura ${T} s: preparación, tirón, bloqueo arriba, bajada controlada y apoyo en el suelo.</p>
<div class="cards">
<div class="card"><h2>Lateral</h2>${sideSvg(256)}</div>
<div class="card"><h2>Frontal</h2>${frontSvg(256)}</div>
</div>
<div class="card"><h2>A tamaño de infografía (68 px)</h2><div class="small">${sideSvg(68)}${frontSvg(68)}</div></div>
</main>
</body>
</html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`wrote ${OUT} (${html.length} bytes)`);
