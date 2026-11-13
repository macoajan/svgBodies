// Sesión guiada del paciente: plan de pasos y máquina de estados. Lógica pura (sin interfaz ni
// relojes): el tiempo entra siempre como `now` (ms). Los pasos con tiempo guardan `terminaEn`
// (marca absoluta), así nada se desfasa al bloquear el teléfono: al volver, `tick` se pone al día.
//
// Pasos:
//   preparar           (manual)  presentación del ejercicio, «Empezar»
//   trabajo            (manual)  una serie (o un lado) de repeticiones: «Serie hecha»
//   mantener           (tiempo)  una repetición con aguante (hold)
//   trabajoTiempo      (tiempo)  serie cronometrada (time)
//   descansoRep        (tiempo)  pausa entre repeticiones con aguante
//   cambioLado         (tiempo)  al pasar al otro lado
//   descansoSerie      (tiempo)  entre series (con su tipo: normal, caminando…)
//   valorar            (manual)  fácil/bien/difícil, dolor y nota de ese ejercicio
//   descansoEjercicio  (tiempo)  antes del siguiente ejercicio
//   descansoItem       (tiempo)  descanso puesto como un elemento más de la pauta
//   resumen            (manual)  fin de la sesión
//
// Los descansos NO avanzan solos al llegar a cero: quedan en espera («Continuar con el
// siguiente») y cuentan el tiempo extra, salvo que el paciente active el avance automático.
// Los pasos de trabajo con tiempo (mantener, trabajoTiempo) sí avanzan solos.
import { DEFAULTS, isRestItem, setSpec } from '@shared/pauta-schema.js';

export const TIMED = Object.freeze(new Set(['mantener', 'trabajoTiempo', 'descansoRep', 'cambioLado', 'descansoSerie', 'descansoEjercicio', 'descansoItem']));
export const REST = Object.freeze(new Set(['descansoRep', 'cambioLado', 'descansoSerie', 'descansoEjercicio', 'descansoItem']));
export const SIDE_LABEL = Object.freeze({ derecho: 'Lado derecho', izquierdo: 'Lado izquierdo' });
const MIN_SIDE = 5; // sin descanso indicado, unos segundos para cambiar de lado

/** Lista de pasos de una pauta. */
export function buildPlan(pauta) {
  const steps = [];
  const n = pauta.items.length;
  pauta.items.forEach((it, i) => {
    if (isRestItem(it)) { steps.push({ type: 'descansoItem', i, restType: it.id, dur: it.time }); return; }
    steps.push({ type: 'preparar', i });
    const sides = it.perSide ? ['derecho', 'izquierdo'] : [null];
    for (let set = 1; set <= it.sets; set++) {
      const sp = setSpec(it, set - 1);
      sides.forEach((side, k) => {
        if (sp.time != null) steps.push({ type: 'trabajoTiempo', i, set, sets: it.sets, side, dur: sp.time });
        else if (it.hold) {
          for (let rep = 1; rep <= sp.reps; rep++) {
            steps.push({ type: 'mantener', i, set, sets: it.sets, side, rep, reps: sp.reps, dur: it.hold });
            if (rep < sp.reps && it.restRep > 0) steps.push({ type: 'descansoRep', i, set, side, rep, reps: sp.reps, dur: it.restRep });
          }
        } else steps.push({ type: 'trabajo', i, set, sets: it.sets, side, reps: sp.reps });
        if (k < sides.length - 1) steps.push({ type: 'cambioLado', i, set, side: sides[k + 1], dur: Math.max(it.restSide ?? MIN_SIDE, MIN_SIDE) });
      });
      if (set < it.sets && sp.rest > 0) steps.push({ type: 'descansoSerie', i, set, restType: sp.restType, dur: sp.rest });
    }
    steps.push({ type: 'valorar', i });
    const rest = it.restAfter ?? pauta.restBetween ?? DEFAULTS.restBetween;
    // Si el siguiente elemento es un descanso, ese sustituye al descanso entre ejercicios.
    if (i < n - 1 && rest > 0 && !isRestItem(pauta.items[i + 1])) steps.push({ type: 'descansoEjercicio', i, next: i + 1, dur: rest });
  });
  steps.push({ type: 'resumen' });
  return steps;
}

/**
 * Estado serializable (se guarda en el dispositivo en cada cambio).
 * `auto`: los descansos avanzan solos al terminar (por defecto, no: esperan al paciente).
 */
export function start(plan, now, { auto = false } = {}) {
  return enter({ plan, idx: -1, terminaEn: null, pausa: null, espera: false, auto, inicio: now, fin: null, valoraciones: {} }, 0, now);
}

function enter(s, idx, base) {
  const step = s.plan[idx];
  const terminaEn = step && TIMED.has(step.type) ? base + step.dur * 1000 : null;
  return { ...s, idx, terminaEn, pausa: null, espera: false, dur: step?.dur ?? 0, fin: step?.type === 'resumen' ? (s.fin ?? base) : s.fin };
}

export const current = s => s.plan[s.idx];
export const isTimed = s => TIMED.has(current(s)?.type);
export const isRest = s => REST.has(current(s)?.type);
export const enEspera = s => !!s.espera;

/** Avanza al paso siguiente («Continuar con el siguiente», «Serie hecha», «Saltar»…). */
export function next(s, now) {
  if (current(s)?.type === 'resumen') return s;
  return enter(s, s.idx + 1, now);
}
export const skip = next;

