// Exercise library, batch A: standing, symmetric, feet planted.
// Each exercise: phases [{ dur (s), pose(s) for s in 0..1, hold?, ease? }] and `still`
// (time in s of the pose shown when motion is reduced).
import {
  A, MF, V, L, BAR_FLOOR, legs, trunk, reach, straight, pose, balance,
  lerp, vlerp, smooth, smoother, bump, clamp01, deg,
} from './engine.mjs';

const hold = p => ({ hold: true, pose: () => p });
const front = at => ({ type: 'barbell', at, layer: 'front' });

// ---------- Deadlift: bar travels vertically over the midfoot ----------
const DL = { x: A + 3, z: 9.5 };
function deadlift(u) {
  const R = reach(DL.z);
  const top = 16 + Math.sqrt(R * R - (DL.x - A) ** 2);
  const h = lerp(BAR_FLOOR, top, u);
  // Knees travel back until the bar clears them, then the hips finish the lift.
  const shin = u < 0.35 ? 22 - 15 * smooth(u / 0.35) : 7 * (1 - smooth((u - 0.35) / 0.65));
  // Shoulders slightly ahead of the bar off the floor, behind it at lockout.
  const d = u < 0.35 ? 1.5 : 1.5 - 4.5 * smooth((u - 0.35) / 0.65);
  const knee = legs({ shin }).knee;
  const S = { x: DL.x + d, y: h - Math.sqrt(R * R - d * d) };
  // Hip: intersection of circle(knee, thigh) and circle(shoulder, trunk), the one behind.
  const dx = S.x - knee.x, dy = S.y - knee.y, dist = Math.hypot(dx, dy);
  const a = (dist * dist + L.thigh ** 2 - L.sh ** 2) / (2 * dist);
  const off = Math.sqrt(Math.max(0, L.thigh ** 2 - a * a));
  const mx = knee.x + a * dx / dist, my = knee.y + a * dy / dist;
  const c1 = { x: mx - off * dy / dist, y: my + off * dx / dist };
  const c2 = { x: mx + off * dy / dist, y: my - off * dx / dist };
  const hip = c1.x < c2.x ? c1 : c2;
  const thigh = deg(Math.atan2(hip.x - knee.x, knee.y - hip.y));
  const alpha = deg(Math.atan2(S.x - hip.x, hip.y - S.y));
  const lg = legs({ shin, thigh, stance: 5 });
  const hand = V(DL.x, h, DL.z);
  return pose({ legs: lg, trunk: trunk(lg.hip, alpha, -0.3 * alpha), hand, pole: V(0, 1, 0.2), objects: [front(hand)] });
}

// ---------- Romanian deadlift: soft knees, hips back, bar brushing the thighs ----------
function rdl(d) {
  const lg = legs({ shin: 6 * d, thigh: -30 * d, stance: 5, out: 0 });
  const t = trunk(lg.hip, 68 * d, -0.4 * 68 * d);
  const R = reach(9.5);
  const phi = deg(Math.asin((A + 4 - t.shoulder.x) / R));
  const hand = straight(t.shoulder, phi, 9.5);
  return pose({ legs: lg, trunk: t, hand, objects: [front(hand)] });
}

// ---------- Kettlebell swing: hip snap launches the bell, arms just follow ----------
function swingPose(ext, phi) {
  const lg = legs({ shin: lerp(9, 0, ext), thigh: lerp(-38, 0, ext), stance: 6.5, out: 1 });
  const alpha = lerp(62, -4, ext);
  const t = trunk(lg.hip, alpha, -0.4 * alpha);
  const hand = straight(t.shoulder, phi, 1.2);
  return pose({ legs: lg, trunk: t, hand, pole: V(0, 1, 0), objects: [{ type: 'kb', at: hand, phi, layer: 'behind' }] });
}
const SW = { low: -28, high: 88 };

// ---------- Squats: legs by depth, trunk lean solved for balance ----------
function airSquat(d) {
  const lg = legs({ shin: 34 * d, thigh: -102 * d, stance: 6, out: 2.4 });
  const phi = 90 * smooth(d);                        // arms forward as counterweight
  return balance(a => {
    const t = trunk(lg.hip, a, -0.35 * a);
    return pose({ legs: lg, trunk: t, hand: straight(t.shoulder, phi, 6), pole: V(0, 1, 0) });
  });
}

