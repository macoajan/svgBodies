// Formato de la pauta y de la respuesta del paciente (v1), su validación y la estimación de
// duración y calorías. Lo comparten la app, el visor web y las pruebas. Todo esto viaja
// cifrado (pauta-crypto.js): el servidor no ve ninguno de estos campos.
//
// Pauta:
// {
//   v: 1, kind: 'pauta',
//   title?: 'Rodilla · L.G.',            alias que pone el profesional (≤ 60)
//   pro?: { name?, center? },             cabecera de la hoja (≤ 80 cada uno)
//   note?: '…',                           nota general (≤ 500)
//   schedule?: { perWeek: 1–14, weeks: 1–52 },
//   restBetween?: 90,                     descanso por defecto entre ejercicios (s)
//   show?: { kcal: false, proText: false },  qué ve el paciente (según el tipo de paciente)
//   format?: { type: 'series'|'amrap'|'emom'|'fortime'|'tabata', minutes?: 1–180, rounds?: 1–100 },
//                                         formato de la sesión (WOD de un canal público); por defecto 'series'
//   items: [{                              1–40 elementos, en orden: ejercicios o descansos
//     id: 'sentadilla-pared',             id del catálogo
//     sets: 3, reps?: 10,                 series y repeticiones (por lado si perSide)
//     time?: 40,                          serie cronometrada: segundos de trabajo (en vez de reps)
//     hold?: 20, tempo?: 3,               mantenimiento o duración de cada repetición (s)
//     perSide?: true,                     unilateral: se hace con cada lado
//     restRep?: 10, restSet?: 60,         descansos entre repeticiones y entre series (s)
//     restType?: 'descanso-caminando',    tipo del descanso entre series (REST_TYPES)
//     perSet?: [{ reps?, time?, rest?, restType? }],  series a medida (una por serie): reparto
//                                         de repeticiones o tiempos y descanso tras cada serie
//     restSide?: 10, restAfter?: 90,      al cambiar de lado y al terminar el ejercicio (s)
//     load?: '60° rodilla', note?: '…',   carga o ángulo (≤ 40) y nota (≤ 300)
//   } | {                                  descanso como un elemento más de la pauta:
//     id: 'descanso-caminando',           uno de REST_TYPES
//     time: 120, note?: '…',              duración (s) y nota
//   }]
// }
//
// El ámbito (privada o canal público) y la visibilidad por fechas no van aquí: viajan en claro
// junto al bloque cifrado (visibility.js), porque es el servidor quien decide qué entrega.
//
// Respuesta del paciente:
// { v: 1, kind: 'respuesta', at: '2026-11-10T18:20:00Z',
//   items: [{ i: 0, diff: 'facil'|'bien'|'dificil', pain: 0–10, note?: '…' }] }

export const LIMITS = { items: 40, title: 60, proField: 80, note: 500, itemNote: 300, load: 40, rest: 600, hold: 600, time: 3600, restItem: 3600 };
export const DEFAULTS = { tempo: 3, restBetween: 90, restMet: 1.3, weightKg: 70 };
const DIFF = ['facil', 'bien', 'dificil'];
export const FORMATS = ['series', 'amrap', 'emom', 'fortime', 'tabata'];

/** Tipos de descanso: como elemento de la pauta o entre series. MET para estimar calorías. */
export const REST_TYPES = Object.freeze({
  descanso: { es: 'Descanso', met: 1.3 },
  'descanso-caminando': { es: 'Descanso caminando', met: 2.8 },
  'descanso-activo': { es: 'Descanso activo (movilidad suave)', met: 2.3 },
  respiracion: { es: 'Respiración', met: 1.3 },
  hidratacion: { es: 'Beber agua', met: 1.3 },
});
export const isRestItem = it => !!it && Object.hasOwn(REST_TYPES, it.id);
const restMet = type => REST_TYPES[type]?.met ?? DEFAULTS.restMet;

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isText = (v, max) => typeof v === 'string' && v.length <= max;

/**
 * Especificación de la serie k (0…sets-1) de un ejercicio, con las series a medida aplicadas:
 * { reps?, time?, rest, restType } — reps o time; `rest` es el descanso tras esa serie (0 en la última).
 * @returns {{ reps?: number, time?: number, rest: number, restType: string }}
 */
export function setSpec(it, k) {
  const ps = it.perSet?.[k] || {};
  const timed = ps.time != null || (ps.reps == null && it.time != null && it.reps == null);
  return {
    ...(timed ? { time: ps.time ?? it.time } : { reps: ps.reps ?? it.reps ?? 1 }),
    rest: k < it.sets - 1 ? (ps.rest ?? it.restSet ?? 0) : 0,
    restType: ps.restType ?? it.restType ?? 'descanso',
  };
}

