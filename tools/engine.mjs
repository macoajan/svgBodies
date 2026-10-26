// Stick-figure exercise engine.
// Body model: sagittal plane (x forward, y down) plus a lateral offset z for the paired
// joints, in viewBox units (ground at y = 60.5). Exercises describe poses through the
// helpers below; the renderer turns sampled poses into self-contained animated SVGs
// (side and front view) using the eap-web method: inline SVG + CSS @keyframes.

export const A = 28;                 // side view: ankle x
export const MF = A + 2;             // midfoot x
export const GROUND = 60.5;
export const ANKLE_Y = 58;
export const L = { shin: 13.5, thigh: 13.5, sh: 15, neck: 19, head: 5, upper: 11.5, fore: 9.5 };
export const Z = { hip: 4, shoulder: 7.5 };
export const HEAD_R = 4.5;
export const PLATE = { r: 6.5, w: 2.2 };
export const BAR_FLOOR = GROUND - 0.6 - PLATE.w / 2 - PLATE.r; // bar height with plates on the floor
export const KB = { bell: 7.2, r: 4.2 };                        // kettlebell: bell centre below the grip, radius

export const rad = d => d * Math.PI / 180;
export const deg = r => r * 180 / Math.PI;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = t => Math.min(1, Math.max(0, t));
export const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const smoother = t => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const bump = t => Math.sin(Math.PI * clamp01(t));

export const V = (x, y, z = 0) => ({ x, y, z });
const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, k) => V(a.x * k, a.y * k, a.z * k);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = a => Math.sqrt(dot(a, a));
const unit = a => mul(a, 1 / len(a));
export const vlerp = (a, b, t) => V(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));

// ---------- Pose helpers ----------

// Angles in degrees from vertical; positive = upper end towards +x (the figure faces right).
// Knees open sideways in proportion to knee flexion (full `out` at 120 degrees).
export function legs({ shin = 0, thigh = 0, stance = 5, out = 2 }) {
  const ankle = V(A, ANKLE_Y, stance);
  const flex = clamp01((shin - thigh) / 120);
  const knee = V(A + L.shin * Math.sin(rad(shin)), ANKLE_Y - L.shin * Math.cos(rad(shin)), stance + out * flex);
  const hip = V(knee.x + L.thigh * Math.sin(rad(thigh)), knee.y - L.thigh * Math.cos(rad(thigh)), Z.hip);
  return { ankle, knee, hip };
}

// Trunk from the hip at `alpha` degrees of forward lean; `neck` rotates the head relative to it.
// at(along, front) gives a point on the trunk: `along` from the hip, `front` towards the chest.
export function trunk(hip, alpha, neck = 0) {
  const s = Math.sin(rad(alpha)), c = Math.cos(rad(alpha));
  const at = (along, front = 0) => V(hip.x + along * s + front * c, hip.y - along * c + front * s, 0);
  const shoulder = { ...at(L.sh), z: Z.shoulder };
  const neckTop = at(L.neck);
  const h = rad(alpha + neck);
  const head = V(neckTop.x + L.head * Math.sin(h), neckTop.y - L.head * Math.cos(h), 0);
  return { alpha, shoulder, neckTop, head, at };
}

// Sagittal reach of a straight arm whose hand sits at lateral offset handZ.
export const reach = handZ => Math.sqrt((L.upper + L.fore) ** 2 - (handZ - Z.shoulder) ** 2);

// Straight arm at `phi` degrees from hanging (positive = forward, 90 = horizontal, 180 = overhead).
export function straight(S, phi, handZ) {
  const R = reach(handZ) - 1e-6;
  return V(S.x + R * Math.sin(rad(phi)), S.y + R * Math.cos(rad(phi)), handZ);
}

// Two-bone IK: elbow on the circle of solutions, on the side the pole vector points to.
export function elbowIK(S, H, pole) {
  const a = L.upper, b = L.fore;
  const d = sub(H, S);
  let dist = len(d);
  if (dist > a + b + 0.05) throw new Error(`hand out of reach (${dist.toFixed(2)})`);
  dist = Math.min(dist, a + b);
  const u = unit(d);
  const x = (a * a - b * b + dist * dist) / (2 * dist);
  const r = Math.sqrt(Math.max(0, a * a - x * x));
  let p = sub(pole, mul(u, dot(pole, u)));
  if (len(p) < 1e-9) p = V(0, 1, 0);
  return add(add(S, mul(u, x)), mul(unit(p), r));
}

