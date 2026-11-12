// Sesión guiada del paciente: plan de pasos y máquina de estados. Lógica pura (sin interfaz ni
// relojes): el tiempo entra siempre como `now` (ms). Los pasos con tiempo guardan `terminaEn`
// (marca absoluta), así nada se desfasa al bloquear el teléfono: al volver, `tick` se pone al día.
//
// Pasos:
//   preparar           (manual)  presentación del ejercicio, «Empezar»
//   trabajo            (manual)  una serie (o un lado) de repeticiones sin aguante: «Serie hecha»
//   mantener           (tiempo)  una repetición con aguante (hold)
//   descansoRep        (tiempo)  entre repeticiones con aguante
//   cambioLado         (tiempo)  al pasar al otro lado
//   descansoSerie      (tiempo)  entre series
//   valorar            (manual)  fácil/bien/difícil, dolor y nota de ese ejercicio
//   descansoEjercicio  (tiempo)  antes del siguiente ejercicio
//   resumen            (manual)  fin de la sesión
import { DEFAULTS } from '@shared/pauta-schema.js';

export const TIMED = Object.freeze(new Set(['mantener', 'descansoRep', 'cambioLado', 'descansoSerie', 'descansoEjercicio']));
export const REST = Object.freeze(new Set(['descansoRep', 'cambioLado', 'descansoSerie', 'descansoEjercicio']));
export const SIDE_LABEL = Object.freeze({ derecho: 'Lado derecho', izquierdo: 'Lado izquierdo' });
const MIN_SIDE = 5; // sin descanso indicado, unos segundos para cambiar de lado

/** Lista de pasos de una pauta. */
export function buildPlan(pauta) {
  const steps = [];
  const n = pauta.items.length;
  pauta.items.forEach((it, i) => {
    steps.push({ type: 'preparar', i });
    const sides = it.perSide ? ['derecho', 'izquierdo'] : [null];
    const reps = it.reps ?? 1;
    for (let set = 1; set <= it.sets; set++) {
      sides.forEach((side, k) => {
        if (it.hold) {
          for (let rep = 1; rep <= reps; rep++) {
            steps.push({ type: 'mantener', i, set, side, rep, reps, dur: it.hold });
            if (rep < reps && it.restRep > 0) steps.push({ type: 'descansoRep', i, set, side, rep, reps, dur: it.restRep });
          }
        } else {
          steps.push({ type: 'trabajo', i, set, side, reps });
        }
        if (k < sides.length - 1) steps.push({ type: 'cambioLado', i, set, side: sides[k + 1], dur: Math.max(it.restSide ?? MIN_SIDE, MIN_SIDE) });
      });
      if (set < it.sets && it.restSet > 0) steps.push({ type: 'descansoSerie', i, set, dur: it.restSet });
    }
    steps.push({ type: 'valorar', i });
    const rest = it.restAfter ?? pauta.restBetween ?? DEFAULTS.restBetween;
    if (i < n - 1 && rest > 0) steps.push({ type: 'descansoEjercicio', i, next: i + 1, dur: rest });
  });
  steps.push({ type: 'resumen' });
  return steps;
}

/** Estado serializable (se guarda en el dispositivo en cada cambio). */
export function start(plan, now) {
  return enter({ plan, idx: -1, terminaEn: null, pausa: null, inicio: now, fin: null, valoraciones: {} }, 0, now);
}

function enter(s, idx, base) {
  const step = s.plan[idx];
  const terminaEn = step && TIMED.has(step.type) ? base + step.dur * 1000 : null;
  return { ...s, idx, terminaEn, pausa: null, dur: step?.dur ?? 0, fin: step?.type === 'resumen' ? (s.fin ?? base) : s.fin };
}

export const current = s => s.plan[s.idx];
export const isTimed = s => TIMED.has(current(s)?.type);

/** Avanza al paso siguiente (botón del paciente o fin del tiempo). */
export function next(s, now) {
  if (current(s)?.type === 'resumen') return s;
  return enter(s, s.idx + 1, now);
}

/**
 * Pone al día los pasos con tiempo. Si ha pasado más de uno (app en segundo plano), encadena
 * sus duraciones desde el fin del anterior, sin perder segundos. Para en el primer paso manual.
 */
