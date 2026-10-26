// Exercise library, batch B: floor work, hanging and single-leg patterns.
// Same conventions as exercises.mjs. Poses use poseLR (independent sides; left z negative).
import {
  A, V, L, Z, HEAD_R, FLOOR_TOP, legs, foot, footFlat, footFromShin, trunk, reach, straight, kneeIK,
  circles, poseLR, mirrorSide, up, down, rot2, along, add, sub, mul, len, vlerp, lerp, smooth, bump,
  clamp01, deg, rad, solve,
} from './engine.mjs';

const F = 58;                                     // floor contact line
const hold = (dur, p) => ({ hold: true, dur, pose: () => p });
const unit2 = v => { const l = Math.hypot(v.x, v.y); return V(v.x / l, v.y / l); };
const sym = (t, r, extra = {}) => poseLR({ trunk: t, r, l: mirrorSide(r), ...extra });
const withZ = (q, z) => V(q.x, q.y, z);

// Lying face up: the neck bends up and the head rests on the floor.
const HEAD_REST_Y = FLOOR_TOP - HEAD_R - 1.7;
function lyingTrunk(pelvis, alpha) {
  const t0 = trunk(pelvis, alpha);
  const neckDir = -74;
  const neckY = t0.shoulderC.y - L.neck * Math.cos(rad(neckDir));
  const c = clamp01((neckY - HEAD_REST_Y) / L.head);
  return trunk(pelvis, alpha, 0, { neckDir, headDir: -deg(Math.acos(c)) });
}

// ---------- Push-up: rigid body pivoting on the toes, hands fixed under the shoulders ----------
const PU = { toeX: 2, feetZ: 3, handZ: 10 };
function pushBody(beta) {
  const d = V(Math.cos(rad(beta)), -Math.sin(rad(beta)));
  const toe = V(PU.toeX, F, PU.feetZ);
  const f = rot2(d, -70);                         // from the toes up to the ankle
  const ankle = V(toe.x + L.foot * f.x, toe.y + L.foot * f.y, PU.feetZ);
  const knee = withZ(along(ankle, d, L.shin), PU.feetZ + 0.5);
  const hip = along(ankle, d, L.shin + L.thigh);
  return { toe, ankle, knee, t: trunk(V(hip.x, hip.y), 90 - beta) };
}
const PU_TOP_Y = F - 20.3, PU_LOW_Y = F - 7.5;
const puBeta = y => solve(b => pushBody(b).t.shoulderC.y - y, 0, 60);
const PU_HAND_X = pushBody(puBeta(PU_TOP_Y)).t.shoulderC.x;
function pushup(u) {
  const b = pushBody(puBeta(lerp(PU_TOP_Y, PU_LOW_Y, u)));
  return sym(b.t, { knee: b.knee, ankle: b.ankle, toe: b.toe, hand: V(PU_HAND_X, F, PU.handZ), pole: V(-0.6, -0.2, 0.8) });
}

// ---------- Forearm plank: elbows and toes fixed, slow weight shift over the elbows ----------
const PL = { toe: V(2, F, 3), elbowX: 48 };
function plank(s) {
  const th = 3 * Math.sin(2 * Math.PI * s);
  const S = V(PL.elbowX + L.upper * Math.sin(rad(th)), F - L.upper * Math.cos(rad(th)));
  const [c1, c2] = circles(PL.toe, L.foot, S, L.shin + L.thigh + L.sh);
  const ankle = c1.y < c2.y ? c1 : c2;
  const d = unit2(sub(S, ankle));
  const hip = along(ankle, d, L.shin + L.thigh);
  const t = trunk(V(hip.x, hip.y), deg(Math.atan2(d.x, -d.y)), 4 * Math.sin(2 * Math.PI * s));
  const elbow = V(PL.elbowX, F, Z.shoulder);
  const hand = V(PL.elbowX + Math.sqrt(L.fore ** 2 - 3.5 ** 2), F, Z.shoulder - 3.5);
  return sym(t, { knee: withZ(along(ankle, d, L.shin), 3.5), ankle, toe: PL.toe, hand, elbow });
}