// Devuelve la lista de problemas (vacía si es válida). `known` (opcional): Set de ids del catálogo.
export function checkPauta(p, known) {
  const errs = [];
  const bad = msg => errs.push(msg);
  if (!p || typeof p !== 'object') return ['no es un objeto'];
  if (p.v !== 1 || p.kind !== 'pauta') bad('versión o tipo desconocidos');
  if (p.title !== undefined && !isText(p.title, LIMITS.title)) bad('title');
  if (p.note !== undefined && !isText(p.note, LIMITS.note)) bad('note');
  if (p.pro !== undefined) for (const k of ['name', 'center']) if (p.pro[k] !== undefined && !isText(p.pro[k], LIMITS.proField)) bad(`pro.${k}`);
  if (p.schedule !== undefined && !(isInt(p.schedule.perWeek, 1, 14) && isInt(p.schedule.weeks, 1, 52))) bad('schedule');
  if (p.restBetween !== undefined && !isInt(p.restBetween, 0, LIMITS.rest)) bad('restBetween');
  if (p.show !== undefined) for (const k of ['kcal', 'proText']) if (p.show[k] !== undefined && typeof p.show[k] !== 'boolean') bad(`show.${k}`);
  if (p.format !== undefined) {
    const f = p.format;
    if (!f || !FORMATS.includes(f.type)) bad('format.type');
    else {
      if (f.minutes !== undefined && !isInt(f.minutes, 1, 180)) bad('format.minutes');
      if (f.rounds !== undefined && !isInt(f.rounds, 1, 100)) bad('format.rounds');
    }
  }
  if (!Array.isArray(p.items) || !p.items.length || p.items.length > LIMITS.items) { bad('items'); return errs; }
  p.items.forEach((it, n) => {
    const w = `items[${n}]`;
    if (isRestItem(it)) {
      if (!isInt(it.time, 5, LIMITS.restItem)) bad(`${w}.time`);
      if (it.note !== undefined && !isText(it.note, LIMITS.itemNote)) bad(`${w}.note`);
      return;
    }
    if (typeof it.id !== 'string' || (known && !known.has(it.id))) bad(`${w}.id`);
    if (!isInt(it.sets, 1, 20)) bad(`${w}.sets`);
    if (it.reps !== undefined && !isInt(it.reps, 1, 200)) bad(`${w}.reps`);
    if (it.time !== undefined && !isInt(it.time, 1, LIMITS.time)) bad(`${w}.time`);
    if (it.reps === undefined && it.hold === undefined && it.time === undefined) bad(`${w}: reps, hold o time`);
    for (const k of ['hold', 'tempo']) if (it[k] !== undefined && !isInt(it[k], 1, LIMITS.hold)) bad(`${w}.${k}`);
    for (const k of ['restRep', 'restSet', 'restSide', 'restAfter']) if (it[k] !== undefined && !isInt(it[k], 0, LIMITS.rest)) bad(`${w}.${k}`);
    if (it.restType !== undefined && !Object.hasOwn(REST_TYPES, it.restType)) bad(`${w}.restType`);
    if (it.perSide !== undefined && typeof it.perSide !== 'boolean') bad(`${w}.perSide`);
    if (it.load !== undefined && !isText(it.load, LIMITS.load)) bad(`${w}.load`);
    if (it.note !== undefined && !isText(it.note, LIMITS.itemNote)) bad(`${w}.note`);
    if (it.perSet !== undefined) {
      if (!Array.isArray(it.perSet) || it.perSet.length !== it.sets) bad(`${w}.perSet`);
      else it.perSet.forEach((ps, k) => {
        const ws = `${w}.perSet[${k}]`;
        if (!ps || typeof ps !== 'object') { bad(ws); return; }
        if (ps.reps !== undefined && !isInt(ps.reps, 1, 200)) bad(`${ws}.reps`);
        if (ps.time !== undefined && !isInt(ps.time, 1, LIMITS.time)) bad(`${ws}.time`);
        if (ps.rest !== undefined && !isInt(ps.rest, 0, LIMITS.rest)) bad(`${ws}.rest`);
        if (ps.restType !== undefined && !Object.hasOwn(REST_TYPES, ps.restType)) bad(`${ws}.restType`);
      });
    }
  });
  return errs;
}

export function checkRespuesta(r, nItems) {
  const errs = [];
  if (!r || r.v !== 1 || r.kind !== 'respuesta') return ['versión o tipo desconocidos'];
  if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) errs.push('at');
  if (!Array.isArray(r.items) || r.items.length > LIMITS.items) return [...errs, 'items'];
  r.items.forEach((it, n) => {
    if (!isInt(it.i, 0, (nItems ?? LIMITS.items) - 1)) errs.push(`items[${n}].i`);
    if (it.diff !== undefined && !DIFF.includes(it.diff)) errs.push(`items[${n}].diff`);
    if (it.pain !== undefined && !isInt(it.pain, 0, 10)) errs.push(`items[${n}].pain`);
    if (it.note !== undefined && !isText(it.note, LIMITS.itemNote)) errs.push(`items[${n}].note`);
  });
  return errs;
}

/**
 * Tramos de tiempo de un elemento: [{ s, met?, rest? }]. `met` ausente = MET del ejercicio.
 * El descanso al terminar no cuenta en el último elemento.
 */