// objects: [{ type: 'barbell' | 'kb', at: V, phi?: deg (kettlebell hang angle), layer: 'front' | 'back' | 'behind' }]
// load: { m: mass as a fraction of body mass, x } for the balance solver.
export function pose({ legs: lg, trunk: t, hand, pole = V(0, 1, 0.3), objects = [], load = null }) {
  const elbow = elbowIK(t.shoulder, hand, pole);
  return { ...lg, alpha: t.alpha, shoulder: t.shoulder, neckTop: t.neckTop, head: t.head, elbow, hand, objects, load };
}

// Segment mass fractions (both sides together for paired segments), anthropometric tables.
const M = { head: 0.081, trunk: 0.497, upper: 0.056, fore: 0.044, thigh: 0.2, shin: 0.093, foot: 0.029 };
export function com(p) {
  let m = 0, x = 0;
  const acc = (mm, px) => { m += mm; x += mm * px; };
  acc(M.head, p.head.x);
  acc(M.trunk, (p.hip.x + p.shoulder.x) / 2);
  acc(M.upper, (p.shoulder.x + p.elbow.x) / 2);
  acc(M.fore, (p.elbow.x + p.hand.x) / 2);
  acc(M.thigh, (p.hip.x + p.knee.x) / 2);
  acc(M.shin, (p.knee.x + p.ankle.x) / 2);
  acc(M.foot, MF);
  if (p.load) acc(p.load.m, p.load.x);
  return x / m;
}

// Balance target: centre of mass of the upright, unloaded stance, so standing poses stay vertical.
let neutralCom = null;
function standingCom() {
  if (neutralCom === null) {
    const lg = legs({});
    const t = trunk(lg.hip, 0);
    neutralCom = com(pose({ legs: lg, trunk: t, hand: straight(t.shoulder, 0, Z.shoulder) }));
  }
  return neutralCom;
}

// Finds the trunk lean that keeps the centre of mass (body + load) over the standing balance point.
export function balance(build, lo = -25, hi = 100, target = standingCom()) {
  const f = a => com(build(a)) - target;
  if (f(lo) > 0) return build(lo);
  if (f(hi) < 0) return build(hi);
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid; else lo = mid;
  }
  return build((lo + hi) / 2);
}

// ---------- Sampling and validation ----------

const PER_MOVE = 12;   // samples per moving phase

export function sample(ex) {
  const T = ex.phases.reduce((s, p) => s + p.dur, 0);
  const out = [];
  let t0 = 0;
  for (const ph of ex.phases) {
    const n = ph.hold ? 1 : PER_MOVE;
    const ease = ph.ease || smoother;
    for (let k = 0; k < n; k++) out.push({ t: t0 + ph.dur * k / n, p: ph.pose(ease(k / n)) });
    t0 += ph.dur;
  }
  out.push({ t: T, p: out[0].p });
  // Phase boundaries must join: end of each phase == start of the next.
  t0 = 0;
  ex.phases.forEach((ph, i) => {
    const next = ex.phases[(i + 1) % ex.phases.length];
    const a = ph.pose(1), b = next.pose(0);
    for (const j of ['knee', 'hip', 'shoulder', 'head', 'elbow', 'hand']) {
      const d = len(sub(a[j], b[j]));
      if (d > 0.05) throw new Error(`${ex.id}: phase ${i}→${(i + 1) % ex.phases.length} jumps at ${j} (${d.toFixed(2)})`);
    }
  });
  return { T, frames: out };
}

