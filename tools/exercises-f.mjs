// Exercise library, batch F: therapeutic exercise (pilot). Knee, hip, ankle and shoulder drills
// that physiotherapists prescribe on printed sheets. Same conventions as the other batches;
// two-sided drills play the right side and then the same phases mirrored (swapLR).
import {
  A, V, L, Z, HEAD_R, FLOOR_TOP, foot, footFlat, footFromShin, trunk, reach, straight, kneeIK, circles,
  poseLR, mirror, up, down, rot2, along, add, sub, mul, len, vlerp, lerp, smooth, bump, deg, rad, solve,
  clamp01, transformPose, rollX, rotZ, balance, legs, pose,
} from './engine.mjs';

const F = 58;                                     // floor contact line
const STAND_Y = 31;                               // pelvis height standing with straight legs
const hold = (dur, p) => ({ hold: true, dur, pose: () => p });
const sideHip = (t, sg) => V(t.pelvis.x, t.pelvis.y, t.pelvis.z + sg * Z.hip);
const sideShoulder = (t, sg) => t.shoulderOf(sg);
const withZ = (q, z) => V(q.x, q.y, z);
const ARM = L.upper + L.fore - 0.02, LEG = L.thigh + L.shin - 0.02;
function within(anchor, q, max) {
  const d = sub(q, anchor), l = len(d);
  return l > max ? add(anchor, mul(d, max / l)) : q;
}
// Foot pointing at `ang` degrees in the sagittal plane (0 = forward and flat, 90 = toes down,
// -90 = toes up, 180 = pointing back).
const footDir = (ankle, ang) => foot(ankle, Math.cos(rad(ang)), Math.sin(rad(ang)));
function legTo(t, sg, ankle, ang, pole = V(1, 0, 0.25 * sg)) {
  const h = sideHip(t, sg), a = within(h, ankle, LEG);
  return { knee: kneeIK(h, a, pole), ankle: a, toe: footDir(a, ang) };
}
// Straight leg hanging from the hip.
function pillar(t, sg) {
  const hip = sideHip(t, sg), knee = along(hip, V(0, 1), L.thigh), ankle = along(knee, V(0, 1), L.shin);
  return { knee, ankle, toe: footDir(ankle, 0) };
}
// Leg from the hip: thigh along `dir`, knee bent `knee` degrees (shin = thigh turned clockwise
// on screen), foot `ang` absolute.
function legFrom(hip, dir, kneeDeg, ang) {
  const knee = along(hip, dir, L.thigh), ankle = along(knee, rot2(dir, kneeDeg), L.shin);
  return { knee, ankle, toe: footDir(ankle, ang) };
}
const handTo = (t, sg, hand) => within(sideShoulder(t, sg), hand, ARM);
// Mirrors a pose; a per-side effort pair [right, left] swaps with the sides.
const swapLR = p => {
  const q = transformPose(p, mirror);
  return { ...q, r: q.l, l: q.r, ...(Array.isArray(p.effort) && p.effort.length === 2 ? { effort: [p.effort[1], p.effort[0]] } : {}) };
};
const mirrored = phases => phases.map(ph => ({ ...ph, pose: e => swapLR(ph.pose(e)) }));
const both = phases => [...phases, ...mirrored(phases)];
// Isometric hold: the pose stays, the halo fades in, pulses gently and fades out.
const pulse = (s, beats) => smooth(s / 0.15) * smooth((1 - s) / 0.15) * (0.85 + 0.15 * Math.sin(2 * Math.PI * beats * s));
const withEffort = (p, e) => ({ ...p, effort: e });
const isoHold = (dur, p, side = null) => ({ dur, ease: s => s, pose: s => withEffort(p, side === null ? pulse(s, dur) : side > 0 ? [pulse(s, dur), 0] : [0, pulse(s, dur)]) });
// Out, hold, back: the usual shape of a slow therapeutic repetition.
const rep = (f, out, top, back, rest = 0.3) => [hold(rest, f(0)), { dur: out, pose: f }, hold(top, f(1)), { dur: back, pose: e => f(1 - e) }];

// ======================= Lying face up =======================

// The neck bends up and the head rests on the floor (as in batch B).
const HEAD_REST_Y = FLOOR_TOP - HEAD_R - 1.7;
function lyingTrunk(pelvis, alpha = -90, spine = {}) {
  const t0 = trunk(pelvis, alpha, 0, spine);
  const neckDir = -74;
  const neckY = t0.shoulderC.y - L.neck * Math.cos(rad(neckDir));
  const c = clamp01((neckY - HEAD_REST_Y) / L.head);
  return trunk(pelvis, alpha, 0, { ...spine, neckDir, headDir: -deg(Math.acos(c)) });
}
const SUP = { pelvis: V(30, F) };
const flatLeg = (t, sg, ang = -90) => legFrom(sideHip(t, sg), V(1, 0), 0, ang);
const armsAlong = (t, sg) => ({ hand: straight(sideShoulder(t, sg), 90, sg * 9.5), pole: V(0, -1, 0.3 * sg) });
// Leg with the heel on the floor, `d` from the hip (LEG = straight, smaller = knee bent up).
function heelLeg(t, sg, d, ang) {
  const hip = sideHip(t, sg), ankle = V(hip.x + d, F, hip.z);
  if (d >= LEG) return { knee: V(hip.x + L.thigh, F, hip.z), ankle, toe: footDir(ankle, ang) };
  const [k1, k2] = circles(hip, L.thigh, ankle, L.shin);
  return { knee: withZ(k1.y < k2.y ? k1 : k2, hip.z), ankle, toe: footDir(ankle, ang) };
}
// Hook lying: knees bent, feet flat on the floor. k blends from the straight leg (0) to it (1).
const HOOK_D = 20;
const slideLeg = (t, sg, k) => heelLeg(t, sg, lerp(LEG, HOOK_D, smooth(k)), lerp(-90, 0, smooth(k)));
const hookLeg = (t, sg) => slideLeg(t, sg, 1);

// ---------- Ankle pumps: legs straight, both feet point and pull back ----------
function ankleShape(e) {
  const t = lyingTrunk(SUP.pelvis);
  const ang = lerp(-112, -40, e);                 // toes towards the head .. pointed
  const side = sg => ({ ...flatLeg(t, sg, ang), ...armsAlong(t, sg) });
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}
const anklePump = s => ankleShape(0.5 - 0.5 * Math.cos(2 * Math.PI * s));

// ---------- Heel slides: the heel slides towards the buttock and back ----------
function heelSlide(e) {
  const t = lyingTrunk(SUP.pelvis);
  const r = { ...heelLeg(t, 1, lerp(LEG, 17, smooth(e)), lerp(-90, -25, smooth(e))), ...armsAlong(t, 1) };
  return poseLR({ trunk: t, r, l: { ...flatLeg(t, -1), ...armsAlong(t, -1) } });
}

// ---------- Straight-leg raise: the other knee bent, the straight leg rises to ~45° ----------
function slr(e) {
  const t = lyingTrunk(SUP.pelvis);
  const a = 45 * smooth(e);
  const r = { ...legFrom(sideHip(t, 1), V(Math.cos(rad(a)), -Math.sin(rad(a))), 0, -90 + a), ...armsAlong(t, 1) };
  const l = { ...hookLeg(t, -1), ...armsAlong(t, -1) };
  return poseLR({ trunk: t, r, l });
}
// Change of legs: the working leg bends up while the other slides straight.
function slrSwitch(e) {
  const t = lyingTrunk(SUP.pelvis);
  return poseLR({ trunk: t, r: { ...slideLeg(t, 1, e), ...armsAlong(t, 1) }, l: { ...slideLeg(t, -1, 1 - e), ...armsAlong(t, -1) } });
}
const SLR_PHASES = [...rep(slr, 1.2, 0.6, 1.4), { dur: 1.0, pose: slrSwitch }];

