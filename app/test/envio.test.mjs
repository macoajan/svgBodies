import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVisible } from '../../server/public/visibility.js';
import { pautaParaEnviar, huella, estadoEnvio, formAVisibilidad, visibilidadAForm, visibilidadTexto, localMidnightISO, resumenRespuestas, nivelDolor } from '../src/domain/envio.js';

const pauta = { v: 1, kind: 'pauta', title: '', items: [{ id: 'plancha', sets: 3, hold: 30 }] };

test('pautaParaEnviar añade nombre y centro del profesional y quita lo vacío', () => {
  const p = pautaParaEnviar(pauta, { nombre: ' Ana ', centro: '' });
  assert.deepEqual(p.pro, { name: 'Ana' });
  assert.equal('title' in p, false);
  assert.equal(pautaParaEnviar(pauta, {}).pro, undefined);
  assert.equal(pauta.title, ''); // no muta la entrada
});

test('huella estable e independiente del orden de las claves', () => {
  assert.equal(huella({ a: 1, b: [1, { c: 2, d: 3 }] }), huella({ b: [1, { d: 3, c: 2 }], a: 1 }));
  assert.notEqual(huella({ a: 1 }), huella({ a: 2 }));
});

test('estado del envío', () => {
  const aj = { nombre: 'Ana' };
  const rec = { pauta };
  assert.equal(estadoEnvio(rec, aj), 'borrador');
  rec.envio = { code: 'x', huella: huella(pautaParaEnviar(pauta, aj)) };
  assert.equal(estadoEnvio(rec, aj), 'enviada');
  assert.equal(estadoEnvio({ ...rec, pauta: { ...pauta, title: 'Otra' } }, aj), 'cambios');
  assert.equal(estadoEnvio(rec, { nombre: 'Otro nombre' }), 'cambios'); // cambiar el nombre también cambia lo enviado
  assert.equal(estadoEnvio({ pauta, envio: { offline: true } }, aj), 'sin-servidor');
});

test('medianoche local con zona horaria', () => {
  const iso = localMidnightISO('2026-11-24');
  assert.match(iso, /^2026-11-24T00:00:00[+-]\d\d:\d\d$/);
  assert.equal(new Date(iso).getDate(), 24);
  assert.match(localMidnightISO('2026-12-31', 1), /^2027-01-01T00:00:00/);
});

test('visibilidad: formulario ida y vuelta, y fin incluido', () => {
  assert.deepEqual(formAVisibilidad({ modo: 'ya' }).visibility, { mode: 'auto' });
  assert.deepEqual(formAVisibilidad({ modo: 'oculta' }).visibility, { mode: 'hide' });
  assert.match(formAVisibilidad({ modo: 'desde' }).error, /desde qué día/);
  const { visibility: v } = formAVisibilidad({ modo: 'desde', desde: '2026-11-24', hasta: '2026-11-30' });
  assert.deepEqual(visibilidadAForm(v), { modo: 'desde', desde: '2026-11-24', hasta: '2026-11-30' });
  // El 30 a última hora sigue visible; el 1 de diciembre ya no.
  assert.equal(isVisible(v, new Date(2026, 10, 30, 23, 59).getTime()), true);
  assert.equal(isVisible(v, new Date(2026, 11, 1, 0, 1).getTime()), false);
  assert.equal(isVisible(v, new Date(2026, 10, 23, 23, 59).getTime()), false);
  assert.match(formAVisibilidad({ modo: 'desde', desde: '2026-11-24', hasta: '2026-11-20' }).error, /posterior/);
  const soloFin = formAVisibilidad({ modo: 'ya', hasta: '2026-11-30' }).visibility;
  assert.deepEqual(visibilidadAForm(soloFin), { modo: 'ya', hasta: '2026-11-30' });
});

test('texto de visibilidad', () => {
  const now = new Date(2026, 10, 12).getTime();
  assert.equal(visibilidadTexto({ mode: 'auto' }, now), 'Visible');
  assert.equal(visibilidadTexto({ mode: 'hide' }, now), 'Oculta para el paciente');
  assert.match(visibilidadTexto(formAVisibilidad({ modo: 'desde', desde: '2026-11-24' }).visibility, now), /Disponible desde el 24 de noviembre/);
  assert.match(visibilidadTexto(formAVisibilidad({ modo: 'ya', hasta: '2026-11-30' }).visibility, now), /Visible hasta el 30 de noviembre/);
});

test('resumen de respuestas por ejercicio', () => {
  const r = (items) => ({ respuesta: { v: 1, kind: 'respuesta', items } });
  const s = resumenRespuestas([
    r([{ i: 0, diff: 'bien', pain: 2 }, { i: 1, diff: 'dificil', pain: 5, note: 'tira' }]),
    r([{ i: 0, diff: 'facil', pain: 1 }, { i: 1, diff: 'dificil', pain: 7 }, { i: 9, pain: 3 }]),
  ], 2);
  assert.deepEqual(s[0], { veces: 2, ultimo: 1, max: 2, dificil: 0, facil: 1, notas: 0, tendencia: 'baja' });
  assert.deepEqual(s[1], { veces: 2, ultimo: 7, max: 7, dificil: 2, facil: 0, notas: 1, tendencia: 'sube' });
  assert.deepEqual([nivelDolor(null), nivelDolor(3), nivelDolor(4), nivelDolor(7)], [null, 'bajo', 'medio', 'alto']);
});
