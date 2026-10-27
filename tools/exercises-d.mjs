// Exercise library, batch D: the rest of the catalogue (benches, bars, cables, carries,
// crawling, rolling and the Turkish get-up). Same conventions as the other batches.
import {
  A, V, L, Z, HEAD_R, FLOOR_TOP, legs, foot, footFlat, footFromShin, trunk, reach, straight, kneeIK,
  circles, poseLR, pose, mirrorSide, up, down, rot2, along, add, sub, mul, len, vlerp, lerp, smooth, smoother,
  bump, deg, rad, solve, balance, transformPose, rollX, rotZ,
} from './engine.mjs';
import { carry } from './exercises-c.mjs';

const F = 58;                                     // floor contact line
const hold = (dur, p) => ({ hold: true, dur, pose: () => p });
const sym = (t, r, extra = {}) => poseLR({ trunk: t, r, l: mirrorSide(r), ...extra });
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
const handTo = (t, sg, hand) => within(sideShoulder(t, sg), hand, ARM);
const hipHands = (t, sg) => { const c = t.at(1.5, 1.8); return { hand: V(c.x, c.y, c.z + sg * 10), pole: V(-0.5, 0, sg) }; };

// Lying face up: the neck bends up so the head rests on the surface whose contact line is `restY`.
function restHead(t0, restY) {
  const neckDir = -74;
  const neckY = t0.shoulderC.y - L.neck * Math.cos(rad(neckDir));
  const c = Math.min(1, Math.max(0, (neckY - (restY - HEAD_R - 1.7)) / L.head));
  return { neckDir, headDir: -deg(Math.acos(c)) };
}

// ---------- Good morning: bar on the back, soft knees, hinge to near horizontal ----------
function goodMorning(d) {
  const lg = legs({ shin: 5 * d, thigh: -28 * d, stance: 5, out: 0 });
  const a = 78 * d;
  const t = trunk(lg.hip, a, -0.4 * a);
  const b = t.at(15.6, -2.6);
  const hand = V(b.x, b.y, 12.5);
  return pose({ legs: lg, trunk: t, hand, pole: V(-0.4, 1, 0.6), objects: [{ type: 'barbell', at: hand }] });
}

// ---------- Hip thrust: shoulder blades on a bench, bar across the hips ----------
const HT = { S: V(22, 42), bench: { type: 'box', x0: 4, x1: 23, top: 43.9, hz: 8 } };
const HT_ANKLE_X = HT.S.x + L.sh + Math.sqrt(L.thigh ** 2 - (F - L.shin - HT.S.y) ** 2);
function hipThrust(u) {
  const g = rad(lerp(38, 0, u));                          // trunk below horizontal
  const hip = V(HT.S.x + L.sh * Math.cos(g), HT.S.y + L.sh * Math.sin(g));
  const alpha = deg(Math.atan2(-Math.cos(g), Math.sin(g)));
  const t = trunk(hip, alpha, 0, { neckDir: alpha + 25, headDir: alpha + 35 });
  const ankle = V(HT_ANKLE_X, F, 6);
  const [k1, k2] = circles(hip, L.thigh, ankle, L.shin);
  const bar = t.at(0.5, 4.5);
  return sym(t, { knee: withZ(k1.y < k2.y ? k1 : k2, 6), ankle, toe: footFlat(ankle), hand: V(bar.x, bar.y, 12), pole: V(0, 1, 0.6) },
    { objects: [{ type: 'barbell', at: bar }] });
}

// ---------- Front squat: bar in the front rack, elbows high ----------
function frontSquat(d) {
  const lg = legs({ shin: 34 * d, thigh: -104 * d, stance: 6, out: 2.4 });
  return balance(a => {
    const t = trunk(lg.hip, a, -0.3 * a);
    const r = t.at(15.4, 3.6), hand = V(r.x, r.y, 9);
    return pose({ legs: lg, trunk: t, hand, pole: V(1, -0.35, 0.35), load: { m: 0.8, x: hand.x }, objects: [{ type: 'barbell', at: hand }] });
  }, -15, 70);
}

// ---------- Box squat: sit back onto a box with vertical shins ----------
const BSQ = (() => {
  const hip = legs({ shin: 16, thigh: -92 }).hip;
  return { type: 'box', x0: A - 24, x1: A - 5, top: hip.y + 2.4, hz: 9 };
})();
function boxSquat(d) {
  const lg = legs({ shin: 16 * d, thigh: -92 * d, stance: 6.5, out: 2.4 });
  const phi = 90 * smooth(d);
  return balance(a => {
    const t = trunk(lg.hip, a, -0.35 * a);
    return pose({ legs: lg, trunk: t, hand: straight(t.shoulder, phi, 6), pole: V(0, 1, 0) });
  });
}

