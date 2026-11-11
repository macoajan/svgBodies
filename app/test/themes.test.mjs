import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES, THEMES_PRO, THEMES_PACIENTE, themeFor } from '../src/themes/themes.js';

test('el paciente siempre tiene un tema de fondo blanco', () => {
  for (const id of THEMES_PACIENTE) assert.equal(THEMES[id].muestra[0], '#FFFFFF', id);
  assert.equal(themeFor('paciente', { temaPaciente: 'C2' }), 'C');
  assert.equal(themeFor('paciente', { temaPaciente: 'C1' }), 'C1');
  assert.equal(themeFor('pro', { temaPro: 'A2' }), 'A1'); // A2 llega en v1.1
  assert.equal(themeFor('pro', null), 'A1');
});

test('cada tema define en CSS los mismos tokens', () => {
  const css = readFileSync(new URL('../src/themes/themes.css', import.meta.url), 'utf8');
  const blocks = [...css.matchAll(/\[data-theme="(\w+)"\]\s*\{([^}]*)\}/g)].map(([, id, body]) => [id, [...body.matchAll(/(--[\w-]+):/g)].map(m => m[1]).sort()]);
  const ids = blocks.map(([id]) => id);
  for (const id of Object.keys(THEMES)) assert.ok(ids.includes(id), `falta ${id}`);
  const ref = blocks[0][1];
  for (const [id, tokens] of blocks) assert.deepEqual(tokens, ref, id);
  for (const id of THEMES_PRO) assert.ok(THEMES[id]);
});
