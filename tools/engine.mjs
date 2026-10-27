// Stick-figure exercise engine.
// Body model in viewBox units: x forward, y down, z lateral (right side +z, left side -z).
// Ground at y = 60.5; joints resting on the floor sit on the contact line y = 58.
// Exercises describe poses through the helpers below; the renderer projects the sampled 3D
// poses with a camera per view (side, front, iso) and writes self-contained animated SVGs
// using the eap-web method: inline SVG + CSS @keyframes.

export const A = 28;                 // standing exercises: ankle x
export const MF = A + 2;             // midfoot x
export const GROUND = 60.5;
export const FLOOR_TOP = GROUND - 0.6;
export const ANKLE_Y = 58;           // contact line: centre of a stroke resting on the floor
export const MAX_Y = FLOOR_TOP - 1.7 + 0.05;
export const L = { shin: 13.5, thigh: 13.5, sh: 15, neck: 4, head: 5, upper: 11.5, fore: 9.5, foot: 6, heel: 2 };
export const Z = { hip: 4, shoulder: 7.5 };
export const HEAD_R = 4.5;
export const PLATE = { r: 6.5, w: 2.2 };
export const BAR_FLOOR = GROUND - 0.6 - PLATE.w / 2 - PLATE.r; // bar height with plates on the floor
export const KB = { bell: 7.2, r: 4.2 };                        // kettlebell: bell centre below the grip, radius
export const DB = { half: 4.2, r: 2.6, w: 1.4 };                // dumbbell: half length, head radius, head half-width
// Box props span z in [z0, z1] (default ±hz).
export const boxZ = pr => [pr.z0 ?? -pr.hz, pr.z1 ?? pr.hz];

export const rad = d => d * Math.PI / 180;
export const deg = r => r * 180 / Math.PI;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = t => Math.min(1, Math.max(0, t));
export const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const smoother = t => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const bump = t => Math.sin(Math.PI * clamp01(t));

