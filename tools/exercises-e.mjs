// Exercise library, batch E: mobility drills, stretches, running drills and jumps.
// Same conventions as the other batches. Two-sided drills play the right side and then the
// same phases mirrored (swapLR), so their rest pose must be symmetric.
import {
  A, V, L, Z, foot, footFromShin, trunk, reach, straight, kneeIK, circles, poseLR,
  mirror, up, down, rot2, along, add, sub, mul, len, vlerp, lerp, smooth, bump, deg, rad, solve,
  transformPose,
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
// 180 = pointing back).
const footDir = (ankle, ang) => foot(ankle, Math.cos(rad(ang)), Math.sin(rad(ang)));
// Ankle of a foot whose toes rest on the floor, pitched `p` degrees toes-down.
const onToes = (x, z, p) => V(x, F - L.foot * Math.sin(rad(Math.max(0, p))), z);
function legTo(t, sg, ankle, ang, pole = V(1, 0, 0.25 * sg)) {
  const h = sideHip(t, sg), a = within(h, ankle, LEG);
  return { knee: kneeIK(h, a, pole), ankle: a, toe: footDir(a, ang) };
}
// Foot relative to the shin (as footFromShin), turned up if needed so the toes stay off the floor.
function safeFoot(knee, ankle, plantar) {
  const toe = footFromShin(knee, ankle, plantar);
  if (toe.y <= F) return toe;
  const d = V(toe.x - ankle.x, toe.y - ankle.y), a = deg(Math.atan2(d.y, d.x));
  const max = deg(Math.asin(Math.max(-1, Math.min(1, (F - ankle.y) / L.foot))));
  return footDir(ankle, Math.abs(a) < 90 ? max : 180 - max);
}
// Straight leg hanging from the hip (standing on it, or the start of a swing).
function pillar(t, sg) {
  const hip = sideHip(t, sg), knee = along(hip, V(0, 1), L.thigh), ankle = along(knee, V(0, 1), L.shin);
  return { knee, ankle, toe: footDir(ankle, 0) };
}
const handTo = (t, sg, hand) => within(sideShoulder(t, sg), hand, ARM);
// Straight arm at `phi` degrees from hanging, hand `hz` out from the body centre line; works
// with a trunk shifted sideways.
function armPhi(t, sg, phi, hz = 8.5) {
  const S = sideShoulder(t, sg), h = straight(V(S.x, S.y, sg * Z.shoulder), phi, sg * hz);
  return V(h.x, h.y, h.z + t.shift);
}
// Straight arm raised sideways `a` degrees from hanging (a little in front of the body).
function armOut(t, sg, a) {
  const S = sideShoulder(t, sg), d = V(0.08, Math.cos(rad(a)), sg * Math.sin(rad(a)));
  return add(S, mul(d, ARM / len(d)));
}
const hipHands = (t, sg) => { const c = t.at(1.5, 1.8); return { hand: V(c.x, c.y, c.z + sg * 10), pole: V(-0.5, 0, sg) }; };
// The same pose with left and right exchanged (mirrored in z).
const swapLR = p => { const q = transformPose(p, mirror); return { ...q, r: q.l, l: q.r }; };
const mirrored = phases => phases.map(ph => ({ ...ph, pose: e => swapLR(ph.pose(e)) }));
// Interpolates two plain state objects (numbers and nested objects, e.g. points) field by field.
function mix(a, b, e) {
  if (typeof a === 'number') return lerp(a, b, e);
  return Object.fromEntries(Object.keys(a).map(k => [k, mix(a[k], b[k], e)]));
}
const upAngle = d => deg(Math.atan2(d.x, -d.y));  // inverse of up(): direction -> degrees

// ======================= Mobility =======================

// ---------- Arm circles: both arms straight, full circles in the sagittal plane ----------
function armCircles(s) {
  const t = trunk(V(A, STAND_Y), 0);
  const side = sg => ({ ...pillar(t, sg), hand: straight(sideShoulder(t, sg), 360 * s, sg * 9) });
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

// ---------- Leg swings: the right leg swings forward and back, arms out for balance ----------
// env fades the swing in and out so every cycle starts and ends standing on both feet.
function legSwing(s) {
  const env = smooth(s / 0.15) * smooth((1 - s) / 0.15);
  const th = env * (18 + 42 * Math.sin(2 * Math.PI * 3 * s));      // hip angle, forward positive
  const t = trunk(V(A, STAND_Y), -0.08 * th);
  const hip = sideHip(t, 1), thighDir = down(th);
  const knee = along(hip, thighDir, L.thigh);
  const ankle = along(knee, rot2(thighDir, 12 * env), L.shin);
  const arms = sg => ({ hand: armOut(t, sg, 50 * smooth(s / 0.1) * smooth((1 - s) / 0.1) + 5), pole: V(0, 1, sg) });
  return poseLR({
    trunk: t,
    r: { knee, ankle, toe: safeFoot(knee, ankle, 7 * env), ...arms(1) },
    l: { ...pillar(t, -1), ...arms(-1) },
  });
}

// ---------- Walkout: fold, walk the hands out to a high plank and back ----------
const WO = { toe: 12, handZ: 9, fold: -10, handF: 14 };
const WO_R = reach(WO.handZ) - 1.5;               // shoulder-to-hand distance, elbows soft
// Straight legs pivoting on the toes: foot pitched `p`, legs `g` degrees from vertical.
function pikeLegs(p, g, toe = WO.toe) {
  const ankle = V(toe - L.foot * Math.cos(rad(p)), F - L.foot * Math.sin(rad(p)));
  const knee = along(ankle, up(g), L.shin);
  return { ankle, knee, hip: along(knee, up(g), L.thigh) };
}
// High plank: body straight from the ankle, foot 70° from the body line, hands under the shoulders.
const WO_PLANK = (() => {
  const at = g => {
    const d = up(g), f = rot2(d, -70);
    const ankle = V(WO.toe + L.foot * f.x, F + L.foot * f.y);
    return { ankle, S: along(ankle, d, LEG + 0.02 + L.sh) };
  };
  const g = solve(g => at(g).S.y - (F - WO_R), 60, 89), k = at(g);
  return { g, p: deg(Math.atan2(F - k.ankle.y, WO.toe - k.ankle.x)), hand: k.S.x };
})();
function woBody(prog, hr, hl, lift = [0, 0]) {
  const lg = pikeLegs(WO_PLANK.p * smooth(prog), lerp(WO.fold, WO_PLANK.g, prog));
  const mid = V((hr + hl) / 2, F);
  const S = circles(lg.hip, L.sh, mid, WO_R)[1];
  const alpha = upAngle(sub(S, lg.hip));
  const t = trunk(lg.hip, alpha, -12 * (1 - prog));
  const side = (sg, hx, l) => ({
    knee: withZ(lg.knee, sg * 4.3), ankle: withZ(lg.ankle, sg * 4.5), toe: footDir(withZ(lg.ankle, sg * 4.5), WO_PLANK.p * smooth(prog)),
    hand: handTo(t, sg, V(hx, F - l, sg * WO.handZ)), pole: V(-0.3, 0, sg),
  });
  return poseLR({ trunk: t, r: side(1, hr, lift[0]), l: side(-1, hl, lift[1]) });
}
// Hands walk out in six alternating steps (right hand first).
function walkout(u) {
  const steps = 6, at = [0, 0], lift = [0, 0];
  for (let i = 0; i < steps; i++) {
    const k = Math.min(1, Math.max(0, u * steps - i)), h = i % 2;
    at[h] += smooth(k) / (steps / 2);
    lift[h] += 2.5 * bump(k);
  }
  const hx = q => lerp(WO.handF, WO_PLANK.hand, q);
  return woBody((at[0] + at[1]) / 2, hx(at[0]), hx(at[1]), lift);
}
// From standing to the fold: the hips go back, the trunk folds and the hands reach the floor.
function woHinge(e) {
  const end = walkout(0);
  const lg = pikeLegs(0, WO.fold * e);
  const t = trunk(lg.hip, end.alpha * smooth(e), -12 * smooth(e));
  const side = sg => {
    const hand = vlerp(straight(sideShoulder(t, sg), 0, sg * WO.handZ), end[sg > 0 ? 'r' : 'l'].hand, smooth(e));
    return { knee: withZ(lg.knee, sg * 4.3), ankle: withZ(lg.ankle, sg * 4.5), toe: footDir(withZ(lg.ankle, sg * 4.5), 0), hand: handTo(t, sg, hand), pole: V(-0.3, 0, sg) };
  };
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

// ---------- Squat to stand: fold and hold the toes, sink into a deep squat, arms up ----------
const STS = {
  stand: { shin: 0, thigh: 0, alpha: 0, neck: 0, toes: 0, phi: 0 },
  fold: { shin: 8, thigh: -22, alpha: 115, neck: -20, toes: 1, phi: 0 },
  squat: { shin: 36, thigh: -112, alpha: 35, neck: -10, toes: 1, phi: 0 },
  reach: { shin: 36, thigh: -112, alpha: 22, neck: 0, toes: 0, phi: 170 },
};
function squatToStand(st) {
  const ankle = sg => V(A, F, sg * 5);
  // Legs as legs() does, but kept here so the knees can open sideways with the depth.
  const flex = Math.min(1, Math.max(0, (st.shin - st.thigh) / 120));
  const knee = V(A + L.shin * Math.sin(rad(st.shin)), F - L.shin * Math.cos(rad(st.shin)), 5 + 2.5 * flex);
  const hip = V(knee.x + L.thigh * Math.sin(rad(st.thigh)), knee.y - L.thigh * Math.cos(rad(st.thigh)));
  const t = trunk(hip, st.alpha, st.neck);
  const side = sg => {
    const grip = V(A + 5, F - 1, sg * 6.5);
    const free = straight(sideShoulder(t, sg), st.phi, sg * 8.5);
    return { knee: withZ(knee, sg * knee.z), ankle: ankle(sg), toe: footDir(ankle(sg), 0), hand: handTo(t, sg, vlerp(free, grip, st.toes)), pole: V(0.2, 1, 0.6 * sg) };
  };
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}
const sts = (a, b) => e => squatToStand(mix(STS[a], STS[b], e));

// ---------- Quadruped thoracic rotation: hand behind the head, elbow down, then to the ceiling ----------
const QD = { knee: V(26, F), alpha: 72 };
const QD_T0 = trunk(V(QD.knee.x, F - L.thigh), QD.alpha, 22);
const QD_HAND = QD_T0.shoulderC.x + 3;            // support hands a little ahead of the shoulders, elbows soft
function kneelLegs(t, sg) {
  const knee = V(QD.knee.x, F, sg * 4.5), ankle = V(QD.knee.x - L.shin, F, sg * 4.5);
  return { knee, ankle, toe: footDir(ankle, 180) };
}
// e: hand from the floor to behind the head; tw: trunk twist (positive = right shoulder up).
function thoracic(e, tw) {
  const t = trunk(V(QD.knee.x, F - L.thigh), QD.alpha, 22, { twist: tw });
  const s = Math.sin(rad(QD.alpha)), c = Math.cos(rad(QD.alpha));
  const zr = V(-Math.sin(rad(tw)) * c, -Math.sin(rad(tw)) * s, Math.cos(rad(tw)));   // right, turned with the twist
  const back = V(-c * Math.cos(rad(tw)), -s * Math.cos(rad(tw)), -Math.sin(rad(tw)));         // dorsal, turned
  const nape = add(t.neckTop, add(mul(back, 3), mul(zr, 4)));
  const floor = V(QD_HAND, F, 9);
  const hand = add(vlerp(floor, nape, smooth(e)), V(0, -4 * bump(e), 0));
  return poseLR({
    trunk: t,
    r: { ...kneelLegs(t, 1), hand: handTo(t, 1, hand), pole: add(mul(zr, 1), V(0, 0.3 * (1 - e), 0)) },
    l: { ...kneelLegs(t, -1), hand: V(QD_HAND, F, -9), pole: V(0, 0.3, -1) },
  });
}

// ---------- World's greatest stretch: deep lunge, elbow to the instep, arm to the ceiling ----------
const WG = { pelvis: V(24, 46), alpha: 70, front: V(40, F, 6), back: onToes(2, -4.5, 60) };
function wgs(dip, open) {                         // dip: elbow towards the instep; open: arm up
  const tw = -15 * dip + 50 * open;
  const t = trunk(WG.pelvis, WG.alpha, -10, { twist: tw });
  const s = Math.sin(rad(WG.alpha)), c = Math.cos(rad(WG.alpha));
  const zr = V(-Math.sin(rad(tw)) * c, -Math.sin(rad(tw)) * s, Math.cos(rad(tw)));
  const S = sideShoulder(t, 1);
  const rest = V(40, F, 12), instep = V(36.5, 52.5, 3), sky = add(S, mul(zr, ARM));
  const hand = open > 0 ? vlerp(rest, sky, open) : vlerp(rest, instep, dip);
  return poseLR({
    trunk: t,
    r: { ...legTo(t, 1, WG.front, 0, V(1, -0.2, 0.2)), hand: handTo(t, 1, add(hand, V(0, -3 * bump(open), 0))), pole: open > 0 ? V(0, -0.3, 1) : V(-0.3, 1, 0.5) },
    l: { ...legTo(t, -1, WG.back, 60, V(0.2, 1, 0)), hand: V(38, F, -4), pole: V(-0.5, 0, -1) },
  });
}

// ======================= Stretches =======================

// ---------- Standing hamstring stretch: straight legs, hips back, fold with the arms hanging ----------
function hamstring(e) {
  const lg = pikeLegs(0, -7 * e, A + L.foot);
  const t = trunk(lg.hip, 105 * e, -25 * e);
  const side = sg => ({
    knee: withZ(lg.knee, sg * 4.3), ankle: withZ(lg.ankle, sg * 4.5), toe: footDir(withZ(lg.ankle, sg * 4.5), 0),
    hand: straight(sideShoulder(t, sg), 0, sg * 8), pole: V(0.3, 0, sg),
  });
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

// ---------- Standing quad stretch: heel to the glute, held at the instep ----------
function quadStretch(e) {
  const t = trunk(V(A, STAND_Y), 0);
  const hip = sideHip(t, 1), thighDir = down(-6 * e);
  const knee = along(hip, thighDir, L.thigh), ankle = along(knee, rot2(thighDir, 150 * e), L.shin);
  const toe = safeFoot(knee, ankle, 35 * e);
  const grip = vlerp(ankle, toe, 0.3);
  const hand = vlerp(straight(sideShoulder(t, 1), 0, 8.5), add(grip, V(0, 0, 1.2)), smooth((e - 0.25) / 0.75));
  return poseLR({
    trunk: t,
    r: { knee, ankle, toe, hand: handTo(t, 1, hand), pole: vlerp(V(0, 1, 1), V(-0.2, 0.3, 1), smooth(e)) },
    l: { ...pillar(t, -1), hand: handTo(t, -1, vlerp(straight(sideShoulder(t, -1), 0, -8.5), armOut(t, -1, 45), smooth(e))), pole: V(0, 1, -1) },
  });
}

// ---------- Half-kneeling hip flexor stretch: hips forward, same-side arm overhead ----------
const HF = { knee: V(A - 6, F, -4.5), front: V(A + 14, F, 5) };
function hipFlexor(e) {
  const hipL = along(HF.knee, up(22 * e), L.thigh);
  const t = trunk(V(hipL.x, hipL.y), -6 * e);
  const ankleL = V(HF.knee.x - L.shin, F, -4.5);
  const lh = hipHands(t, -1), over = armPhi(t, -1, 170, 6);
  return poseLR({
    trunk: t,
    r: { ...legTo(t, 1, HF.front, 0, V(1, -0.3, 0.2)), ...hipHands(t, 1) },
    l: { knee: HF.knee, ankle: ankleL, toe: footDir(ankleL, 180), hand: handTo(t, -1, add(vlerp(lh.hand, over, smooth(e)), V(4 * bump(e), 0, 0))), pole: vlerp(lh.pole, V(0, 0, -1), e) },
  });
}

// ---------- Child's pose: from all fours, sit back onto the heels with the arms long ----------
function childPose(e) {
  const k = smooth(e);
  const hip = along(QD.knee, up(-62 * k), L.thigh);
  const t = trunk(hip, lerp(QD.alpha, 95, k), 0, { neckDir: lerp(QD.alpha, 90, k), headDir: lerp(QD.alpha + 22, 78, k) });
  const side = sg => ({ ...kneelLegs(t, sg), hand: handTo(t, sg, V(lerp(QD_HAND, QD_HAND + 3, k), F, sg * 9)), pole: V(-0.3, -0.4, sg) });
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

// ---------- Downward dog: from a high plank the hips go up and back, heels towards the floor ----------
const DD = { toe: 10, handZ: 10 };
const DD_R = reach(DD.handZ) - 0.02;
const DD_PLANK = (() => {
  const at = g => {
    const d = up(g), f = rot2(d, -70);
    const ankle = V(DD.toe + L.foot * f.x, F + L.foot * f.y);
    const hip = along(ankle, d, L.shin + L.thigh);
    return { ankle, hip, S: along(hip, d, L.sh) };
  };
  const g = solve(g => at(g).S.y - (F - DD_R), 60, 89), k = at(g);
  return { p: deg(Math.atan2(F - k.ankle.y, DD.toe - k.ankle.x)), hand: V(k.S.x, F), reachHip: len(sub(k.hip, V(k.S.x, F))) };
})();
function downDog(e) {
  const p = lerp(DD_PLANK.p, 12, e);
  const ankle = V(DD.toe - L.foot * Math.cos(rad(p)), F - L.foot * Math.sin(rad(p)));
  const hip = circles(ankle, L.shin + L.thigh, DD_PLANK.hand, lerp(DD_PLANK.reachHip, L.sh + DD_R - 0.4, smooth(e))).sort((a, b) => a.y - b.y)[0];
  const S = circles(hip, L.sh, DD_PLANK.hand, DD_R)[1];
  const t = trunk(hip, upAngle(sub(S, hip)), 0);
  const knee = vlerp(ankle, hip, 0.5);
  const side = sg => ({ knee: withZ(knee, sg * 3.5), ankle: withZ(ankle, sg * 3), toe: footDir(withZ(ankle, sg * 3), p), hand: V(DD_PLANK.hand.x, F, sg * DD.handZ), pole: V(-0.5, 0, sg) });
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

// ---------- Cobra: lying face down, the arms lift the chest, hips stay on the floor ----------
const CB = { pelvis: V(32, F), hand: 45 };
function cobra(e) {
  const alpha = lerp(90, 52, e);
  const t = trunk(CB.pelvis, alpha, 0, { neckDir: lerp(60, alpha - 8, e), headDir: lerp(30, alpha - 20, e) });
  const side = sg => {
    const hip = sideHip(t, sg), knee = along(hip, V(-1, 0), L.thigh), ankle = along(knee, V(-1, 0), L.shin);
    return { knee, ankle, toe: footDir(ankle, 180), hand: V(CB.hand, F, sg * 10), pole: V(-0.3, -1, 0.5 * sg) };
  };
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

// ---------- Calf stretch at the wall: back leg straight with the heel down, lean in ----------
const CW = { wall: { type: 'box', x0: A + 24, x1: A + 26, top: -14, hz: 16 }, back: V(A - 12, F, -4.5), front: V(A + 2, F, 4.5) };
function calfStretch(e) {
  const g = lerp(24, 36, e);
  const kneeB = along(CW.back, up(g), L.shin), hipB = along(kneeB, up(g), L.thigh);
  const t = trunk(V(hipB.x, hipB.y), g, -0.7 * g);
  const wallHand = sg => V(CW.wall.x0 - 1.2, 21, sg * 9);
  return poseLR({
    trunk: t,
    r: { ...legTo(t, 1, CW.front, 0), hand: wallHand(1), pole: V(0, 1, 0.6) },
    l: { knee: withZ(kneeB, -4.3), ankle: CW.back, toe: footDir(CW.back, 0), hand: wallHand(-1), pole: V(0, 1, -0.6) },
  });
}

// ---------- Cross-body shoulder stretch: straight arm across the chest, pulled at the elbow ----------
function crossArm(e) {
  const t = trunk(V(A, STAND_Y), 0);
  const S = sideShoulder(t, 1), d = V(0.3, 0.05, -1), dl = len(d);
  const across = add(S, mul(d, ARM / dl));
  const k = smooth(e);
  const handR = add(vlerp(straight(S, 0, 8.5), across, k), V(8 * bump(k), 0, 0));
  const pull = add(S, mul(d, 12 / dl));
  const handL = vlerp(straight(sideShoulder(t, -1), 0, -8.5), add(pull, V(1.5, 0.6, 0)), smooth((e - 0.35) / 0.65));
  return poseLR({
    trunk: t,
    r: { ...pillar(t, 1), hand: handTo(t, 1, handR), pole: V(0.3, 1, 0.6) },
    l: { ...pillar(t, -1), hand: handTo(t, -1, handL), pole: V(0.3, 1, -0.6) },
  });
}

// ======================= Running drills (on the spot, treadmill style) =======================

// Periodic Catmull-Rom through key points [x, y, p] at even spacing, open ends (start/end given).
function spline(keys, k) {
  const n = keys.length - 1, u = Math.min(n - 1e-9, k * n), i = Math.floor(u), f = u - i;
  const P = j => keys[Math.max(0, Math.min(n, j))];
  return [0, 1, 2].map(c => {
    const p0 = P(i - 1)[c], p1 = P(i)[c], p2 = P(i + 1)[c], p3 = P(i + 2)[c];
    return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  });
}
// cfg: hipY, bob, lean, duty (stance share), land/push (stance x relative to the hip, foot pitch),
// swing keys [x, y above the floor, pitch], arm amplitude and elbow angle.
function runner(cfg) {
  const path = ph => {
    if (ph < cfg.duty) {
      const k = ph / cfg.duty, p = lerp(cfg.land[1], cfg.push[1], smooth((k - 0.5) / 0.5));
      return [lerp(cfg.land[0], cfg.push[0], k), F - L.foot * Math.sin(rad(Math.max(0, p))), p];
    }
    const keys = [[cfg.push[0], 0, cfg.push[1]], ...cfg.swing, [cfg.land[0], 0, cfg.land[1]]]
      .map(([x, h, p]) => [x, F - h - (h === 0 ? L.foot * Math.sin(rad(Math.max(0, p))) : 0), p]);
    const [x, y, p] = spline(keys, (ph - cfg.duty) / (1 - cfg.duty));
    return [x, Math.min(y, F - L.foot * Math.sin(rad(Math.max(0, Math.min(90, p))))), p];
  };
  return s => {
    const y = cfg.hipY + cfg.bob * Math.cos(4 * Math.PI * (s - cfg.duty / 2));
    const t = trunk(V(A, y), cfg.lean, -0.6 * cfg.lean);
    const side = (sg, ph) => {
      const [x, ay, p] = path(ph);
      const S = sideShoulder(t, sg), phi = -sg * cfg.arm * Math.cos(2 * Math.PI * s);
      const elbow = along(S, down(phi), L.upper), hand = along(elbow, rot2(down(phi), -cfg.elbow), L.fore);
      return { ...legTo(t, sg, V(A + x, ay, sg * 4), p, V(1, 0, 0.15 * sg)), hand, elbow };
    };
    return poseLR({ trunk: t, r: side(1, s), l: side(-1, (s + 0.5) % 1) });
  };
}
const RUN = runner({
  hipY: 32.4, bob: 1.0, lean: 8, duty: 0.35, land: [6, 0], push: [-9, 45], arm: 35, elbow: 90,
  swing: [[-15, 8, 70], [-9, 15, 80], [3, 15, 40], [9, 7, 10]],
});
const SKIP = runner({
  hipY: 28.6, bob: 1.0, lean: 0, duty: 0.4, land: [2, 35], push: [-2, 45], arm: 50, elbow: 85,
  swing: [[-1, 7, 55], [8, 14, 40], [11, 13, 35], [6, 6, 35]],
});
const KICKS = runner({
  hipY: 29.4, bob: 0.8, lean: 3, duty: 0.4, land: [2, 30], push: [-2, 40], arm: 30, elbow: 90,
  swing: [[-5, 10, 70], [-7, 21, 110], [-6, 24, 125], [-2, 10, 60]],
});

// ======================= Jumps =======================

// State: pelvis, trunk lean, neck, arm angles and per side the ankle (x, y, z) and foot pitch.
// shift moves the trunk sideways (skater jumps).
function jumper(st, pole = V(1, 0, 0)) {
  const t = trunk(V(st.px, st.py), st.alpha, st.neck ?? -0.3 * st.alpha, { shift: st.shift ?? 0 });
  const side = (sg, a, phi) => ({ ...legTo(t, sg, V(a.x, Math.min(a.y, F - L.foot * Math.sin(rad(Math.max(0, Math.min(90, a.p))))), a.z), a.p, V(pole.x, pole.y, 0.25 * sg)), hand: armPhi(t, sg, phi), pole: V(0, 1, 0.3 * sg) });
  return poseLR({ trunk: t, r: side(1, st.r, st.phiR), l: side(-1, st.l, st.phiL) });
}
const feet = (x, p, z = 4.5, lift = 0) => ({ r: { ...onToes(x, z, p), y: onToes(x, z, p).y - lift, p }, l: { ...onToes(x, -z, p), y: onToes(x, -z, p).y - lift, p } });
const S_ = (px, py, alpha, phi, ft, extra = {}) => ({ px, py, alpha, phiR: phi, phiL: phi, ...ft, ...extra });
const JS = {
  stand: S_(A, STAND_Y, 0, 0, feet(A, 0)),
  dip: S_(A - 6, 41, 38, -50, feet(A, 0)),
  off: S_(A + 0.5, 27.4, -2, 150, feet(A, 50)),
  air: S_(A + 0.5, 25, 0, 160, feet(A, 40, 4.5, 5)),
  land: S_(A, 27.8, 0, 100, feet(A, 40)),
  absorb: S_(A - 5, 39, 30, 40, feet(A, 0)),
  squat: S_(A - 7, 44, 42, -40, feet(A, 0)),
  tuck: S_(A, 18, 12, 60, { r: { x: A + 5, y: 33, z: 5, p: 30 }, l: { x: A + 5, y: 33, z: -5, p: 30 } }),
};
const easeOut = e => 1 - (1 - e) * (1 - e), easeIn = e => e * e;
const jmove = (a, b, dur, ease, pole) => ({ dur, ...(ease ? { ease } : {}), pose: e => jumper(mix(a, b, e), pole) });
const TUCK_POLE = V(1, -0.6, 0);

// Broad jump: from x0 to x1, land in a squat, stand, then walk back in four steps.
const BJ = { x0: A - 12, x1: A + 12 };
const BJS = {
  stand: S_(BJ.x0, STAND_Y, 0, 0, feet(BJ.x0, 0)),
  dip: S_(BJ.x0 - 6, 41, 40, -55, feet(BJ.x0, 0)),
  off: S_(BJ.x0 + 6, 31, 30, 120, feet(BJ.x0, 55)),
  air: S_(BJ.x0 + 15, 24, 18, 100, { r: { x: BJ.x0 + 17, y: 44, z: 4.5, p: 20 }, l: { x: BJ.x0 + 17, y: 44, z: -4.5, p: 20 } }),
  land: S_(BJ.x1 - 7, 42, 45, 60, feet(BJ.x1, 0)),
  up: S_(BJ.x1, STAND_Y, 0, 0, feet(BJ.x1, 0)),
};
// One step back: the side `sg` foot goes back 12, the pelvis follows halfway.
function stepBack(from, sg, e) {
  const st = mix(from, from, 0), key = sg > 0 ? 'r' : 'l';           // deep copy
  const a = from[key];
  st[key] = { ...a, x: a.x - 12 * smooth(e), y: a.y - 3 * bump(e) };
  st.px = from.px - 6 * smooth(e);
  st.phiR = 12 * sg * bump(e); st.phiL = -12 * sg * bump(e);
  return st;
}
function broadPhases() {
  const s0 = BJS.up, s1 = stepBack(s0, 1, 1), s2 = stepBack(s1, -1, 1), s3 = stepBack(s2, 1, 1);
  const back = [[s0, 1], [s1, -1], [s2, 1], [s3, -1]].map(([st, sg]) => ({ dur: 0.45, pose: e => jumper(stepBack(st, sg, e)) }));
  return [
    hold(0.3, jumper(BJS.stand)), jmove(BJS.stand, BJS.dip, 0.5), jmove(BJS.dip, BJS.off, 0.22, e => e),
    jmove(BJS.off, BJS.air, 0.22, easeOut), jmove(BJS.air, BJS.land, 0.25, easeIn), hold(0.2, jumper(BJS.land)),
    jmove(BJS.land, BJS.up, 0.6), hold(0.3, jumper(BJS.up)), ...back,
  ];
}

// Split jump: right foot in front, jump, legs switch in the air, land with the left in front.
const SJ_R = { px: A - 1, py: 42.5, alpha: 4, phiR: -35, phiL: 35, r: { x: A + 10, y: F, z: 4.5, p: 0 }, l: { ...onToes(A - 16, -4.5, 55), p: 55 } };
const swapState = st => ({ ...st, phiR: st.phiL, phiL: st.phiR, r: { ...st.l, z: -st.l.z }, l: { ...st.r, z: -st.r.z } });
const SJ_AIR = { px: A - 0.5, py: 28, alpha: 2, phiR: 0, phiL: 0, r: { x: A, y: 47, z: 4.5, p: 35 }, l: { x: A, y: 47, z: -4.5, p: 35 } };
const SJ_L = swapState(SJ_R);
const SPLIT_POLE = V(1, 0.3, 0);

// Skater jumps: land on the right leg far to the right, the left foot sweeps behind, and back.
const SK_R = { px: A - 3, py: 40, alpha: 35, neck: -15, shift: 14, phiR: -35, phiL: 45, r: { x: A, y: F, z: 18, p: 0 }, l: { ...onToes(A - 10, 7, 60), p: 60 } };
const SK_AIR = { px: A - 1, py: 31, alpha: 20, neck: -8, shift: 0, phiR: 5, phiL: 5, r: { x: A - 2, y: 49, z: 5, p: 30 }, l: { x: A - 2, y: 49, z: -5, p: 30 } };
const SK_L = swapState({ ...SK_R, shift: -SK_R.shift });

// Pogo hops: stiff legs, the bounce comes from the ankles.
const PG = { toe: S_(A, 27.6, 0, 8, feet(A, 45)), air: S_(A, 24.4, 0, 8, feet(A, 50, 4.5, 3.5)) };

export const EXERCISES_E = [
  // ---------- Mobility ----------
  {
    id: 'circulos-brazos', name: 'Círculos de brazos', still: 0.25,
    cue: 'Brazos estirados describiendo círculos amplios y lentos; el tronco no se mueve.',
    phases: [{ dur: 2.0, ease: s => s, pose: armCircles }],
  },
  {
    id: 'balanceo-pierna', name: 'Balanceo de pierna', still: 1.1,
    cue: 'De pie sobre una pierna, la otra oscila adelante y atrás, relajada y cada vez más amplia.',
    phases: [{ dur: 3.6, ease: s => s, pose: legSwing }, ...mirrored([{ dur: 3.6, ease: s => s, pose: legSwing }])],
  },
  {
    id: 'gusano', name: 'Gusano (walkout)', still: 3.4, views: ['side', 'top'], isoCam: { yaw: 25, pitch: 30 },
    cue: 'Plegarse hasta apoyar las manos y caminar con ellas hasta la plancha; volver igual y subir.',
    phases: [
      hold(0.4, woHinge(0)), { dur: 1.1, pose: woHinge }, { dur: 1.8, ease: s => s, pose: walkout }, hold(0.5, walkout(1)),
      { dur: 1.8, ease: s => s, pose: s => walkout(1 - s) }, { dur: 1.0, pose: s => woHinge(1 - s) },
    ],
  },
  {
    id: 'squat-to-stand', name: 'Squat to stand', still: 3.1,
    cue: 'Agarrar las puntas de los pies, bajar a sentadilla profunda con el pecho alto, subir los brazos y volver.',
    phases: [
      hold(0.3, sts('stand', 'stand')(0)), { dur: 1.1, pose: sts('stand', 'fold') }, { dur: 1.1, pose: sts('fold', 'squat') },
      { dur: 0.8, pose: sts('squat', 'reach') }, hold(0.8, sts('squat', 'reach')(1)), { dur: 0.8, pose: s => sts('squat', 'reach')(1 - s) },
      { dur: 1.0, pose: s => sts('fold', 'squat')(1 - s) }, { dur: 1.0, pose: s => sts('stand', 'fold')(1 - s) },
    ],
  },
  {
    id: 'rotacion-toracica', name: 'Rotación torácica en cuadrupedia', still: 2.5, views: ['side', 'top'], isoCam: { yaw: 30, pitch: 35 },
    cue: 'Mano en la nuca: el codo baja hacia el brazo de apoyo y después sube al techo girando el pecho.',
    phases: (() => {
      const side = [
        hold(0.3, thoracic(0, 0)), { dur: 0.7, pose: e => thoracic(e, 0) }, { dur: 0.7, pose: e => thoracic(1, -20 * e) },
        { dur: 1.1, pose: e => thoracic(1, lerp(-20, 45, e)) }, hold(0.5, thoracic(1, 45)), { dur: 0.8, pose: e => thoracic(1, 45 * (1 - e)) },
        { dur: 0.7, pose: e => thoracic(1 - e, 0) },
      ];
      return [...side, ...mirrored(side)];
    })(),
  },
  {
    id: 'worlds-greatest-stretch', name: "World's greatest stretch", still: 3.0, isoCam: { yaw: 50, pitch: 25 },
    cue: 'Zancada profunda con la mano contraria en el suelo; el codo baja al empeine y después el brazo sube al techo.',
    phases: [
      hold(0.4, wgs(0, 0)), { dur: 0.9, pose: e => wgs(e, 0) }, hold(0.4, wgs(1, 0)), { dur: 0.6, pose: e => wgs(1 - e, 0) },
      { dur: 1.0, pose: e => wgs(0, e) }, hold(0.8, wgs(0, 1)), { dur: 0.9, pose: e => wgs(0, 1 - e) },
    ],
  },
  // ---------- Stretches ----------
  {
    id: 'estiramiento-isquios', name: 'Estiramiento de isquiotibiales', still: 2.5,
    cue: 'Piernas estiradas y cadera atrás; el tronco cae hacia delante con los brazos colgando. Mantener.',
    phases: [hold(0.4, hamstring(0)), { dur: 1.5, pose: hamstring }, hold(2.0, hamstring(1)), { dur: 1.3, pose: s => hamstring(1 - s) }],
  },
  {
    id: 'estiramiento-cuadriceps', name: 'Estiramiento de cuádriceps', still: 2.0,
    cue: 'De pie sobre una pierna, llevar el talón al glúteo sujetando el empeine; rodillas juntas.',
    phases: (() => {
      const side = [hold(0.3, quadStretch(0)), { dur: 1.0, pose: quadStretch }, hold(2.0, quadStretch(1)), { dur: 0.9, pose: s => quadStretch(1 - s) }];
      return [...side, ...mirrored(side)];
    })(),
  },
  {
    id: 'estiramiento-flexor-cadera', name: 'Estiramiento de flexor de cadera', still: 2.5,
    cue: 'Rodilla trasera en el suelo; la cadera avanza sin arquear la zona lumbar y el brazo de ese lado sube.',
    phases: [hold(0.4, hipFlexor(0)), { dur: 1.3, pose: hipFlexor }, hold(2.0, hipFlexor(1)), { dur: 1.0, pose: s => hipFlexor(1 - s) }],
  },
  {
    id: 'postura-nino', name: 'Postura del niño', still: 3.0, views: ['side', 'top'], isoCam: { yaw: 30, pitch: 35 },
    cue: 'Desde cuadrupedia, sentarse sobre los talones con los brazos largos y la frente en el suelo.',
    phases: [hold(0.5, childPose(0)), { dur: 1.6, pose: childPose }, hold(2.5, childPose(1)), { dur: 1.4, pose: s => childPose(1 - s) }],
  },
  {
    id: 'perro-boca-abajo', name: 'Perro boca abajo', still: 2.5, views: ['side', 'top'], isoCam: { yaw: 30, pitch: 30 },
    cue: 'Desde plancha alta, la cadera sube y atrás formando una V invertida; talones hacia el suelo.',
    phases: [hold(0.4, downDog(0)), { dur: 1.2, pose: downDog }, hold(2.0, downDog(1)), { dur: 1.0, pose: s => downDog(1 - s) }],
  },
  {
    id: 'cobra', name: 'Cobra', still: 2.5, views: ['side', 'top'], isoCam: { yaw: 30, pitch: 30 },
    cue: 'Boca abajo con las manos junto al pecho; los brazos elevan el tronco y la cadera sigue apoyada.',
    phases: [hold(0.5, cobra(0)), { dur: 1.2, pose: cobra }, hold(2.0, cobra(1)), { dur: 1.2, pose: s => cobra(1 - s) }],
  },
  {
    id: 'estiramiento-gemelo', name: 'Estiramiento de gemelo en pared', still: 2.5, props: [CW.wall],
    cue: 'Manos en la pared y pierna trasera estirada con el talón apoyado; el cuerpo se inclina hacia la pared.',
    phases: [hold(0.4, calfStretch(0)), { dur: 1.2, pose: calfStretch }, hold(2.0, calfStretch(1)), { dur: 1.0, pose: s => calfStretch(1 - s) }],
  },
  {
    id: 'estiramiento-hombro', name: 'Estiramiento de hombro cruzado', still: 2.0, isoCam: { yaw: 60, pitch: 20 },
    cue: 'Brazo estirado cruzando el pecho a la altura del hombro; la otra mano lo acerca desde el codo.',
    phases: (() => {
      const side = [hold(0.3, crossArm(0)), { dur: 1.0, pose: crossArm }, hold(2.0, crossArm(1)), { dur: 0.9, pose: s => crossArm(1 - s) }];
      return [...side, ...mirrored(side)];
    })(),
  },
  // ---------- Running drills ----------
  {
    id: 'carrera', name: 'Carrera', still: 0.2,
    cue: 'Tronco algo inclinado, apoyo bajo la cadera y brazos a 90° acompañando la zancada.',
    phases: [{ dur: 0.7, ease: s => s, pose: RUN }],
  },
  {
    id: 'skipping', name: 'Skipping', still: 0.3,
    cue: 'Rodillas a la altura de la cadera, apoyo corto sobre la parte delantera del pie y brazos activos.',
    phases: [{ dur: 0.6, ease: s => s, pose: SKIP }],
  },
  {
    id: 'talones-gluteo', name: 'Talones al glúteo', still: 0.35,
    cue: 'Zancadas cortas llevando el talón hacia el glúteo, rodillas apuntando al suelo.',
    phases: [{ dur: 0.6, ease: s => s, pose: KICKS }],
  },
  // ---------- Jumps ----------
  {
    id: 'salto-vertical', name: 'Salto vertical', still: 1.1,
    cue: 'Contramovimiento rápido con los brazos atrás, extensión completa hacia arriba y aterrizaje suave.',
    phases: [
      hold(0.3, jumper(JS.stand)), jmove(JS.stand, JS.dip, 0.5), jmove(JS.dip, JS.off, 0.22, s => s),
      jmove(JS.off, JS.air, 0.25, easeOut), jmove(JS.air, JS.land, 0.25, easeIn), jmove(JS.land, JS.absorb, 0.3), jmove(JS.absorb, JS.stand, 0.6),
    ],
  },
  {
    id: 'sentadilla-salto', name: 'Sentadilla con salto', still: 0.5,
    cue: 'Desde sentadilla, salto explosivo y aterrizaje directo en la siguiente sentadilla.',
    phases: [
      hold(0.15, jumper(JS.squat)), jmove(JS.squat, JS.off, 0.32), jmove(JS.off, JS.air, 0.25, easeOut),
      jmove(JS.air, JS.land, 0.25, easeIn), jmove(JS.land, JS.squat, 0.45),
    ],
  },
  {
    id: 'salto-rodillas-pecho', name: 'Salto con rodillas al pecho', still: 1.05,
    cue: 'Salto alto y, en el aire, las rodillas suben al pecho; se estiran antes de aterrizar.',
    phases: [
      hold(0.3, jumper(JS.stand)), jmove(JS.stand, JS.dip, 0.45), jmove(JS.dip, JS.off, 0.22, s => s),
      jmove(JS.off, JS.tuck, 0.3, easeOut, TUCK_POLE), jmove(JS.tuck, JS.land, 0.3, easeIn, TUCK_POLE),
      jmove(JS.land, JS.absorb, 0.3), jmove(JS.absorb, JS.stand, 0.6),
    ],
  },
  {
    id: 'salto-horizontal', name: 'Salto horizontal', still: 1.25,
    cue: 'Brazos atrás y salto hacia delante; aterrizaje con las dos piernas y la cadera atrás. Se vuelve andando.',
    phases: broadPhases(),
  },
  {
    id: 'zancada-salto', name: 'Zancada con salto', still: 0.1,
    cue: 'Desde zancada, salto y cambio de piernas en el aire; aterrizaje suave en la zancada contraria.',
    phases: [
      hold(0.15, jumper(SJ_R, SPLIT_POLE)), jmove(SJ_R, SJ_AIR, 0.3, easeOut, SPLIT_POLE), jmove(SJ_AIR, SJ_L, 0.3, easeIn, SPLIT_POLE),
      hold(0.15, jumper(SJ_L, SPLIT_POLE)), jmove(SJ_L, SJ_AIR, 0.3, easeOut, SPLIT_POLE), jmove(SJ_AIR, SJ_R, 0.3, easeIn, SPLIT_POLE),
    ],
  },
  {
    id: 'saltos-patinador', name: 'Saltos de patinador', still: 0.1, views: ['front', 'side'], isoCam: { yaw: 65, pitch: 20 },
    cue: 'Saltos laterales de una pierna a la otra; la pierna libre cruza por detrás y los brazos acompañan.',
    phases: [
      hold(0.2, jumper(SK_R)), jmove(SK_R, SK_AIR, 0.3, easeOut), jmove(SK_AIR, SK_L, 0.3, easeIn),
      hold(0.2, jumper(SK_L)), jmove(SK_L, SK_AIR, 0.3, easeOut), jmove(SK_AIR, SK_R, 0.3, easeIn),
    ],
  },
  {
    id: 'saltos-tobillo', name: 'Saltos de tobillo (pogo)', still: 0.2,
    cue: 'Saltos cortos y rápidos con las piernas casi rectas; el rebote sale de los tobillos.',
    phases: [jmove(PG.toe, PG.air, 0.2, easeOut), jmove(PG.air, PG.toe, 0.2, easeIn)],
  },
];