// ---------- Wall ball: front squat with the ball, drive and throw to the target, catch ----------
const WB = { r: 4.5, wall: { type: 'box', x0: A + 21, x1: A + 23, top: -14, hz: 16 } };
const WB_TARGET = V(WB.wall.x0 - WB.r - 0.4, -7, 0);
function wallBall(d, p, flight = null) {
  const lg = legs({ shin: 34 * d, thigh: -104 * d, stance: 6, out: 2.4 });
  return balance(a => {
    const t = trunk(lg.hip, a, -0.3 * a - 25 * p);
    const S = t.shoulder, chest = t.at(12.5, 5.5);
    const rel = V(S.x + 6, S.y - 18, 0);
    const c = vlerp(V(chest.x, chest.y, 0), rel, p);
    const ball = flight === null ? c : add(vlerp(rel, WB_TARGET, bump(flight)), V(0, -3 * bump(2 * flight), 0));
    return pose({ legs: lg, trunk: t, hand: V(c.x, c.y, 4.6), pole: V(0.2, 1, 0.8), load: { m: 0.15, x: c.x },
      objects: [{ type: 'ball', at: ball, r: WB.r }] });
  }, -15, 70);
}

// ---------- Side lunge: wide stance, shift onto one leg, the other stays straight ----------
const SL = { stance: 16, shift: 9 };
const SL_TOP = F - Math.sqrt(LEG ** 2 - (SL.stance - Z.hip) ** 2) + 0.1;
function sideLunge(e, side) {
  const shift = side * SL.shift * e;
  const t = trunk(V(A - 5 * e, lerp(SL_TOP, 41.8, e)), 35 * e, -10 * e, { shift });
  const c = t.at(11, 5);
  const s = sg => ({ ...legTo(t, sg, V(A, F, sg * SL.stance), 0, V(1, 0, 0.6 * sg)), hand: V(c.x, c.y, shift + sg * 2.5), pole: V(0, 1, sg) });
  return poseLR({ trunk: t, r: s(1), l: s(-1) });
}

// ---------- Bulgarian split squat: rear foot on a bench ----------
const BU = { bench: { type: 'box', x0: A - 36, x1: A - 21.5, top: 46, hz: 8 }, rear: V(A - 23.5, 46 - 1.9, -4.5) };
function bulgarian(e) {
  const lg = legs({ shin: lerp(2, 12, e), thigh: lerp(-22, -86, e), stance: 4.5, out: 0 });
  const t = trunk(lg.hip, 8 + 10 * e, -6);
  const front = { knee: lg.knee, ankle: lg.ankle, toe: footFlat(lg.ankle), ...hipHands(t, 1) };
  const rear = { knee: kneeIK(sideHip(t, -1), BU.rear, V(0.3, 1, 0)), ankle: BU.rear, toe: footDir(BU.rear, 180), ...hipHands(t, -1) };
  return poseLR({ trunk: t, r: front, l: rear });
}

// ---------- Single-leg Romanian deadlift: the free leg continues the line of the trunk ----------
function slRdl(d) {
  const lg = legs({ shin: 6 * d, thigh: -16 * d, stance: 4.5, out: 0 });
  const a = 70 * d;
  const t = trunk(lg.hip, a, -0.45 * a);
  const dir = V(-Math.sin(rad(a + 12 * d)), Math.cos(rad(a + 12 * d)));   // free leg a little above the trunk line
  const hipL = sideHip(t, -1);
  const kneeL = along(hipL, dir, L.thigh), ankleL = withZ(along(kneeL, dir, L.shin), -4.5);
  const fd = rot2(dir, -90 - 25 * bump(d));
  const handR = straight(sideShoulder(t, 1), 0, 8.5), handL = straight(sideShoulder(t, -1), 0, -8.5);
  return poseLR({
    trunk: t,
    r: { knee: lg.knee, ankle: lg.ankle, toe: footFlat(lg.ankle), hand: handR },
    l: { knee: withZ(kneeL, -4.3), ankle: ankleL, toe: foot(ankleL, fd.x, fd.y), hand: handL },
    objects: [{ type: 'kb', at: handL, phi: 0 }],
  });
}

// ---------- Bench press: lying on a bench, bar from the lower chest to over the shoulders ----------
const BP = { pelvis: V(36, 44 - 1.9), bench: { type: 'box', x0: 12, x1: 40, top: 44, hz: 7 } };
function benchPress(u) {
  const t0 = trunk(BP.pelvis, -90);
  const t = trunk(BP.pelvis, -90, 0, restHead(t0, BP.pelvis.y));
  const ankle = V(BP.pelvis.x + 17, F, 7);
  const [k1, k2] = circles(BP.pelvis, L.thigh, ankle, L.shin);
  const chest = t.at(12, 4), R = reach(11);
  const top = V(t.shoulderC.x + 1.5, t.shoulderC.y - Math.sqrt(R * R - 2.25) + 0.02);
  const c = vlerp(chest, top, u);
  return sym(t, { knee: withZ(k1.y < k2.y ? k1 : k2, 7), ankle, toe: footFlat(ankle), hand: V(c.x, c.y, 11), pole: V(0.3, 1, 0.8) },
    { objects: [{ type: 'barbell', at: V(c.x, c.y, 0) }] });
}

