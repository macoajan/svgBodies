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
//   items: [{                              1–40 ejercicios, en orden
//     id: 'sentadilla-pared',             id del catálogo
//     sets: 3, reps?: 10,                 series y repeticiones (por lado si perSide)
//     hold?: 20, tempo?: 3,               mantenimiento o duración de cada repetición (s)
//     perSide?: true,                     unilateral: se hace con cada lado
//     restRep?: 10, restSet?: 60,         descansos entre repeticiones y entre series (s)
//     restSide?: 10, restAfter?: 90,      al cambiar de lado y al terminar el ejercicio (s)
//     load?: '60° rodilla', note?: '…',   carga o ángulo (≤ 40) y nota (≤ 300)
//   }]
// }
//
// El ámbito (privada o canal público) y la visibilidad por fechas no van aquí: viajan en claro
// junto al bloque cifrado (visibility.js), porque es el servidor quien decide qué entrega.
//
// Respuesta del paciente:
// { v: 1, kind: 'respuesta', at: '2026-11-10T18:20:00Z',
//   items: [{ i: 0, diff: 'facil'|'bien'|'dificil', pain: 0–10, note?: '…' }] }

export const LIMITS = { items: 40, title: 60, proField: 80, note: 500, itemNote: 300, load: 40, rest: 600, hold: 600 };
export const DEFAULTS = { tempo: 3, restBetween: 90, restMet: 1.3, weightKg: 70 };
const DIFF = ['facil', 'bien', 'dificil'];
export const FORMATS = ['series', 'amrap', 'emom', 'fortime', 'tabata'];

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isText = (v, max) => typeof v === 'string' && v.length <= max;

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
    if (typeof it.id !== 'string' || (known && !known.has(it.id))) bad(`${w}.id`);
    if (!isInt(it.sets, 1, 20)) bad(`${w}.sets`);
    if (it.reps !== undefined && !isInt(it.reps, 1, 200)) bad(`${w}.reps`);
    if (it.reps === undefined && it.hold === undefined) bad(`${w}: reps o hold`);
    for (const k of ['hold', 'tempo']) if (it[k] !== undefined && !isInt(it[k], 1, LIMITS.hold)) bad(`${w}.${k}`);
    for (const k of ['restRep', 'restSet', 'restSide', 'restAfter']) if (it[k] !== undefined && !isInt(it[k], 0, LIMITS.rest)) bad(`${w}.${k}`);
    if (it.perSide !== undefined && typeof it.perSide !== 'boolean') bad(`${w}.perSide`);
    if (it.load !== undefined && !isText(it.load, LIMITS.load)) bad(`${w}.load`);
    if (it.note !== undefined && !isText(it.note, LIMITS.itemNote)) bad(`${w}.note`);
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

// Tiempo de trabajo y de descanso de un ejercicio (s). El descanso al terminar no cuenta en el último.
export function itemTimes(it, { last = false, restBetween = DEFAULTS.restBetween } = {}) {
  const sides = it.perSide ? 2 : 1;
  const reps = it.reps ?? 1;
  const perRep = it.hold ?? it.tempo ?? DEFAULTS.tempo;
  const work = it.sets * sides * reps * perRep;
  const rest = it.sets * sides * (reps - 1) * (it.restRep ?? 0)
    + (it.sets - 1) * (it.restSet ?? 0)
    + (it.perSide ? it.sets * (it.restSide ?? 0) : 0)
    + (last ? 0 : it.restAfter ?? restBetween);
  return { work, rest };
}

// Duración (min) y calorías estimadas de una sesión. `metOf(id)` da el MET del catálogo.
// kcal = MET × 3,5 × peso ÷ 200 × minutos (trabajo con el MET del ejercicio, descansos con MET de reposo).
export function estimateSession(p, metOf, weightKg = DEFAULTS.weightKg) {
  let seconds = 0, kcal = 0;
  const perMin = met => (met * 3.5 * weightKg) / 200;
  p.items.forEach((it, n) => {
    const { work, rest } = itemTimes(it, { last: n === p.items.length - 1, restBetween: p.restBetween ?? DEFAULTS.restBetween });
    seconds += work + rest;
    kcal += perMin(metOf(it.id)) * (work / 60) + perMin(DEFAULTS.restMet) * (rest / 60);
  });
  return { minutes: Math.round(seconds / 60), kcal: Math.round(kcal) };
}

// Dosis en lenguaje sencillo para el paciente: «3 series · 10 repeticiones con cada lado ·
// mantén 3 s · descanso 45 s».
// En formatos tipo WOD (AMRAP, EMOM…) las series no aplican y se omiten.
export function doseText(it, format) {
  const parts = format && format.type !== 'series' ? [] : [`${it.sets} ${it.sets === 1 ? 'serie' : 'series'}`];
  const side = it.perSide ? ' con cada lado' : '';
  if (it.reps !== undefined) parts.push(`${it.reps} ${it.reps === 1 ? 'repetición' : 'repeticiones'}${side}`);
  else if (side) parts.push(side.trim());
  if (it.hold) parts.push(`mantén ${it.hold} s`);
  if (it.restRep) parts.push(`pausa ${it.restRep} s entre repeticiones`);
  if (it.restSet) parts.push(`descanso ${it.restSet} s`);
  if (it.load) parts.push(it.load);
  return parts.join(' · ');
}

export const FORMAT_LABEL = { series: 'Series', amrap: 'AMRAP', emom: 'EMOM', fortime: 'For time', tabata: 'Tabata' };