// ---------- Short-arc knee extension over a roll under the knees ----------
const ROLL = { r: 4.5, hw: 10 };
const ROLL_C = (() => {
  const hip = V(SUP.pelvis.x, F);
  const kneeY = FLOOR_TOP - 2 * ROLL.r - 1.6;
  return V(hip.x + Math.sqrt(L.thigh ** 2 - (F - kneeY) ** 2), FLOOR_TOP - ROLL.r, 0);
})();
function shortArc(e) {
  const t = lyingTrunk(SUP.pelvis);
  const side = (sg, ext) => {
    const hip = sideHip(t, sg), knee = V(ROLL_C.x, ROLL_C.y - ROLL.r - 1.6, sg * 4.5);
    const thigh = sub(knee, hip), th = Math.atan2(thigh.y, thigh.x);
    const restA = Math.asin((F - knee.y) / L.shin);  // shin down to the heel on the floor
    const a = lerp(restA, th, smooth(ext));
    const ankle = V(knee.x + L.shin * Math.cos(a), knee.y + L.shin * Math.sin(a), sg * 4.5);
    return { knee, ankle, toe: footDir(ankle, lerp(-70, -100, smooth(ext))), ...armsAlong(t, sg) };
  };
  return poseLR({ trunk: t, r: side(1, e), l: side(-1, 0), objects: [{ type: 'wheel', at: ROLL_C, r: ROLL.r, hw: ROLL.hw }] });
}

// ---------- Single-leg bridge: one foot planted, the other leg straight in line with its thigh ----------
const GB = { S: V(SUP.pelvis.x - L.sh, F), top: 24 };
const GB_ANKLE_X = (() => {
  const g = rad(GB.top), k = V(GB.S.x + (L.sh + L.thigh) * Math.cos(g), F - (L.sh + L.thigh) * Math.sin(g));
  return k.x + Math.sqrt(L.shin ** 2 - (F - k.y) ** 2);
})();
// u: hips up (0..1); lift: the free (left) leg goes from planted to straight in line with its thigh.
function bridgeOne(u, lift = 1) {
  const g = rad(GB.top * u);
  const hip = V(GB.S.x + L.sh * Math.cos(g), F - L.sh * Math.sin(g));
  const t = lyingTrunk(hip, deg(Math.atan2(GB.S.x - hip.x, hip.y - GB.S.y)));
  const planted = sg => {
    const h = sideHip(t, sg), ankle = V(GB_ANKLE_X, F, h.z);
    const [k1, k2] = circles(h, L.thigh, ankle, L.shin);
    return { knee: withZ(k1.y < k2.y ? k1 : k2, h.z), ankle, toe: footFlat(ankle) };
  };
  const r = { ...planted(1), ...armsAlong(t, 1) };
  // Free leg: the thigh keeps its angle and the knee straightens.
  const p0 = planted(-1), h = sideHip(t, -1);
  const d = sub(p0.knee, h), dir = V(d.x / L.thigh, d.y / L.thigh);
  const kneeDeg = deg(Math.atan2(p0.ankle.y - p0.knee.y, p0.ankle.x - p0.knee.x) - Math.atan2(dir.y, dir.x));
  const k = smooth(lift), thighAng = deg(Math.atan2(dir.y, dir.x));
  const l = { ...legFrom(h, dir, lerp(kneeDeg, 0, k), lerp(0, thighAng - 80, k)), ...armsAlong(t, -1) };
  return poseLR({ trunk: t, r, l });
}
const BRIDGE_ONE = [
  hold(0.4, bridgeOne(0, 0)), { dur: 0.8, pose: e => bridgeOne(0, e) },
  { dur: 1.0, pose: e => bridgeOne(e) }, hold(0.8, bridgeOne(1)), { dur: 1.2, pose: e => bridgeOne(1 - e) },
  { dur: 0.8, pose: e => bridgeOne(0, 1 - e) },
];

// ---------- Assisted shoulder flexion with a stick, lying with knees bent ----------
const STICK = { half: 14, w: 2 };
function stickFlexion(e) {
  const t = lyingTrunk(SUP.pelvis);
  const phi = lerp(100, 245, smooth(e));
  const hand = sg => straight(sideShoulder(t, sg), phi, sg * 9.5);
  const h = hand(1);
  const stick = { type: 'rope', w: STICK.w, points: [V(h.x, h.y, -STICK.half), V(h.x, h.y, STICK.half)] };
  const side = sg => ({ ...hookLeg(t, sg), hand: hand(sg), pole: V(0, -1, 0.4 * sg) });
  return poseLR({ trunk: t, r: side(1), l: side(-1), objects: [stick] });
}

// ======================= Standing =======================

// Wall in front of the figure, for support (hands at chest height).
const WALL_FRONT = { type: 'box', x0: A + 20, x1: A + 22, top: -14, hz: 16 };
const wallHand = sg => V(WALL_FRONT.x0 - 1.2, 22, sg * 9);
// Heel raise on one foot: toes fixed, the foot pitches `p` degrees.
function raisedAnkle(z, p) {
  const toe = V(A + L.foot, F, z);
  return V(toe.x - L.foot * Math.cos(rad(p)), F - L.foot * Math.sin(rad(p)), z);
}
// Free leg: the ankle travels from the floor (z = sg * 4.5) to `to` (foot pitched `ang`), knee forward.
function freeLeg(t, sg, k, to, ang) {
  const e = smooth(k), from = V(A, F, sg * 4.5);
  const a = add(vlerp(from, to, e), V(0, -2 * bump(e), 0));
  return legTo(t, sg, a, lerp(0, ang, e), V(1, 0, 0.15 * sg));
}

// ---------- Heel raises at the wall: both feet, or on one foot ----------
// p: heel raise 0..1; lift: the left foot comes off the floor (single-leg version).
function heelRaise(p, lift = 0) {
  const pitch = 45 * smooth(p);
  const ar = raisedAnkle(4.5, pitch);
  const t = trunk(V(ar.x, ar.y - LEG), 0);
  const r = { ...legTo(t, 1, ar, pitch), hand: wallHand(1), pole: V(0, 1, 0.6) };
  const l = lift > 0
    ? { ...freeLeg(t, -1, lift, V(t.pelvis.x - 6, F - 12 - (F - ar.y), -4.5), 60), hand: wallHand(-1), pole: V(0, 1, -0.6) }
    : { ...legTo(t, -1, withZ(ar, -4.5), pitch), hand: wallHand(-1), pole: V(0, 1, -0.6) };
  return poseLR({ trunk: t, r, l });
}
const RAISES_ONE = [
  hold(0.3, heelRaise(0)), { dur: 0.6, pose: e => heelRaise(0, Math.max(e, 1e-3)) },
  { dur: 0.9, pose: e => heelRaise(e, 1) }, hold(0.5, heelRaise(1, 1)), { dur: 1.2, pose: e => heelRaise(1 - e, 1) },
  { dur: 0.9, pose: e => heelRaise(e, 1) }, hold(0.5, heelRaise(1, 1)), { dur: 1.2, pose: e => heelRaise(1 - e, 1) },
  { dur: 0.6, pose: e => heelRaise(0, Math.max(1 - e, 1e-3)) },
];

// ---------- Single-leg balance: knee up in front, small sway, arms relaxed ----------
function balanceOne(k, s = 0) {
  const sway = Math.sin(2 * Math.PI * s), sway2 = Math.sin(4 * Math.PI * s + 1);
  const t = trunk(V(A + 0.6 * sway2 * smooth(k), STAND_Y, 1.2 * smooth(k) + 0.6 * sway * smooth(k)), 0);
  const ankle = V(A, F, 4.5);
  const r = { ...legTo(t, 1, ankle, 0), hand: straight(sideShoulder(t, 1), 8 + 4 * sway * smooth(k), t.pelvis.z + 10 + 6 * smooth(k)), pole: V(0, 1, 0.6) };
  const up_ = legFrom(sideHip(t, -1), down(50), 75, 25);
  const l = { ...freeLeg(t, -1, k, up_.ankle, 25), hand: straight(sideShoulder(t, -1), 8 - 4 * sway * smooth(k), t.pelvis.z - 10 - 6 * smooth(k)), pole: V(0, 1, -0.6) };
  return poseLR({ trunk: t, r, l });
}
const BALANCE_ONE = [hold(0.3, balanceOne(0)), { dur: 0.8, pose: e => balanceOne(e) }, { dur: 4, ease: s => s, pose: s => balanceOne(1, s) }, { dur: 0.8, pose: e => balanceOne(1 - e) }];