export const V = (x, y, z = 0) => ({ x, y, z });
export const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a, k) => V(a.x * k, a.y * k, a.z * k);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = a => Math.sqrt(dot(a, a));
const unit = a => mul(a, 1 / len(a));
export const vlerp = (a, b, t) => V(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
export const mirror = q => V(q.x, q.y, -q.z);

// 2D directions in the sagittal plane. up(a): a degrees from straight up, positive = forward.
// down(a): a degrees from hanging, positive = forward. rot2 turns a direction by a degrees
// (positive = clockwise on screen, e.g. from "down" towards "back").
export const up = a => V(Math.sin(rad(a)), -Math.cos(rad(a)));
export const down = a => V(Math.sin(rad(a)), Math.cos(rad(a)));
export const rot2 = (v, a) => V(v.x * Math.cos(rad(a)) - v.y * Math.sin(rad(a)), v.x * Math.sin(rad(a)) + v.y * Math.cos(rad(a)), v.z);
export const along = (P, d, k) => V(P.x + d.x * k, P.y + d.y * k, P.z);

// ---------- Pose helpers ----------

// Standing legs rooted at the ankle. Angles in degrees from vertical; positive = upper end
// forward. Knees open sideways in proportion to knee flexion (full `out` at 120 degrees).
export function legs({ shin = 0, thigh = 0, stance = 5, out = 2 }) {
  const ankle = V(A, ANKLE_Y, stance);
  const flex = clamp01((shin - thigh) / 120);
  const knee = V(A + L.shin * Math.sin(rad(shin)), ANKLE_Y - L.shin * Math.cos(rad(shin)), stance + out * flex);
  const hip = V(knee.x + L.thigh * Math.sin(rad(thigh)), knee.y - L.thigh * Math.cos(rad(thigh)), Z.hip);
  return { ankle, knee, hip };
}

// Foot from the ankle along the 2D direction (dx, dy), toes turned slightly out.
export function foot(ankle, dx, dy, splay = 0.2) {
  const s = Math.sign(ankle.z) || 1;
  return add(ankle, mul(unit(V(dx, dy, s * splay * Math.hypot(dx, dy))), L.foot));
}
export const footFlat = ankle => foot(ankle, 1, 0);
// Foot relative to the shin: plantar 0 = foot at right angles to the shin, positive = pointed.
export function footFromShin(knee, ankle, plantar = 0) {
  const d = rot2(unit(V(ankle.x - knee.x, ankle.y - knee.y)), -90 + plantar);
  return foot(ankle, d.x, d.y);
}

// Trunk from the hip centre at `alpha` degrees of forward lean (90 = face down, -90 = face up).
// `neck` turns the head relative to the trunk. neckDir/headDir (absolute, same convention as
// alpha) bend the cervical spine and set the head, e.g. to rest the head on the floor.
// at(along, front) gives a point on the trunk: `along` from the hip, `front` towards the chest.
// shift moves the whole trunk sideways (z); twist turns the shoulders about the trunk axis
// (positive = right shoulder back), e.g. for a woodchop.
export function trunk(hip, alpha, neck = 0, { neckDir = alpha, headDir = null, shift = 0, twist = 0 } = {}) {
  const s = Math.sin(rad(alpha)), c = Math.cos(rad(alpha));
  const at = (al, front = 0) => V(hip.x + al * s + front * c, hip.y - al * c + front * s, shift);
  const pelvis = V(hip.x, hip.y, shift);
  const shoulderC = at(L.sh);
  const neckTop = along(shoulderC, up(neckDir), L.neck);
  const head = along(neckTop, up(headDir ?? neckDir + neck), L.head);
  // Shoulder offset turned about the trunk axis u = (s, -c, 0): cos·z + sin·(u × z).
  const shoulderOf = sg => V(shoulderC.x - sg * Z.shoulder * Math.sin(rad(twist)) * c, shoulderC.y - sg * Z.shoulder * Math.sin(rad(twist)) * s,
    shift + sg * Z.shoulder * Math.cos(rad(twist)));
  return { alpha, pelvis, shoulderC, shoulder: shoulderOf(1), shoulderOf, neckTop, head, at, shift, twist };
}

// Sagittal reach of a straight arm whose hand sits at lateral offset handZ.
export const reach = handZ => Math.sqrt((L.upper + L.fore) ** 2 - (Math.abs(handZ) - Z.shoulder) ** 2);

// Straight arm at `phi` degrees from hanging (positive = forward, 90 = horizontal, 180 = overhead).
export function straight(S, phi, handZ) {
  const R = reach(handZ) - 1e-6;
  return V(S.x + R * Math.sin(rad(phi)), S.y + R * Math.cos(rad(phi)), handZ);
}

// Two-bone IK: middle joint on the circle of solutions, on the side the pole vector points to.
export function twoBone(root, end, a, b, pole, what = 'limb') {
  const d = sub(end, root);
  let dist = len(d);
  if (dist > a + b + 0.05) throw new Error(`${what} out of reach (${dist.toFixed(2)})`);
  dist = Math.min(dist, a + b);
  const u = unit(d);
  const x = (a * a - b * b + dist * dist) / (2 * dist);
  const r = Math.sqrt(Math.max(0, a * a - x * x));
  let p = sub(pole, mul(u, dot(pole, u)));
  if (len(p) < 1e-9) p = V(0, 1, 0);
  return add(add(root, mul(u, x)), mul(unit(p), r));
}
export const elbowIK = (S, H, pole) => twoBone(S, H, L.upper, L.fore, pole, 'hand');
export const kneeIK = (hip, ankle, pole) => twoBone(hip, ankle, L.thigh, L.shin, pole, 'foot');

// Intersections of two circles in the sagittal plane (z taken from P).
export function circles(P, rP, Q, rQ) {
  const dx = Q.x - P.x, dy = Q.y - P.y, dist = Math.hypot(dx, dy);
  const a = (dist * dist + rP * rP - rQ * rQ) / (2 * dist);
  const off = Math.sqrt(Math.max(0, rP * rP - a * a));
  const mx = P.x + a * dx / dist, my = P.y + a * dy / dist;
  return [V(mx - off * dy / dist, my + off * dx / dist, P.z), V(mx + off * dy / dist, my - off * dx / dist, P.z)];
}

// One side of the body. Hip and shoulder come from the trunk; the caller gives knee, ankle,
// toe and hand, and either the elbow or a pole vector for the elbow IK. z of the given
// joints must already carry the side's sign.
function limbs(t, sg, { knee, ankle, toe, hand, elbow, pole }) {
  const hip = V(t.pelvis.x, t.pelvis.y, t.pelvis.z + sg * Z.hip);
  const shoulder = t.shoulderOf(sg);
  return { hip, knee, ankle, toe, shoulder, elbow: elbow ?? elbowIK(shoulder, hand, pole ?? V(0, 1, 0.3 * sg)), hand };
}
export const mirrorSide = s => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v && typeof v === 'object' ? mirror(v) : v]));

