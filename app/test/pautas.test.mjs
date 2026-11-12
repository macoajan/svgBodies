import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkPauta } from '../../server/public/pauta-schema.js';
import { newPauta, defaultItem, addItems, updateItem, updatePauta, moveItem, removeItem, duplicateItem, scheduleText, doseShort, summary, problems, searchPautas } from '../src/domain/pautas.js';

const catalog = JSON.parse(readFileSync(new URL('../../library/catalog.json', import.meta.url), 'utf8'));
const byId = new Map(catalog.exercises.map(e => [e.id, e]));
const known = new Set(byId.keys());
const ex = id => byId.get(id);

test('los valores por defecto de cada ejercicio del catálogo dan una pauta válida', () => {
  const { pauta, added } = addItems(newPauta({ title: 'Todo' }), catalog.exercises.slice(0, 40));
  assert.equal(added, 40);
  assert.deepEqual(checkPauta(pauta, known), []);
  for (const e of catalog.exercises) assert.deepEqual(checkPauta({ ...newPauta(), items: [defaultItem(e)] }, known), [], e.id);
});

test('defaults: isométrico con aguante, unilateral por lado', () => {
  const iso = defaultItem(ex('sentadilla-pared'));
  assert.equal(iso.hold, 20);
  const uni = catalog.exercises.find(e => e.laterality === 'unilateral');
  assert.equal(defaultItem(uni).perSide, true);
  assert.equal(defaultItem(uni).restSide, 10);
});

test('no se pasa de 40 ejercicios', () => {
  const p = addItems(newPauta(), catalog.exercises.slice(0, 38)).pauta;
  const r = addItems(p, catalog.exercises.slice(38, 45));
  assert.equal(r.added, 2); assert.equal(r.pauta.items.length, 40);
  assert.equal(duplicateItem(r.pauta, 0).items.length, 40);
});

test('updateItem ajusta rangos, quita opcionales y mantiene la coherencia', () => {
  let p = addItems(newPauta(), [ex('puente-una-pierna')]).pauta;
  p = updateItem(p, 0, { sets: 99, reps: 0, hold: 2.6, load: 'x'.repeat(80) });
  const it = p.items[0];
  assert.equal(it.sets, 20); assert.equal(it.reps, 1); assert.equal(it.hold, 3); assert.equal(it.load.length, 40);
  assert.equal(it.restRep, undefined); // con 1 repetición no hay pausa entre repeticiones
  p = updateItem(p, 0, { perSide: false });
  assert.equal(p.items[0].perSide, undefined); assert.equal(p.items[0].restSide, undefined);
  p = updateItem(p, 0, { reps: null, hold: null });
  assert.equal(p.items[0].reps, 1);
  p = updateItem(p, 0, { sets: null });
  assert.equal(p.items[0].sets, 20); // las series son obligatorias
  assert.deepEqual(checkPauta(p, known), []);
});

test('updatePauta: calendario, descanso, nota y qué ve el paciente', () => {
  let p = updatePauta(newPauta(), { perWeek: 30, weeks: 2, restBetween: 9999, note: '', kcal: true, title: 't'.repeat(99) });
  assert.deepEqual(p.schedule, { perWeek: 14, weeks: 2 });
  assert.equal(p.restBetween, 600); assert.equal(p.note, undefined); assert.equal(p.show.kcal, true); assert.equal(p.title.length, 60);
  p = updatePauta(p, { perWeek: '' });
  assert.equal(p.schedule, undefined);
});

test('mover, quitar y duplicar', () => {
  let p = addItems(newPauta(), [ex('puente-una-pierna'), ex('sentadilla-pared'), ex('plancha')]).pauta;
  assert.deepEqual(moveItem(p, 0, 2).items.map(i => i.id), ['sentadilla-pared', 'plancha', 'puente-una-pierna']);
  assert.equal(moveItem(p, 0, -1), p);
  assert.deepEqual(removeItem(p, 1).items.map(i => i.id), ['puente-una-pierna', 'plancha']);
  assert.deepEqual(duplicateItem(p, 0).items.map(i => i.id), ['puente-una-pierna', 'puente-una-pierna', 'sentadilla-pared', 'plancha']);
});

test('textos de resumen', () => {
  assert.equal(scheduleText({ perWeek: 7, weeks: 3 }), 'A diario · 3 semanas');
  assert.equal(scheduleText({ perWeek: 1, weeks: 1 }), '1 día por semana · 1 semana');
  assert.equal(doseShort({ sets: 3, reps: 10, perSide: true, hold: 3, restSide: 10, restSet: 45 }), '3 × 10 por lado · 3 s · cambio 10 s · desc. 45 s');
});

test('resumen y problemas', () => {
  const p = addItems(newPauta(), [ex('sentadilla-pared')]).pauta;
  const s = summary(p, byId, 70);
  assert.ok(s.minutes > 0 && s.kcal > 0);
  assert.deepEqual(summary(newPauta(), byId), { minutes: 0, kcal: 0 });
  assert.deepEqual(problems(newPauta(), known), ['Añade al menos un ejercicio.']);
  assert.deepEqual(problems(p, known), []);
  assert.match(problems({ ...p, items: [{ ...p.items[0], id: 'no-existe' }] }, known)[0], /no está en la biblioteca/);
});

test('buscar pautas por título, alias o ejercicio; las más recientes primero', () => {
  const list = [
    { id: 'a', pacienteId: 'p1', editada: '2026-01-01', pauta: { title: 'Rodilla', items: [{ id: 'sentadilla-pared' }] } },
    { id: 'b', pacienteId: 'p2', editada: '2026-02-01', pauta: { title: 'Hombro', items: [{ id: 'plancha' }] } },
  ];
  const pac = { p1: { alias: 'L.G.' }, p2: { alias: 'Violinista' } };
  assert.deepEqual(searchPautas(list, '', pac, byId).map(r => r.id), ['b', 'a']);
  assert.deepEqual(searchPautas(list, 'violin', pac, byId).map(r => r.id), ['b']);
  assert.deepEqual(searchPautas(list, 'sentadilla', pac, byId).map(r => r.id), ['a']);
});
