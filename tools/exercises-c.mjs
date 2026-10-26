// Exercise library, batch C: jumps, locomotion and moving equipment.
// Same conventions as the other batches. Flight phases are just poses with both feet off
// the floor; walking is done on the spot (treadmill style) so the loop closes.
import {
  A, V, L, Z, foot, footFlat, trunk, straight, kneeIK, poseLR, up, rot2, along, add, sub, mul, len,
  vlerp, lerp, smooth, bump, clamp01, rad, solve, ROPE,
} from './engine.mjs';

const F = 58;                                     // floor contact line
const hold = (dur, p) => ({ hold: true, dur, pose: () => p });
const sideHip = (t, sg) => V(t.pelvis.x, t.pelvis.y, sg * Z.hip);
const sideShoulder = (t, sg) => V(t.shoulderC.x, t.shoulderC.y, sg * Z.shoulder);
const zs = (q, sg) => V(q.x, q.y, sg * Math.abs(q.z));

// Keeps a point within `max` of an anchor (a foot lifts, or an arm straightens, instead of overstretching).
function within(anchor, q, max) {
  const d = sub(q, anchor), l = len(d);
  return l > max ? add(anchor, mul(d, max / l)) : q;
}
// Foot pitched `p` degrees toes-down from flat.
const footAt = (ankle, p) => foot(ankle, Math.cos(rad(p)), Math.sin(rad(p)));
// Leg by IK from the trunk's hip to the ankle; knee forward and slightly out. The foot moves
// with the ankle if the ankle has to be pulled in.
function legTo(t, sg, ankle, toe) {
  const h = sideHip(t, sg), a = within(h, ankle, L.thigh + L.shin - 0.02);
  return { knee: kneeIK(h, a, V(1, 0, 0.25 * sg)), ankle: a, toe: add(toe, sub(a, ankle)) };
}
const armTo = (t, sg, hand) => {
  const S = sideShoulder(t, sg);
  return { hand: within(S, hand, L.upper + L.fore - 0.02) };
};