function goblet(d) {
  const lg = legs({ shin: 36 * d, thigh: -106 * d, stance: 6.5, out: 2.8 });
  return balance(a => {
    const t = trunk(lg.hip, a, -0.35 * a);
    const c = t.at(11.2, 4.6);                       // hands at the sternum, bell hanging below
    const hand = V(c.x, c.y, 2.2);
    return pose({ legs: lg, trunk: t, hand, pole: V(0.1, 1, 0.5), load: { m: 0.25, x: hand.x },
      objects: [{ type: 'kb', at: hand, phi: 0, layer: 'front' }] });
  });
}

function backSquat(d) {
  const lg = legs({ shin: 30 * d, thigh: -98 * d, stance: 6, out: 2.2 });
  return balance(a => {
    const t = trunk(lg.hip, a, -0.3 * a);
    const b = t.at(15.6, -2.6);                      // bar on the upper traps
    const hand = V(b.x, b.y, 12.5);
    return pose({ legs: lg, trunk: t, hand, pole: V(-0.4, 1, 0.6), load: { m: 1, x: b.x },
      objects: [{ type: 'barbell', at: hand, layer: 'back' }] });
  });
}

// ---------- Overhead press: head moves back to let the bar pass, then through ----------
function overheadTarget(S, z) {
  const R = reach(z), x = A + 1;
  return V(x, S.y - Math.sqrt(R * R - (x - S.x) ** 2), z);
}
function press(s) {
  const lg = legs({ stance: 5 });
  const b = bump(s / 0.8);
  const t = trunk(lg.hip, -6 * b, -22 * b);
  const rack = t.at(15.2, 3.8);
  const top = overheadTarget(t.shoulder, 9.5);
  const hand = V(lerp(rack.x, top.x, smooth((s - 0.25) / 0.75)), lerp(rack.y, top.y, s), 9.5);
  return pose({ legs: lg, trunk: t, hand, pole: vlerp(V(1, 0.3, 0.5), V(0, 0, 1), s), objects: [front(hand)] });
}

// ---------- Bent-over row: fixed hinge, bar from hang to the lower chest ----------
function row(s) {
  const lg = legs({ shin: 10, thigh: -38, stance: 5, out: 0.5 });
  const t = trunk(lg.hip, 68, -0.45 * 68);
  const hang = straight(t.shoulder, 0, 9);
  const c = t.at(8.5, 3.6);
  const hand = vlerp(hang, V(c.x, c.y, 9), s);
  return pose({ legs: lg, trunk: t, hand, pole: V(-1, -0.35, 0.6), objects: [front(hand)] });
}

// ---------- Thruster: front squat, then the leg drive flows into the press ----------
function thruster(d, p) {
  const lg = legs({ shin: 34 * d, thigh: -104 * d, stance: 6, out: 2.4 });
  return balance(a => {
    const t = trunk(lg.hip, a, -0.3 * a - 20 * bump(p));
    const r = t.at(15.4, 3.6);
    const hand = vlerp(V(r.x, r.y, 9), overheadTarget(t.shoulder, 9), p);
    return pose({ legs: lg, trunk: t, hand, pole: vlerp(V(1, -0.35, 0.35), V(0, 0, 1), p),
      load: { m: 0.6, x: hand.x }, objects: [front(hand)] });
  }, -15, 70);
}

