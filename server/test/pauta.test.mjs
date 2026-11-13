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

import { setSpec, doseText, isRestItem, fmtDur, REST_TYPES } from '../public/pauta-schema.js';

test('descansos como elementos de la pauta', () => {
  const p = { ...pauta, items: [pauta.items[0], { id: 'descanso-caminando', time: 120 }, pauta.items[2]] };
  assert.deepEqual(checkPauta(p, known), []);
  assert.ok(isRestItem(p.items[1]));
  assert.equal(doseText(p.items[1]), 'Descanso caminando · 2 min');
  assert.ok(checkPauta({ ...p, items: [{ id: 'descanso', time: 2 }] }).includes('items[0].time'));
  // Cuenta en la duración con el MET de su tipo y sustituye al descanso entre ejercicios
  // (90 s): con 2 min caminando, la sesión dura 30 s más y gasta algo más.
  const sin = estimateSession({ ...p, items: [pauta.items[0], pauta.items[2]] }, metOf, 70);
  const con = estimateSession(p, metOf, 70);
  assert.ok(con.minutes >= sin.minutes && con.kcal > sin.kcal, `${sin.minutes}→${con.minutes} min, ${sin.kcal}→${con.kcal} kcal`);
  assert.ok(Object.keys(REST_TYPES).length >= 4);
});

test('series cronometradas y series a medida', () => {
  const crono = { id: 'plancha', sets: 3, time: 40, restSet: 30, restType: 'respiracion' };
  assert.deepEqual(checkPauta({ ...pauta, items: [crono] }, known), []);
  assert.deepEqual(setSpec(crono, 0), { time: 40, rest: 30, restType: 'respiracion' });
  assert.deepEqual(setSpec(crono, 2), { time: 40, rest: 0, restType: 'respiracion' });
  assert.equal(doseText(crono), '3 series · 40 s · descanso 30 s (respiración)');
  assert.deepEqual(itemTimes(crono, { last: true }), { work: 120, rest: 60 });

  const reparto = { id: 'elevacion-talones', sets: 3, reps: 10, perSet: [{ reps: 12, rest: 60 }, { reps: 10, rest: 90, restType: 'descanso-caminando' }, { reps: 8 }] };
  assert.deepEqual(checkPauta({ ...pauta, items: [reparto] }, known), []);
  assert.equal(doseText(reparto), '3 series · 12, 10 y 8 repeticiones · descansos 1 min y 1 min 30 s');
  assert.deepEqual(setSpec(reparto, 1), { reps: 10, rest: 90, restType: 'descanso-caminando' });
  const mixto = { id: 'plancha', sets: 2, reps: 5, perSet: [{ time: 30 }, {}] };
  assert.equal(doseText(mixto), '2 series · 30 s · 5 rep.');
  assert.ok(checkPauta({ ...pauta, items: [{ ...reparto, perSet: [{}] }] }, known).includes('items[0].perSet'));
  assert.ok(checkPauta({ ...pauta, items: [{ ...crono, restType: 'siesta' }] }, known).includes('items[0].restType'));
  assert.equal(fmtDur(75), '1 min 15 s');
});