export function tick(s, now) {
  let st = s;
  while (st.pausa == null && st.terminaEn != null && now >= st.terminaEn) st = enter(st, st.idx + 1, st.terminaEn);
  return st;
}

/** Fracción que queda del paso con tiempo (1 al empezar, 0 al acabar), con los ajustes del paciente. */
export function fractionLeft(s, now) {
  const total = s.dur || current(s)?.dur || 0;
  return total ? Math.min(1, Math.max(0, (s.pausa != null ? s.pausa : (s.terminaEn ?? now) - now) / 1000 / total)) : 0;
}

/** Segundos que quedan del paso actual (0 si no tiene tiempo). */
export function remaining(s, now) {
  if (s.pausa != null) return Math.ceil(s.pausa / 1000);
  if (s.terminaEn == null) return 0;
  return Math.max(0, Math.ceil((s.terminaEn - now) / 1000));
}

/** Alarga o acorta el paso con tiempo actual (el paciente decide sus descansos). */
export function adjust(s, deltaSec, now) {
  if (s.terminaEn == null && s.pausa == null) return s;
  // `dur` (duración total del paso, ajustes incluidos) sirve para dibujar el progreso.
  if (s.pausa != null) {
    const pausa = Math.max(1000, s.pausa + deltaSec * 1000);
    return { ...s, pausa, dur: Math.max(1, (s.dur ?? 0) + (pausa - s.pausa) / 1000) };
  }
  const t = s.terminaEn + deltaSec * 1000;
  return t <= now ? next(s, now) : { ...s, terminaEn: t, dur: Math.max(1, (s.dur ?? 0) + deltaSec) };
}

export const skip = (s, now) => next(s, now);

/** Pausa el reloj del paso actual (los pasos manuales ya esperan al paciente). */
export function pause(s, now) {
  if (s.pausa != null || s.terminaEn == null) return s;
  return { ...s, pausa: Math.max(0, s.terminaEn - now), terminaEn: null };
}

export function resume(s, now) {
  if (s.pausa == null) return s;
  return { ...s, terminaEn: now + s.pausa, pausa: null };
}

export const paused = s => s.pausa != null;

/** Guarda la valoración de un ejercicio: { diff?, pain?, note? }. */
export function rate(s, i, v) {
  const prev = s.valoraciones[i] || {};
  const merged = { ...prev, ...v };
  for (const k of Object.keys(merged)) if (merged[k] === undefined || merged[k] === null || merged[k] === '') delete merged[k];
  return { ...s, valoraciones: { ...s.valoraciones, [i]: merged } };
}

/** Respuesta para el profesional (formato v1), solo con los ejercicios valorados. */
export function toRespuesta(s, at = new Date().toISOString()) {
  const items = Object.entries(s.valoraciones)
    .map(([i, v]) => ({ i: Number(i), ...(v.diff ? { diff: v.diff } : {}), ...(Number.isInteger(v.pain) ? { pain: v.pain } : {}), ...(v.note ? { note: String(v.note).slice(0, 300) } : {}) }))
    .filter(it => Object.keys(it).length > 1)
    .sort((a, b) => a.i - b.i);
  return { v: 1, kind: 'respuesta', at, items };
}

/** Progreso para la cabecera: ejercicio actual (1…n) y fracción de pasos hechos. */
export function progress(s) {
  const step = current(s);
  const n = Math.max(...s.plan.map(p => (p.i ?? -1) + 1));
  const i = step?.type === 'resumen' ? n : step?.type === 'descansoEjercicio' ? step.next : step?.i ?? 0;
  return { ejercicio: Math.min(i + 1, n), total: n, fraccion: s.idx / Math.max(1, s.plan.length - 1) };
}

/** Pasos con tiempo que empezarán en el futuro, para programar avisos con la app cerrada. */
export function upcomingTimers(s, now, max = 20) {
  const out = [];
  if (s.pausa != null || s.terminaEn == null) return out;
  let t = s.terminaEn, idx = s.idx;
  out.push({ at: t, step: s.plan[idx] });
  while (out.length < max) {
    idx++;
    const st = s.plan[idx];
    if (!st || !TIMED.has(st.type)) { if (st) out.push({ at: t, step: st, manual: true }); break; }
    t += st.dur * 1000;
    out.push({ at: t, step: st });
  }
  return out.filter(x => x.at > now);
}
