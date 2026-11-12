import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndex, search, facetCounts, facetOptions, parseFilters, toQuery, fold, kcalPerMin, mainEquipment, FACETS } from '../src/domain/catalogo.js';
import { enrichVocab } from '../../tools/build-app-library.mjs';

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const catalog = enrichVocab(read('../../library/catalog.json'), {
  muscles: read('../../taxonomy/vocab/muscles.json'), equipment: read('../../taxonomy/vocab/equipment.json'),
});
const index = buildIndex(catalog);
const ids = list => list.map(e => e.id);

test('fold quita tildes y mayúsculas', () => assert.equal(fold('Abducción RODILLA'), 'abduccion rodilla'));

test('sin búsqueda ni filtros: todos, por nombre', () => {
  const all = search(index);
  assert.equal(all.length, catalog.exercises.length);
  const names = all.map(e => e.name.es);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'es')));
});

test('búsqueda sin tildes, por varias palabras, y nombre antes que otros campos', () => {
  const r = search(index, { q: 'abduccion cadera' });
  assert.ok(r.length > 0);
  assert.ok(r.every(e => fold(e.name.es + ' ' + e.familyName.es).includes('abduccion')));
  // «gluteo» aparece en nombres y en músculos: primero los que lo llevan en el nombre.
  const g = search(index, { q: 'gluteo' });
  const firstNotInName = g.findIndex(e => !fold(e.name.es).includes('gluteo'));
  if (firstNotInName > 0) assert.ok(g.slice(firstNotInName).every(e => !fold(e.name.es).includes('gluteo')));
  assert.deepEqual(search(index, { q: 'zzzz' }), []);
});

test('filtros: «o» dentro de un filtro, «y» entre filtros', () => {
  const rod = search(index, { filters: { region: ['rodilla'] } });
  const cad = search(index, { filters: { region: ['cadera'] } });
  const both = search(index, { filters: { region: ['rodilla', 'cadera'] } });
  assert.equal(both.length, new Set([...ids(rod), ...ids(cad)]).size);
  const rodN1 = search(index, { filters: { region: ['rodilla'], nivel: ['1'] } });
  assert.ok(rodN1.length <= rod.length && rodN1.every(e => e.level === 1 && e.regions.includes('rodilla')));
});

test('músculo: un grupo incluye a sus músculos hijos', () => {
  const tren = search(index, { filters: { musculo: ['tren-inferior'] } });
  const cuad = search(index, { filters: { musculo: ['cuadriceps'] } });
  assert.ok(ids(cuad).every(id => ids(tren).includes(id)));
});

test('recuentos de un filtro ignoran ese filtro y aplican los demás', () => {
  const st = { filters: { region: ['rodilla'], nivel: ['1'] } };
  const counts = facetCounts(index, st, 'region');
  assert.equal(counts.get('rodilla'), search(index, { filters: { nivel: ['1'], region: ['rodilla'] } }).length);
  assert.equal(counts.get('cadera'), search(index, { filters: { nivel: ['1'], region: ['cadera'] } }).length);
});

test('opciones: orden del vocabulario, solo las usadas, con jerarquía y grupos', () => {
  for (const f of FACETS) assert.ok(facetOptions(catalog, f.key).length > 0, f.key);
  const mus = facetOptions(catalog, 'musculo');
  assert.equal(mus[0].value, 'tren-inferior'); assert.equal(mus[0].depth, 0);
  assert.equal(mus.find(o => o.value === 'cuadriceps').depth, 1);
  const mat = facetOptions(catalog, 'material');
  assert.equal(mat[0].group, 'ninguno');
  assert.ok(mat.every(o => o.group));
  assert.deepEqual(facetOptions(catalog, 'nivel').map(o => o.value), ['1', '2', '3', '4']);
});

test('filtros en la URL: ida y vuelta', () => {
  const st = { q: ' puente ', filters: { region: ['cadera', 'rodilla'], nivel: ['1'] } };
  const q = toQuery(st);
  assert.deepEqual(q, { q: 'puente', region: 'cadera,rodilla', nivel: '1' });
  assert.deepEqual(parseFilters(q), st.filters);
  assert.deepEqual(parseFilters({ region: ',,', otro: 'x' }), {});
});

test('kcal por minuto y material principal', () => {
  assert.equal(kcalPerMin(4, 80), 5.6);
  const ex = catalog.exercises.find(e => e.equipment.includes('esterilla') && e.equipment.length === 1);
  if (ex) assert.equal(mainEquipment(catalog, ex), 'Esterilla');
  assert.equal(mainEquipment(catalog, { equipment: ['peso-corporal'] }), 'Sin material');
  assert.equal(mainEquipment(catalog, { equipment: ['esterilla', 'banda-elastica'] }), catalog.vocab.equipment['banda-elastica']?.es ?? 'banda-elastica');
});
