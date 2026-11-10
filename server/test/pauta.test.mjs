import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newKey, seal, open, shortLink, longLink, parseLink } from '../public/pauta-crypto.js';
import { checkPauta, checkRespuesta, itemTimes, estimateSession } from '../public/pauta-schema.js';

const catalog = JSON.parse(readFileSync(new URL('../../library/catalog.json', import.meta.url)));
const metOf = id => catalog.exercises.find(e => e.id === id).met;
const known = new Set(catalog.exercises.map(e => e.id));

const pauta = {
  v: 1, kind: 'pauta', title: 'Rodilla · L.G.', note: 'Si molesta la rodilla, baja menos.',
  schedule: { perWeek: 7, weeks: 3 }, restBetween: 90, show: { kcal: false, proText: false },
  items: [
    { id: 'sentadilla-pared', sets: 3, reps: 3, hold: 20, restRep: 10, restSet: 60, load: '60° rodilla' },
    { id: 'puente-una-pierna', sets: 3, reps: 10, hold: 3, perSide: true, restRep: 2, restSide: 10, restSet: 45 },
    { id: 'elevacion-talones', sets: 3, reps: 15, restSet: 45 },
  ],
};

test('cifrar y descifrar una pauta', async () => {
  const key = newKey();
  const blob = await seal(pauta, key);
  assert.match(blob, /^v1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(await open(blob, key), pauta);
  await assert.rejects(open(blob, newKey()));
});

test('enlaces corto y largo', async () => {
  const key = newKey();
  assert.deepEqual(parseLink(shortLink('https://maroto.es/', 'k7Qx2aB9', key)), { code: 'k7Qx2aB9', key });
  const blob = await seal(pauta, key);
  const long = longLink('https://maroto.es', key, blob);
  assert.deepEqual(parseLink(long), { key, blob });
  assert.ok(long.length < 900, `enlace largo de ${long.length} caracteres`);
  assert.equal(parseLink('https://maroto.es/p/abc'), null);
});

test('validación de la pauta y la respuesta', () => {
  assert.deepEqual(checkPauta(pauta, known), []);
  assert.ok(checkPauta({ ...pauta, show: { kcal: 'sí' } }).includes('show.kcal'));
  assert.ok(checkPauta({ ...pauta, items: [{ id: 'nada', sets: 3, reps: 5 }] }, known).includes('items[0].id'));
  const r = { v: 1, kind: 'respuesta', at: '2026-11-10T18:20:00Z', items: [{ i: 0, diff: 'dificil', pain: 4, note: 'Uf' }] };
  assert.deepEqual(checkRespuesta(r, 3), []);
  assert.ok(checkRespuesta({ ...r, items: [{ i: 5, pain: 11 }] }, 3).length === 2);
});

test('tiempos y calorías estimadas', () => {
  // Puente: 3 series × 2 lados × 10 reps × 3 s = 180 s de trabajo.
  assert.deepEqual(itemTimes(pauta.items[1], { restBetween: 90 }), { work: 180, rest: 3 * 2 * 9 * 2 + 2 * 45 + 3 * 10 + 90 });
  const est = estimateSession(pauta, metOf, 70);
  assert.ok(est.minutes >= 10 && est.minutes <= 20, `${est.minutes} min`);
  assert.ok(est.kcal > 20 && est.kcal < 120, `${est.kcal} kcal`);
  assert.ok(estimateSession(pauta, metOf, 90).kcal > est.kcal);
});