// ---------- Jumping jacks: feet apart and arms overhead on one hop, back on the next ----------
function jack(s) {
  const spread = (1 - Math.cos(2 * Math.PI * s)) / 2;
  const h = 3 * Math.abs(Math.sin(2 * Math.PI * s));      // airborne between the landings
  const p = 35 * h / 3;
  const t = trunk(V(A, 31.8 - h), 0);
  const side = sg => {
    const ankle = V(A, F - h - L.foot * Math.sin(rad(p)), sg * lerp(4.5, 11, spread));
    const a = rad(lerp(12, 168, spread));                  // arm abduction from hanging
    const S = sideShoulder(t, sg);
    const hand = add(S, mul(V(0.08, Math.cos(a), sg * Math.sin(a)), (L.upper + L.fore - 0.01) / Math.hypot(0.08, 1)));
    return { ...legTo(t, sg, ankle, footAt(ankle, p)), hand, pole: V(0.3, 0, sg) };
  };
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

// ---------- Jump rope: one turn per hop, the rope passes under the feet at the top of the hop ----------
const JR = { z: 11, Rx: 15, Rd: 29.3, Ru: 34 };
function ropePoints(C, theta) {
  const pts = [];
  const R = (JR.Rd + JR.Ru) / 2 + (JR.Rd - JR.Ru) / 2 * Math.cos(rad(theta));
  for (let k = 0; k <= ROPE.segments; k++) {
    const u = k / ROPE.segments, c = Math.cos(Math.PI * u);
    const w = Math.pow(Math.sin(Math.PI * u), 0.6);          // the belly of the rope swings out
    pts.push(V(C.x + JR.Rx * Math.sin(rad(theta)) * w, C.y + R * Math.cos(rad(theta)) * w, -JR.z * Math.sign(c) * Math.pow(Math.abs(c), 0.35)));
  }
  return pts;
}
function jumpRope(s) {
  const h = s > 0.25 && s < 0.75 ? 4 * Math.sin(Math.PI * (s - 0.25) / 0.5) : 0;
  const theta = 180 - 360 * s;                              // forward turn: over the head, in front, under the feet
  const p = 30 + 15 * h / 4;                                // on the balls of the feet
  const t = trunk(V(A, 29 - h), 0);
  const handC = V(A + 3, t.pelvis.y + 1.5);
  const circ = V(1.2 * Math.sin(rad(theta)), 1.2 * Math.cos(rad(theta)));   // wrists turn the rope
  const side = sg => {
    const ankle = V(A, F - h - L.foot * Math.sin(rad(p)), sg * 4);
    return { ...legTo(t, sg, ankle, footAt(ankle, p)), hand: V(handC.x + circ.x, handC.y + circ.y, sg * JR.z), pole: V(-0.5, 1, 0.3 * sg) };
  };
  return poseLR({ trunk: t, r: side(1), l: side(-1), objects: [{ type: 'rope', points: ropePoints(add(handC, circ), theta) }] });
}

// ---------- Farmer's walk: heavy bells at the sides, walking on the spot ----------
const FW = { x: A + 2, stride: 6.5, lift: 5, duty: 0.6, z: 4.5, handZ: 10 };
function footCycle(ph) {
  if (ph < FW.duty) {                                       // stance: the foot travels back under the body
    const k = ph / FW.duty, p = k > 0.75 ? 25 * (k - 0.75) / 0.25 : 0;
    return { x: FW.x + FW.stride * (1 - 2 * k), lift: 0, p };
  }
  const k = (ph - FW.duty) / (1 - FW.duty);                 // swing: forward with the toes clear
  return { x: FW.x - FW.stride + 2 * FW.stride * smooth(k), lift: FW.lift * bump(k), p: 25 * (1 - smooth(k)) };
}
// Loaded carry. Each hand: 'kb' (bell hanging at the side), 'free' (natural arm swing) or
// 'overhead' (bell locked out above the shoulder).
export function carry(s, hands = { r: 'kb', l: 'kb' }) {
  const t = trunk(V(FW.x, 32.6 - 0.4 * Math.cos(4 * Math.PI * s)), 2);
  const objects = [];
  const side = (sg, ph, mode) => {
    const f = footCycle(ph);
    const ankle = V(f.x, F - f.lift - L.foot * Math.sin(rad(f.p)), sg * FW.z);
    const S = sideShoulder(t, sg);
    let hand, phi = 0;
    if (mode === 'overhead') hand = V(S.x + 0.5, S.y - Math.sqrt((L.upper + L.fore - 0.02) ** 2 - 0.25), S.z);
    else {
      phi = (mode === 'free' ? -14 : -4) * sg * Math.sin(2 * Math.PI * s);
      hand = straight(S, phi, sg * FW.handZ);
    }
    if (mode !== 'free') objects.push({ type: 'kb', at: hand, phi });
    return { ...legTo(t, sg, ankle, footAt(ankle, f.p)), hand, pole: V(0.2, 1, 0.3 * sg) };
  };
  const r = side(1, s, hands.r), l = side(-1, (s + 0.5) % 1, hands.l);
  return poseLR({ trunk: t, r, l, objects });
}
const farmer = s => carry(s);

// ---------- Box jump: dip, jump, land soft on the box, stand, step down ----------
const BJ = { onX: A + 15, onY: 41, z: 4.5 };
const JBOX = { type: 'box', x0: A + 8.5, x1: A + 27, top: BJ.onY + 1.9, hz: 13 };
const DIP = { pelvis: V(A - 6, 40.5), alpha: 38, phi: -45 };
const LAND = { pelvis: V(BJ.onX - 7, BJ.onY - 18.5), alpha: 25, phi: 60 };
function jumpPose(pelvis, alpha, phi, rAnkle, lAnkle, p, swing = 0) {
  const t = trunk(pelvis, alpha, -0.3 * alpha);
  const side = (sg, ankle, ph) => ({ ...legTo(t, sg, ankle, footAt(ankle, p)), hand: straight(sideShoulder(t, sg), ph, sg * 8.5) });
  return poseLR({ trunk: t, r: side(1, rAnkle, phi - 18 * swing), l: side(-1, lAnkle, phi + 18 * swing) });
}
const floorA = sg => V(A, F, sg * BJ.z), boxA = sg => V(BJ.onX, BJ.onY, sg * BJ.z);
function dip(e) {
  return jumpPose(vlerp(V(A, 31), DIP.pelvis, smooth(e)), DIP.alpha * e, DIP.phi * e, floorA(1), floorA(-1), 0);
}
function flight(e) {
  const pelvis = add(vlerp(DIP.pelvis, LAND.pelvis, e), V(0, -12 * bump(e)));
  const phi = e < 0.4 ? lerp(DIP.phi, 150, smooth(e / 0.4)) : lerp(150, LAND.phi, smooth((e - 0.4) / 0.6));
  const ankle = sg => add(vlerp(floorA(sg), boxA(sg), smooth(e)), V(0, -22 * bump(e)));
  return jumpPose(pelvis, lerp(DIP.alpha, LAND.alpha, e), phi, ankle(1), ankle(-1), 40 * bump(e));
}
function standOnBox(e) {
  return jumpPose(vlerp(LAND.pelvis, V(BJ.onX, BJ.onY - 27), smooth(e)), LAND.alpha * (1 - e), LAND.phi * (1 - e), boxA(1), boxA(-1), 0);
}
// Stepping down is a step-up played backwards: the left foot goes down first, then the right.
const boxArc = (a, b, e) => {
  const fx = smooth((e - 0.25) / 0.75), fy = smooth(e / 0.8);
  return V(lerp(a.x, b.x, fx), lerp(a.y, b.y, fy) - 9 * bump(e), lerp(a.z, b.z, fx));
};
function stepLead(e) {
  return jumpPose(V(A + e, 31), 4 * e, 0, boxArc(floorA(1), boxA(1), e), floorA(-1), 0);
}
function stepDrive(e) {
  const pelvis = V(A + 1 + (BJ.onX - A - 1) * smooth(e / 0.75), 31 - (31 - BJ.onY + 27) * smooth((e - 0.2) / 0.8));
  return jumpPose(pelvis, lerp(4, 0, e) + 14 * bump(e), 0, boxA(1), boxArc(floorA(-1), boxA(-1), (e - 0.35) / 0.65), 0, bump(e));
}

// ---------- Burpee: squat, hands down, feet back to a plank, feet in, stand, jump ----------
// Plank: hands under the shoulders, rigid line to the toes (solved so the toes touch the floor).
const BP = { hand: V(A + 9, F, 9) };
const BP_PLANK = (() => {
  const S = V(BP.hand.x - 0.5, F - 20.3);
  const at = beta => {
    const d = V(Math.cos(rad(beta)), -Math.sin(rad(beta)));
    const ankle = sub(S, mul(d, L.shin + L.thigh + L.sh));
    const toe = sub(ankle, mul(rot2(d, -70), L.foot));
    return { d, ankle, toe, pelvis: sub(S, mul(d, L.sh)) };
  };
  const beta = solve(b => at(b).toe.y - F, 5, 45);
  const k = at(beta);
  return { pelvis: k.pelvis, alpha: 90 - beta, ankle: V(k.ankle.x, k.ankle.y, 3), toe: V(k.toe.x, k.toe.y, 3) };
})();
// Key states: pelvis, trunk lean, neck, right ankle and toe, and the hands: a floor point or a
// straight-arm angle (phi).
const ST = {
  stand: { pelvis: V(A, 31), alpha: 0, neck: 0, ankle: V(A, F, 4.5), toe: footFlat(V(A, F, 4.5)), phi: 0 },
  squat: { pelvis: V(A - 6, 47), alpha: 55, neck: -25, ankle: V(A, F, 4.5), toe: footFlat(V(A, F, 4.5)), hand: BP.hand },
  plank: { pelvis: BP_PLANK.pelvis, alpha: BP_PLANK.alpha, neck: 0, ankle: BP_PLANK.ankle, toe: BP_PLANK.toe, hand: BP.hand },
  air: { pelvis: V(A, 26), alpha: -3, neck: 0, ankle: V(A + 1, F - 5 - L.foot * Math.sin(rad(40)), 4.5), toe: null, phi: 170 },
};
ST.air.toe = footAt(ST.air.ankle, 40);
function burpee(a, b, e, { feetLift = 0, hipLift = 0, handLead = 1 } = {}) {
  const pelvis = add(vlerp(a.pelvis, b.pelvis, e), V(0, -hipLift * bump(e)));
  const t = trunk(pelvis, lerp(a.alpha, b.alpha, e), lerp(a.neck, b.neck, e));
  const lift = V(0, -feetLift * bump(e), 0);
  const kh = clamp01(e * handLead);
  const side = sg => {
    const S = sideShoulder(t, sg);
    const h = st => (st.hand ? zs(st.hand, sg) : straight(S, st.phi, sg * 8.5));
    const hand = vlerp(h(a), h(b), smooth(kh));
    // Ankle interpolated; the foot keeps its length by interpolating its pitch.
    const ankle = add(vlerp(zs(a.ankle, sg), zs(b.ankle, sg), e), lift);
    const pitch = st => Math.atan2(st.toe.y - st.ankle.y, st.toe.x - st.ankle.x);
    const fp = lerp(pitch(a), pitch(b), e), toe = foot(ankle, Math.cos(fp), Math.sin(fp));
    return { ...legTo(t, sg, ankle, toe), ...armTo(t, sg, hand), pole: V(-0.3, 0.2, sg) };
  };
  return poseLR({ trunk: t, r: side(1), l: side(-1) });
}

export const EXERCISES_C = [
  {
    id: 'jumping-jacks', name: 'Jumping jacks', still: 0.5,
    cue: 'Saltito ligero sobre la punta de los pies: piernas abiertas y brazos arriba, y vuelta a cerrar.',
    phases: [{ dur: 1.0, ease: s => s, pose: jack }],
  },
  {
    id: 'comba', name: 'Comba', still: 0.3,
    cue: 'Saltos bajos sobre la parte delantera del pie; la cuerda gira con las muñecas, codos pegados.',
    phases: [{ dur: 0.6, ease: s => s, pose: jumpRope }],
  },
  {
    id: 'paseo-granjero', name: 'Paseo del granjero', still: 0.2,
    cue: 'Tronco alto y hombros quietos con una pesa en cada mano; pasos cortos y firmes.',
    phases: [{ dur: 1.1, ease: s => s, pose: farmer }],
  },
  {
    id: 'salto-cajon', name: 'Salto al cajón', still: 1.0, props: [JBOX],
    cue: 'Contramovimiento con los brazos, salto y aterrizaje suave en sentadilla parcial; se baja andando.',
    phases: [
      hold(0.3, dip(0)), { dur: 0.45, pose: dip }, { dur: 0.5, ease: s => s, pose: flight }, { dur: 0.5, pose: standOnBox },
      hold(0.3, standOnBox(1)), { dur: 1.0, pose: s => stepDrive(1 - s) }, { dur: 0.7, pose: s => stepLead(1 - s) },
    ],
  },
  {
    id: 'burpee', name: 'Burpee', still: 1.3,
    cue: 'Manos al suelo, pies atrás a plancha, pies de vuelta, de pie y salto con los brazos arriba.',
    phases: [
      hold(0.2, burpee(ST.stand, ST.stand, 0)),
      { dur: 0.6, pose: e => burpee(ST.stand, ST.squat, e) },
      { dur: 0.45, pose: e => burpee(ST.squat, ST.plank, e, { feetLift: 6, hipLift: 3 }) },
      hold(0.2, burpee(ST.plank, ST.plank, 0)),
      { dur: 0.45, pose: e => burpee(ST.plank, ST.squat, e, { feetLift: 6, hipLift: 3 }) },
      { dur: 0.5, pose: e => burpee(ST.squat, ST.stand, e, { handLead: 2 }) },
      { dur: 0.3, pose: e => burpee(ST.stand, ST.air, e) },
      { dur: 0.35, pose: e => burpee(ST.air, ST.stand, e) },
    ],
  },
];