// ---------- Glute bridge: shoulders and feet planted, hips rise to a straight line ----------
const GB = { S: V(22, F), top: 22 };
const GB_ANKLE_X = (() => {
  const g = rad(GB.top), k = V(GB.S.x + 28.5 * Math.cos(g), F - 28.5 * Math.sin(g));
  return k.x + Math.sqrt(L.shin ** 2 - (F - k.y) ** 2);
})();
function bridge(u) {
  const g = rad(GB.top * u);
  const hip = V(GB.S.x + L.sh * Math.cos(g), F - L.sh * Math.sin(g));
  const t = lyingTrunk(hip, deg(Math.atan2(GB.S.x - hip.x, hip.y - GB.S.y)));
  const ankle = V(GB_ANKLE_X, F, 5.5);
  const [k1, k2] = circles(hip, L.thigh, ankle, L.shin);
  const knee = withZ(k1.y < k2.y ? k1 : k2, 5.5);
  return sym(t, { knee, ankle, toe: footFlat(ankle), hand: V(GB.S.x + reach(9) - 0.01, F, 9), pole: V(0, -1, 0) });
}

// ---------- Leg helpers for floor patterns ----------
// Leg from the hip: thigh along `thighDir`, knee bent `knee` degrees (shin = thigh turned
// clockwise on screen), foot turned `footTurn` degrees from the shin.
function legFrom(hip, thighDir, kneeDeg, footTurn) {
  const knee = along(hip, thighDir, L.thigh);
  const shinDir = rot2(thighDir, kneeDeg);
  const ankle = along(knee, shinDir, L.shin);
  const fd = rot2(shinDir, footTurn);
  return { knee, ankle, toe: foot(ankle, fd.x, fd.y) };
}
const sideHip = (t, sg) => V(t.pelvis.x, t.pelvis.y, sg * Z.hip);
const sideShoulder = (t, sg) => V(t.shoulderC.x, t.shoulderC.y, sg * Z.shoulder);

// ---------- Dead bug: arms up, hips and knees at 90°, opposite arm and leg reach out ----------
const DB = { pelvis: V(36, F) };
function deadBug(a, b) {                          // a: right arm + left leg, b: left arm + right leg
  const t = lyingTrunk(DB.pelvis, -90);
  const side = (sg, armE, legE) => ({
    ...legFrom(sideHip(t, sg), up(80 * legE), 90 * (1 - legE), -90),
    hand: straight(sideShoulder(t, sg), lerp(180, 262, armE), sg * 8),
  });
  return poseLR({ trunk: t, r: side(1, a, b), l: side(-1, b, a) });
}

// ---------- Bird dog: on hands and knees, opposite arm and leg extend level ----------
const BD = { knee: V(26, F) };
function birdDog(a, b) {
  const t = trunk(V(BD.knee.x, F - L.thigh), 65, 22);
  const S = t.shoulderC, R = reach(9);
  const handX = S.x + Math.sqrt(R * R - (F - S.y) ** 2);
  const phiSupport = deg(Math.atan2(handX - S.x, F - S.y));
  const side = (sg, armE, legE) => ({
    // The foot turns down only once the knee is off the floor.
    ...legFrom(sideHip(t, sg), rot2(V(0, 1), 90 * legE), 90 * (1 - legE), -90 * smooth((legE - 0.35) / 0.65)),
    hand: straight(sideShoulder(t, sg), lerp(phiSupport, 92, armE), sg * 9),
  });
  return poseLR({ trunk: t, r: side(1, a, b), l: side(-1, b, a) });
}

