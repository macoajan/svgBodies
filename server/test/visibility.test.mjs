import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkVisibility, isVisible, visibilityState } from '../public/visibility.js';
import { checkPauta } from '../public/pauta-schema.js';

const day = { mode: 'auto', from: '2026-11-11T06:00:00+01:00', until: '2026-11-12T00:00:00+01:00' };
const at = s => Date.parse(s);

test('validación de la visibilidad', () => {
  assert.deepEqual(checkVisibility(day), []);
  assert.deepEqual(checkVisibility({ mode: 'show' }), []);
  assert.ok(checkVisibility({ mode: 'siempre' }).includes('mode'));
  assert.ok(checkVisibility({ mode: 'auto', from: '11/11/2026' }).includes('from'));
  assert.ok(checkVisibility({ ...day, until: day.from }).includes('until debe ser posterior a from'));
  assert.ok(checkVisibility({ mode: 'auto', extra: 1 }).length);
});

test('modo automático por fechas', () => {
  assert.equal(isVisible(day, at('2026-11-11T05:59:59+01:00')), false);
  assert.equal(isVisible(day, at('2026-11-11T06:00:00+01:00')), true);
  assert.equal(isVisible(day, at('2026-11-11T23:59:00+01:00')), true);
  assert.equal(isVisible(day, at('2026-11-12T00:00:00+01:00')), false);
  assert.equal(isVisible({ mode: 'auto', from: day.from }, at('2027-01-01T00:00:00Z')), true);
  assert.equal(isVisible(undefined), true);
});

test('los forzados ignoran las fechas', () => {
  const before = at('2026-11-10T12:00:00Z');
  assert.equal(isVisible({ ...day, mode: 'show' }, before), true);
  assert.equal(isVisible({ ...day, mode: 'hide' }, at('2026-11-11T12:00:00+01:00')), false);
  assert.equal(visibilityState(day, before), 'programada');
  assert.equal(visibilityState(day, at('2026-11-13T00:00:00Z')), 'caducada');
  assert.equal(visibilityState({ ...day, mode: 'hide' }, before), 'oculta');
});

test('formato de sesión tipo WOD', () => {
  const wod = { v: 1, kind: 'pauta', title: 'Lunes', format: { type: 'amrap', minutes: 20 },
    items: [{ id: 'burpee', sets: 1, reps: 10 }, { id: 'swing-kettlebell', sets: 1, reps: 15, load: '24 / 16 kg' }] };
  assert.deepEqual(checkPauta(wod), []);
  assert.ok(checkPauta({ ...wod, format: { type: 'crossfit' } }).includes('format.type'));
});