/** Vuelve al paso de trabajo anterior (para repetir una serie o un ejercicio). */
export function prev(s, now) {
  let idx = s.idx - 1;
  while (idx > 0 && (REST.has(s.plan[idx].type) || s.plan[idx].type === 'valorar')) idx--;
  if (idx < 0 || idx === s.idx) return s;
  return enter({ ...s, fin: null }, idx, now);
}

/**
 * Pone al día los pasos con tiempo. Si ha pasado más de uno (app en segundo plano), encadena
 * sus duraciones desde el fin del anterior, sin perder segundos. Se detiene en el primer paso
 * manual y, salvo avance automático, al terminar un descanso (queda en espera).
 */
export function tick(s, now) {
  let st = s;
  while (st.pausa == null && !st.espera && st.terminaEn != null && now >= st.terminaEn) {
    if (REST.has(current(st).type) && !st.auto) { st = { ...st, espera: true }; break; }
    st = enter(st, st.idx + 1, st.terminaEn);
  }
  return st;
}

/** Fracción que queda del paso con tiempo (1 al empezar, 0 al acabar), con los ajustes del paciente. */
export function fractionLeft(s, now) {
  if (s.espera) return 0;
  const total = s.dur || current(s)?.dur || 0;
  return total ? Math.min(1, Math.max(0, (s.pausa != null ? s.pausa : (s.terminaEn ?? now) - now) / 1000 / total)) : 0;
}

/** Segundos que quedan del paso actual (0 si no tiene tiempo o ya terminó). */
export function remaining(s, now) {
  if (s.espera) return 0;
  if (s.pausa != null) return Math.ceil(s.pausa / 1000);
  if (s.terminaEn == null) return 0;
  return Math.max(0, Math.ceil((s.terminaEn - now) / 1000));
}

/** Segundos de más desde que terminó el descanso (en espera). */
export const overtime = (s, now) => (s.espera && s.terminaEn != null ? Math.max(0, Math.floor((now - s.terminaEn) / 1000)) : 0);

/**
 * Alarga o acorta el paso con tiempo actual (el paciente decide sus descansos). En espera,
 * «+15 s» vuelve a poner el reloj en marcha con ese tiempo.
 */
export function adjust(s, deltaSec, now) {
  if (s.espera) return deltaSec > 0 ? { ...s, espera: false, terminaEn: now + deltaSec * 1000, dur: deltaSec } : s;
  if (s.terminaEn == null && s.pausa == null) return s;
  if (s.pausa != null) {
    const pausa = Math.max(1000, s.pausa + deltaSec * 1000);
    return { ...s, pausa, dur: Math.max(1, (s.dur ?? 0) + (pausa - s.pausa) / 1000) };
  }
  const t = s.terminaEn + deltaSec * 1000;
  if (t <= now) return isRest(s) && !s.auto ? { ...s, terminaEn: now, espera: true } : next(s, now);
  return { ...s, terminaEn: t, dur: Math.max(1, (s.dur ?? 0) + deltaSec) };
}

/** Para el reloj del paso actual (los pasos manuales ya esperan al paciente). */
export function pause(s, now) {
  if (s.pausa != null || s.terminaEn == null || s.espera) return s;
  return { ...s, pausa: Math.max(0, s.terminaEn - now), terminaEn: null };
}

export function resume(s, now) {
  if (s.pausa == null) return s;
  return { ...s, terminaEn: now + s.pausa, pausa: null };
}

export const paused = s => s.pausa != null;

/** Cambia el avance automático de los descansos durante la sesión. */
export const setAuto = (s, auto) => ({ ...s, auto: !!auto });

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

/**
 * Progreso para la cabecera: ejercicio actual (1…n, sin contar los descansos sueltos), total y
 * fracción de pasos hechos.
 */
export function progress(s) {
  const step = current(s);
  const exIdx = [...new Set(s.plan.filter(p => p.type === 'preparar').map(p => p.i))];
  const n = exIdx.length;
  const i = step?.type === 'descansoEjercicio' ? step.next : step?.i;
  let pos = step?.type === 'resumen' ? n - 1 : exIdx.findIndex(x => x >= (i ?? 0));
  if (pos < 0) pos = n - 1;
  return { ejercicio: Math.min(pos + 1, n), total: n, fraccion: s.idx / Math.max(1, s.plan.length - 1) };
}

/**
 * Fines de tiempo futuros, para avisar con la app en segundo plano. Encadena los pasos con
 * tiempo y se detiene en el primero que espera al paciente (paso manual o fin de descanso).
 */
export function upcomingTimers(s, now, max = 20) {
  const out = [];
  if (s.pausa != null || s.terminaEn == null || s.espera) return out;
  let t = s.terminaEn, idx = s.idx;
  for (;;) {
    const st = s.plan[idx];
    if (REST.has(st.type) && !s.auto) { out.push({ at: t, step: st, espera: true }); break; }
    out.push({ at: t, step: st });
    const nx = s.plan[idx + 1];
    if (!nx || !TIMED.has(nx.type) || out.length >= max) { if (nx && !TIMED.has(nx.type)) out.push({ at: t, step: nx, manual: true }); break; }
    idx++;
    t += nx.dur * 1000;
  }
  return out.filter(x => x.at > now);
}