// ---------- Reverse lunge: the back leg steps back, both knees reach ~90° ----------
const LU = { stance: 4, shin: 8, thigh: -80, backKneeY: 54.5, backShin: 10 };
const LU_END = (() => {
  const hip = legs({ shin: LU.shin, thigh: LU.thigh, stance: LU.stance, out: 0 }).hip;
  const knee = V(hip.x - Math.sqrt(L.thigh ** 2 - (LU.backKneeY - hip.y) ** 2), LU.backKneeY, LU.stance);
  const ankle = along(knee, V(-Math.cos(rad(LU.backShin)), -Math.sin(rad(LU.backShin))), L.shin);
  return { ankle, footDeg: deg(Math.atan2(F - ankle.y, Math.sqrt(L.foot ** 2 - (F - ankle.y) ** 2))) };
})();
function lunge(e, lead) {
  const lg = legs({ shin: LU.shin * e, thigh: LU.thigh * e, stance: LU.stance, out: 0 });
  const t = trunk(V(lg.hip.x, lg.hip.y), 6 * e, -4 * e);
  const hip = t.at(1.5, 1.8);                     // hands on the hips, elbows out and back
  const hands = sg => ({ hand: V(hip.x, hip.y, sg * 10), pole: V(-0.5, 0, sg) });
  const front = { knee: lg.knee, ankle: lg.ankle, toe: footFlat(lg.ankle), ...hands(1) };
  const start = V(A, F, LU.stance);
  const ankle = add(vlerp(start, LU_END.ankle, smooth(e)), V(0, -4 * bump(e), 0));
  const fd = LU_END.footDeg * smooth(e);
  const back = {
    knee: kneeIK(sideHip(t, 1), ankle, V(0.5, 1, 0)), ankle,
    toe: foot(ankle, Math.cos(rad(fd)), Math.sin(rad(fd))), ...hands(1),
  };
  return lead === 'r'
    ? poseLR({ trunk: t, r: front, l: mirrorSide(back) })
    : poseLR({ trunk: t, r: back, l: mirrorSide(front) });
}

// ---------- Step-up onto a box: lead foot up, drive, trail foot joins; then step down ----------
const SU = { stance: 4, onX: A + 12, onY: 45, lift: 9 };
const BOX = { type: 'box', x0: A + 8.5, x1: A + 26.5, top: SU.onY + 1.9, hz: 13 };
// Keeps an ankle within reach of its hip (the foot lifts instead of overstretching the leg).
function within(hip, ankle) {
  const d = sub(ankle, hip), l = len(d), max = L.thigh + L.shin - 0.02;
  return l > max ? add(hip, mul(d, max / l)) : ankle;
}
function stepPose(hip, alpha, rAnkle, lAnkle, swing) {
  const t = trunk(hip, alpha);
  const side = (sg, ankle, phi) => {
    const a = within(sideHip(t, sg), ankle);
    return { knee: kneeIK(sideHip(t, sg), a, V(1, 0, 0.1 * sg)), ankle: a, toe: footFlat(a), hand: straight(sideShoulder(t, sg), phi, sg * 8.5) };
  };
  return poseLR({ trunk: t, r: side(1, rAnkle, -18 * swing), l: side(-1, lAnkle, 18 * swing) });
}
const floorAnkle = sg => V(A, F, sg * SU.stance);
const boxAnkle = sg => V(SU.onX, SU.onY, sg * SU.stance);
// Foot path onto/off the box: it rises first and moves forward later, clearing the front edge.
const arc = (a, b, e) => {
  const fx = smooth((e - 0.25) / 0.75), fy = smooth(e / 0.8);
  return V(lerp(a.x, b.x, fx), lerp(a.y, b.y, fy) - SU.lift * bump(e), lerp(a.z, b.z, fx));
};
function stepLead(e) {                            // right foot onto the box
  return stepPose(V(A + e, 31), 4 * e, arc(floorAnkle(1), boxAnkle(1), e), floorAnkle(-1), 0);
}
function stepDrive(e) {                           // stand up on the box, left foot joins
  const hip = V(A + 1 + (SU.onX - A - 1) * smooth(e / 0.75), 31 - 13 * smooth((e - 0.2) / 0.8));
  const l = arc(floorAnkle(-1), boxAnkle(-1), (e - 0.35) / 0.65);
  return stepPose(hip, lerp(4, 0, e) + 14 * bump(e), boxAnkle(1), l, bump(e));
}

// ---------- Pull-up: hands fixed on the bar, elbows down and out, knees bent ----------
const PB = { type: 'pullbar', x: 32, y: -5, hz: 16 };
const PU_R = reach(11);
function pullup(u) {
  const S = V(lerp(PB.x - 1, PB.x - 3.5, u), lerp(PB.y + Math.sqrt(PU_R * PU_R - 1) - 0.01, PB.y + 5, u));
  const alpha = lerp(-2, -10, u);
  const hip = sub(S, mul(up(alpha), L.sh));
  const t = trunk(hip, alpha, -10 * u);
  const thighDir = down(12);
  const knee = along(sideHip(t, 1), thighDir, L.thigh);
  const ankle = along(knee, rot2(thighDir, 75), L.shin);
  return sym(t, { knee, ankle, toe: footFromShin(knee, ankle, 50), hand: V(PB.x, PB.y, 11), pole: V(0.1, 1, 1) });
}