// ---------- Wall sit: back on the wall, slide down to ~90° at the knees, hold, slide up ----------
const WS = { hipX: A - 13, low: F - L.thigh - 0.3 };
const WS_HIGH = F - Math.sqrt(LEG ** 2 - (A - WS.hipX) ** 2);
const WALL_BACK = { type: 'box', x0: WS.hipX - 5.5, x1: WS.hipX - 3.5, top: -14, hz: 16 };
function wallSit(e) {
  const t = trunk(V(WS.hipX, lerp(WS_HIGH, WS.low, smooth(e))), 0);
  const side = sg => ({ ...legTo(t, sg, V(A, F, sg * 5.5), 0, V(1, 0, 0.3 * sg)), hand: V(t.pelvis.x + 9, t.pelvis.y - 1.5, sg * 8), pole: V(-0.2, 1, sg) });
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

// ---------- Chair ----------
const CHAIR = { x0: A - 22, x1: A - 6, seat: 44.6, hz: 9, back: 16 };
const CHAIR_PROP = (() => {
  const { x0, x1, seat, hz, back } = CHAIR, P = (x, y, z) => V(x, y, z);
  const segs = [];
  for (const z of [-hz, hz]) segs.push([P(x0, seat, z), P(x1, seat, z)], [P(x0, seat, z), P(x0, FLOOR_TOP, z)], [P(x1, seat, z), P(x1, FLOOR_TOP, z)], [P(x0, seat, z), P(x0, seat - back, z)]);
  segs.push([P(x0, seat, -hz), P(x0, seat, hz)], [P(x1, seat, -hz), P(x1, seat, hz)], [P(x0, seat - back, -hz), P(x0, seat - back, hz)]);
  return { type: 'lines', w: 1.6, segs };
})();
const SEAT_HIP_Y = CHAIR.seat - 2.6;

// ---------- Sit to stand: arms crossed on the chest, lean forward and stand up ----------
const crossed = (t, sg) => { const c = t.at(11, 4); return { hand: V(c.x, c.y, -sg * 5), pole: V(1, 0, sg) }; };
// d: 0 standing .. 1 seated. The trunk leans forward (up to ~45°) on the way and is upright
// at both ends.
function sitStand(d) {
  const lg = legs({ shin: 14 * d, thigh: -90 * d, stance: 5.5, out: 1.5 });
  const hip = V(lg.hip.x, Math.min(lg.hip.y, SEAT_HIP_Y));
  const a = 46 * smooth(d / 0.8) * (1 - smooth((d - 0.85) / 0.15));
  const t = trunk(hip, a, -0.4 * a);
  const side = sg => ({ ...legTo(t, sg, V(A, F, sg * 5.5), 0, V(1, 0, 0.25 * sg)), ...crossed(t, sg) });
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

// ---------- Seated knee extension: upright on the chair, the lower leg straightens ----------
function seatedExt(e) {
  const hip = V(CHAIR.x1 - 3, SEAT_HIP_Y);
  const t = trunk(hip, 0);
  const side = (sg, ext) => {
    const knee = V(hip.x + L.thigh, hip.y, sg * 5), a = lerp(90, 2, smooth(ext));
    const ankle = add(knee, V(L.shin * Math.cos(rad(a)), L.shin * Math.sin(rad(a)), 0));
    return { knee, ankle, toe: footDir(ankle, lerp(0, -80, smooth(ext))), hand: V(hip.x + 2, CHAIR.seat - 1.8, sg * 11), pole: V(-0.3, 0, sg) };
  };
  return poseLR({ trunk: t, r: side(1, e), l: side(-1, 0) });
}

// ---------- Step-down: standing on a step, one foot lowers in front to touch the floor ----------
const STEP = { top: F - 9 + 1.9, hz: 13 };
const STEP_ANKLE = V(A, STEP.top - 1.9);
const STEP_PROP = { type: 'box', x0: A - 12, x1: A + L.foot + 1, top: STEP.top, hz: STEP.hz };
// d: support knee bend 0..1; reach: free foot from the step to the floor in front.
function stepDown(d, reach_ = d) {
  const sh = 26 * smooth(d), th = -34 * smooth(d);
  const knee = V(A + L.shin * Math.sin(rad(sh)), STEP_ANKLE.y - L.shin * Math.cos(rad(sh)));
  const hip = V(knee.x + L.thigh * Math.sin(rad(th)), knee.y - L.thigh * Math.cos(rad(th)));
  const t = trunk(hip, 14 * smooth(d), -8 * smooth(d));
  const handsHip = sg => { const c = t.at(1.5, 1.8); return { hand: V(c.x, c.y, sg * 10), pole: V(-0.5, 0, sg) }; };
  const r = { ...legTo(t, 1, withZ(STEP_ANKLE, 4.5), 0), ...handsHip(1) };
  const k = smooth(reach_);
  const target = V(STEP_PROP.x1 + 3, F - 2.6, -4.5);  // heel just touching the floor
  const from = withZ(STEP_ANKLE, -4.5);
  const fx = smooth(reach_ / 0.55), fy = smooth((reach_ - 0.35) / 0.65);
  const a = V(lerp(from.x, target.x, fx), lerp(from.y, target.y, fy) - 2.5 * bump(fx), lerp(from.z, target.z, fx));
  const l = { ...legTo(t, -1, a, lerp(0, -20, k), V(1, 0, -0.2)), ...handsHip(-1) };
  return poseLR({ trunk: t, r, l });
}

// ======================= Side-lying =======================

// Builds the body face down along x (head at +x), rolls it onto its left side (chest towards
// +z, the camera) and sets the lowest joint of the bottom side on the floor.
function sideLying(build) {
  const body = build(trunk(V(30, 0), 90, 0));
  const rolled = transformPose(body, rollX(90, V(0, 0, 0)));
  const low = Math.max(...['shoulder', 'hip', 'knee', 'ankle'].map(j => rolled.l[j].y));
  return transformPose(rolled, q => V(q.x + 2, q.y + F - low, q.z));
}
// Rotation of q by `a` degrees about the axis through c along unit vector u (Rodrigues).
function rotAxis(q, c, u, a) {
  const v = sub(q, c), co = Math.cos(rad(a)), si = Math.sin(rad(a));
  const cr = V(u.y * v.z - u.z * v.y, u.z * v.x - u.x * v.z, u.x * v.y - u.y * v.x);
  const dt = u.x * v.x + u.y * v.y + u.z * v.z;
  return add(c, add(add(mul(v, co), mul(cr, si)), mul(u, dt * (1 - co))));
}
const unit3 = v => mul(v, 1 / len(v));
// In the face-down frame +x points to the head, +y to the front of the body and +z to the
// right side (up after the roll). Hips flexed `hf`, knees bent `kf`. The top leg can open as a
// clamshell (`open`: the knee turns about the hip-ankle axis, feet together) or rise straight
// (`abd`: the whole leg turns about the front-back axis through the hip).
function slLeg(t, sg, hf, kf, open = 0, abd = 0) {
  const hip = sideHip(t, sg);
  const dir = V(-Math.cos(rad(hf)), Math.sin(rad(hf)), 0), shin = rot2(dir, -kf);
  let knee = add(hip, mul(dir, L.thigh)), ankle = add(knee, mul(shin, L.shin));
  let toe = add(ankle, mul(rot2(shin, -80), L.foot));
  if (open) { const u = unit3(sub(ankle, hip)); knee = rotAxis(knee, hip, u, -open); toe = rotAxis(toe, hip, u, -open); }
  if (abd) [knee, ankle, toe] = [knee, ankle, toe].map(q => rotAxis(q, hip, V(0, 1, 0), abd));
  return { knee, ankle, toe };
}
// Arms: the bottom arm reaches overhead along the floor under the head, the top hand rests on
// the floor in front of the chest.
function slArms(t, sg) {
  if (sg < 0) return { hand: add(sideShoulder(t, -1), V(ARM - 0.6, 0, 1.5)), pole: V(0, 1, 0) };
  const c = t.at(10, 0);
  return { hand: handTo(t, 1, V(c.x, c.y + 10, -6)), pole: V(0, 0, 1) };
}

// ---------- Clamshell: hips and knees bent, feet together, the top knee opens ----------
const clam = e => sideLying(t => poseLR({ trunk: t,
  r: { ...slLeg(t, 1, 45, 90, 40 * smooth(e)), ...slArms(t, 1) }, l: { ...slLeg(t, -1, 45, 90), ...slArms(t, -1) } }));

// ---------- Side-lying hip abduction: legs straight, the top leg rises ----------
const sideAbd = e => sideLying(t => poseLR({ trunk: t,
  r: { ...slLeg(t, 1, 5, 0, 0, 32 * smooth(e)), ...slArms(t, 1) }, l: { ...slLeg(t, -1, 5, 0), ...slArms(t, -1) } }));

// ======================= Lying face down =======================

// ---------- Prone hip extension: forehead on the hands, one straight leg lifts ----------
const PR = { pelvis: V(30, F) };
function proneExt(e) {
  const t = trunk(PR.pelvis, 90, 0, { neckDir: 62, headDir: 28 });
  const side = (sg, lift) => {
    const a = 14 * smooth(lift);
    const dir = V(-Math.cos(rad(a)), -Math.sin(rad(a)));
    const lg = legFrom(sideHip(t, sg), dir, 0, 180 + a + 10);
    const under = V(t.head.x - 1, F - 0.5, sg * 4);
    return { ...lg, hand: handTo(t, sg, under), pole: V(0, -1, sg) };
  };
  return poseLR({ trunk: t, r: side(1, e), l: side(-1, 0) });
}

// ======================= Shoulder, standing =======================

// ---------- Codman pendulum: trunk bent forward, the other hand on a table, the arm hangs and circles ----------
const TABLE = { type: 'box', x0: A + 16, x1: A + 34, top: 30, z0: -16, z1: -3 };
function pendulum(s, amp = 1) {
  const t = trunk(V(A - 3, STAND_Y + 2), 62, -20);
  const r = (() => {
    const S = sideShoulder(t, 1), th = 2 * Math.PI * s, rad_ = 4.5 * amp;
    const hand = V(S.x + rad_ * Math.cos(th), S.y + ARM - 1, S.z + 1 + rad_ * Math.sin(th));
    return { hand: handTo(t, 1, hand), pole: V(0, 0, 1) };
  })();
  const l = { hand: handTo(t, -1, V(TABLE.x0 + 4, TABLE.top - 1.6, -9)), pole: V(0, 1, -0.5) };
  return poseLR({ trunk: t,
    r: { ...legTo(t, 1, V(A - 4, F, 5.5), 0, V(1, 0, 0.2)), ...r },
    l: { ...legTo(t, -1, V(A + 6, F, -5.5), 0, V(1, 0, -0.2)), ...l } });
}
const PENDULUM = [{ dur: 0.6, pose: e => pendulum(0, smooth(e)) }, { dur: 4.8, ease: s => s, pose: s => pendulum(2 * s) }, { dur: 0.6, pose: e => pendulum(0, 1 - smooth(e)) }];

// ---------- Wall slides: forearms on the wall, slide up and back down ----------
const WSL = { wallX: A + 20 };
const WALL_SLIDE = { type: 'box', x0: WSL.wallX + 1.2, x1: WSL.wallX + 3.2, top: -14, hz: 16 };
function wallSlide(e) {
  const th = lerp(90, 140, smooth(e));
  // The body leans in as one piece from the ankles so the elbows stay on the wall.
  const ankleX = A + 4, Sx = WSL.wallX - L.upper * Math.sin(rad(th));
  const beta = deg(Math.asin((Sx - ankleX) / (LEG + L.sh)));
  const hip = V(ankleX + LEG * Math.sin(rad(beta)), F - LEG * Math.cos(rad(beta)));
  const t = trunk(hip, beta, -beta);
  const side = sg => {
    const S = sideShoulder(t, sg);
    const elbow = within(S, V(WSL.wallX, S.y - L.upper * Math.cos(rad(th)) * -1, sg * 9), L.upper - 1e-6);
    return { ...legTo(t, sg, V(ankleX, F, sg * 5), 0), elbow, hand: V(WSL.wallX, elbow.y - L.fore, sg * 9) };
  };
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

// ======================= Spine (segmented trunk) =======================

// ---------- Pelvic tilt, lying with knees bent: the low back arches and flattens ----------
// k: -1 posterior tilt (back flat) .. 0 neutral .. 1 anterior tilt (arched). The pelvis turns and
// the lumbar spine bends the other way so the chest stays on the floor.
const TILT = { neutral: 8, range: 24 };   // slightly exaggerated so the arch reads
function pelvicTilt(k) {
  const t0 = k < 0 ? TILT.neutral * (1 + k) : TILT.neutral + TILT.range * k;   // flat back at most
  const t = lyingTrunk(SUP.pelvis, -90 + t0, { lumbar: -t0 });
  const side = sg => ({ ...hookLeg(t, sg), ...armsAlong(t, sg) });
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}
const TILT_PHASES = [
  hold(0.3, pelvicTilt(0)), { dur: 1.0, pose: e => pelvicTilt(-e) }, hold(0.6, pelvicTilt(-1)),
  { dur: 1.6, pose: e => pelvicTilt(-1 + 2 * e) }, hold(0.6, pelvicTilt(1)), { dur: 1.0, pose: e => pelvicTilt(1 - e) },
];

// ---------- Cat-camel on hands and knees: the spine rounds up and then arches down ----------
// k: 1 rounded (cat), 0 neutral, -1 arched (cow). Hips over the knees, hands fixed on the floor;
// the pelvis tilts with the spine so the shoulders stay over the hands.
const QD = { knee: V(26, F), chord: 65, handZ: 9 };
const QD_HIP = V(QD.knee.x, F - L.thigh);
const QD_HAND = (() => { const S = trunk(QD_HIP, QD.chord).shoulderC; return V(S.x + 1, F); })();
function chordOffset(lumbar, thoracic) {
  const c = trunk(V(0, 0), 0, 0, { lumbar, thoracic }).shoulderC;
  return deg(Math.atan2(c.x, -c.y));
}
function catCamel(k) {
  const lumbar = k > 0 ? 16 * k : 24 * k, thoracic = k > 0 ? 38 * k : 12 * k;
  const t = trunk(QD_HIP, QD.chord - chordOffset(lumbar, thoracic), k > 0 ? 18 + 30 * k : 18 + 40 * k, { lumbar, thoracic });
  const side = sg => ({
    ...legFrom(sideHip(t, sg), V(0, 1), 90, 180),
    hand: V(QD_HAND.x, F, sg * QD.handZ), pole: V(-0.4, 0, sg),
  });
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}
const CAT_PHASES = [
  hold(0.3, catCamel(0)), { dur: 1.4, pose: e => catCamel(e) }, hold(0.6, catCamel(1)),
  { dur: 2.2, pose: e => catCamel(1 - 2 * e) }, hold(0.6, catCamel(-1)), { dur: 1.2, pose: e => catCamel(-1 + e) },
];

// ---------- Prone extensions: pelvis on the floor, the lumbar spine arches ----------
// Head follows the chest, looking slightly down.
function proneTrunk(lumbar, thoracic) {
  const top = 90 + lumbar + thoracic;
  return trunk(PR.pelvis, 90, 0, { lumbar, thoracic, neckDir: top - 18 + 8 * (1 + lumbar / 60), headDir: top - 50 * (1 + lumbar / 60) - 10 });
}
const proneLegs = (t, sg) => legFrom(sideHip(t, sg), V(-1, 0), 0, 180);
// Sphinx: forearms on the floor, the elbows move under the shoulders as the chest rises.
const SPHINX = { lumbar: -44, thoracic: -20 };
function sphinx(e) {
  const k = smooth(e), t = proneTrunk(SPHINX.lumbar * k, SPHINX.thoracic * k);
  const side = sg => {
    const S = sideShoulder(t, sg), h = Math.min(F - S.y, L.upper - 0.05);
    const elbow = V(S.x + Math.sqrt(L.upper ** 2 - h * h), F, S.z);
    return { ...proneLegs(t, sg), elbow, hand: V(elbow.x + L.fore, F, sg * 6) };
  };
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}
// Press-up (McKenzie): hands planted ahead of the shoulders, the arms push the chest up.
const PRESS = { lumbar: -40, thoracic: -14 };
const PRESS_HAND_X = PR.pelvis.x + L.sh + 3;
function pressUp(e) {
  const k = smooth(e), t = proneTrunk(PRESS.lumbar * k, PRESS.thoracic * k);
  const side = sg => ({ ...proneLegs(t, sg), hand: V(PRESS_HAND_X, F, sg * 10), pole: V(-1, -0.4, 1.2 * sg) });
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

// ======================= Cervical (seated) =======================

// Seated upright on the chair, hands resting on the thighs; `head` sets the neck and head.
function seatedHead({ nd = 0, hd = 0, side = 0, hside = null, yaw = 0 } = {}) {
  const hip = V(CHAIR.x1 - 3, SEAT_HIP_Y);
  const t = trunk(hip, 0, 0, { neckDir: nd, headDir: hd, neckSide: side, headSide: hside ?? side * 1.5, headYaw: yaw });
  const side_ = sg => {
    const knee = V(hip.x + L.thigh, hip.y, sg * 5), ankle = V(knee.x, knee.y + L.shin, sg * 5);
    return { knee, ankle, toe: footDir(ankle, 0), hand: V(hip.x + 9, hip.y - 1.8, sg * 6), pole: V(-0.2, 1, sg) };
  };
  return poseLR({ trunk: t, r: side_(1), l: side_(-1) });
}
// Chin tuck: the neck tilts back while the head stays level, so the head slides straight back.
const chinTuck = e => seatedHead({ nd: lerp(10, -10, smooth(e)), hd: lerp(0, 6, smooth(e)) });
// Flexion (k > 0, look down) and extension (k < 0, look up).
const neckFlex = k => seatedHead(k > 0 ? { nd: 28 * k, hd: 58 * k } : { nd: 22 * k, hd: 48 * k });
const NECK_FLEX = [
  hold(0.3, neckFlex(0)), { dur: 1.2, pose: neckFlex }, hold(0.6, neckFlex(1)), { dur: 1.2, pose: e => neckFlex(1 - e) },
  hold(0.3, neckFlex(0)), { dur: 1.2, pose: e => neckFlex(-e) }, hold(0.6, neckFlex(-1)), { dur: 1.2, pose: e => neckFlex(-1 + e) },
];
// Rotation to each side and lateral flexion (ear towards the shoulder).
const neckTurn = k => seatedHead({ yaw: 70 * k });
const neckSide = k => seatedHead({ side: 25 * k, hside: 40 * k });
const sides = f => [
  hold(0.3, f(0)), { dur: 1.2, pose: f }, hold(0.8, f(1)), { dur: 1.2, pose: e => f(1 - e) },
  hold(0.3, f(0)), { dur: 1.2, pose: e => f(-e) }, hold(0.8, f(-1)), { dur: 1.2, pose: e => f(-1 + e) },
];

// ======================= Shoulder with a stick, forearm and wrist, elastic bands =======================

const standT = (lean = 0) => trunk(V(A, STAND_Y), lean);
const standLegs = (t, sg) => legTo(t, sg, V(A, F, sg * 4.5), 0);
// Elbow at the side, bent 90°: the forearm turns about the vertical through the elbow.
// th: 0 = forearm straight ahead, positive = outwards (external rotation), negative = across the belly.
const elbowAtSide = (t, sg) => add(sideShoulder(t, sg), V(0.5, L.upper - 0.05, 0));
const forearmAt = (t, sg, th) => add(elbowAtSide(t, sg), V(L.fore * Math.cos(rad(th)), 0, sg * L.fore * Math.sin(rad(th))));
const stickThrough = (a, b, over = 4) => {
  const d = sub(b, a), u = mul(d, 1 / len(d));
  return { type: 'rope', w: STICK.w, points: [sub(a, mul(u, over)), add(b, mul(u, over))] };
};

// ---------- External rotation with a stick: the other arm pushes the stick towards the working side ----------
// Both elbows stay at the sides; the right forearm rotates out and the left one in, the stick rigid.
const ER_GAP = len(sub(forearmAt(standT(), 1, 0), forearmAt(standT(), -1, 0)));
function stickER(e) {
  const t = standT(), thR = 55 * smooth(e);
  const hr = forearmAt(t, 1, thR);
  const thL = solve(th => len(sub(hr, forearmAt(t, -1, th))) - ER_GAP, -80, 0);
  const hl = forearmAt(t, -1, thL);
  const side = (sg, hand) => ({ ...standLegs(t, sg), elbow: elbowAtSide(t, sg), hand });
  return poseLR({ trunk: t, r: side(1, hr), l: side(-1, hl), objects: [stickThrough(hl, hr)] });
}

// ---------- Internal rotation with a stick behind the back: the top hand pulls the bottom one up ----------
function stickIR(e) {
  const t = standT(), k = smooth(e);
  const low = V(A - 5.5, 34 - 6 * k, 1.5), high = V(A - 6.5, 4 - 6 * k, -1.5);
  const side = (sg, hand, pole) => ({ ...standLegs(t, sg), hand, pole });
  return poseLR({ trunk: t, r: side(1, low, V(-0.6, 0.2, 1)), l: side(-1, high, V(-0.2, -1, -0.6)), objects: [stickThrough(low, high, 3)] });
}

// ---------- Abduction with a stick: the other arm pushes the straight arm out to the side ----------
function stickAbd(e) {
  const t = standT(), a = lerp(12, 95, smooth(e));
  const Sr = sideShoulder(t, 1), hr = add(Sr, mul(V(0.15, Math.cos(rad(a)), Math.sin(rad(a))), ARM / Math.hypot(0.15, 1)));
  // A real stick is longer than shoulder width: the healthy hand stays on its own side.
  const aim = add(sideShoulder(t, -1), V(8, 7, 0)), d = sub(aim, hr), hl = add(hr, mul(d, Math.min(len(d), 26) / len(d)));
  return poseLR({ trunk: t,
    r: { ...standLegs(t, 1), hand: hr, pole: V(0, 0, 1) },
    l: { ...standLegs(t, -1), hand: within(sideShoulder(t, -1), hl, ARM), pole: V(0, 1, -0.5) },
    objects: [stickThrough(within(sideShoulder(t, -1), hl, ARM), hr)] });
}

// ---------- Extension with a stick behind the back: straight arms lift the stick backwards ----------
function stickExt(e) {
  const t = standT(), phi = -lerp(4, 40, smooth(e));
  const hand = sg => straight(sideShoulder(t, sg), phi, sg * 9);
  const side = sg => ({ ...standLegs(t, sg), hand: hand(sg), pole: V(-1, 0, 0.3 * sg) });
  const hr = hand(1);
  return poseLR({ trunk: t, r: side(1), l: side(-1), objects: [{ type: 'rope', w: STICK.w, points: [V(hr.x, hr.y, -13), V(hr.x, hr.y, 13)] }] });
}

// ---------- Seated, forearms resting on the thighs ----------
// The trunk leans so the elbows rest on the thighs; the forearms lie along them, hands past the knees.
const SEAT_HIP = V(CHAIR.x1 - 3, SEAT_HIP_Y);
const FA = { elbowX: SEAT_HIP.x + 5.5, y: SEAT_HIP.y - 2.4, z: 6.5 };
const FA_LEAN = solve(a => len(sub(trunk(SEAT_HIP, a).shoulderOf(1), V(FA.elbowX, FA.y, FA.z))) - L.upper, 0, 60);
function seatedForearms(rHand) {
  const t = trunk(SEAT_HIP, FA_LEAN, -0.5 * FA_LEAN);
  const side = sg => {
    const knee = V(SEAT_HIP.x + L.thigh, SEAT_HIP.y, sg * 5), ankle = V(knee.x, knee.y + L.shin, sg * 5);
    const elbow = V(FA.elbowX, FA.y, sg * FA.z), hand = V(FA.elbowX + L.fore, FA.y, sg * FA.z);
    return { knee, ankle, toe: footDir(ankle, 0), elbow, hand, ...rHand(sg, hand) };
  };
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}
const hammer = (hand, axis, objs = []) => [
  { type: 'rope', w: 1.8, points: [sub(hand, mul(axis, 2)), add(hand, mul(axis, 8))] },
  { type: 'ball', at: add(hand, mul(axis, 8.5)), r: 1.8 },
];
// Pronation-supination with a hammer: the forearm turns, the hammer tips in and out (right side).
function pronoSup(phi) {
  let objs = [];
  const p = seatedForearms((sg, hand) => {
    const ph = sg > 0 ? phi : 0, axis = V(0, -Math.cos(rad(ph)), sg * Math.sin(rad(ph)));
    if (sg > 0) objs = hammer(hand, axis);
    return { fingers: add(hand, V(L.palm, 0, 0)) };
  });
  return { ...p, objects: objs };
}
const PRONO = [
  hold(0.3, pronoSup(0)), { dur: 1.2, pose: e => pronoSup(75 * e) }, hold(0.5, pronoSup(75)), { dur: 2.0, pose: e => pronoSup(75 - 150 * e) },
  hold(0.5, pronoSup(-75)), { dur: 1.2, pose: e => pronoSup(-75 + 75 * e) },
];
// Wrist flexion-extension: palms down, the hands bend down and up past the knees.
const wristFlex = w => seatedForearms((sg, hand) => ({ fingers: add(hand, V(L.palm * Math.cos(rad(w)), L.palm * Math.sin(rad(w)), 0)) }));
const WRIST_FLEX = [
  hold(0.3, wristFlex(0)), { dur: 1.0, pose: e => wristFlex(65 * e) }, hold(0.4, wristFlex(65)), { dur: 1.8, pose: e => wristFlex(65 - 125 * e) },
  hold(0.4, wristFlex(-60)), { dur: 1.0, pose: e => wristFlex(-60 + 60 * e) },
];
// Radial-ulnar deviation, thumb up holding a hammer: the hand and the hammer tip up and down.
function wristDev(d) {
  let objs = [];
  const p = seatedForearms((sg, hand) => {
    const dir = V(Math.cos(rad(-d)), Math.sin(rad(-d)), 0), up_ = V(Math.sin(rad(-d)), -Math.cos(rad(-d)), 0);
    if (sg > 0) objs = hammer(add(hand, mul(dir, 2)), up_);
    return sg > 0 ? { fingers: add(hand, mul(dir, L.palm)) } : {};
  });
  return { ...p, objects: objs };
}
const WRIST_DEV = [
  hold(0.3, wristDev(0)), { dur: 1.0, pose: e => wristDev(22 * e) }, hold(0.4, wristDev(22)), { dur: 1.6, pose: e => wristDev(22 - 50 * e) },
  hold(0.4, wristDev(-28)), { dur: 1.0, pose: e => wristDev(-28 + 28 * e) },
];

// ---------- Elastic band, standing ----------
const BAND_Y = elbowAtSide(standT(), 1).y;
// Rotation against a band anchored to the side: external (anchor on the other side) or internal.
function bandRot(th, anchorZ) {
  const t = standT(), hr = forearmAt(t, 1, th);
  return poseLR({ trunk: t,
    r: { ...standLegs(t, 1), elbow: elbowAtSide(t, 1), hand: hr },
    l: { ...standLegs(t, -1), hand: straight(sideShoulder(t, -1), 0, -9) },
    objects: [{ type: 'band', a: V(A + 3, BAND_Y, anchorZ), b: hr }] });
}
// Row: band anchored in front at chest height, the hands come back beside the ribs.
const ROW_ANCHOR = V(A + 34, 22, 0);
function bandRow(e) {
  const t = standT(), k = smooth(e);
  const side = sg => {
    const S = sideShoulder(t, sg), out = straight(S, 82, sg * 8.5), back = V(S.x + 1, S.y + 9.5, sg * 10);
    return { ...standLegs(t, sg), hand: vlerp(out, back, k), pole: V(-1, 0.3, sg * 0.5) };
  };
  const p = poseLR({ trunk: t, r: side(1), l: side(-1) });
  return { ...p, objects: ['r', 'l'].map(s => ({ type: 'band', a: ROW_ANCHOR, b: p[s].hand })) };
}
// Straight-arm pull-down: band anchored high in front, straight arms come down to the thighs.
const PULL_ANCHOR = V(A + 30, -6, 0);
function bandPull(e) {
  const t = standT(), phi = lerp(95, 0, smooth(e));
  const side = sg => ({ ...standLegs(t, sg), hand: straight(sideShoulder(t, sg), phi, sg * 9), pole: V(0, 1, 0.3 * sg) });
  const p = poseLR({ trunk: t, r: side(1), l: side(-1) });
  return { ...p, objects: ['r', 'l'].map(s => ({ type: 'band', a: PULL_ANCHOR, b: p[s].hand })) };
}
// Clamshell with a band around the knees (same movement as the clamshell).
const clamBand = e => { const p = clam(e); return { ...p, objects: [{ type: 'band', a: p.r.knee, b: p.l.knee }] }; };

// ======================= Isometrics and scapula =======================

// ---------- Quadriceps set: legs straight, the knee presses down onto a towel, hold ----------
const TOWEL = { type: 'wheel', at: V(SUP.pelvis.x + L.thigh, FLOOR_TOP - 1.4, 0), r: 1.4, hw: 9 };
function quadSet(e) {
  const t = lyingTrunk(SUP.pelvis);
  const leg = (sg, k) => {
    const bend = 6 * (1 - smooth(k));               // slight bend over the towel, straight when pressing
    const dir = V(Math.cos(rad(bend)), -Math.sin(rad(bend)));
    return { ...legFrom(sideHip(t, sg), dir, 2 * bend, lerp(-80, -100, smooth(k))), ...armsAlong(t, sg) };
  };
  return poseLR({ trunk: t, r: leg(1, e), l: leg(-1, 0), objects: [TOWEL] });
}
// ---------- Isometric external rotation: elbow at the side, the back of the hand pushes a wall ----------
const ISO_TH = 18;
const ISO_HAND = forearmAt(standT(), 1, ISO_TH);
const WALL_SIDE = { type: 'box', x0: A - 6, x1: A + 22, top: -14, z0: ISO_HAND.z + 0.9, z1: ISO_HAND.z + 2.9 };
function isoER(e) {
  const t = standT(), th = lerp(0, ISO_TH, smooth(e)), hr = forearmAt(t, 1, th);
  return poseLR({ trunk: t,
    r: { ...standLegs(t, 1), elbow: elbowAtSide(t, 1), hand: hr },
    l: { ...standLegs(t, -1), hand: straight(sideShoulder(t, -1), 0, -9) } });
}
// ---------- Scapular elevation and depression: shrug up, then draw the shoulders down ----------
function scapStand(up, fwd = 0) {
  const t = trunk(V(A, STAND_Y), 0, 0, { scap: { r: { up, fwd }, l: { up, fwd } } });
  const side = sg => ({ ...standLegs(t, sg), hand: straight(sideShoulder(t, sg), 0, sg * 9), pole: V(0, 1, 0.3 * sg) });
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}
const SHRUG = [
  hold(0.3, scapStand(0)), { dur: 0.9, pose: e => scapStand(3.2 * smooth(e)) }, hold(0.6, scapStand(3.2)),
  { dur: 1.4, pose: e => scapStand(lerp(3.2, -1.6, smooth(e))) }, hold(0.6, scapStand(-1.6)), { dur: 0.8, pose: e => scapStand(-1.6 * (1 - smooth(e))) },
];
// ---------- Scapular retraction: the shoulder blades squeeze together, arms relaxed ----------
const scapRetract = e => scapStand(0, lerp(0.6, -2.8, smooth(e)));
// ---------- Supine protraction (serratus punch): straight arms push the hands to the ceiling ----------
function scapPunch(e) {
  const fwd = 3.2 * smooth(e);
  const t = lyingTrunk(SUP.pelvis, -90, { scap: { r: { fwd }, l: { fwd } } });
  const side = sg => ({ ...hookLeg(t, sg), hand: straight(sideShoulder(t, sg), 180, sg * 7.5), pole: V(0, 0, sg) });
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

export const EXERCISES_F = [
  // ---------- Ankle ----------
  {
    id: 'bombeo-tobillo', name: 'Bombeo de tobillos', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, still: 0.25,
    cue: 'Tumbado con las piernas estiradas, lleva las puntas de los pies hacia ti y después estíralas, a ritmo constante.',
    phases: [{ dur: 1.4, ease: s => s, pose: anklePump }],
  },
  // ---------- Knee ----------
  {
    id: 'deslizamiento-talon', name: 'Deslizamiento de talón', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, still: 1.6,
    cue: 'Desliza el talón por el suelo hacia el glúteo doblando la rodilla y vuelve a estirar despacio.',
    phases: both(rep(heelSlide, 1.4, 0.5, 1.3)),
  },
  {
    id: 'extension-rodilla-rodillo', name: 'Extensión de rodilla sobre rodillo', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, still: 1.4,
    cue: 'Con un rodillo bajo las rodillas, estira una rodilla levantando el talón y mantén unos segundos sin despegar el muslo.',
    glow: [['r.hip', 'r.knee'], ['l.hip', 'l.knee']],
    phases: both([hold(0.3, shortArc(0)), { dur: 1.0, pose: shortArc }, isoHold(1.5, shortArc(1), 1), { dur: 1.0, pose: e => shortArc(1 - e) }]),
  },
  {
    id: 'elevacion-pierna-recta', name: 'Elevación de pierna recta', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, still: 1.5,
    cue: 'Con la otra rodilla doblada, tensa el muslo y eleva la pierna estirada hasta la altura de la otra rodilla.',
    phases: [...SLR_PHASES, ...mirrored(SLR_PHASES)],
  },
  // ---------- Standing ----------
  {
    id: 'elevacion-talones', name: 'Elevación de talones', still: 1.3, props: [WALL_FRONT],
    cue: 'De pie con las manos en la pared, sube de puntillas despacio y baja controlando hasta apoyar los talones.',
    phases: rep(p => heelRaise(p), 0.9, 0.5, 1.3),
  },
  {
    id: 'elevacion-talones-unipodal', name: 'Elevación de talones a una pierna', still: 1.8, props: [WALL_FRONT],
    cue: 'Apoyado en una sola pierna y con las manos en la pared, sube de puntillas y baja lentamente.',
    phases: both(RAISES_ONE),
  },
  {
    id: 'equilibrio-unipodal', name: 'Equilibrio a una pierna', still: 2.5,
    cue: 'Sostente sobre una pierna con la rodilla de apoyo ligeramente flexionada y la pelvis nivelada.',
    phases: both(BALANCE_ONE),
  },
  {
    id: 'sentadilla-pared', name: 'Sentadilla isométrica en pared', still: 2.5, props: [WALL_BACK],
    cue: 'Espalda apoyada en la pared, baja hasta que las rodillas queden a unos 90° y mantén la posición.',
    glow: [['r.hip', 'r.knee'], ['l.hip', 'l.knee']],
    phases: [hold(0.4, wallSit(0)), { dur: 1.6, pose: wallSit }, isoHold(3, wallSit(1)), { dur: 1.6, pose: e => wallSit(1 - e) }],
  },
  {
    id: 'sentarse-levantarse', name: 'Sentarse y levantarse de la silla', still: 1.4, props: [CHAIR_PROP],
    cue: 'Brazos cruzados, inclina el tronco adelante y levántate empujando con las dos piernas; siéntate despacio.',
    phases: [
      hold(0.5, sitStand(1)), { dur: 1.8, pose: e => sitStand(1 - e) },
      hold(0.6, sitStand(0)), { dur: 2.0, pose: e => sitStand(e) },
    ],
  },
  {
    id: 'extension-rodilla-sentado', name: 'Extensión de rodilla sentado', still: 1.4, props: [CHAIR_PROP],
    cue: 'Sentado con la espalda recta, estira la rodilla hasta dejar la pierna horizontal, mantén y baja despacio.',
    phases: both(rep(seatedExt, 1.1, 1.0, 1.3)),
  },
  {
    id: 'bajada-escalon', name: 'Bajada de escalón', still: 1.5, props: [STEP_PROP],
    cue: 'De pie en el escalón, flexiona la rodilla de apoyo y baja el otro pie hasta rozar el suelo con el talón; vuelve a subir.',
    phases: both(rep(e => stepDown(e), 1.5, 0.3, 1.2)),
  },
  // ---------- Side-lying and prone ----------
  {
    id: 'almeja', name: 'Almeja', views: ['side', 'front'], isoCam: { yaw: 25, pitch: 30 }, still: 1.3,
    cue: 'Tumbado de lado con caderas y rodillas dobladas, separa la rodilla de arriba sin despegar los pies ni girar la pelvis.',
    phases: rep(clam, 1.0, 0.6, 1.2),
  },
  {
    id: 'abduccion-cadera-lateral', name: 'Abducción de cadera de lado', views: ['side', 'front'], isoCam: { yaw: 25, pitch: 30 }, still: 1.3,
    cue: 'Tumbado de lado con las piernas estiradas, eleva la pierna de arriba ligeramente hacia atrás, sin girar la pelvis.',
    phases: rep(sideAbd, 1.0, 0.6, 1.2),
  },
  {
    id: 'extension-cadera-prono', name: 'Extensión de cadera boca abajo', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, still: 1.4,
    cue: 'Boca abajo con la frente sobre las manos, aprieta el glúteo y eleva la pierna estirada unos centímetros sin arquear la zona lumbar.',
    phases: both(rep(proneExt, 1.0, 0.8, 1.1)),
  },
  // ---------- Shoulder, standing ----------
  {
    id: 'pendulo-codman', name: 'Péndulo de Codman', still: 1.5, props: [TABLE], isoCam: { yaw: 40, pitch: 25 },
    cue: 'Inclinado hacia delante con una mano en la mesa, deja colgar el otro brazo relajado y dibuja círculos pequeños moviendo el cuerpo.',
    phases: PENDULUM,
  },
  {
    id: 'deslizamiento-pared', name: 'Deslizamiento en pared', still: 1.6, props: [WALL_SLIDE],
    cue: 'De cara a la pared con los antebrazos apoyados, deslízalos hacia arriba sin encoger los hombros y baja despacio.',
    phases: rep(wallSlide, 1.6, 0.5, 1.6),
  },
  // ---------- Isometrics and scapula ----------
  {
    id: 'contraccion-cuadriceps', name: 'Contracción isométrica de cuádriceps', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, still: 1.5,
    glow: [['r.hip', 'r.knee'], ['l.hip', 'l.knee']],
    cue: 'Tumbado con las piernas estiradas y una toalla bajo la rodilla, aprieta el muslo empujando la rodilla contra la toalla y mantén.',
    phases: both([hold(0.3, quadSet(0)), { dur: 0.5, pose: quadSet }, isoHold(3, quadSet(1), 1), { dur: 0.6, pose: e => quadSet(1 - e) }]),
  },
  {
    id: 'isometria-rotacion-externa', name: 'Isometría de rotación externa', views: ['front', 'top'], isoCam: { yaw: 50, pitch: 40 }, still: 1.5,
    props: [WALL_SIDE], glow: [['r.shoulder', 'r.elbow']],
    cue: 'De lado a la pared con el codo pegado al cuerpo y doblado a 90°, empuja la pared con el dorso de la mano, sin moverte, y mantén.',
    phases: [hold(0.3, isoER(0)), { dur: 0.6, pose: isoER }, isoHold(4, isoER(1)), { dur: 0.6, pose: e => isoER(1 - e) }],
  },
  {
    id: 'elevacion-depresion-escapular', name: 'Elevación y depresión escapular', views: ['front', 'side'], still: 1.3,
    cue: 'De pie con los brazos relajados, sube los hombros hacia las orejas y después bájalos alejándolos de ellas.',
    phases: SHRUG,
  },
  {
    id: 'retraccion-escapular', name: 'Retracción escapular', views: ['top', 'side'], isoCam: { yaw: 30, pitch: 50 }, still: 1.3,
    cue: 'De pie con los brazos relajados, junta las escápulas llevando los hombros hacia atrás, sin subirlos, y mantén.',
    phases: rep(scapRetract, 0.9, 1.2, 1.0),
  },
  {
    id: 'protraccion-escapular-supino', name: 'Protracción escapular en supino', views: ['side', 'front'], isoCam: { yaw: 18, pitch: 35 }, still: 1.2,
    cue: 'Tumbado con los brazos estirados hacia el techo, empuja las manos hacia arriba separando los hombros del suelo, sin doblar los codos.',
    phases: rep(scapPunch, 0.8, 0.8, 1.0),
  },
  // ---------- Shoulder with a stick ----------
  {
    id: 'rotacion-externa-baston', name: 'Rotación externa con bastón', views: ['top', 'front'], isoCam: { yaw: 30, pitch: 55 }, still: 1.4,
    cue: 'De pie con los codos pegados al cuerpo y doblados a 90°, empuja el bastón con la mano sana para girar el antebrazo afectado hacia fuera.',
    phases: rep(stickER, 1.4, 1.0, 1.4),
  },
  {
    id: 'rotacion-interna-baston', name: 'Rotación interna con bastón', views: ['side', 'front'], isoCam: { yaw: 150, pitch: 15 }, still: 1.4,
    cue: 'Con el bastón detrás de la espalda, una mano arriba y la afectada abajo, tira hacia arriba con la de arriba para subir la de abajo por la espalda.',
    phases: rep(stickIR, 1.4, 1.0, 1.4),
  },
  {
    id: 'abduccion-hombro-baston', name: 'Abducción de hombro con bastón', views: ['front', 'side'], still: 1.5,
    cue: 'De pie con el bastón en las manos, empuja con el brazo sano para subir de lado el brazo afectado, estirado.',
    phases: rep(stickAbd, 1.5, 0.8, 1.5),
  },
  {
    id: 'extension-hombro-baston', name: 'Extensión de hombro con bastón', views: ['side', 'front'], still: 1.3,
    cue: 'De pie con el bastón detrás del cuerpo y los brazos estirados, sepáralo hacia atrás sin inclinar el tronco.',
    phases: rep(stickExt, 1.2, 0.8, 1.2),
  },
  // ---------- Forearm and wrist ----------
  {
    id: 'pronosupinacion', name: 'Pronosupinación con martillo', hands: true, views: ['front', 'side'], props: [CHAIR_PROP], still: 1.5,
    cue: 'Sentado con el antebrazo apoyado en el muslo y el martillo en vertical, gira el antebrazo para tumbar el martillo hacia fuera y hacia dentro.',
    phases: PRONO,
  },
  {
    id: 'flexo-extension-muneca', name: 'Flexión y extensión de muñeca', hands: true, views: ['side', 'front'], props: [CHAIR_PROP], still: 1.4,
    cue: 'Sentado con los antebrazos en los muslos y las manos fuera, palmas abajo, baja y sube las manos moviendo sólo la muñeca.',
    phases: WRIST_FLEX,
  },
  {
    id: 'desviacion-muneca', name: 'Desviación radial y cubital', hands: true, views: ['side', 'front'], props: [CHAIR_PROP], still: 1.4,
    cue: 'Sentado con el antebrazo en el muslo y el pulgar arriba, sujeta el martillo y muévelo arriba y abajo sólo con la muñeca.',
    phases: WRIST_DEV,
  },
  // ---------- Elastic band ----------
  {
    id: 'rotacion-externa-banda', name: 'Rotación externa con banda', views: ['top', 'front'], isoCam: { yaw: 30, pitch: 55 }, still: 1.4,
    cue: 'Con la banda anclada al otro lado y el codo pegado al cuerpo, gira el antebrazo hacia fuera y vuelve despacio.',
    phases: rep(e => bandRot(lerp(-35, 50, smooth(e)), -24), 1.2, 0.6, 1.5),
  },
  {
    id: 'rotacion-interna-banda', name: 'Rotación interna con banda', views: ['top', 'front'], isoCam: { yaw: 30, pitch: 55 }, still: 1.4,
    cue: 'Con la banda anclada del mismo lado y el codo pegado al cuerpo, lleva el antebrazo hacia el abdomen y vuelve despacio.',
    phases: rep(e => bandRot(lerp(45, -40, smooth(e)), 26), 1.2, 0.6, 1.5),
  },
  {
    id: 'remo-banda', name: 'Remo con banda', still: 1.4,
    cue: 'Con la banda anclada delante a la altura del pecho, tira llevando los codos atrás y juntando las escápulas.',
    phases: rep(bandRow, 1.1, 0.6, 1.4),
  },
  {
    id: 'extension-hombro-banda', name: 'Extensión de hombro con banda', still: 1.4,
    cue: 'Con la banda anclada arriba y delante, baja los brazos estirados hasta los muslos y vuelve despacio.',
    phases: rep(bandPull, 1.2, 0.5, 1.5),
  },
  {
    id: 'almeja-banda', name: 'Almeja con banda', views: ['side', 'front'], isoCam: { yaw: 25, pitch: 30 }, still: 1.3,
    cue: 'Como la almeja, con una banda elástica por encima de las rodillas: separa la rodilla de arriba contra la banda.',
    phases: rep(clamBand, 1.0, 0.6, 1.2),
  },
  // ---------- Cervical ----------
  {
    id: 'retraccion-cervical', name: 'Retracción cervical', face: true, props: [CHAIR_PROP], still: 1.6,
    cue: 'Sentado con la espalda recta, lleva la cabeza hacia atrás como para hacer papada, mirando al frente, y vuelve despacio.',
    glow: [['shoulderC', 'neckTop']],
    phases: [hold(0.4, chinTuck(0)), { dur: 1.0, pose: chinTuck }, isoHold(2, chinTuck(1)), { dur: 1.0, pose: e => chinTuck(1 - e) }],
  },
  {
    id: 'flexo-extension-cervical', name: 'Flexión y extensión cervical', face: true, props: [CHAIR_PROP], still: 1.6,
    cue: 'Sentado con la espalda recta, baja la barbilla hacia el pecho y después mira hacia arriba, sin forzar el final.',
    phases: NECK_FLEX,
  },
  {
    id: 'rotacion-cervical', name: 'Rotación cervical', face: true, views: ['front', 'side'], props: [CHAIR_PROP], still: 1.6,
    cue: 'Sentado con la espalda recta, gira la cabeza para mirar por encima de un hombro y después del otro, sin girar los hombros.',
    phases: sides(neckTurn),
  },
  {
    id: 'inclinacion-cervical', name: 'Inclinación cervical', face: true, views: ['front', 'side'], props: [CHAIR_PROP], still: 1.6,
    cue: 'Sentado con la espalda recta, acerca la oreja al hombro sin levantarlo y después hacia el otro lado.',
    phases: sides(neckSide),
  },
  // ---------- Spine ----------
  {
    id: 'basculacion-pelvica', name: 'Báscula pélvica', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, still: 2.3,
    cue: 'Tumbado con las rodillas dobladas, aplana la zona lumbar contra el suelo y después arquéala suavemente, moviendo sólo la pelvis.',
    phases: TILT_PHASES,
  },
  {
    id: 'gato-camello', name: 'Gato-camello', views: ['side', 'front'], isoCam: { yaw: 25, pitch: 25 }, still: 2.0,
    cue: 'A cuatro patas, redondea la espalda hacia el techo metiendo la barbilla y después hunde la espalda levantando la mirada, despacio.',
    phases: CAT_PHASES,
  },
  {
    id: 'extension-codos-prono', name: 'Extensión lumbar sobre codos', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 30 }, still: 2.5,
    cue: 'Boca abajo, apóyate en los antebrazos con los codos bajo los hombros y deja que la zona lumbar se arquee, con la pelvis en el suelo.',
    phases: [hold(0.4, sphinx(0)), { dur: 1.6, pose: sphinx }, hold(2.5, sphinx(1)), { dur: 1.4, pose: e => sphinx(1 - e) }],
  },
  {
    id: 'extension-mckenzie', name: 'Extensión lumbar con brazos', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 30 }, still: 1.8,
    cue: 'Boca abajo con las manos a la altura de la cabeza, empuja con los brazos para levantar el tronco dejando la pelvis y las piernas relajadas en el suelo.',
    phases: [hold(0.4, pressUp(0)), { dur: 1.4, pose: pressUp }, hold(0.8, pressUp(1)), { dur: 1.4, pose: e => pressUp(1 - e) }],
  },
  // ---------- Hip ----------
  {
    id: 'puente-una-pierna', name: 'Puente a una pierna', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, still: 1.5,
    cue: 'Con una pierna estirada en línea con el muslo, sube la cadera apoyando sólo el otro pie, sin que la pelvis se incline.',
    phases: both(BRIDGE_ONE),
  },
  // ---------- Shoulder ----------
  {
    id: 'flexion-hombro-baston', name: 'Flexión de hombro con bastón', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, still: 1.8,
    cue: 'Tumbado con las rodillas dobladas, sube el bastón con los brazos estirados por encima de la cabeza; el brazo sano ayuda al otro.',
    phases: rep(stickFlexion, 1.8, 0.6, 1.6, 0.4),
  },
];
