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
const swapLR = p => { const q = transformPose(p, mirror); return { ...q, r: q.l, l: q.r }; };
const mirrored = phases => phases.map(ph => ({ ...ph, pose: e => swapLR(ph.pose(e)) }));
const both = phases => [...phases, ...mirrored(phases)];
// Out, hold, back: the usual shape of a slow therapeutic repetition.
const rep = (f, out, top, back, rest = 0.3) => [hold(rest, f(0)), { dur: out, pose: f }, hold(top, f(1)), { dur: back, pose: e => f(1 - e) }];

// ======================= Lying face up =======================

// The neck bends up and the head rests on the floor (as in batch B).
const HEAD_REST_Y = FLOOR_TOP - HEAD_R - 1.7;
function lyingTrunk(pelvis, alpha = -90) {
  const t0 = trunk(pelvis, alpha);
  const neckDir = -74;
  const neckY = t0.shoulderC.y - L.neck * Math.cos(rad(neckDir));
  const c = clamp01((neckY - HEAD_REST_Y) / L.head);
  return trunk(pelvis, alpha, 0, { neckDir, headDir: -deg(Math.acos(c)) });
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
    phases: both(rep(shortArc, 1.0, 1.0, 1.0)),
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
    phases: [hold(0.4, wallSit(0)), { dur: 1.6, pose: wallSit }, hold(3, wallSit(1)), { dur: 1.6, pose: e => wallSit(1 - e) }],
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