export function validate(ex, frames) {
  const near = (a, b, what) => { if (Math.abs(a - b) > 0.06 || Number.isNaN(a)) throw new Error(`${ex.id}: ${what} ${a.toFixed(3)} != ${b}`); };
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const { t, p } of frames) {
    near(d2(p.ankle, p.knee), L.shin, `shin @${t.toFixed(2)}`);
    near(d2(p.knee, p.hip), L.thigh, `thigh @${t.toFixed(2)}`);
    near(d2(p.hip, p.shoulder), L.sh, `trunk @${t.toFixed(2)}`);
    near(len(sub(p.shoulder, p.elbow)), L.upper, `upper arm @${t.toFixed(2)}`);
    near(len(sub(p.elbow, p.hand)), L.fore, `forearm @${t.toFixed(2)}`);
    for (const j of ['knee', 'hip', 'shoulder', 'head', 'elbow', 'hand'])
      if (p[j].y > ANKLE_Y + 0.01) throw new Error(`${ex.id}: ${j} below the ankles @${t.toFixed(2)}`);
    for (const o of p.objects) {
      const bottom = o.type === 'barbell' ? o.at.y + PLATE.r + PLATE.w / 2
        : o.at.y + (KB.bell + KB.r) * Math.cos(rad(o.phi || 0));
      if (bottom > GROUND - 0.5) throw new Error(`${ex.id}: ${o.type} goes through the floor @${t.toFixed(2)}`);
    }
  }
}

// ---------- Rendering ----------

export const INK = '#C2410C', IRON = '#0F2A3D', FLOOR = '#AEB8C1';
const VIEWBOX = '-7 -15 78 78';
const r1 = v => (Math.abs(v) < 0.05 ? 0 : +v.toFixed(1));
const r2 = v => +v.toFixed(2);

// A segment is drawn from (0,0) to (0,L0); translate(P) rotate(θ) scaleY(|PQ|/L0) puts it on P→Q.
// scaleY only acts along the segment, so stroke width is preserved under foreshortening.
function segParams(P, Q, L0) {
  return { tx: P.x, ty: P.y, rot: deg(Math.atan2(-(Q.x - P.x), Q.y - P.y)), sy: Math.hypot(Q.x - P.x, Q.y - P.y) / L0 };
}

function unwrap(frames) {
  for (let i = 1; i < frames.length; i++) {
    while (frames[i].rot - frames[i - 1].rot > 180) frames[i].rot -= 360;
    while (frames[i].rot - frames[i - 1].rot < -180) frames[i].rot += 360;
  }
}

function fmt(kind, f, useScale) {
  const t = `translate(${r1(f.tx)}px,${r1(f.ty)}px)`;
  if (kind === 'pt') return t;
  return `${t} rotate(${r1(f.rot)}deg)` + (useScale ? ` scaleY(${r2(f.sy)})` : '');
}

// Elements of a view: { key, kind: 'seg'|'pt'|'rot', svg, at(p) -> params }
function sideElements(objs) {
  const P = j => p => ({ x: p[j].x, y: p[j].y });
  const seg = (key, a, b, L0) => ({ key, kind: 'seg', svg: line0(key, L0), at: p => segParams(P(a)(p), P(b)(p), L0) });
  const pt = (key, j, svg) => ({ key, kind: 'pt', svg, at: p => ({ tx: p[j].x, ty: p[j].y }) });
  const obj = (o, i) => o.type === 'barbell'
    ? { key: `o${i}`, kind: 'pt', svg: plateSide(`o${i}`), at: p => ({ tx: p.objects[i].at.x, ty: p.objects[i].at.y }) }
    : { key: `o${i}`, kind: 'rot', svg: kbGlyph(`o${i}`), at: p => ({ tx: p.objects[i].at.x, ty: p.objects[i].at.y, rot: -(p.objects[i].phi || 0) }) };
  const behind = objs.map((o, i) => (o.layer === 'behind' ? obj(o, i) : null)).filter(Boolean);
  const front = objs.map((o, i) => (o.layer !== 'behind' ? obj(o, i) : null)).filter(Boolean);
  return [
    ...behind,
    seg('shin', 'knee', 'ankle', L.shin),
    seg('thigh', 'hip', 'knee', L.thigh),
    seg('trunk', 'neckTop', 'hip', L.neck),
    pt('head', 'head', `<circle class="k-head" r="${HEAD_R}"></circle>`),
    pt('knee', 'knee', jointDot('knee')),
    ...front,
    seg('upper', 'shoulder', 'elbow', L.upper),
    seg('fore', 'elbow', 'hand', L.fore),
    pt('elbow', 'elbow', jointDot('elbow')),
    pt('hand', 'hand', jointDot('hand')),
  ];
}

