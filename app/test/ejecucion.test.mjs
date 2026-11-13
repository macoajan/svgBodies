import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, start, next, prev, tick, remaining, overtime, fractionLeft, adjust, skip, pause, resume, rate, toRespuesta, progress, current, upcomingTimers, setAuto } from '../src/domain/ejecucion.js';
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

test('plan: descansos como elementos, series cronometradas y series a medida', () => {
  const p = {
    v: 1, kind: 'pauta', restBetween: 90, items: [
      { id: 'plancha', sets: 2, time: 40, restSet: 30, restType: 'respiracion' },
      { id: 'descanso-caminando', time: 120 },
      { id: 'elevacion-talones', sets: 3, reps: 10, perSet: [{ reps: 12, rest: 60 }, { time: 30, rest: 90, restType: 'descanso-caminando' }, { reps: 8 }] },
    ],
  };
  const plan = buildPlan(p);
  assert.deepEqual(types(plan), [
    'preparar', 'trabajoTiempo(40)', 'descansoSerie(30)', 'trabajoTiempo(40)', 'valorar',
    'descansoItem(120)',
    'preparar', 'trabajo', 'descansoSerie(60)', 'trabajoTiempo(30)', 'descansoSerie(90)', 'trabajo', 'valorar',
    'resumen',
  ]);
  assert.equal(plan[2].restType, 'respiracion');
  assert.equal(plan[5].restType, 'descanso-caminando');
  assert.deepEqual(plan.filter(x => x.type === 'trabajo').map(x => x.reps), [12, 8]);
  // El ejercicio seguido de un descanso suelto no añade el descanso entre ejercicios.
  assert.ok(!plan.some(x => x.type === 'descansoEjercicio'));
  // Progreso: los descansos sueltos no cuentan como ejercicio.
  let s = start(plan, 0);
  assert.equal(progress(s).total, 2);
  while (current(s).type !== 'descansoItem') s = next(s, 0);
  assert.equal(progress(s).ejercicio, 2);
});

test('al terminar un descanso se espera «Continuar con el siguiente» y cuenta el tiempo extra', () => {
  let s = start(buildPlan(pauta), 0);
  s = next(s, 1000); // Empezar → mantener 20 s (1–21 s)
  s = tick(s, 21_000);
  assert.equal(current(s).type, 'descansoRep'); assert.equal(remaining(s, 21_000), 10);
  s = tick(s, 40_000); // el descanso acabó en t=31 s
  assert.equal(current(s).type, 'descansoRep'); assert.equal(s.espera, true);
  assert.equal(remaining(s, 40_000), 0); assert.equal(overtime(s, 40_000), 9); assert.equal(fractionLeft(s, 40_000), 0);
  assert.equal(tick(s, 99_000), s, 'en espera no avanza aunque pase el tiempo');
  assert.equal(pause(s, 41_000), s);
  s = next(s, 41_000); // Continuar con el siguiente
  assert.equal(current(s).type, 'mantener'); assert.equal(current(s).rep, 2);
});

test('con avance automático, tick encadena los pasos vencidos sin perder segundos', () => {
  let s = start(buildPlan(pauta), 0, { auto: true });
  s = next(s, 1000);
  // Hasta t=36 s: mantener (1–21) y pausa (21–31); el segundo aguante empezó en 31 y le quedan 15 s.
  s = tick(s, 36_000);
  assert.equal(current(s).type, 'mantener'); assert.equal(current(s).rep, 2); assert.equal(remaining(s, 36_000), 15);
  s = tick(s, 10_000_000);
  assert.equal(current(s).type, 'valorar');
  assert.equal(setAuto(s, false).auto, false);
});

test('el paciente alarga, acorta, para el reloj, salta y vuelve atrás', () => {
  let s = start(buildPlan(pauta), 0);
  s = next(s, 0); s = tick(s, 20_000); // pausa entre repeticiones de 10 s desde t=20 s
  assert.equal(current(s).type, 'descansoRep');
  s = adjust(s, 15, 20_000); assert.equal(remaining(s, 20_000), 25);
  assert.equal(fractionLeft(s, 20_000), 1); assert.equal(fractionLeft(s, 32_500), 0.5);
  s = adjust(s, -15, 20_000); assert.equal(remaining(s, 20_000), 10);
  const p = pause(s, 22_000); assert.equal(remaining(p, 99_000), 8); assert.equal(tick(p, 99_000), p);
  const r = resume(p, 100_000); assert.equal(remaining(r, 100_000), 8);
  // Acortar del todo no avanza: deja el descanso terminado, esperando al paciente.
  const fin = adjust(s, -60, 20_000);
  assert.equal(current(fin).type, 'descansoRep'); assert.equal(fin.espera, true);
  // En espera, +15 s vuelve a poner el reloj en marcha.
  const mas = adjust(fin, 15, 30_000); assert.equal(mas.espera, false); assert.equal(remaining(mas, 30_000), 15);
  assert.equal(current(skip(s, 21_000)).type, 'mantener');
  // Anterior: vuelve al aguante, no al descanso.
  const atras = prev(s, 22_000);
  assert.equal(current(atras).type, 'mantener'); assert.equal(current(atras).rep, 1); assert.equal(remaining(atras, 22_000), 20);
  assert.equal(prev(start(buildPlan(pauta), 0), 0).idx, 0);
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

test('avisos futuros: encadena el trabajo con tiempo y para al terminar un descanso', () => {
  const s = next(start(buildPlan(pauta), 0), 0);
  assert.deepEqual(upcomingTimers(s, 0).map(x => [x.at / 1000, x.step.type, !!x.espera]), [[20, 'mantener', false], [30, 'descansoRep', true]]);
  const auto = next(start(buildPlan(pauta), 0, { auto: true }), 0);
  assert.deepEqual(upcomingTimers(auto, 0).map(x => [x.at / 1000, x.step.type]), [[20, 'mantener'], [30, 'descansoRep'], [50, 'mantener'], [110, 'descansoSerie'], [130, 'mantener'], [140, 'descansoRep'], [160, 'mantener'], [160, 'valorar']]);
  assert.deepEqual(upcomingTimers(pause(s, 5), 5), []);
});