function segments(it, { last = false, restBetween = DEFAULTS.restBetween, nextRest = false } = {}) {
  if (isRestItem(it)) return [{ s: it.time, met: restMet(it.id), rest: true }];
  const out = [];
  const sides = it.perSide ? 2 : 1;
  for (let k = 0; k < it.sets; k++) {
    const sp = setSpec(it, k);
    const reps = sp.time != null ? 1 : sp.reps;
    const perRep = sp.time ?? it.hold ?? it.tempo ?? DEFAULTS.tempo;
    out.push({ s: sides * reps * perRep });
    out.push({ s: sides * (reps - 1) * (sp.time != null ? 0 : it.restRep ?? 0), met: DEFAULTS.restMet, rest: true });
    if (it.perSide) out.push({ s: it.restSide ?? 0, met: DEFAULTS.restMet, rest: true });
    out.push({ s: sp.rest, met: restMet(sp.restType), rest: true });
  }
  // Si después viene un descanso como elemento, ese sustituye al descanso entre ejercicios.
  if (!last && !nextRest) out.push({ s: it.restAfter ?? restBetween, met: DEFAULTS.restMet, rest: true });
  return out.filter(x => x.s > 0);
}

// Tiempo de trabajo y de descanso de un elemento (s). El descanso al terminar no cuenta en el último.
export function itemTimes(it, opts = {}) {
  let work = 0, rest = 0;
  for (const x of segments(it, opts)) { if (x.rest) rest += x.s; else work += x.s; }
  return { work, rest };
}

// Duración (min) y calorías estimadas de una sesión. `metOf(id)` da el MET del catálogo.
// kcal = MET × 3,5 × peso ÷ 200 × minutos (trabajo con el MET del ejercicio, descansos con el de su tipo).
export function estimateSession(p, metOf, weightKg = DEFAULTS.weightKg) {
  let seconds = 0, kcal = 0;
  const perMin = met => (met * 3.5 * weightKg) / 200;
  p.items.forEach((it, n) => {
    for (const x of segments(it, { last: n === p.items.length - 1, nextRest: isRestItem(p.items[n + 1]), restBetween: p.restBetween ?? DEFAULTS.restBetween })) {
      seconds += x.s;
      kcal += perMin(x.met ?? metOf(it.id)) * (x.s / 60);
    }
  });
  return { minutes: Math.round(seconds / 60), kcal: Math.round(kcal) };
}

/** «45 s», «1 min», «1 min 30 s». */
export function fmtDur(s) {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

const lista = xs => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : String(xs[0]));

// Dosis en lenguaje sencillo para el paciente: «3 series · 10 repeticiones con cada lado ·
// mantén 3 s · descanso 45 s». En formatos tipo WOD (AMRAP, EMOM…) las series no se muestran.
export function doseText(it, format) {
  if (isRestItem(it)) return `${REST_TYPES[it.id].es} · ${fmtDur(it.time)}`;
  const wod = format && format.type !== 'series';
  const side = it.perSide ? ' con cada lado' : '';
  const specs = Array.from({ length: it.sets }, (_, k) => setSpec(it, k));
  const parts = wod ? [] : [`${it.sets} ${it.sets === 1 ? 'serie' : 'series'}`];
  const reps = specs.map(sp => sp.reps), times = specs.map(sp => sp.time);
  const allTimed = times.every(t => t != null), allReps = reps.every(r => r != null);
  const same = xs => xs.every(x => x === xs[0]);
  if (allTimed) parts.push(`${same(times) ? fmtDur(times[0]) : lista(times.map(fmtDur))}${side}`);
  else if (allReps) {
    const r = same(reps) ? reps[0] : null;
    parts.push(r != null ? `${r} ${r === 1 ? 'repetición' : 'repeticiones'}${side}` : `${lista(reps)} repeticiones${side}`);
  } else parts.push(specs.map(sp => (sp.time != null ? fmtDur(sp.time) : `${sp.reps} rep.`)).join(' · ') + side);
  if (it.hold && !allTimed) parts.push(`mantén ${it.hold} s`);
  if (it.restRep && !allTimed) parts.push(`pausa ${it.restRep} s entre repeticiones`);
  const rests = specs.slice(0, -1).map(sp => sp.rest);
  if (!wod && rests.length && rests.some(r => r > 0)) {
    const tipo = specs[0].restType !== 'descanso' ? ` (${REST_TYPES[specs[0].restType].es.toLowerCase()})` : '';
    parts.push(same(rests) ? `descanso ${fmtDur(rests[0])}${tipo}` : `descansos ${lista(rests.map(fmtDur))}`);
  }
  if (it.load) parts.push(it.load);
  return parts.join(' · ');
}

/** Nombre de un elemento: el del catálogo (byId) o el del tipo de descanso. */
export const itemName = (it, byId) => (isRestItem(it) ? REST_TYPES[it.id].es : byId?.get(it.id)?.name?.es ?? it.id);

export const FORMAT_LABEL = { series: 'Series', amrap: 'AMRAP', emom: 'EMOM', fortime: 'For time', tabata: 'Tabata' };