// ---------- Dips: hands on parallel bars, knees bent, lean forward at the bottom ----------
const DP = { x: 32, y: 28, z: 12 };
const DP_BARS = { type: 'lines', w: 2.4, segs: [-1, 1].flatMap(sg => [
  [V(16, DP.y, sg * DP.z), V(46, DP.y, sg * DP.z)], [V(18, DP.y, sg * DP.z), V(18, FLOOR_TOP, sg * DP.z)], [V(44, DP.y, sg * DP.z), V(44, FLOOR_TOP, sg * DP.z)],
]) };
function dips(u) {
  const R = reach(DP.z);
  const S = V(lerp(DP.x - 0.5, DP.x + 3, u), lerp(DP.y - Math.sqrt(R * R - 0.25) + 0.02, DP.y - 8, u));
  const alpha = lerp(5, 22, u);
  const t = trunk(sub(S, mul(up(alpha), L.sh)), alpha, -0.3 * alpha);
  const thighDir = down(10);
  const knee = along(sideHip(t, 1), thighDir, L.thigh), ankle = along(knee, rot2(thighDir, 80), L.shin);
  return sym(t, { knee, ankle, toe: footFromShin(knee, ankle, 45), hand: V(DP.x, DP.y, DP.z), pole: V(-1, 0, 0.25) });
}

// ---------- One-arm dumbbell row: left knee and hand on the bench ----------
const DR = { pelvis: V(28, 47 - 1.9 - L.thigh), bench: { type: 'box', x0: 14, x1: 46, top: 47, z0: -14, z1: -1 } };
function dbRow(u) {
  const t = trunk(DR.pelvis, 80, -35);
  const cY = DR.bench.top - 1.9;
  const kneeL = V(DR.pelvis.x, cY, -5), ankleL = V(DR.pelvis.x - L.shin, cY, -5);
  const S = sideShoulder(t, 1);
  const hang = straight(S, 0, 9), row = t.at(9, 3);
  const hand = vlerp(hang, V(row.x, row.y, 9), u);
  return poseLR({
    trunk: t,
    r: { ...legTo(t, 1, V(27, F, 8), 0), hand, pole: V(-1, -0.5, 0.2) },
    l: { knee: kneeL, ankle: ankleL, toe: footDir(ankleL, 180), hand: V(t.shoulderC.x + 1.5, cY, -8), pole: V(-1, 0, 0) },
    objects: [{ type: 'db', at: hand }],
  });
}

// ---------- Inverted row: under a fixed bar, heels down, body rigid ----------
const IR = { ax: 62, ay: 56, bar: 32, handZ: 10 };
function irBody(beta) {
  const d = V(-Math.cos(rad(beta)), -Math.sin(rad(beta)));
  const ankle = V(IR.ax, IR.ay, 3.5);
  return { d, ankle, knee: withZ(along(ankle, d, L.shin), 3.8), pelvis: along(V(IR.ax, IR.ay), d, L.shin + L.thigh), S: along(V(IR.ax, IR.ay), d, L.shin + L.thigh + L.sh) };
}
const IR_BOTTOM = solve(b => irBody(b).S.y - (IR.bar + 20.6), 0, 40);
const IR_X = irBody(IR_BOTTOM).S.x;
const IR_TOP = solve(b => irBody(b).S.y - (IR.bar + 4), 0, 60);
const IR_BAR = { type: 'lines', w: 2.4, segs: [[V(IR_X, IR.bar, -16), V(IR_X, IR.bar, 16)], [V(IR_X, IR.bar, -16), V(IR_X, FLOOR_TOP, -16)], [V(IR_X, IR.bar, 16), V(IR_X, FLOOR_TOP, 16)]] };
function invertedRow(u) {
  const b = irBody(lerp(IR_BOTTOM, IR_TOP, u));
  const t = trunk(b.pelvis, -(90 - lerp(IR_BOTTOM, IR_TOP, u)));
  return sym(t, { knee: b.knee, ankle: b.ankle, toe: foot(b.ankle, 0.35, -0.94), hand: V(IR_X, IR.bar, IR.handZ), pole: V(0, 1, 0.8) });
}

// ---------- Side plank: forearm plank rolled onto the left side; the top arm reaches up ----------
function sidePlank(e) {
  // Body frame: face-down plank along x. Rolled +90° about x the left side faces the floor
  // and the chest faces +z (towards the side camera).
  const t = trunk(V(30, 0), 90, 0);
  const leg = sg => {
    const hip = sideHip(t, sg), back = V(-1, 0);
    const knee = withZ(along(hip, back, L.thigh), sg * 3), ankle = withZ(along(knee, back, L.shin), sg * 2);
    return { knee, ankle, toe: foot(ankle, 0, 1, 0) };    // no splay: after the roll it would point into the floor
  };
  const onHip = V(t.pelvis.x + 1, 0, 10), raised = add(sideShoulder(t, 1), V(0, 0, ARM));
  const body = poseLR({
    trunk: t,
    r: { ...leg(1), hand: within(sideShoulder(t, 1), vlerp(onHip, raised, e), ARM), pole: V(0, -1, 0.3) },
    l: { ...leg(-1), hand: add(sideShoulder(t, -1), V(0, 0, -ARM)) },
  });
  const rolled = transformPose(body, rollX(90, V(0, 0, 0)));
  // Tilt in the sagittal plane so the left ankle sits 11.5 below the left shoulder (elbow on the floor).
  const pivot = rolled.l.shoulder;
  const gamma = solve(g => rotZ(g, pivot)(rolled.l.ankle).y - pivot.y - L.upper, -60, 0);
  const tilted = transformPose(rolled, rotZ(gamma, pivot));
  const sh = tilted.l.shoulder;
  const p = transformPose(tilted, q => V(q.x + 32 - 30, q.y + (F - L.upper - sh.y), q.z));
  const elbow = add(p.l.shoulder, V(0, L.upper, 0));
  p.l = { ...p.l, elbow, hand: add(elbow, V(0, 0, L.fore)) };
  return p;
}