export const EXERCISES = [
  {
    id: 'peso-muerto', name: 'Peso muerto', still: 0,
    cue: 'Barra pegada a las piernas sobre el mediopié; empuja el suelo y extiende cadera y rodillas a la vez.',
    phases: [hold(deadlift(0)), { dur: 1.3, pose: deadlift }, hold(deadlift(1)), { dur: 1.4, pose: s => deadlift(1 - s) }, hold(deadlift(0))]
      .map((p, i) => ({ ...p, dur: p.dur ?? [0.5, 1.3, 0.7, 1.4, 0.5][i] })),
  },
  {
    id: 'peso-muerto-rumano', name: 'Peso muerto rumano', still: 2.1,
    cue: 'Rodillas casi fijas; la cadera va atrás y la barra baja rozando los muslos hasta media tibia.',
    phases: [
      { ...hold(rdl(0)), dur: 0.5 }, { dur: 1.6, pose: rdl }, { ...hold(rdl(1)), dur: 0.3 }, { dur: 1.2, pose: s => rdl(1 - s) },
    ],
  },
  {
    id: 'swing-kettlebell', name: 'Swing con kettlebell', still: 0.6,
    cue: 'Bisagra explosiva: la cadera lanza la pesa hasta la altura del pecho con los brazos sueltos.',
    phases: [
      { dur: 0.6, ease: s => s, pose: s => swingPose(smoother(s / 0.6), lerp(SW.low, SW.high, smooth(s))) },
      { dur: 0.14, ease: s => s, pose: s => swingPose(1, SW.high + 3 * bump(s)) },
      { dur: 0.6, ease: s => s, pose: s => swingPose(1 - smoother((s - 0.45) / 0.55), lerp(SW.high, SW.low, smooth(s))) },
      { ...hold(swingPose(0, SW.low)), dur: 0.1 },
    ],
  },
  {
    id: 'sentadilla', name: 'Sentadilla', still: 1.9,
    cue: 'Cadera atrás y abajo, rodillas en la línea de los pies, brazos al frente como contrapeso.',
    phases: [{ ...hold(airSquat(0)), dur: 0.5 }, { dur: 1.4, pose: airSquat }, { ...hold(airSquat(1)), dur: 0.3 }, { dur: 1.1, pose: s => airSquat(1 - s) }],
  },
  {
    id: 'sentadilla-goblet', name: 'Sentadilla goblet', still: 2.0,
    cue: 'Pesa pegada al pecho, codos por dentro de las rodillas, tronco erguido.',
    phases: [{ ...hold(goblet(0)), dur: 0.5 }, { dur: 1.5, pose: goblet }, { ...hold(goblet(1)), dur: 0.3 }, { dur: 1.2, pose: s => goblet(1 - s) }],
  },
  {
    id: 'sentadilla-trasera', name: 'Sentadilla trasera', still: 2.1,
    cue: 'Barra sobre los trapecios en la vertical del mediopié; bajar hasta romper el paralelo.',
    phases: [{ ...hold(backSquat(0)), dur: 0.5 }, { dur: 1.6, pose: backSquat }, { ...hold(backSquat(1)), dur: 0.25 }, { dur: 1.3, pose: s => backSquat(1 - s) }],
  },
  {
    id: 'press-militar', name: 'Press militar', still: 1.5,
    cue: 'De la clavícula a la vertical del mediopié; la cabeza se aparta y vuelve a pasar bajo la barra.',
    phases: [{ ...hold(press(0)), dur: 0.5 }, { dur: 1.0, pose: press }, { ...hold(press(1)), dur: 0.5 }, { dur: 1.3, pose: s => press(1 - s) }],
  },
  {
    id: 'remo-con-barra', name: 'Remo con barra', still: 1.1,
    cue: 'Tronco fijo e inclinado; la barra sube del cuelgue a la parte baja del pecho con los codos atrás.',
    phases: [{ ...hold(row(0)), dur: 0.5 }, { dur: 0.6, pose: row }, { ...hold(row(1)), dur: 0.35 }, { dur: 0.9, pose: s => row(1 - s) }],
  },
  {
    id: 'thruster', name: 'Thruster', still: 2.55,
    cue: 'Sentadilla frontal y, sin pausa, el impulso de las piernas encadena el press por encima de la cabeza.',
    phases: [
      { ...hold(thruster(0, 0)), dur: 0.35 },
      { dur: 1.1, pose: s => thruster(s, 0) },
      { ...hold(thruster(1, 0)), dur: 0.1 },
      { dur: 1.0, ease: s => s, pose: s => thruster(1 - smoother(s / 0.6), smoother((s - 0.35) / 0.65)) },
      { ...hold(thruster(0, 1)), dur: 0.35 },
      { dur: 0.8, pose: s => thruster(0, 1 - s) },
    ],
  },
];
