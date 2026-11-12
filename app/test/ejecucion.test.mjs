import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, start, next, tick, remaining, fractionLeft, adjust, skip, pause, resume, rate, toRespuesta, progress, current, upcomingTimers } from '../src/domain/ejecucion.js';
import { checkRespuesta } from '../../server/public/pauta-schema.js';

const pauta = {
  v: 1, kind: 'pauta', restBetween: 90,
  items: [
    { id: 'sentadilla-pared', sets: 2, reps: 2, hold: 20, restRep: 10, restSet: 60 },
    { id: 'puente-una-pierna', sets: 2, reps: 10, perSide: true, restSide: 10, restSet: 45, restAfter: 30 },
    { id: 'elevacion-talones', sets: 1, reps: 15 },
  ],
};
const types = plan => plan.map(p => p.type + (p.side ? `:${p.side[0]}` : '') + (p.dur ? `(${p.dur})` : ''));

test('plan: aguantes, lados, descansos de los tres niveles y valoración', () => {
  assert.deepEqual(types(buildPlan(pauta)), [
    'preparar', 'mantener(20)', 'descansoRep(10)', 'mantener(20)', 'descansoSerie(60)', 'mantener(20)', 'descansoRep(10)', 'mantener(20)', 'valorar', 'descansoEjercicio(90)',
    'preparar', 'trabajo:d', 'cambioLado:i(10)', 'trabajo:i', 'descansoSerie(45)', 'trabajo:d', 'cambioLado:i(10)', 'trabajo:i', 'valorar', 'descansoEjercicio(30)',
    'preparar', 'trabajo', 'valorar',
    'resumen',
  ]);
});

test('sin descansos indicados: no hay pasos de descanso, salvo unos segundos para cambiar de lado', () => {
  const p = { v: 1, kind: 'pauta', restBetween: 0, items: [{ id: 'x', sets: 2, reps: 3, hold: 5, perSide: true }, { id: 'y', sets: 1, reps: 1 }] };
  const t = types(buildPlan(p));
  assert.ok(!t.some(x => x.startsWith('descanso')));
  assert.ok(t.includes('cambioLado:i(5)'));
});

test('avance manual y con tiempo; tick encadena los pasos vencidos sin perder segundos', () => {
  let s = start(buildPlan(pauta), 0);
  assert.equal(current(s).type, 'preparar'); assert.equal(remaining(s, 0), 0);
  s = next(s, 1000); // Empezar → mantener 20 s
  assert.equal(current(s).type, 'mantener'); assert.equal(remaining(s, 1000), 20);
  assert.equal(tick(s, 20_999), s);
  // Teléfono bloqueado hasta t=36 s: mantener (1–21 s) y descansoRep (21–31 s) han terminado;
  // el segundo aguante empezó en t=31 s y le quedan 15 s.
  s = tick(s, 36_000);
  assert.equal(current(s).type, 'mantener'); assert.equal(current(s).rep, 2); assert.equal(remaining(s, 36_000), 15);
  // Mucho tiempo después: llega hasta el primer paso manual (valorar) y se detiene.
  s = tick(s, 10_000_000);
  assert.equal(current(s).type, 'valorar');
});

test('el paciente alarga, acorta, salta y pausa', () => {
  let s = start(buildPlan(pauta), 0);
  s = next(s, 0); s = tick(s, 20_000); // descansoRep de 10 s desde t=20 s
  assert.equal(current(s).type, 'descansoRep'); assert.equal(remaining(s, 20_000), 10);
  s = adjust(s, 15, 20_000); assert.equal(remaining(s, 20_000), 25);
  assert.equal(fractionLeft(s, 20_000), 1); assert.equal(fractionLeft(s, 32_500), 0.5);
  s = adjust(s, -15, 20_000); assert.equal(remaining(s, 20_000), 10);
  const p = pause(s, 22_000); assert.equal(remaining(p, 99_000), 8); assert.equal(tick(p, 99_000), p);
  const r = resume(p, 100_000); assert.equal(remaining(r, 100_000), 8);
  assert.equal(current(adjust(s, -60, 20_000)).type, 'mantener'); // acortar del todo pasa al siguiente
  assert.equal(current(skip(s, 21_000)).type, 'mantener');
});

test('valoraciones → respuesta v1 válida, solo con lo valorado', () => {
  let s = start(buildPlan(pauta), 0);
  s = rate(s, 0, { diff: 'bien', pain: 2 });
  s = rate(s, 2, { diff: 'dificil' });
  s = rate(s, 2, { note: 'Me cuesta el equilibrio' });
  s = rate(s, 1, { note: '' });
  const r = toRespuesta(s, '2026-11-12T10:00:00Z');
  assert.deepEqual(r.items, [{ i: 0, diff: 'bien', pain: 2 }, { i: 2, diff: 'dificil', note: 'Me cuesta el equilibrio' }]);
  assert.deepEqual(checkRespuesta(r, 3), []);
});

test('progreso y fin', () => {
  let s = start(buildPlan(pauta), 0);
  assert.deepEqual(progress(s), { ejercicio: 1, total: 3, fraccion: 0 });
  while (current(s).type !== 'resumen') s = next(s, 5000);
  assert.equal(progress(s).ejercicio, 3); assert.equal(progress(s).fraccion, 1);
  assert.equal(s.fin, 5000);
  assert.equal(next(s, 9000), s);
});

test('avisos futuros: encadena los pasos con tiempo hasta el siguiente manual', () => {
  let s = next(start(buildPlan(pauta), 0), 0);
  const u = upcomingTimers(s, 0);
  assert.deepEqual(u.map(x => [x.at / 1000, x.step.type]), [[20, 'mantener'], [30, 'descansoRep'], [50, 'mantener'], [110, 'descansoSerie'], [130, 'mantener'], [140, 'descansoRep'], [160, 'mantener'], [160, 'valorar']]);
  assert.deepEqual(upcomingTimers(pause(s, 5), 5), []);
});