// General pose: right side `r`, left side `l` (left joints with negative z).
// objects: [{ type: 'barbell' | 'kb', at: V, phi?: deg (kettlebell hang angle) }]
// load: { m: mass as a fraction of body mass, x } for the balance solver.
export function poseLR({ trunk: t, r, l, objects = [], load = null }) {
  return {
    alpha: t.alpha, pelvis: t.pelvis, shoulderC: t.shoulderC, neckTop: t.neckTop, head: t.head,
    r: limbs(t, 1, r), l: limbs(t, -1, l), objects, load,
  };
}

// Symmetric standing pose (batch A): legs from legs(), left side mirrored.
export function pose({ legs: lg, trunk: t, hand, pole = V(0, 1, 0.3), objects = [], load = null }) {
  const r = { knee: lg.knee, ankle: lg.ankle, toe: footFlat(lg.ankle), hand, pole };
  return { ...poseLR({ trunk: t, r, l: mirrorSide(r), objects, load }), upright: true };
}

// Applies f to every point of a pose (joints and objects): rigid moves such as rolling the body
// onto its side. The caller keeps f rigid so segment lengths are preserved.
export function transformPose(p, f) {
  const side = q => Object.fromEntries(Object.entries(q).map(([k, v]) => [k, f(v)]));
  const obj = o => ({ ...o, ...(o.at ? { at: f(o.at) } : {}), ...(o.a ? { a: f(o.a), b: f(o.b) } : {}), ...(o.points ? { points: o.points.map(f) } : {}) });
  return { ...p, pelvis: f(p.pelvis), shoulderC: f(p.shoulderC), neckTop: f(p.neckTop), head: f(p.head), r: side(p.r), l: side(p.l), objects: p.objects.map(obj) };
}
// Rotation about an axis parallel to x (roll) or z (in the sagittal plane), through point c.
export const rollX = (deg_, c) => q => {
  const a = rad(deg_), y = q.y - c.y, z = q.z - c.z;
  return V(q.x, c.y + y * Math.cos(a) - z * Math.sin(a), c.z + y * Math.sin(a) + z * Math.cos(a));
};
export const rotZ = (deg_, c) => q => { const r = rot2(V(q.x - c.x, q.y - c.y), deg_); return V(c.x + r.x, c.y + r.y, q.z); };

