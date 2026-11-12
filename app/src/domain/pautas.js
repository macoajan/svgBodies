// Lógica pura del editor de pautas: crear y modificar pautas y ejercicios respetando el formato
// v1 (@shared/pauta-schema.js), valores por defecto según el ejercicio, resumen y búsqueda.
// Las funciones devuelven objetos nuevos (no mutan la entrada).
import { LIMITS, DEFAULTS, checkPauta, estimateSession } from '@shared/pauta-schema.js';

export const ITEM_RANGES = Object.freeze({
  sets: [1, 20], reps: [1, 200], hold: [1, LIMITS.hold], tempo: [1, LIMITS.hold],
  restRep: [0, LIMITS.rest], restSet: [0, LIMITS.rest], restSide: [0, LIMITS.rest], restAfter: [0, LIMITS.rest],
});
export const PAUTA_RANGES = Object.freeze({ perWeek: [1, 14], weeks: [1, 52], restBetween: [0, LIMITS.rest] });

/** @param {number} n @param {readonly number[]} range */
const clamp = (n, range) => Math.min(range[1], Math.max(range[0], Math.round(n)));

/** Pauta vacía (los ejercicios se añaden después). */
export function newPauta({ title = '' } = {}) {
  return { v: 1, kind: 'pauta', title, schedule: { perWeek: 3, weeks: 4 }, restBetween: DEFAULTS.restBetween, show: { kcal: false, proText: false }, items: [] };
}

/** Dosis inicial razonable según el tipo de ejercicio; el profesional la ajusta. */
export function defaultItem(ex) {
  const goals = ex.goals || [];
  const it = { id: ex.id, sets: 3, reps: 10, restSet: 60 };
  if (goals.includes('isometria')) Object.assign(it, { reps: 3, hold: 20, restRep: 10 });
  else if (goals.includes('flexibilidad')) Object.assign(it, { sets: 2, reps: 3, hold: 30, restRep: 10, restSet: 30 });
  else if (ex.action === 'movilidad') Object.assign(it, { sets: 2, reps: 10, restSet: 30 });
  if (ex.laterality === 'unilateral') Object.assign(it, { perSide: true, restSide: 10 });
  return it;
}

/** Añade ejercicios del catálogo al final (sin pasar del máximo). Devuelve { pauta, added }. */
export function addItems(pauta, exercises) {
  const room = LIMITS.items - pauta.items.length;
  const add = exercises.slice(0, Math.max(0, room)).map(defaultItem);
  return { pauta: { ...pauta, items: [...pauta.items, ...add] }, added: add.length };
}

/**
 * Cambia campos de un ejercicio. `null` o '' quitan el campo opcional; los números se
 * redondean y se ajustan a su rango; los textos se recortan a su límite.
 */
export function updateItem(pauta, index, patch) {
  const it = { ...pauta.items[index] };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === '' || (k === 'perSide' && v === false)) { if (k !== 'sets') delete it[k]; continue; }
    if (ITEM_RANGES[k]) { const n = Number(v); if (Number.isFinite(n)) it[k] = clamp(n, ITEM_RANGES[k]); continue; }
    if (k === 'perSide') it.perSide = true;
    else if (k === 'load') it.load = String(v).slice(0, LIMITS.load);
    else if (k === 'note') it.note = String(v).slice(0, LIMITS.itemNote);
  }
  // Sin lados no hay descanso al cambiar de lado; sin repeticiones ni aguante, al menos 1 repetición.
  if (!it.perSide) delete it.restSide;
  if (it.reps === undefined && it.hold === undefined) it.reps = 1;
  if ((it.reps ?? 1) <= 1) delete it.restRep;
  const items = pauta.items.slice();
  items[index] = it;
  return { ...pauta, items };
}