function frontElements(objs) {
  const C = 32;
  const F = (j, sg) => p => ({ x: C + sg * p[j].z, y: p[j].y });
  const els = [];
  const objEl = (o, i) => o.type === 'barbell'
    ? { key: `o${i}`, kind: 'pt', svg: barFront(`o${i}`), at: p => ({ tx: C, ty: p.objects[i].at.y }) }
    : { key: `o${i}`, kind: 'pt', svg: kbFront(`o${i}`), at: p => ({ tx: C, ty: p.objects[i].at.y + KB.bell * Math.cos(rad(p.objects[i].phi || 0)) }) };
  for (const [s, sg] of [['r', -1], ['l', 1]]) {
    els.push({ key: `shin-${s}`, kind: 'seg', svg: line0(`shin-${s}`, L.shin), at: p => segParams(F('knee', sg)(p), F('ankle', sg)(p), L.shin) });
    els.push({ key: `thigh-${s}`, kind: 'seg', svg: line0(`thigh-${s}`, L.thigh), at: p => segParams(F('hip', sg)(p), F('knee', sg)(p), L.thigh) });
    els.push({ key: `knee-${s}`, kind: 'pt', svg: jointDot(`knee-${s}`), at: p => ({ tx: F('knee', sg)(p).x, ty: p.knee.y }) });
  }
  els.push({ key: 'pelvis', kind: 'pt', svg: `<line class="k-pelvis" x1="${-Z.hip}" y1="0" x2="${Z.hip}" y2="0"></line>`, at: p => ({ tx: C, ty: p.hip.y }) });
  objs.forEach((o, i) => { if (o.layer === 'back') els.push(objEl(o, i)); });
  els.push({ key: 'spine', kind: 'seg', svg: line0('spine', L.neck), at: p => segParams({ x: C, y: p.neckTop.y }, { x: C, y: p.hip.y }, L.neck) });
  els.push({ key: 'shoulders', kind: 'pt', svg: `<line class="k-shoulders" x1="${-Z.shoulder}" y1="0" x2="${Z.shoulder}" y2="0"></line>`, at: p => ({ tx: C, ty: p.shoulder.y }) });
  els.push({ key: 'head', kind: 'pt', svg: `<circle class="k-head" r="${HEAD_R}"></circle>`, at: p => ({ tx: C, ty: p.head.y }) });
  objs.forEach((o, i) => { if (o.layer !== 'back') els.push(objEl(o, i)); });
  for (const [s, sg] of [['r', -1], ['l', 1]]) {
    els.push({ key: `upper-${s}`, kind: 'seg', svg: line0(`upper-${s}`, L.upper), at: p => segParams(F('shoulder', sg)(p), F('elbow', sg)(p), L.upper) });
    els.push({ key: `fore-${s}`, kind: 'seg', svg: line0(`fore-${s}`, L.fore), at: p => segParams(F('elbow', sg)(p), F('hand', sg)(p), L.fore) });
    els.push({ key: `elbow-${s}`, kind: 'pt', svg: jointDot(`elbow-${s}`), at: p => ({ tx: F('elbow', sg)(p).x, ty: p.elbow.y }) });
    els.push({ key: `hand-${s}`, kind: 'pt', svg: jointDot(`hand-${s}`), at: p => ({ tx: F('hand', sg)(p).x, ty: p.hand.y }) });
  }
  return els;
}

const line0 = (key, L0) => `<line class="k-${key}" x1="0" y1="0" x2="0" y2="${L0}"></line>`;
const jointDot = key => `<circle class="k-${key}" r="1.7" fill="${INK}" stroke="none"></circle>`;
const plateSide = key => `<g class="k-${key}" stroke="${IRON}"><circle r="${PLATE.r}" stroke-width="${PLATE.w}"></circle><circle r="1.4" fill="${IRON}" stroke="none"></circle></g>`;
// Front view: the bell is a sphere (round from any angle); the handle is hidden behind the hands.
const kbFront = key => `<circle class="k-${key}" r="${KB.r}" fill="${IRON}" stroke="none"></circle>`;
const kbGlyph = key => `<g class="k-${key}"><path d="M-2.8 3 C-2.8 -1.4 2.8 -1.4 2.8 3" stroke="${IRON}" stroke-width="1.8"></path><circle cy="${KB.bell}" r="${KB.r}" fill="${IRON}" stroke="none"></circle></g>`;
function barFront(key) {
  const h = 2 * PLATE.r + PLATE.w;
  return `<g class="k-${key}"><line x1="-30" y1="0" x2="30" y2="0" stroke="${IRON}" stroke-width="2"></line>`
    + `<rect x="-27" y="${-h / 2}" width="3.6" height="${h}" rx="0.8" fill="${IRON}" stroke="none"></rect>`
    + `<rect x="23.4" y="${-h / 2}" width="3.6" height="${h}" rx="0.8" fill="${IRON}" stroke="none"></rect>`
    + `<line x1="-21" y1="-2.4" x2="-21" y2="2.4" stroke="${IRON}" stroke-width="1.6"></line>`
    + `<line x1="21" y1="-2.4" x2="21" y2="2.4" stroke="${IRON}" stroke-width="1.6"></line></g>`;
}