// Segment mass fractions (both sides together for paired segments), anthropometric tables.
const M = { head: 0.081, trunk: 0.497, upper: 0.056, fore: 0.044, thigh: 0.2, shin: 0.093, foot: 0.029 };
export function com(p) {
  let m = 0, x = 0;
  const acc = (mm, a, b = a) => { m += mm; x += mm * (a.x + b.x) / 2; };
  acc(M.head, p.head);
  acc(M.trunk, p.pelvis, p.shoulderC);
  for (const s of [p.r, p.l]) {
    acc(M.upper / 2, s.shoulder, s.elbow);
    acc(M.fore / 2, s.elbow, s.hand);
    acc(M.thigh / 2, s.hip, s.knee);
    acc(M.shin / 2, s.knee, s.ankle);
    acc(M.foot / 2, s.ankle, s.toe);
  }
  if (p.load) { m += p.load.m; x += p.load.m * p.load.x; }
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

// Root finding for monotone f on [lo, hi] (bisection).
export function solve(f, lo, hi) {
  const flo = f(lo);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if ((f(mid) > 0) === (flo > 0)) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------- Sampling and validation ----------

const PER_MOVE = 12;   // samples per moving phase
const SIDE_J = ['hip', 'knee', 'ankle', 'toe', 'shoulder', 'elbow', 'hand'];

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
  ex.phases.forEach((ph, i) => {
    const next = ex.phases[(i + 1) % ex.phases.length];
    const a = ph.pose(1), b = next.pose(0);
    const pairs = [['head', a.head, b.head], ...['r', 'l'].flatMap(s => SIDE_J.map(j => [`${s}.${j}`, a[s][j], b[s][j]]))];
    for (const [j, qa, qb] of pairs) {
      const d = len(sub(qa, qb));
      if (d > 0.05) throw new Error(`${ex.id}: phase ${i}→${(i + 1) % ex.phases.length} jumps at ${j} (${d.toFixed(2)})`);
    }
  });
  return { T, frames: out };
}

export function validate(ex, frames) {
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // Segment length is checked in 3D, or in the sagittal plane for legs placed with legs().
  const seg = (a, b, Lx, what, t) => {
    const l3 = len(sub(a, b)), l2 = d2(a, b);
    if (!(Math.abs(l3 - Lx) < 0.06 || Math.abs(l2 - Lx) < 0.06))
      throw new Error(`${ex.id}: ${what} ${l3.toFixed(3)} != ${Lx} @${t.toFixed(2)}`);
  };
  for (const { t, p } of frames) {
    seg(p.pelvis, p.shoulderC, L.sh, 'trunk', t);
    seg(p.shoulderC, p.neckTop, L.neck, 'neck', t);
    seg(p.neckTop, p.head, L.head, 'head', t);
    for (const s of ['r', 'l']) {
      const q = p[s];
      seg(q.hip, q.knee, L.thigh, `${s} thigh`, t);
      seg(q.knee, q.ankle, L.shin, `${s} shin`, t);
      seg(q.ankle, q.toe, L.foot, `${s} foot`, t);
      seg(q.shoulder, q.elbow, L.upper, `${s} upper arm`, t);
      seg(q.elbow, q.hand, L.fore, `${s} forearm`, t);
      for (const j of SIDE_J) if (q[j].y > MAX_Y) throw new Error(`${ex.id}: ${s}.${j} below the floor @${t.toFixed(2)}`);
    }
    if (p.neckTop.y > MAX_Y) throw new Error(`${ex.id}: neck below the floor @${t.toFixed(2)}`);
    if (p.head.y + HEAD_R + 1.7 > FLOOR_TOP + 0.05) throw new Error(`${ex.id}: head through the floor @${t.toFixed(2)}`);
    if (p.upright && p.pelvis.x > p.r.knee.x + 0.5) throw new Error(`${ex.id}: hip in front of the knee @${t.toFixed(2)}`);
    for (const pr of ex.props || []) {
      if (pr.type !== 'box') continue;
      const [z0, z1] = boxZ(pr);
      for (const s of ['r', 'l']) for (const j of ['knee', 'ankle', 'toe', 'hand']) {
        const q = p[s][j];
        if (q.x > pr.x0 - 0.8 && q.x < pr.x1 + 0.8 && q.y > pr.top - 1.6 && q.z > z0 && q.z < z1)
          throw new Error(`${ex.id}: ${s}.${j} inside the box @${t.toFixed(2)}`);
      }
    }
    for (const o of p.objects) {
      if (o.type === 'rope') {
        const low = Math.max(...o.points.map(q => q.y));
        if (low > FLOOR_TOP - 0.3) throw new Error(`${ex.id}: rope through the floor @${t.toFixed(2)}`);
        continue;
      }
      if (o.type === 'cord') continue;
      if (o.type === 'ball' || o.type === 'wheel' || o.type === 'db') {
        const r0 = o.type === 'db' ? DB.r : o.r;
        if (o.at.y + r0 > FLOOR_TOP + 0.1) throw new Error(`${ex.id}: ${o.type} through the floor @${t.toFixed(2)}`);
        continue;
      }
      const bottom = o.type === 'barbell' ? o.at.y + PLATE.r + PLATE.w / 2
        : o.at.y + (KB.bell + KB.r) * Math.cos(rad(o.phi || 0));
      if (bottom > GROUND - 0.5) throw new Error(`${ex.id}: ${o.type} goes through the floor @${t.toFixed(2)}`);
    }
  }
}

// ---------- Cameras ----------

// Every view is the same projection: the camera turns `yaw` degrees from the figure's right
// side towards its front and rises `pitch` degrees. depth grows towards the viewer.
export const VIEWS = {
  side: { yaw: 0, pitch: 0, cx: 0, cy: ANKLE_Y, centre: false, label: 'lateral' },
  front: { yaw: 90, pitch: 0, cx: 32, cy: ANKLE_Y, centre: false, label: 'frontal' },
  iso: { yaw: 40, pitch: 30, cx: 32, cy: 54, centre: true, label: 'isométrica' },
  top: { yaw: 0, pitch: 90, cx: 0, cy: 24, centre: false, label: 'cenital' },
};
export function camera(view, x0, override = null) {
  const v = { ...VIEWS[view], ...(override || {}) };
  const cyw = Math.cos(rad(v.yaw)), syw = Math.sin(rad(v.yaw)), cp = Math.cos(rad(v.pitch)), sp = Math.sin(rad(v.pitch));
  const ox = v.centre ? x0 : 0;
  const horiz = q => (q.x - ox) * syw + q.z * cyw;
  // Towards the camera: horizontally by the yaw, and upwards as the camera rises.
  const depth = q => horiz(q) * cp + (ANKLE_Y - q.y) * sp;
  const dir = (dx, dy, dz) => ({ x: dx * cyw - dz * syw, y: dy * cp + (dx * syw + dz * cyw) * sp });
  const proj = q => ({ x: v.cx + (q.x - ox) * cyw - q.z * syw, y: v.cy + (q.y - ANKLE_Y) * cp + horiz(q) * sp });
  return { view, depth, dir, proj, yaw: v.yaw, pitch: v.pitch, sideOn: Math.abs(cyw) > 0.99 && v.pitch < 1 };
}

// Horizontal extent of the figure over the cycle (used to centre the iso view and size the floor).
export function extent(frames) {
  let lo = Infinity, hi = -Infinity;
  for (const { p } of frames) for (const s of ['r', 'l']) for (const j of SIDE_J) { lo = Math.min(lo, p[s][j].x); hi = Math.max(hi, p[s][j].x); }
  for (const { p } of frames) { lo = Math.min(lo, p.head.x - HEAD_R); hi = Math.max(hi, p.head.x + HEAD_R); }
  return { lo, hi, mid: (lo + hi) / 2 };
}

// Convex hull (monotone chain) of 2D points.
export function hull(pts) {
  const P = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], hi = [];
  for (const q of P) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of P.reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

// ---------- Rendering ----------

export const INK = '#C2410C', IRON = '#0F2A3D', FLOOR = '#AEB8C1';
const PLATE_FILL = '#DCE4EA', FLOOR_FILL = '#E2EAEF';
const BOX_FILL = { top: '#EEF2F5', side: '#C9D3DB', front: '#DCE4EA' };
const VIEWBOX = '-7 -15 78 78';
const r1 = v => (Math.abs(v) < 0.05 ? 0 : +v.toFixed(1));
const r2 = v => +v.toFixed(2);
const pts = list => list.map(q => `${r2(q.x)},${r2(q.y)}`).join(' ');

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

const line0 = (key, L0, attrs = '') => `<line class="k-${key}" x1="0" y1="0" x2="0" y2="${L0}"${attrs}></line>`;
export const ROPE = { segments: 14, width: 1.3 };
const jointDot = key => `<circle class="k-${key}" r="1.7" fill="${INK}" stroke="none"></circle>`;
const kbBell = key => `<circle class="k-${key}" r="${KB.r}" fill="${IRON}" stroke="none"></circle>`;
const kbGlyph = key => `<g class="k-${key}"><path d="M-2.8 3 C-2.8 -1.4 2.8 -1.4 2.8 3" stroke="${IRON}" stroke-width="1.8"></path><circle cy="${KB.bell}" r="${KB.r}" fill="${IRON}" stroke="none"></circle></g>`;

// Short cylinder along z (radius r, from z0 to z1 relative to its centre): outline = hull of both faces.
function cylinder(cam, r, z0, z1, fill, sw) {
  const outline = [];
  for (const z of [z0, z1]) for (let k = 0; k < 24; k++) {
    const a = k * Math.PI / 12;
    outline.push(cam.dir(r * Math.cos(a), r * Math.sin(a), z));
  }
  return `<polygon points="${pts(hull(outline))}" fill="${fill}" stroke="${IRON}" stroke-width="${sw}"></polygon>`;
}

// Half a barbell (sg = -1 left, 1 right) drawn around the bar centre. The plate is a short
// cylinder: its outline is the hull of both faces, so it keeps its thickness edge-on.
function barHalf(key, cam, sg) {
  const end = cam.dir(0, 0, 30 * sg), outline = [];
  for (const z of [23.4, 27]) for (let k = 0; k < 24; k++) {
    const a = k * Math.PI / 12;
    outline.push(cam.dir(PLATE.r * Math.cos(a), PLATE.r * Math.sin(a), z * sg));
  }
  const hub = cam.dir(0, 0, 27 * sg);
  return `<g class="k-${key}"><line x1="0" y1="0" x2="${r2(end.x)}" y2="${r2(end.y)}" stroke="${IRON}" stroke-width="2"></line>`
    + `<polygon points="${pts(hull(outline))}" fill="${cam.sideOn ? 'none' : PLATE_FILL}" stroke="${IRON}" stroke-width="${PLATE.w}"></polygon>`
    + (cam.sideOn ? `<circle cx="${r2(hub.x)}" cy="${r2(hub.y)}" r="1.4" fill="${IRON}" stroke="none"></circle>` : '') + '</g>';
}

// Static props, drawn behind the figure so contacts (feet on a box, hands on a bar) stay visible.
function propSvg(pr, cam) {
  if (pr.type === 'box') {
    const { x0, x1, top } = pr, [z0, z1] = boxZ(pr), y1 = pr.bottom ?? FLOOR_TOP;
    const P = (x, y, z) => cam.proj(V(x, y, z));
    const faces = [];
    const v = cam;
    const syw = Math.sin(rad(v.yaw)), cyw = Math.cos(rad(v.yaw));
    if (cyw > 0.01) faces.push([BOX_FILL.side, [P(x0, top, z1), P(x1, top, z1), P(x1, y1, z1), P(x0, y1, z1)]]);
    if (syw > 0.01) faces.push([BOX_FILL.front, [P(x1, top, z0), P(x1, top, z1), P(x1, y1, z1), P(x1, y1, z0)]]);
    if (v.pitch > 0.5) faces.push([BOX_FILL.top, [P(x0, top, z0), P(x1, top, z0), P(x1, top, z1), P(x0, top, z1)]]);
    return faces.map(([fill, q]) => `<polygon points="${pts(q)}" fill="${fill}" stroke="${IRON}" stroke-width="1.2"></polygon>`).join('');
  }
  if (pr.type === 'pullbar') {
    const a = cam.proj(V(pr.x, pr.y, -pr.hz)), b = cam.proj(V(pr.x, pr.y, pr.hz)), c = cam.proj(V(pr.x, pr.y, 0));
    return `<line x1="${r2(a.x)}" y1="${r2(a.y)}" x2="${r2(b.x)}" y2="${r2(b.y)}" stroke="${IRON}" stroke-width="2.4"></line>`
      + `<circle cx="${r2(c.x)}" cy="${r2(c.y)}" r="1.6" fill="${IRON}" stroke="none"></circle>`;
  }
  if (pr.type === 'lines') {
    // Static bars and frames: [[from, to], ...] in 3D, painted far to near.
    const segs = pr.segs.map(([a, b]) => [cam.proj(a), cam.proj(b), (cam.depth(a) + cam.depth(b)) / 2]).sort((u, w) => u[2] - w[2]);
    return segs.map(([a, b]) => `<line x1="${r2(a.x)}" y1="${r2(a.y)}" x2="${r2(b.x)}" y2="${r2(b.y)}" stroke="${IRON}" stroke-width="${pr.w ?? 2.4}"></line>`).join('');
  }
  throw new Error(`unknown prop ${pr.type}`);
}

// Elements of a view: { key, kind: 'seg'|'pt'|'rot', svg, at(p) -> params, depth(p) }.
function elements(p0, cam) {
  const els = [];
  const segE = (key, P, Q, L0, attrs = '') => els.push({
    key, kind: 'seg', svg: line0(key, L0, attrs),
    at: p => segParams(cam.proj(P(p)), cam.proj(Q(p)), L0), depth: p => (cam.depth(P(p)) + cam.depth(Q(p))) / 2,
  });
  const ptE = (key, P, svg, bias = 0) => els.push({
    key, kind: 'pt', svg, at: p => { const q = cam.proj(P(p)); return { tx: q.x, ty: q.y }; }, depth: p => cam.depth(P(p)) + bias,
  });
  for (const s of ['l', 'r']) {
    const J = j => p => p[s][j];
    const heel = p => { const a = p[s].ankle; return add(a, mul(sub(a, p[s].toe), L.heel / L.foot)); };
    segE(`foot-${s}`, heel, J('toe'), L.foot + L.heel);
    segE(`shin-${s}`, J('knee'), J('ankle'), L.shin);
    segE(`thigh-${s}`, J('hip'), J('knee'), L.thigh);
    segE(`upper-${s}`, J('shoulder'), J('elbow'), L.upper);
    segE(`fore-${s}`, J('elbow'), J('hand'), L.fore);
    for (const j of ['knee', 'elbow', 'hand']) ptE(`${j}-${s}`, J(j), jointDot(`${j}-${s}`), 0.05);
  }
  segE('pelvis', p => p.l.hip, p => p.r.hip, 2 * Z.hip);
  segE('trunk', p => p.shoulderC, p => p.pelvis, L.sh);
  segE('neck', p => p.neckTop, p => p.shoulderC, L.neck);
  segE('shoulders', p => p.l.shoulder, p => p.r.shoulder, 2 * Z.shoulder);
  ptE('head', p => p.head, `<circle class="k-head" r="${HEAD_R}"></circle>`, 0.2);
  p0.objects.forEach((o, i) => {
    if (o.type === 'rope') {
      // A rope changes shape, so it is a chain of short segments animated like the limbs.
      for (let k = 0; k < o.points.length - 1; k++)
        segE(`o${i}s${k}`, p => p.objects[i].points[k], p => p.objects[i].points[k + 1], 5, ` stroke="${IRON}" stroke-width="${o.w ?? ROPE.width}"`);
    } else if (o.type === 'cord') {
      segE(`o${i}`, p => p.objects[i].a, p => p.objects[i].b, 20, ` stroke="${IRON}" stroke-width="1.1"`);
    } else if (o.type === 'ball') {
      ptE(`o${i}`, p => p.objects[i].at, `<circle class="k-o${i}" r="${o.r}" fill="${IRON}" stroke="none"></circle>`);
    } else if (o.type === 'wheel') {
      ptE(`o${i}`, p => p.objects[i].at, `<g class="k-o${i}">${cylinder(cam, o.r, -o.hw, o.hw, PLATE_FILL, 1.6)}</g>`);
    } else if (o.type === 'db') {
      // Dumbbell across the hand (along z): handle plus two short cylinders.
      const a = cam.dir(0, 0, -DB.half), b = cam.dir(0, 0, DB.half);
      const head = z => `<g transform="translate(${r2(cam.dir(0, 0, z).x)} ${r2(cam.dir(0, 0, z).y)})">${cylinder(cam, DB.r, -DB.w, DB.w, IRON, 0.6)}</g>`;
      ptE(`o${i}`, p => p.objects[i].at, `<g class="k-o${i}"><line x1="${r2(a.x)}" y1="${r2(a.y)}" x2="${r2(b.x)}" y2="${r2(b.y)}" stroke="${IRON}" stroke-width="1.6"></line>${head(-DB.half)}${head(DB.half)}</g>`, 0.1);
    } else if (o.type === 'barbell') {
      for (const sg of [-1, 1]) {
        const key = `o${i}${sg < 0 ? 'l' : 'r'}`, at = p => V(p.objects[i].at.x, p.objects[i].at.y, 0);
        els.push({
          key, kind: 'pt', svg: barHalf(key, cam, sg),
          at: p => { const q = cam.proj(at(p)); return { tx: q.x, ty: q.y }; },
          depth: p => cam.depth(V(p.objects[i].at.x, p.objects[i].at.y, 15 * sg)),
        });
      }
    } else if (cam.sideOn) {
      els.push({
        key: `o${i}`, kind: 'rot', svg: kbGlyph(`o${i}`),
        at: p => { const o2 = p.objects[i], q = cam.proj(o2.at); return { tx: q.x, ty: q.y, rot: -(o2.phi || 0) }; },
        depth: p => cam.depth(p.objects[i].at),
      });
    } else {
      const bell = p => { const o2 = p.objects[i]; return add(o2.at, mul(down(o2.phi || 0), KB.bell)); };
      ptE(`o${i}`, bell, kbBell(`o${i}`));
    }
  });
  return els;
}

export function renderView(ex, view, { T, frames }, size) {
  const cls = `ex-${ex.id}-${view}`;
  const ext = extent(frames);
  const cam = camera(view, ext.mid, view === 'iso' ? ex.isoCam : null);
  const els = elements(frames[0].p, cam);
  // Back-to-front order: mean depth over the cycle (fixed, so it can live in static SVG).
  const meanDepth = new Map(els.map(e => [e, frames.reduce((s, f) => s + e.depth(f.p), 0) / frames.length]));
  els.sort((a, b) => meanDepth.get(a) - meanDepth.get(b));
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

  let ground;
  if (cam.pitch > 0) {
    const gx = Math.max(17, (ext.hi - ext.lo) / 2 + 3), gz = 17;
    ground = `<polygon points="${pts([[-gx, -gz], [gx, -gz], [gx, gz], [-gx, gz]].map(([dx, dz]) => cam.proj(V(ext.mid + dx, GROUND, dz))))}" fill="${FLOOR_FILL}" stroke="none"></polygon>`;
  } else {
    ground = `<line x1="-7" y1="${GROUND}" x2="71" y2="${GROUND}" stroke="${FLOOR}" stroke-width="1.2"></line>`;
  }
  const props = (ex.props || []).map(pr => propSvg(pr, cam)).join('');
  const title = `${ex.name} — vista ${VIEWS[view].label}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="ex ${cls}" width="${size}" height="${size}" viewBox="${VIEWBOX}" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${title}"><title>${title}</title><style>\n${css}\n</style>${ground}${props}${els.map(e => e.svg).join('')}</svg>`;
}

// Pose data for native renderers: 3D joints of both sides (left side has negative z).
export function poseData(ex, { T, frames }) {
  const r = v => ({ x: r2(v.x), y: r2(v.y), z: r2(v.z) });
  const sideOf = q => Object.fromEntries(SIDE_J.map(j => [j, r(q[j])]));
  const ext = extent(frames);
  return {
    id: ex.id, name: ex.name, batch: ex.batch, duration: r2(T), still: ex.still || 0,
    centre: r2(ext.mid), extent: { lo: r2(ext.lo), hi: r2(ext.hi) }, props: ex.props || [],
    camera: { ...{ yaw: VIEWS.iso.yaw, pitch: VIEWS.iso.pitch }, ...(ex.isoCam || {}) },
    frames: frames.map(({ t, p }) => ({
      t: r2(t),
      joints: { pelvis: r(p.pelvis), shoulderC: r(p.shoulderC), neckTop: r(p.neckTop), head: r(p.head), r: sideOf(p.r), l: sideOf(p.l) },
      objects: p.objects.map(o => (o.type === 'rope' ? { type: 'rope', points: o.points.map(r), ...(o.w ? { w: o.w } : {}) }
        : o.type === 'cord' ? { type: 'cord', a: r(o.a), b: r(o.b) }
          : { type: o.type, at: r(o.at), ...(o.phi !== undefined ? { phi: r2(o.phi) } : {}), ...(o.r ? { r: o.r } : {}), ...(o.hw ? { hw: o.hw } : {}) })),
    })),
  };
}