// ---------- Pallof press: anti-rotation, the cable pulls from the left side ----------
const PF_ANCHOR = V(A + 4, 20, -48);
function pallof(u) {
  const lg = legs({ shin: 8, thigh: -14, stance: 7, out: 0 });
  const t = trunk(lg.hip, 3);
  const S = t.shoulder, chest = t.at(11.5, 4.5);
  const c = vlerp(chest, V(S.x + 19.5, S.y + 3, 0), u);
  return pose({ legs: lg, trunk: t, hand: V(c.x, c.y, 1.2), pole: V(0, 1, 0.5),
    objects: [{ type: 'cord', a: PF_ANCHOR, b: V(c.x, c.y, 0) }] });
}

// ---------- Woodchop: cable from high right to low left, the trunk turns with the arms ----------
const WC_ANCHOR = V(A + 6, -12, 46);
function woodchop(u) {
  const lg = legs({ shin: 10 * u, thigh: -18 * u, stance: 7, out: 1 });
  const t = trunk(lg.hip, 6 + 14 * u, 0, { twist: lerp(32, -32, u) });
  const S = t.shoulderC;
  const hi = V(S.x + 11, S.y - 12, 8), lo = V(S.x + 9, S.y + 15, -8);
  const c = add(vlerp(hi, lo, u), V(3 * bump(u), 0, 0));
  const side = sg => ({ knee: mirrorIf(lg.knee, sg), ankle: mirrorIf(lg.ankle, sg), toe: footFlat(mirrorIf(lg.ankle, sg)), hand: handTo(t, sg, add(c, V(0, 0, sg * 1.2))), pole: V(0, 1, 0.3 * sg) });
  return poseLR({ trunk: t, r: side(1), l: side(-1), objects: [{ type: 'cord', a: WC_ANCHOR, b: c }] });
}
function mirrorIf(q, sg) { return sg > 0 ? q : V(q.x, q.y, -q.z); }

// ---------- Ab wheel rollout: from kneeling, roll out to a long body and back ----------
const AW = { kx: 14, wheel: { r: 3.8, hw: 2.4 } };
const AW_Y = FLOOR_TOP - AW.wheel.r - 0.8;
function abWheel(u) {
  const hip = along(V(AW.kx, F), up(55 * u), L.thigh);
  const t = trunk(hip, lerp(55, 82, u), lerp(15, 5, u));
  const S = t.shoulderC, R = reach(3.5) - 0.02;
  const hx = S.x + Math.sqrt(R * R - (AW_Y - S.y) ** 2);
  const knee = V(AW.kx, F, 4.5), ankle = V(AW.kx - L.shin, F, 4.5);
  return sym(t, { knee, ankle, toe: footDir(ankle, 180), hand: V(hx, AW_Y, 3.5), pole: V(0, 1, 0.3) },
    { objects: [{ type: 'wheel', at: V(hx, AW_Y, 0), ...AW.wheel }] });
}

// ---------- High plank shared by mountain climbers ----------
const HP = (() => {
  const toe = V(4, F, 3), S_Y = F - 20.3;
  const at = beta => {
    const d = V(Math.cos(rad(beta)), -Math.sin(rad(beta)));
    const f = rot2(d, -70);
    const ankle = V(toe.x + L.foot * f.x, toe.y + L.foot * f.y, 3);
    return { d, ankle, S: along(ankle, d, L.shin + L.thigh + L.sh) };
  };
  const beta = solve(b => at(b).S.y - S_Y, 0, 60), k = at(beta);
  return {
    pelvis: along(k.ankle, k.d, L.shin + L.thigh), alpha: 90 - beta, ankle: k.ankle, handX: k.S.x,
    footAng: deg(Math.atan2(toe.y - k.ankle.y, toe.x - k.ankle.x)),
  };
})();
function climbers(s) {
  const t = trunk(HP.pelvis, HP.alpha, 0);
  const side = (sg, k) => {
    const tuck = V(t.pelvis.x + 2, 51, sg * 4.5);
    const ankle = add(vlerp(withZ(HP.ankle, sg * 3), tuck, smooth(k)), V(0, -2.5 * bump(k), 0));
    return { ...legTo(t, sg, ankle, lerp(HP.footAng, 65, smooth(k)), V(0.3, 1, 0.2 * sg)), hand: V(HP.handX, F, sg * 10), pole: V(-0.3, 0.2, 0.8 * sg) };
  };
  const k = (1 - Math.cos(2 * Math.PI * s)) / 2;
  return poseLR({ trunk: t, r: side(1, k), l: side(-1, 1 - k) });
}