export function renderView(ex, view, { T, frames }, size) {
  const cls = `ex-${ex.id}-${view}`;
  const p0 = frames[0].p;
  const els = view === 'side' ? sideElements(p0.objects) : frontElements(p0.objects);
  const stillIdx = Math.max(0, frames.findIndex(f => f.t >= (ex.still || 0) - 1e-9));
  let css = `.${cls} *{transform-box:view-box;transform-origin:0 0}\n`;
  for (const el of els) {
    const fr = frames.map(f => el.at(f.p));
    if (el.kind === 'seg' || el.kind === 'rot') unwrap(fr);
    const useScale = el.kind === 'seg' && fr.some(f => Math.abs(f.sy - 1) > 0.005);
    const strs = fr.map(f => fmt(el.kind, f, useScale));
    const sel = `.${cls} .k-${el.key}`;
    if (strs.every(s => s === strs[0])) { css += `${sel}{transform:${strs[0]}}\n`; continue; }
    const kf = [];
    strs.forEach((s, i) => {
      // Drop keyframes identical to both neighbours (holds).
      if (i > 0 && i < strs.length - 1 && s === strs[i - 1] && s === strs[i + 1]) return;
      kf.push(`${r2(100 * frames[i].t / T)}%{transform:${s}}`);
    });
    const name = `${ex.id}-${view}-${el.key}`;
    css += `${sel}{transform:${strs[stillIdx]};animation:${name} ${r2(T)}s linear infinite}\n@keyframes ${name}{${kf.join('')}}\n`;
  }
  css += `@media (prefers-reduced-motion: reduce){.${cls} *{animation:none !important}}`;

  const ground = `<line x1="-7" y1="${GROUND}" x2="71" y2="${GROUND}" stroke="${FLOOR}" stroke-width="1.2"></line>`;
  const stance = p0.ankle.z;
  const feet = view === 'side'
    ? `<line x1="${A - 2}" y1="${ANKLE_Y}" x2="${A + 6}" y2="${ANKLE_Y}"></line>`
    : [-1, 1].map(sg => `<line x1="${32 + sg * (stance - 1.2)}" y1="${ANKLE_Y}" x2="${32 + sg * (stance + 1.8)}" y2="${ANKLE_Y}"></line>`).join('');
  const title = `${ex.name} — vista ${view === 'side' ? 'lateral' : 'frontal'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="ex ${cls}" width="${size}" height="${size}" viewBox="${VIEWBOX}" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${title}"><title>${title}</title><style>\n${css}\n</style>${ground}${feet}${els.map(e => e.svg).join('')}</svg>`;
}

// Pose data for native renderers: 3D joints of the right side (mirror z for the left).
export function poseData(ex, { T, frames }) {
  const r = v => ({ x: r2(v.x), y: r2(v.y), z: r2(v.z) });
  const J = ['ankle', 'knee', 'hip', 'shoulder', 'neckTop', 'head', 'elbow', 'hand'];
  return {
    id: ex.id, name: ex.name, duration: r2(T),
    frames: frames.map(({ t, p }) => ({
      t: r2(t), joints: Object.fromEntries(J.map(j => [j, r(p[j])])),
      objects: p.objects.map(o => ({ type: o.type, at: r(o.at), ...(o.phi !== undefined ? { phi: r2(o.phi) } : {}), layer: o.layer })),
    })),
  };
}
