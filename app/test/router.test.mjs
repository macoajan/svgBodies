import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, match, href } from '../src/router.js';

test('parseHash separa ruta y consulta', () => {
  assert.deepEqual(parseHash(''), { path: '/', query: {} });
  assert.deepEqual(parseHash('#/pro/pauta/ab%20c/?tab=2&x=y'), { path: '/pro/pauta/ab c', query: { tab: '2', x: 'y' } });
});

test('match encuentra la ruta y sus parámetros', () => {
  const routes = [{ path: '/' }, { path: '/pro' }, { path: '/pro/pauta/:id' }];
  assert.equal(match(routes, '/').route.path, '/');
  assert.deepEqual(match(routes, '/pro/pauta/42').params, { id: '42' });
  assert.equal(match(routes, '/pro/otra/42'), null);
  assert.equal(match(routes, '/nada'), null);
});

test('href construye el hash', () => {
  assert.equal(href('/pro'), '#/pro');
  assert.equal(href('/pro', { a: '1 2' }), '#/pro?a=1+2');
});