// ---------- Battle ropes: half squat, alternating arm waves ----------
const BR = { anchor: 76, n: 16 };
function wave(hand, sg, s) {
  const pts = [], ph = sg > 0 ? 0 : Math.PI;
  for (let k = 0; k <= BR.n; k++) {
    const u = k / BR.n, base = 57.6 + (hand.y - 57.6) * Math.pow(1 - u, 2.2);
    const y = base + 5 * Math.sin(Math.PI * u) * (1 - 0.6 * u) * Math.sin(2 * Math.PI * (2 * u - s) + ph);
    pts.push(V(lerp(hand.x, BR.anchor, u), Math.min(58.6, y), lerp(hand.z, sg * 3, u)));
  }
  return pts;
}
function battleRopes(s) {
  const lg = legs({ shin: 16, thigh: -50, stance: 7, out: 1.5 });
  const t = trunk(lg.hip, 22, -10);
  const side = sg => {
    const w = Math.sin(2 * Math.PI * s + (sg > 0 ? 0 : Math.PI));
    const lgS = sg > 0 ? lg : { knee: mirrorIf(lg.knee, -1), ankle: mirrorIf(lg.ankle, -1) };
    return { knee: lgS.knee, ankle: lgS.ankle, toe: footFlat(lgS.ankle), hand: handTo(t, sg, V(t.shoulderC.x + 13, t.pelvis.y + 1 - 7 * w, sg * 9)), pole: V(-0.2, 1, 0.5 * sg) };
  };
  const r = side(1), l = side(-1);
  return poseLR({ trunk: t, r, l, objects: [{ type: 'rope', points: wave(r.hand, 1, s), w: 2.2 }, { type: 'rope', points: wave(l.hand, -1, s), w: 2.2 }] });
}

// ---------- Kettlebell clean (right arm): hike, hip snap, bell lands in the rack ----------
function cleanPose(e) {                            // e: 0 hike between the legs, 1 rack
  const ext = smoother(e / 0.55);
  const lg = legs({ shin: lerp(9, 0, ext), thigh: lerp(-38, 0, ext), stance: 6.5, out: 1 });
  const alpha = lerp(58, 0, ext);
  const t = trunk(lg.hip, alpha, -0.4 * alpha);
  const S = sideShoulder(t, 1);
  const armPhi = -25 * (1 - ext);
  const k = smooth((e - 0.25) / 0.75);
  const rack = t.at(13.5, 4.2);
  const hand = handTo(t, 1, vlerp(straight(S, armPhi, 2), V(rack.x, rack.y, 5), k));
  const r = { knee: lg.knee, ankle: lg.ankle, toe: footFlat(lg.ankle), hand, pole: V(0.3, 1, 0.2) };
  const l = { ...mirrorSide({ knee: lg.knee, ankle: lg.ankle, toe: footFlat(lg.ankle) }), hand: straight(sideShoulder(t, -1), 8 * ext, -8.5) };
  return poseLR({ trunk: t, r, l, objects: [{ type: 'kb', at: hand, phi: lerp(armPhi, -20, k) }] });
}

// ---------- Bear crawl: on hands and toes, knees hovering, opposite limbs move together ----------
const BC = { pelvis: V(24, 41), alpha: 78, stride: 4, lift: 3.5, duty: 0.6 };
function limbCycle(ph) {
  if (ph < BC.duty) return { dx: BC.stride * (1 - 2 * ph / BC.duty), lift: 0 };
  const k = (ph - BC.duty) / (1 - BC.duty);
  return { dx: -BC.stride + 2 * BC.stride * smooth(k), lift: BC.lift * bump(k) };
}
function bearCrawl(s) {
  const t = trunk(BC.pelvis, BC.alpha, 15);
  const side = (sg, phHand, phFoot) => {
    const h = limbCycle(phHand), f = limbCycle(phFoot);
    const ankle = V(BC.pelvis.x - 4 + f.dx, 53.8 - f.lift, sg * 5);
    return { ...legTo(t, sg, ankle, 45, V(1, 0.3, 0.2 * sg)), hand: handTo(t, sg, V(t.shoulderC.x + h.dx, F - h.lift, sg * 9)), pole: V(-0.3, 0, 0.5 * sg) };
  };
  return poseLR({ trunk: t, r: side(1, s, (s + 0.5) % 1), l: side(-1, (s + 0.5) % 1, s) });
}

// ---------- Sled push: long lean, arms bent on the posts, driving the legs on the spot ----------
const SP = { pelvis: V(A + 1, 36), alpha: 55, cx: A - 5, stride: 7, handle: V(A + 26, 32) };
const SLED = [
  { type: 'box', x0: A + 27, x1: A + 43, top: 50, hz: 10 },
  { type: 'lines', w: 2.2, segs: [-1, 1].map(sg => [V(A + 28, 50, sg * 7), V(A + 26, 30, sg * 7)]).concat([[V(A + 26, 30, -7), V(A + 26, 30, 7)]]) },
];
function sledPush(s) {
  const t = trunk(add(SP.pelvis, V(0, -0.6 * Math.cos(4 * Math.PI * s))), SP.alpha, -20);
  const side = (sg, ph) => {
    let x, lift, p;
    if (ph < 0.55) { const k = ph / 0.55; x = SP.cx + SP.stride * (1 - 2 * k); lift = 0; p = 35; }
    else { const k = (ph - 0.55) / 0.45; x = SP.cx - SP.stride + 2 * SP.stride * smooth(k); lift = 7 * bump(k); p = 35 - 25 * bump(k); }
    const ankle = V(x, F - lift - L.foot * Math.sin(rad(p)), sg * 4.5);
    return { ...legTo(t, sg, ankle, p), hand: V(SP.handle.x, SP.handle.y, sg * 7), pole: V(0, 1, 0.3 * sg) };
  };
  return poseLR({ trunk: t, r: side(1, s), l: side(-1, (s + 0.5) % 1) });
}