/** Cambia campos generales: title, note, perWeek, weeks, restBetween, kcal, proText. */
export function updatePauta(pauta, patch) {
  const p = { ...pauta, schedule: pauta.schedule ? { ...pauta.schedule } : undefined, show: { ...(pauta.show || {}) } };
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'title') p.title = String(v ?? '').slice(0, LIMITS.title);
    else if (k === 'note') { const t = String(v ?? '').slice(0, LIMITS.note); if (t) p.note = t; else delete p.note; }
    else if (k === 'perWeek' || k === 'weeks') {
      if (v === null || v === '') { delete p.schedule; continue; }
      p.schedule = { perWeek: 3, weeks: 4, ...(p.schedule || {}), [k]: clamp(Number(v), PAUTA_RANGES[k]) };
    } else if (k === 'restBetween') p.restBetween = clamp(Number(v), PAUTA_RANGES.restBetween);
    else if (k === 'kcal' || k === 'proText') p.show[k] = !!v;
  }
  if (p.schedule === undefined) delete p.schedule;
  return p;
}

export function moveItem(pauta, from, to) {
  if (to < 0 || to >= pauta.items.length || from === to) return pauta;
  const items = pauta.items.slice();
  const [it] = items.splice(from, 1);
  items.splice(to, 0, it);
  return { ...pauta, items };
}

export function removeItem(pauta, index) {
  return { ...pauta, items: pauta.items.filter((_, i) => i !== index) };
}

export function duplicateItem(pauta, index) {
  if (pauta.items.length >= LIMITS.items) return pauta;
  const items = pauta.items.slice();
  items.splice(index + 1, 0, { ...items[index] });
  return { ...pauta, items };
}

/** «3 días por semana · 4 semanas», «A diario · 2 semanas». */
export function scheduleText(s) {
  if (!s) return 'Sin calendario';
  const dias = s.perWeek === 7 ? 'A diario' : s.perWeek === 14 ? 'Dos veces al día' : `${s.perWeek} ${s.perWeek === 1 ? 'día' : 'días'} por semana`;
  return `${dias} · ${s.weeks} ${s.weeks === 1 ? 'semana' : 'semanas'}`;
}

/** Dosis compacta para el profesional: «3 × 10 por lado · 3 s · desc. 60 s». */
export function doseShort(it) {
  const parts = [`${it.sets} × ${it.reps ?? 1}${it.perSide ? ' por lado' : ''}`];
  if (it.hold) parts.push(`${it.hold} s`);
  if (it.restRep) parts.push(`pausa ${it.restRep} s`);
  if (it.perSide && it.restSide) parts.push(`cambio ${it.restSide} s`);
  if (it.restSet && it.sets > 1) parts.push(`desc. ${it.restSet} s`);
  if (it.load) parts.push(it.load);
  return parts.join(' · ');
}

/** Duración y kcal estimadas (0 si no hay ejercicios). */
export function summary(pauta, byId, kg) {
  if (!pauta.items.length) return { minutes: 0, kcal: 0 };
  return estimateSession(pauta, id => byId.get(id)?.met ?? 3, kg || DEFAULTS.weightKg);
}

/** Problemas que impiden enviar la pauta, en lenguaje sencillo. */
export function problems(pauta, known) {
  if (!pauta.items.length) return ['Añade al menos un ejercicio.'];
  const errs = checkPauta(pauta, known);
  return errs.map(e => (/\.id$/.test(e) ? `Hay un ejercicio que no está en la biblioteca (${e}).` : `Revisa: ${e}.`));
}

/**
 * Busca pautas por título, alias del paciente o nombre de ejercicio.
 * @param {Array<{ id: string, pacienteId?: string, pauta: any, editada: string, estado?: string }>} list
 */
export function searchPautas(list, q, pacientes, byId) {
  const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = fold(q).split(/\s+/).filter(Boolean);
  const sorted = [...list].sort((a, b) => String(b.editada).localeCompare(String(a.editada)));
  if (!words.length) return sorted;
  return sorted.filter(r => {
    const text = fold([r.pauta.title, pacientes[r.pacienteId]?.alias, ...r.pauta.items.map(it => byId?.get(it.id)?.name?.es)].join(' '));
    return words.every(w => text.includes(w));
  });
}
