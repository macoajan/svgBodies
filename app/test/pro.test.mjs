import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FREE_LIMITS, activos, uso, puedeEnviar } from '../src/domain/limites.js';
import { cifrarCopia, descifrarCopia } from '../src/domain/copia.js';
import { createStorage, memoryBackend } from '../src/data/storage.js';

const P = (id, pacienteId, enviada) => ({ id, pacienteId, ...(enviada ? { envio: { code: id } } : {}) });

test('el límite gratuito es de 3 pacientes con pauta activa', () => assert.equal(FREE_LIMITS.pacientesActivos, 3));

test('cuentan pacientes (no pautas) con alguna pauta enviada; las pautas sin paciente cuentan sueltas', () => {
  const pautas = [P('a', 'p1', true), P('b', 'p1', true), P('c', 'p2', true), P('d', null, true), P('e', 'p3', false)];
  assert.equal(activos(pautas).size, 3);
  assert.deepEqual(uso(pautas), { usados: 3, limite: 3 });
});

test('puedeEnviar: lo ya enviado y el mismo paciente nunca se bloquean', () => {
  const pautas = [P('a', 'p1', true), P('b', 'p2', true), P('c', 'p3', true), P('d', 'p1', false), P('e', 'p4', false), P('f', null, false)];
  assert.equal(puedeEnviar(pautas, 'a', false), true);  // actualizar una enviada
  assert.equal(puedeEnviar(pautas, 'd', false), true);  // otro pauta de un paciente activo
  assert.equal(puedeEnviar(pautas, 'e', false), false); // cuarto paciente
  assert.equal(puedeEnviar(pautas, 'f', false), false);
  assert.equal(puedeEnviar(pautas, 'e', true), true);   // Pro
  assert.equal(puedeEnviar(pautas.slice(1), 'e', false), true); // con hueco
});

test('copia de seguridad: ida y vuelta, frase incorrecta y archivo ajeno', async () => {
  const snap = { v: 1, collections: { pacientes: { v: 1, data: { x: { alias: 'L.G.' } } } } };
  const f = await cifrarCopia(snap, 'una frase larga', { iter: 1000 });
  assert.ok(!f.includes('L.G.'));
  assert.deepEqual((await descifrarCopia(f, 'una frase larga')).snapshot, snap);
  await assert.rejects(descifrarCopia(f, 'otra frase larga'), /frase no es correcta/);
  await assert.rejects(descifrarCopia('{"a":1}', 'x'), /no es una copia/);
  await assert.rejects(cifrarCopia(snap, 'corta'), /al menos 8/);
});

test('restore sustituye todos los datos desde una instantánea', async () => {
  const a = await createStorage({ backend: memoryBackend() }).open();
  await a.set('pacientes', { p: { alias: 'Ana' } });
  await a.set('compra', { pro: true, comprobado: 'x' });
  const snap = a.snapshot();
  const b = await createStorage({ backend: memoryBackend() }).open();
  await b.set('pautas', { z: {} });
  await b.restore(snap);
  assert.deepEqual(b.get('pacientes'), { p: { alias: 'Ana' } });
  assert.deepEqual(b.get('pautas'), {});
  await assert.rejects(b.restore({ v: 2 }), { code: 'corrupto' });
});