// ---------- Turkish get-up: key positions interpolated with IK, the bell always overhead ----------
// A state: pelvis, trunk lean, neck/head directions, and per side the ankle, foot angle,
// knee pole and hand ('up' = right arm locked out above the shoulder).
const TG = { px: 30 };
function tgState(pelvis, alpha, head, r, l) { return { pelvis, alpha, head, r, l }; }
const TG_REST = (() => { const t0 = trunk(V(TG.px, F), -90); return restHead(t0, F); })();
const legR0 = { ankle: V(TG.px + 13, F, 6), ang: 0, kp: V(0, -1, 0.2) };
const legL0 = { ankle: V(TG.px + 25.5, 57, -10), ang: -80, kp: V(0, -1, 0) };
const plant = V(TG.px - 17, F, -13);
const TGS = [
  tgState(V(TG.px, F), -90, TG_REST, { ...legR0, hand: 'up' }, { ...legL0, hand: V(TG.px - 5, F, -24), hp: V(0, -1, 0) }),
  tgState(V(TG.px, F), -60, { neckDir: -60, headDir: -50 }, { ...legR0, hand: 'up' }, { ...legL0, hand: V(TG.px - 7, F, -19), hp: V(0, 0.3, -1) }),
  tgState(V(TG.px, F), -30, { neckDir: -30, headDir: -20 }, { ...legR0, hand: 'up' }, { ...legL0, hand: plant, hp: V(-0.3, 0, -1) }),
  tgState(V(TG.px + 2, 47), -75, { neckDir: -60, headDir: -45 }, { ...legR0, hand: 'up' }, { ...legL0, hand: plant, hp: V(-0.3, 0, -1) }),
  tgState(V(TG.px - 1, 44.5), -70, { neckDir: -50, headDir: -30 }, { ankle: V(TG.px + 12, F, 6), ang: 0, kp: V(1, 0, 0.2), hand: 'up' },
    { ankle: V(TG.px - 14.5, F, -6), ang: -180, kp: V(0.2, 1, 0), hand: plant, hp: V(-0.3, 0, -1) }),
  tgState(V(TG.px - 1, 44.5), 0, { neckDir: 0, headDir: 0 }, { ankle: V(TG.px + 12, F, 6), ang: 0, kp: V(1, 0, 0.2), hand: 'up' },
    { ankle: V(TG.px - 14.5, F, -6), ang: -180, kp: V(0.2, 1, 0), hand: 'hang', hp: V(0, 1, -0.3) }),
  tgState(V(TG.px + 12, 31), 0, { neckDir: 0, headDir: 0 }, { ankle: V(TG.px + 12, F, 4.5), ang: 0, kp: V(1, 0, 0.2), hand: 'up' },
    { ankle: V(TG.px + 12, F, -4.5), ang: 0, kp: V(1, 0, -0.2), hand: 'hang', hp: V(0, 1, -0.3) }),
];
function tgu(a, b, e, { liftL = 0, pelvisPath = null } = {}) {
  const pelvis = pelvisPath ? pelvisPath(e) : vlerp(a.pelvis, b.pelvis, e);
  const t = trunk(pelvis, lerp(a.alpha, b.alpha, e), 0, { neckDir: lerp(a.head.neckDir, b.head.neckDir, e), headDir: lerp(a.head.headDir, b.head.headDir, e) });
  const side = (sg, A1, B1, lift) => {
    const S = sideShoulder(t, sg);
    const handOf = st => (st.hand === 'up' ? add(S, V(0.3, -ARM, 0)) : st.hand === 'hang' ? straight(S, 5, sg * 8.5) : st.hand);
    const hand = within(S, vlerp(handOf(A1), handOf(B1), e), ARM);
    const ankle = add(vlerp(A1.ankle, B1.ankle, e), V(0, -lift * bump(e), 0));
    return { ...legTo(t, sg, ankle, lerp(A1.ang, B1.ang, e), vlerp(A1.kp, B1.kp, e)), hand, pole: vlerp(A1.hp || V(0.3, 0, 0.5 * sg), B1.hp || V(0.3, 0, 0.5 * sg), e) };
  };
  const r = side(1, a.r, b.r, 0), l = side(-1, a.l, b.l, liftL);
  return poseLR({ trunk: t, r, l, objects: [{ type: 'kb', at: r.hand, phi: 0 }] });
}
// Standing up from the half kneel: the hips rise first, then move over the front foot.
const tgStandPath = e => V(lerp(TGS[5].pelvis.x, TGS[6].pelvis.x, smooth((e - 0.3) / 0.7)), lerp(TGS[5].pelvis.y, TGS[6].pelvis.y, smooth(e / 0.8)));
function tguPhases() {
  const steps = [[0, 1, 1.0], [1, 2, 0.9], [2, 3, 0.9], [3, 4, 1.2, { liftL: 3 }], [4, 5, 1.0], [5, 6, 1.4, { liftL: 4, pelvisPath: tgStandPath }]];
  const fwd = steps.map(([i, j, dur, o]) => ({ dur, pose: e => tgu(TGS[i], TGS[j], e, o) }));
  const back = steps.slice().reverse().map(([i, j, dur, o]) => ({ dur: dur * 0.9, pose: e => tgu(TGS[i], TGS[j], 1 - e, o) }));
  return [hold(0.4, tgu(TGS[0], TGS[1], 0)), ...fwd, hold(0.6, tgu(TGS[5], TGS[6], 1, { pelvisPath: tgStandPath })), ...back];
}