export const EXERCISES_B = [
  {
    id: 'flexion', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, name: 'Flexión', still: 1.5,
    cue: 'Cuerpo en bloque de talones a cabeza; codos a unos 45° del tronco y pecho casi al suelo.',
    phases: [hold(0.4, pushup(0)), { dur: 1.1, pose: pushup }, hold(0.15, pushup(1)), { dur: 0.9, pose: s => pushup(1 - s) }],
  },
  {
    id: 'plancha', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, name: 'Plancha', still: 0,
    cue: 'Codos bajo los hombros y cuerpo recto; se mantiene la posición respirando con calma.',
    phases: [{ dur: 4, ease: s => s, pose: plank }],
  },
  {
    id: 'puente-gluteo', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, name: 'Puente de glúteo', still: 1.5,
    cue: 'Pies y hombros apoyados; la cadera sube hasta alinear hombros, cadera y rodillas.',
    phases: [hold(0.5, bridge(0)), { dur: 1.0, pose: bridge }, hold(0.8, bridge(1)), { dur: 1.2, pose: s => bridge(1 - s) }],
  },
  {
    id: 'dead-bug', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, name: 'Dead bug', still: 1.4,
    cue: 'Zona lumbar pegada al suelo; brazo y pierna contrarios se alejan sin perder el apoyo.',
    phases: [
      hold(0.3, deadBug(0, 0)), { dur: 1.1, pose: s => deadBug(s, 0) }, hold(0.4, deadBug(1, 0)), { dur: 0.9, pose: s => deadBug(1 - s, 0) },
      hold(0.3, deadBug(0, 0)), { dur: 1.1, pose: s => deadBug(0, s) }, hold(0.4, deadBug(0, 1)), { dur: 0.9, pose: s => deadBug(0, 1 - s) },
    ],
  },
  {
    id: 'bird-dog', views: ['side', 'top'], isoCam: { yaw: 18, pitch: 35 }, name: 'Bird dog', still: 1.4,
    cue: 'Manos bajo los hombros y rodillas bajo la cadera; brazo y pierna contrarios se estiran sin girar la pelvis.',
    phases: [
      hold(0.3, birdDog(0, 0)), { dur: 1.1, pose: s => birdDog(s, 0) }, hold(0.5, birdDog(1, 0)), { dur: 0.9, pose: s => birdDog(1 - s, 0) },
      hold(0.3, birdDog(0, 0)), { dur: 1.1, pose: s => birdDog(0, s) }, hold(0.5, birdDog(0, 1)), { dur: 0.9, pose: s => birdDog(0, 1 - s) },
    ],
  },
  {
    id: 'zancada-atras', name: 'Zancada atrás', still: 1.4,
    cue: 'Paso atrás y bajar en vertical: rodilla delantera sobre el pie, la trasera casi roza el suelo.',
    phases: [
      hold(0.3, lunge(0, 'r')), { dur: 1.1, pose: s => lunge(s, 'r') }, hold(0.25, lunge(1, 'r')), { dur: 1.0, pose: s => lunge(1 - s, 'r') },
      hold(0.3, lunge(0, 'l')), { dur: 1.1, pose: s => lunge(s, 'l') }, hold(0.25, lunge(1, 'l')), { dur: 1.0, pose: s => lunge(1 - s, 'l') },
    ],
  },
  {
    id: 'step-up', name: 'Step-up al cajón', still: 2.1, props: [BOX],
    cue: 'Todo el pie sobre el cajón y empuje con la pierna de arriba, sin impulsarse con la de abajo.',
    phases: [
      hold(0.3, stepLead(0)), { dur: 0.7, pose: stepLead }, { dur: 1.1, pose: stepDrive }, hold(0.4, stepDrive(1)),
      { dur: 1.0, pose: s => stepDrive(1 - s) }, { dur: 0.7, pose: s => stepLead(1 - s) },
    ],
  },
  {
    id: 'dominada', name: 'Dominada', still: 1.5, props: [PB],
    cue: 'Desde brazos estirados, codos hacia abajo y atrás hasta pasar la barbilla por la barra.',
    phases: [hold(0.5, pullup(0)), { dur: 1.0, pose: pullup }, hold(0.35, pullup(1)), { dur: 1.3, pose: s => pullup(1 - s) }],
  },
];
