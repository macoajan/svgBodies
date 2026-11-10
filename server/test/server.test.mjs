// Pruebas de extremo a extremo: servidor real en un puerto libre, base de datos en memoria y
// el mismo cliente (api-client.js) que usarán la app y el visor.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { loadConfig } from '../src/config.mjs';
import { openStore } from '../src/store.mjs';
import { createApp } from '../src/app.mjs';
import * as api from '../public/api-client.js';
import { createRateLimiter } from '../src/ratelimit.mjs';

let server, base, store;
const pauta = { v: 1, kind: 'pauta', title: 'Rodilla', items: [{ id: 'sentadilla-pared', sets: 3, reps: 3, hold: 20 }] };
const iso = ms => new Date(Date.now() + ms).toISOString();
const DAY = 86_400_000;

before(async () => {
  store = openStore(':memory:');
  server = createServer(createApp({ ...loadConfig({}), publicUrl: 'http://placeholder', trustProxy: false, writeLimit: 1000, readLimit: 1000 }, store));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); store.close(); });

const get = (path, init) => fetch(base + path, init);

test('pauta privada: publicar, abrir, actualizar con el mismo enlace y borrar', async () => {
  const pub = await api.publishPauta(base, pauta);
  assert.ok(!pub.offline && pub.code && pub.token);
  assert.match(pub.link, /\/p\/[A-Za-z0-9]{8}#[A-Za-z0-9_-]{43}$/);
  assert.deepEqual((await api.fetchPauta(pub.link)).pauta, pauta);

  const changed = { ...pauta, note: 'Baja menos' };
  await api.updatePauta(base, pub, changed);
  assert.equal((await api.fetchPauta(pub.link)).pauta.note, 'Baja menos');

  await assert.rejects(api.updatePauta(base, { ...pub, token: 'x'.repeat(43) }, pauta), e => e.status === 401);
  await api.deletePauta(base, pub);
  await assert.rejects(api.fetchPauta(pub.link), e => e.status === 404);
});

test('el servidor solo guarda texto cifrado', async () => {
  const pub = await api.publishPauta(base, { ...pauta, note: 'texto-secreto-de-prueba' });
  const raw = store.getPauta(pub.code);
  assert.ok(!raw.blob.includes('secreto') && !raw.blob.includes('sentadilla'));
  assert.notEqual(raw.tokenHash, pub.token);
});

test('visibilidad: programada, forzada y vista por el profesional', async () => {
  const pub = await api.publishPauta(base, pauta, { visibility: { mode: 'auto', from: iso(DAY) } });
  await assert.rejects(api.fetchPauta(pub.link), e => e.status === 403 && e.body.estado === 'programada' && !!e.body.desde);
  const own = await api.fetchPauta(pub.link, { token: pub.token });
  assert.equal(own.estado, 'programada');
  await api.updatePauta(base, pub, null, { visibility: { mode: 'show' } });
  assert.deepEqual((await api.fetchPauta(pub.link)).pauta, pauta);
  await api.updatePauta(base, pub, null, { visibility: { mode: 'hide' } });
  await assert.rejects(api.fetchPauta(pub.link), e => e.status === 403 && e.body.estado === 'oculta');
  const bad = await get(`/api/v1/p/${pub.code}`, { method: 'PUT', headers: { Authorization: `Bearer ${pub.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility: { mode: 'auto', from: 'mañana' } }) });
  assert.equal(bad.status, 400);
});

test('respuestas del paciente', async () => {
  const pub = await api.publishPauta(base, pauta);
  const r = { v: 1, kind: 'respuesta', at: new Date().toISOString(), items: [{ i: 0, diff: 'dificil', pain: 4 }] };
  await api.sendRespuesta(base, pub.code, pub.key, r);
  await api.sendRespuesta(base, pub.code, pub.key, { ...r, items: [{ i: 0, diff: 'bien', pain: 2 }] });
  const list = await api.fetchRespuestas(base, pub);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0].respuesta, r);
  assert.equal((await api.fetchRespuestas(base, pub, list[0].id)).length, 1);
  await assert.rejects(api.fetchRespuestas(base, { ...pub, token: 'y'.repeat(43) }), e => e.status === 401);
});

test('canal público: solo se entregan las sesiones visibles', async () => {
  const canal = await api.createCanal(base, { name: 'WOD Box' });
  await api.addSesion(base, canal, { ...pauta, title: 'Hoy' }, { mode: 'auto', from: iso(-DAY), until: iso(DAY) });
  const futura = await api.addSesion(base, canal, { ...pauta, title: 'Sorpresa' }, { mode: 'auto', from: iso(3 * DAY) });
  await api.addSesion(base, canal, { ...pauta, title: 'Retirada' }, { mode: 'hide' });
  await api.addSesion(base, canal, { ...pauta, title: 'Siempre' });

  const pub = await api.fetchCanal(canal.link);
  assert.equal(pub.meta.name, 'WOD Box');
  assert.deepEqual(pub.sesiones.map(s => s.pauta.title), ['Hoy', 'Siempre']);

  const all = await api.fetchCanal(canal.link, { token: canal.token });
  assert.deepEqual(all.sesiones.map(s => s.estado), ['visible', 'programada', 'oculta', 'visible']);

  await api.updateSesion(base, canal, futura.id, null, { mode: 'show' });
  assert.ok((await api.fetchCanal(canal.link)).sesiones.some(s => s.pauta.title === 'Sorpresa'));
  await api.deleteSesion(base, canal, futura.id);
  assert.equal((await api.fetchCanal(canal.link, { token: canal.token })).sesiones.length, 3);
  await assert.rejects(api.addSesion(base, { ...canal, token: 'z'.repeat(43) }, pauta), e => e.status === 401);
  await api.deleteCanal(base, canal);
  await assert.rejects(api.fetchCanal(canal.link), e => e.status === 404);
});

test('caducidad: se borra lo que lleva tiempo sin uso', async () => {
  const pub = await api.publishPauta(base, pauta);
  await api.sendRespuesta(base, pub.code, pub.key, { v: 1, kind: 'respuesta', at: new Date().toISOString(), items: [] });
  assert.equal(store.purgeExpired(Date.now()), 0);
  assert.ok(store.purgeExpired(Date.now() + 200 * DAY) >= 1);
  assert.equal(store.getPauta(pub.code), undefined);
  assert.equal(store.countRespuestas(pub.code), 0);
});

test('límites y entradas no válidas', async () => {
  const post = body => get('/api/v1/p', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.equal((await post('{"blob":"texto en claro"}')).status, 400);
  assert.equal((await post('no es json')).status, 400);
  assert.equal((await post(JSON.stringify({ blob: 'v1.' + 'A'.repeat(20000) }))).status, 413);
  assert.equal((await get('/api/v1/p/abc')).status, 404);
  assert.equal((await get('/api/v1/p', { method: 'GET' })).status, 405);
  assert.equal((await get('/api/v1/p', { method: 'OPTIONS' })).status, 204);
});

test('visor, biblioteca y ficheros', async () => {
  const viewer = await get('/p/AbCdEf12');
  assert.equal(viewer.status, 200);
  assert.match(viewer.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(await viewer.text(), /\/assets\/viewer\.js/);
  assert.equal((await get('/c/AbCdEf12')).status, 200);
  assert.equal((await get('/assets/api-client.js')).status, 200);
  assert.equal((await get('/assets/../src/app.mjs')).status, 404);
  assert.equal((await get('/lib/catalog.json')).status, 200);
  assert.equal((await get('/lib/svg/sentadilla-pared-lateral.svg')).headers.get('content-type'), 'image/svg+xml; charset=utf-8');
  assert.equal((await get('/lib/svg/..%2Fcatalog.json')).status, 404);
  assert.equal((await get('/.well-known/assetlinks.json')).status, 404);
  assert.equal((await get('/healthz')).status, 200);
});

test('límite de peticiones por IP', () => {
  const rl = createRateLimiter({ windowMs: 1000, limits: { read: 2, write: 1 } });
  assert.equal(rl.hit('a', 'write', 0), 0);
  assert.ok(rl.hit('a', 'write', 10) > 0);
  assert.equal(rl.hit('b', 'write', 10), 0);
  assert.equal(rl.hit('a', 'write', 1000), 0);
});