const FLOOR = { views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 } };
export const EXERCISES_D = [
  {
    id: 'buenos-dias', name: 'Buenos días', still: 2.0,
    cue: 'Barra en la espalda y rodillas blandas; la cadera va atrás hasta que el tronco queda casi horizontal.',
    phases: [hold(0.4, goodMorning(0)), { dur: 1.4, pose: goodMorning }, hold(0.3, goodMorning(1)), { dur: 1.2, pose: s => goodMorning(1 - s) }],
  },
  {
    id: 'hip-thrust', name: 'Hip thrust', still: 1.5, props: [HT.bench], ...FLOOR, views: ['side', 'front'],
    cue: 'Escápulas en el banco y barra sobre la cadera; empujar hasta alinear rodillas, cadera y hombros.',
    phases: [hold(0.4, hipThrust(0)), { dur: 0.9, pose: hipThrust }, hold(0.6, hipThrust(1)), { dur: 1.1, pose: s => hipThrust(1 - s) }],
  },
  {
    id: 'sentadilla-frontal', name: 'Sentadilla frontal', still: 2.0,
    cue: 'Barra apoyada en los hombros con los codos altos; tronco muy vertical durante toda la bajada.',
    phases: [hold(0.4, frontSquat(0)), { dur: 1.5, pose: frontSquat }, hold(0.2, frontSquat(1)), { dur: 1.2, pose: s => frontSquat(1 - s) }],
  },
  {
    id: 'sentadilla-cajon', name: 'Sentadilla al cajón', still: 1.8, props: [BSQ],
    cue: 'Cadera atrás hasta sentarse en el cajón con las tibias verticales; pausa y subir sin balanceo.',
    phases: [hold(0.4, boxSquat(0)), { dur: 1.3, pose: boxSquat }, hold(0.6, boxSquat(1)), { dur: 1.0, pose: s => boxSquat(1 - s) }],
  },
  {
    id: 'wall-ball', name: 'Wall ball', still: 2.0, props: [WB.wall],
    cue: 'Sentadilla con el balón al pecho y, al subir, lanzamiento a la diana; se recoge y se vuelve a bajar.',
    phases: [
      hold(0.2, wallBall(0, 0)), { dur: 0.9, pose: d => wallBall(d, 0) }, hold(0.1, wallBall(1, 0)),
      { dur: 0.55, ease: s => s, pose: s => wallBall(1 - smoother(s / 0.65), smooth((s - 0.3) / 0.7)) },
      { dur: 1.0, ease: s => s, pose: s => wallBall(0, 1, s) },
      { dur: 0.45, pose: s => wallBall(0, 1 - s) },
    ],
  },
  {
    id: 'zancada-lateral', name: 'Zancada lateral', still: 1.4, isoCam: { yaw: 60, pitch: 25 },
    cue: 'Pies muy abiertos; la cadera va atrás y hacia un lado sobre esa pierna, la otra queda estirada.',
    phases: [
      hold(0.3, sideLunge(0, 1)), { dur: 1.0, pose: s => sideLunge(s, 1) }, hold(0.3, sideLunge(1, 1)), { dur: 0.9, pose: s => sideLunge(1 - s, 1) },
      hold(0.3, sideLunge(0, -1)), { dur: 1.0, pose: s => sideLunge(s, -1) }, hold(0.3, sideLunge(1, -1)), { dur: 0.9, pose: s => sideLunge(1 - s, -1) },
    ],
  },
  {
    id: 'sentadilla-bulgara', name: 'Sentadilla búlgara', still: 1.6, props: [BU.bench],
    cue: 'Empeine trasero sobre el banco; bajar en vertical con el peso en la pierna delantera.',
    phases: [hold(0.3, bulgarian(0)), { dur: 1.2, pose: bulgarian }, hold(0.25, bulgarian(1)), { dur: 1.0, pose: s => bulgarian(1 - s) }],
  },
  {
    id: 'peso-muerto-una-pierna', name: 'Peso muerto a una pierna', still: 1.9,
    cue: 'Apoyo en una pierna con la rodilla blanda; tronco y pierna libre suben y bajan como una sola pieza.',
    phases: [hold(0.4, slRdl(0)), { dur: 1.5, pose: slRdl }, hold(0.3, slRdl(1)), { dur: 1.3, pose: s => slRdl(1 - s) }],
  },
  {
    id: 'press-banca', name: 'Press de banca', still: 1.4, props: [BP.bench],
    cue: 'Escápulas juntas y pies firmes; la barra baja al pecho y sube hasta la vertical de los hombros.',
    phases: [hold(0.4, benchPress(1)), { dur: 1.1, pose: s => benchPress(1 - s) }, hold(0.2, benchPress(0)), { dur: 0.9, pose: benchPress }],
  },
  {
    id: 'fondos-paralelas', name: 'Fondos en paralelas', still: 1.5, props: [DP_BARS],
    cue: 'Brazos bloqueados arriba; bajar con el tronco algo inclinado hasta el codo a 90° y empujar.',
    phases: [hold(0.4, dips(0)), { dur: 1.1, pose: dips }, hold(0.2, dips(1)), { dur: 0.9, pose: s => dips(1 - s) }],
  },
  {
    id: 'remo-mancuerna', name: 'Remo con mancuerna', still: 1.1, props: [DR.bench],
    cue: 'Rodilla y mano en el banco, espalda plana; la mancuerna sube hacia la cadera con el codo pegado.',
    phases: [hold(0.4, dbRow(0)), { dur: 0.7, pose: dbRow }, hold(0.3, dbRow(1)), { dur: 0.9, pose: s => dbRow(1 - s) }],
  },
  {
    id: 'remo-invertido', name: 'Remo invertido', still: 1.4, props: [IR_BAR], ...FLOOR, views: ['side', 'front'],
    cue: 'Cuerpo en bloque apoyado en los talones; el pecho sube a la barra y baja hasta estirar los brazos.',
    phases: [hold(0.4, invertedRow(0)), { dur: 0.9, pose: invertedRow }, hold(0.3, invertedRow(1)), { dur: 1.1, pose: s => invertedRow(1 - s) }],
  },
  {
    id: 'suitcase-carry', name: 'Suitcase carry', still: 0.2,
    cue: 'Una pesa en una sola mano y el tronco recto, sin inclinarse hacia ese lado.',
    phases: [{ dur: 1.1, ease: s => s, pose: s => carry(s, { r: 'kb', l: 'free' }) }],
  },
  {
    id: 'overhead-carry', name: 'Overhead carry', still: 0.2,
    cue: 'Pesa bloqueada por encima del hombro, brazo vertical y costillas abajo mientras se camina.',
    phases: [{ dur: 1.1, ease: s => s, pose: s => carry(s, { r: 'overhead', l: 'free' }) }],
  },
  {
    id: 'plancha-lateral', name: 'Plancha lateral', still: 1.5, isoCam: { yaw: 20, pitch: 30 },
    cue: 'Codo bajo el hombro y cuerpo en línea; la mano libre sube al techo y vuelve a la cadera.',
    phases: [hold(0.5, sidePlank(0)), { dur: 1.2, pose: sidePlank }, hold(0.6, sidePlank(1)), { dur: 1.2, pose: s => sidePlank(1 - s) }],
  },
  {
    id: 'pallof-press', name: 'Pallof press', still: 1.5, isoCam: { yaw: 55, pitch: 25 },
    cue: 'La polea tira hacia un lado; las manos salen al frente y vuelven al pecho sin que el tronco gire.',
    phases: [hold(0.4, pallof(0)), { dur: 0.8, pose: pallof }, hold(0.8, pallof(1)), { dur: 0.8, pose: s => pallof(1 - s) }],
  },
  {
    id: 'lenador', name: 'Leñador', still: 0.9, isoCam: { yaw: 60, pitch: 25 },
    cue: 'De arriba a un lado hasta abajo al otro: brazos largos, el tronco gira y las piernas acompañan.',
    phases: [hold(0.3, woodchop(0)), { dur: 0.9, pose: woodchop }, hold(0.3, woodchop(1)), { dur: 1.2, pose: s => woodchop(1 - s) }],
  },
  {
    id: 'rueda-abdominal', name: 'Rueda abdominal', still: 1.4, ...FLOOR,
    cue: 'De rodillas, rodar hacia delante sin hundir la zona lumbar y volver tirando con el abdomen.',
    phases: [hold(0.4, abWheel(0)), { dur: 1.4, pose: abWheel }, hold(0.3, abWheel(1)), { dur: 1.2, pose: s => abWheel(1 - s) }],
  },
  {
    id: 'mountain-climbers', name: 'Mountain climbers', still: 0.2, ...FLOOR,
    cue: 'En plancha alta, las rodillas van al pecho alternando, rápido y sin subir la cadera.',
    phases: [{ dur: 0.8, ease: s => s, pose: climbers }],
  },
  {
    id: 'battle-ropes', name: 'Battle ropes', still: 0.25,
    cue: 'Media sentadilla y tronco firme; los brazos alternan ondas rápidas que recorren las cuerdas.',
    phases: [{ dur: 0.7, ease: s => s, pose: battleRopes }],
  },
  {
    id: 'cargada-kettlebell', name: 'Cargada con kettlebell', still: 1.0,
    cue: 'La cadera lanza la pesa, que sube pegada al cuerpo y se recoge en el pecho sin golpear el antebrazo.',
    phases: [hold(0.2, cleanPose(0)), { dur: 0.7, pose: cleanPose }, hold(0.5, cleanPose(1)), { dur: 0.7, pose: s => cleanPose(1 - s) }],
  },
  {
    id: 'turkish-get-up', name: 'Turkish get-up', still: 8.0, ...FLOOR,
    cue: 'De tumbado a de pie y vuelta, paso a paso, con la pesa siempre vertical sobre el hombro.',
    phases: tguPhases(),
  },
  {
    id: 'bear-crawl', name: 'Bear crawl', still: 0.2, ...FLOOR,
    cue: 'Manos y puntas de los pies en el suelo, rodillas a un palmo; avanzan a la vez mano y pie contrarios.',
    phases: [{ dur: 1.2, ease: s => s, pose: bearCrawl }],
  },
  {
    id: 'sled-push', name: 'Sled push', still: 0.2, props: SLED,
    cue: 'Cuerpo inclinado y brazos firmes en los postes; pasos cortos y potentes empujando el suelo.',
    phases: [{ dur: 0.9, ease: s => s, pose: sledPush }],
  },
];
